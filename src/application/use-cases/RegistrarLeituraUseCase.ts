import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IPadraoRepository } from '@/domain/repositories/IPadraoRepository';
import { IEnderecoRepository } from '@/domain/repositories/IEnderecoRepository';
import { INotificacaoRepository } from '@/domain/repositories/INotificacaoRepository';
import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { IArquivoFotoGateway } from '@/domain/gateways/IArquivoFotoGateway';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { IRelogio, relogioSistema } from '@/domain/services/Relogio';
import { ReferenciaLeituraService } from '@/domain/services/ReferenciaLeituraService';
import { AvisoValorMenorService } from '@/domain/services/AvisoValorMenorService';
import { RegraSubstituicaoLeituraService } from '@/domain/services/RegraSubstituicaoLeituraService';
import { RegraLocalizacaoLeituraService } from '@/domain/services/RegraLocalizacaoLeituraService';
import { GeradorNotificacoesService } from '@/domain/services/GeradorNotificacoesService';

export interface CoordenadasInput {
  latitude: number;
  longitude: number;
  precisaoMetros?: number;
}

export interface RegistrarLeituraInput {
  padraoId: string;
  usuarioId: string;
  valorConsumo: number;
  /** Obrigatório quando o endereço é usina; ignorado nos demais. */
  valorInjecao?: number | null;
  fotoTemporariaUri: string;
  /** Nulo quando a permissão foi negada ou o GPS não respondeu. */
  coordenadas: CoordenadasInput | null;
  /** O técnico já viu e confirmou o aviso de valor menor. */
  confirmouValorMenor?: boolean;
  /** Só para teste e para registro retroativo; o padrão é agora. */
  medidoEm?: Date;
}

export interface RegistrarLeituraOutput {
  sucesso: boolean;
  leituraId?: string;
  /** Leitura que perdeu a vaga do dia para esta. */
  substituiuLeituraId?: string;
  /** Quando true, a tela mostra `aviso` e chama de novo com confirmouValorMenor. */
  precisaConfirmar?: boolean;
  aviso?: string;
  erro?: string;
}

/**
 * Registra a leitura do medidor — a tarefa central do app.
 *
 * A ordem das etapas é deliberada: validar, perguntar sobre valor menor,
 * só então persistir a foto, e por fim gravar. Comprimir e mover a foto é
 * caro e deixa lixo no armazenamento, então só acontece depois que o registro
 * está decidido.
 */
export class RegistrarLeituraUseCase {
  constructor(
    private readonly leituraRepo: ILeituraRepository,
    private readonly padraoRepo: IPadraoRepository,
    private readonly enderecoRepo: IEnderecoRepository,
    private readonly notificacaoRepo: INotificacaoRepository,
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly arquivoFoto: IArquivoFotoGateway,
    private readonly relogio: IRelogio = relogioSistema,
  ) {}

