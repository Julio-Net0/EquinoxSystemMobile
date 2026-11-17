import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { IEmpresaRepository } from '@/domain/repositories/IEmpresaRepository';
import { IEnderecoRepository } from '@/domain/repositories/IEnderecoRepository';
import { IPadraoRepository } from '@/domain/repositories/IPadraoRepository';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { INotificacaoRepository } from '@/domain/repositories/INotificacaoRepository';
import { ISincronizacaoRemotaGateway } from '@/domain/gateways/ISincronizacaoRemotaGateway';
import { IArquivoFotoGateway } from '@/domain/gateways/IArquivoFotoGateway';
import {
  MotivoFalhaRemota,
  ResultadoRemoto,
  remotoFalhou,
  remotoOk,
} from '@/domain/gateways/ResultadoRemoto';
import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CaminhoComprovanteService } from '@/domain/services/CaminhoComprovanteService';

/**
 * Repositórios "crus": o processador lê o estado atual e marca a leitura como
 * sincronizada sem passar pela fila — senão a confirmação de um envio geraria
 * outro envio, para sempre.
 */
export interface RepositoriosDoEnvio {
  empresa: IEmpresaRepository;
  endereco: IEnderecoRepository;
  padrao: IPadraoRepository;
  leitura: ILeituraRepository;
  usuario: IUsuarioRepository;
  notificacao: INotificacaoRepository;
}

export interface ProcessarFilaOutput {
  enviados: number;
  /** Recusados nesta rodada (continuam na fila até o limite de tentativas). */
  recusados: number;
  /** Fora da fila automática, aguardando nova tentativa manual. */
  isolados: number;
  /** O que sobrou na fila ao fim da rodada, isolados incluídos. */
  restantes: number;
  /** Preenchido quando a rodada parou no meio por falta de rede ou de sessão. */
  interrompidoPor?: Exclude<MotivoFalhaRemota, 'rejeitado'>;
}

/**
 * Push: esvazia a fila de envio, em ordem de criação.
 *
 * Regras que sustentam a sincronização:
 *
 * 1. **Foto antes da linha.** O comprovante sobe para o armazenamento antes de
 *    a leitura ser gravada no banco remoto. Se a rede cair no meio, sobra uma
 *    foto órfã — nunca uma leitura sem comprovante.
 * 2. **Idempotência.** Todo envio é um upsert pelo UUID, e o item só sai da
 *    fila depois da confirmação. Repetir após uma queda não duplica.
 * 3. **Rede não é culpa do dado.** Sem conexão (ou sem sessão), a rodada para
 *    e nada conta como tentativa. Só a recusa do servidor conta.
 * 4. **Um item ruim não trava os outros.** Depois de
 *    `ActionQueueItem.MAX_TENTATIVAS` recusas ele fica isolado e a fila segue.
 */
export class ProcessarFilaSincronizacaoUseCase {
  constructor(
    private readonly fila: IActionQueueRepository,
    private readonly repos: RepositoriosDoEnvio,
    private readonly remoto: ISincronizacaoRemotaGateway,
    private readonly arquivoFoto: IArquivoFotoGateway,
  ) {}

  public async executar(): Promise<ProcessarFilaOutput> {
    const saida: ProcessarFilaOutput = { enviados: 0, recusados: 0, isolados: 0, restantes: 0 };

    for (const item of await this.fila.obterPendentes()) {
      if (item.estaIsolado()) {
        saida.isolados += 1;
        continue;
      }

      const resultado = await this.enviar(item);

      if (resultado.ok) {
        await this.fila.remover(item.id);
        saida.enviados += 1;
        continue;
      }

      if (resultado.motivo !== 'rejeitado') {
        saida.interrompidoPor = resultado.motivo;
        break;
      }

      // Conta feita antes de gravar, sem mexer no item: quem registra a recusa
      // é o repositório, e o item em mãos pode ser a mesma instância dele.
      const estourouOLimite = item.tentativas + 1 >= ActionQueueItem.MAX_TENTATIVAS;
      await this.fila.registrarFalha(item.id, resultado.mensagem);
      saida.recusados += 1;

      if (estourouOLimite) {
        saida.isolados += 1;
        await this.marcarLeituraComFalha(item);
      }
    }

    saida.restantes = await this.fila.contar();
    return saida;
  }

