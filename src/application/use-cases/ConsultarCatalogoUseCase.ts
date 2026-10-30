import { IEnderecoRepository } from '@/domain/repositories/IEnderecoRepository';
import { IPadraoRepository } from '@/domain/repositories/IPadraoRepository';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

export interface UltimaLeituraDTO {
  valorConsumo: number;
  valorInjecao: number | null;
  dataLocal: string;
}

export interface PadraoCatalogoDTO {
  padraoId: string;
  numero: string;
  ultimaLeitura: UltimaLeituraDTO | null;
}

export interface EnderecoCatalogoDTO {
  enderecoId: string;
  apelido: string;
  uc: string;
  ehUsina: boolean;
  logradouro: string;
  temGeocerca: boolean;
  padroes: PadraoCatalogoDTO[];
}

export interface ConsultarCatalogoInput {
  usuarioId: string;
}

export interface ConsultarCatalogoOutput {
  enderecos: EnderecoCatalogoDTO[];
}

/**
 * Tudo que a tela de leitura precisa: os endereços do técnico, seus padrões e
 * a última leitura de cada um — que é a referência do aviso de valor menor.
 *
 * Substitui o ConsultarUsinasUseCase do modelo antigo.
 */
export class ConsultarCatalogoUseCase {
  constructor(
    private readonly enderecoRepo: IEnderecoRepository,
    private readonly padraoRepo: IPadraoRepository,
    private readonly leituraRepo: ILeituraRepository,
  ) {}

  public async executar(entrada: ConsultarCatalogoInput): Promise<ConsultarCatalogoOutput> {
    const enderecos = await this.enderecoRepo.listarPorUsuario(new UUIDv4(entrada.usuarioId));
    if (enderecos.length === 0) return { enderecos: [] };

    // Em lote, para não disparar uma consulta por endereço.
    const padroes = await this.padraoRepo.listarPorEnderecos(enderecos.map((e) => e.id));

    const catalogo: EnderecoCatalogoDTO[] = [];
    for (const endereco of enderecos) {
      const doEndereco = padroes.filter((p) => p.enderecoId.equals(endereco.id));

      const padroesDTO: PadraoCatalogoDTO[] = [];
      for (const padrao of doEndereco) {
        padroesDTO.push({
          padraoId: padrao.id.value,
          numero: padrao.numero,
          ultimaLeitura: await this.ultimaLeitura(padrao.id),
        });
      }

      catalogo.push({
        enderecoId: endereco.id.value,
        apelido: endereco.apelido,
        uc: endereco.uc,
        ehUsina: endereco.ehUsina,
        logradouro: endereco.logradouro(),
        temGeocerca: endereco.temGeocerca(),
        padroes: padroesDTO,
      });
    }

    return { enderecos: catalogo };
  }

  /** Só vigentes: uma substituída carrega o valor que já foi corrigido. */
  private async ultimaLeitura(padraoId: UUIDv4): Promise<UltimaLeituraDTO | null> {
    const vigentes = await this.leituraRepo.listarVigentesDoPadrao(padraoId);
    if (vigentes.length === 0) return null;

    const ultima = vigentes.reduce((a, b) => (b.medidoEm.getTime() > a.medidoEm.getTime() ? b : a));

    return {
      valorConsumo: ultima.valorConsumo.valor,
      valorInjecao: ultima.valorInjecao?.valor ?? null,
      dataLocal: ultima.dataLocal.value,
    };
  }
}