  public async executar(entrada: RegistrarLeituraInput): Promise<RegistrarLeituraOutput> {
    const padrao = await this.padraoRepo.buscarPorId(new UUIDv4(entrada.padraoId));
    if (!padrao) {
      return { sucesso: false, erro: 'Padrão não encontrado' };
    }

    const endereco = await this.enderecoRepo.buscarPorId(padrao.enderecoId);
    if (!endereco) {
      return { sucesso: false, erro: 'Endereço do padrão não encontrado' };
    }

    if (!entrada.fotoTemporariaUri || entrada.fotoTemporariaUri.trim() === '') {
      return { sucesso: false, erro: 'Foto comprobatória do medidor é obrigatória' };
    }
    if (!Number.isFinite(entrada.valorConsumo) || entrada.valorConsumo < 0) {
      return { sucesso: false, erro: 'Informe um valor de leitura válido' };
    }

    // Injeção só existe em usina: num endereço comum o campo nem é mostrado,
    // então um valor que chegue aqui é descartado em vez de gravado.
    const valorInjecao = endereco.aceitaInjecao() ? (entrada.valorInjecao ?? null) : null;
    if (endereco.aceitaInjecao()) {
      if (valorInjecao === null || !Number.isFinite(valorInjecao) || valorInjecao < 0) {
        return {
          sucesso: false,
          erro: 'Este endereço é uma usina — informe também a leitura de injeção',
        };
      }
    }

    const agora = this.relogio.agora();
    const medidoEm = entrada.medidoEm ?? agora;
    const dataLocal = DataLocal.de(medidoEm);
    const hoje = DataLocal.de(agora);

    // Só leituras vigentes: uma substituída carrega o valor que já foi corrigido.
    const vigentesDoPadrao = await this.leituraRepo.listarVigentesDoPadrao(padrao.id);
    const referencia = ReferenciaLeituraService.selecionar(dataLocal, vigentesDoPadrao);

    const aviso = AvisoValorMenorService.mensagem(entrada.valorConsumo, valorInjecao, referencia);
    if (aviso && !entrada.confirmouValorMenor) {
      return { sucesso: false, precisaConfirmar: true, aviso };
    }

    const coordenadas = entrada.coordenadas
      ? new CoordenadasGPS(
          entrada.coordenadas.latitude,
          entrada.coordenadas.longitude,
          entrada.coordenadas.precisaoMetros,
        )
      : null;

    const leituraId = UUIDv4.gerar();

    let foto;
    try {
      foto = await this.arquivoFoto.comprimirEPersistir(entrada.fotoTemporariaUri, leituraId.value);
    } catch (erro) {
      return { sucesso: false, erro: (erro as Error).message };
    }

    const leitura = new Leitura({
      id: leituraId,
      padraoId: padrao.id,
      usuarioId: new UUIDv4(entrada.usuarioId),
      valorConsumo: new ValorKwh(entrada.valorConsumo),
      valorInjecao: valorInjecao === null ? null : new ValorKwh(valorInjecao),
      fotoLocalUri: foto.uri,
      coordenadas,
      medidoEm,
      dataLocal,
    });

    const substituida = await this.persistir(leitura, agora);

    const localizacao = RegraLocalizacaoLeituraService.avaliar(coordenadas, endereco.coordenadas);
    const autor = await this.usuarioRepo.buscarPorId(leitura.usuarioId);

    const notificacoes = GeradorNotificacoesService.paraLeituraRegistrada({
      leitura,
      referencia,
      substituida,
      localizacao,
      empresaId: endereco.empresaId,
      padraoNumero: padrao.numero,
      enderecoApelido: endereco.apelido,
      autorNome: autor?.nome ?? 'Técnico',
      hoje,
      agora,
    });
    if (notificacoes.length > 0) {
      await this.notificacaoRepo.salvarVarias(notificacoes);
    }

    return {
      sucesso: true,
      leituraId: leitura.id.value,
      substituiuLeituraId: substituida?.id.value,
    };
  }

  /**
   * Resolve a vaga única de (padrão, dia local) e grava.
   *
   * Quando a vigente é mais recente que a nova — registro retroativo, por
   * exemplo — a nova já entra como substituída por ela, em vez de derrubar
   * uma medição posterior.
   */
  private async persistir(leitura: Leitura, agora: Date): Promise<Leitura | null> {
    const vigente = await this.leituraRepo.buscarVigenteDoDia(leitura.padraoId, leitura.dataLocal);

    if (!vigente) {
      await this.leituraRepo.salvar(leitura);
      return null;
    }

    if (RegraSubstituicaoLeituraService.escolherVigente(vigente, leitura) === 'atual') {
      leitura.substituirPor(vigente, agora);
      await this.leituraRepo.salvar(leitura);
      return null;
    }

    RegraSubstituicaoLeituraService.aplicar(vigente, leitura, agora);
    await this.leituraRepo.salvarSubstituindo(leitura, vigente);
    return vigente;
  }
}