  private async enviar(item: ActionQueueItem): Promise<ResultadoRemoto> {
    const id = item.registroId;

    try {
      switch (item.tipoOperacao) {
        case 'UPSERT_LEITURA':
          return await this.enviarLeitura(id);
        case 'UPSERT_NOTIFICACAO':
          return await this.enviarSeExistir(id, (i) => this.repos.notificacao.buscarPorId(i), (n) =>
            this.remoto.enviarNotificacao(n),
          );
        case 'MARCAR_NOTIFICACOES_LIDAS':
          return await this.remoto.marcarNotificacoesLidas(id);
        case 'UPSERT_EMPRESA':
          return await this.enviarSeExistir(id, (i) => this.repos.empresa.buscarPorId(i), (e) =>
            this.remoto.enviarEmpresa(e),
          );
        case 'UPSERT_ENDERECO':
          return await this.enviarSeExistir(id, (i) => this.repos.endereco.buscarPorId(i), (e) =>
            this.remoto.enviarEndereco(e),
          );
        case 'UPSERT_PADRAO':
          return await this.enviarSeExistir(id, (i) => this.repos.padrao.buscarPorId(i), (p) =>
            this.remoto.enviarPadrao(p),
          );
        case 'UPSERT_USUARIO':
          return await this.enviarSeExistir(id, (i) => this.repos.usuario.buscarPorId(i), (u) =>
            this.remoto.enviarUsuario(u),
          );
        case 'EXCLUIR_ENDERECO':
          return id ? await this.remoto.excluirEndereco(id) : remotoOk();
        case 'EXCLUIR_PADRAO':
          return id ? await this.remoto.excluirPadrao(id) : remotoOk();
        case 'EXCLUIR_USUARIO':
          return id ? await this.remoto.excluirUsuario(id) : remotoOk();
        default:
          return remotoFalhou('rejeitado', `Operação desconhecida: ${item.tipoOperacao as string}`);
      }
    } catch (erro) {
      // Erro inesperado ao montar o envio conta como recusa: repetir igual
      // daria no mesmo, e o item não pode travar a fila.
      return remotoFalhou('rejeitado', (erro as Error).message);
    }
  }

  /**
   * Registro que não existe mais no aparelho (apagado depois de enfileirado)
   * não tem o que enviar: o item sai da fila como concluído.
   */
  private async enviarSeExistir<T>(
    id: UUIDv4 | null,
    buscar: (id: UUIDv4) => Promise<T | null>,
    enviar: (registro: T) => Promise<ResultadoRemoto>,
  ): Promise<ResultadoRemoto> {
    const registro = id ? await buscar(id) : null;
    return registro ? enviar(registro) : remotoOk();
  }

  private async enviarLeitura(id: UUIDv4 | null): Promise<ResultadoRemoto> {
    const leitura = id ? await this.repos.leitura.buscarPorId(id) : null;
    if (!leitura) return remotoOk();

    const fotoPath = leitura.fotoRemotaPath ?? (await this.subirFoto(leitura));
    if (typeof fotoPath !== 'string') return fotoPath;

    const envio = await this.remoto.enviarLeitura(leitura, fotoPath);
    if (!envio.ok) return envio;

    leitura.marcarSincronizada(fotoPath);
    await this.repos.leitura.atualizar(leitura);
    return remotoOk();
  }

  /** Sobe o comprovante e devolve o caminho remoto, ou a falha. */
  private async subirFoto(leitura: Leitura): Promise<string | ResultadoRemoto> {
    const padrao = await this.repos.padrao.buscarPorId(leitura.padraoId);
    const endereco = padrao ? await this.repos.endereco.buscarPorId(padrao.enderecoId) : null;
    if (!padrao || !endereco) {
      return remotoFalhou('rejeitado', 'O padrão desta leitura não existe mais neste aparelho');
    }

    if (!leitura.temFotoNoAparelho() || !(await this.arquivoFoto.existe(leitura.fotoLocalUri))) {
      return remotoFalhou(
        'rejeitado',
        'A foto do medidor não foi encontrada no aparelho, e sem ela a leitura não pode subir',
      );
    }

    const fotoPath = CaminhoComprovanteService.de(endereco.empresaId, endereco.id, leitura.id);
    const upload = await this.remoto.enviarFoto(fotoPath, leitura.fotoLocalUri);
    return upload.ok ? fotoPath : upload;
  }

  private async marcarLeituraComFalha(item: ActionQueueItem): Promise<void> {
    if (item.tipoOperacao !== 'UPSERT_LEITURA' || !item.registroId) return;

    const leitura = await this.repos.leitura.buscarPorId(item.registroId);
    if (!leitura) return;

    leitura.marcarFalhaDeEnvio();
    await this.repos.leitura.atualizar(leitura);
  }
}
