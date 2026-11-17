import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IArquivoFotoGateway } from '@/domain/gateways/IArquivoFotoGateway';
import { ISessionStorage } from '@/domain/gateways/ISessionStorage';
import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import {
  CHAVE_ULTIMA_SYNC,
  CHAVE_ULTIMO_ERRO,
  ISyncMetaRepository,
} from '@/domain/repositories/ISyncMetaRepository';
import { TipoOperacaoActionQueue } from '@/domain/entities/ActionQueueItem';

export interface ItemDaFilaDTO {
  itemId: string;
  tipo: TipoOperacaoActionQueue;
  /** Descrição em português, para a tela de diagnóstico. */
  descricao: string;
  criadoEm: string;
  tentativas: number;
  isolado: boolean;
  ultimoErro: string | null;
  /** Feito por outra pessoa neste aparelho: sobe quando ela entrar (ADR 10.19). */
  deOutroUsuario: boolean;
}

export interface EstadoSincronizacaoOutput {
  /** O que ainda não subiu de quem está logado, isolados incluídos. */
  pendentes: number;
  isolados: number;
  /** Itens de outras pessoas que usaram o aparelho, esperando o dono. */
  deOutrosUsuarios: number;
  ultimaSincronizacaoEm: string | null;
  ultimoErro: string | null;
  itens: ItemDaFilaDTO[];
}

const DESCRICOES: Record<TipoOperacaoActionQueue, string> = {
  UPSERT_EMPRESA: 'Empresa',
  UPSERT_ENDERECO: 'Endereço',
  EXCLUIR_ENDERECO: 'Exclusão de endereço',
  UPSERT_PADRAO: 'Padrão',
  EXCLUIR_PADRAO: 'Exclusão de padrão',
  UPSERT_USUARIO: 'Usuário',
  EXCLUIR_USUARIO: 'Exclusão de usuário',
  UPSERT_LEITURA: 'Leitura',
  UPSERT_NOTIFICACAO: 'Notificação',
  MARCAR_NOTIFICACOES_LIDAS: 'Notificações lidas',
};

/**
 * O que a interface precisa saber sobre a sincronização: quanto falta subir,
 * quando foi a última vez e o que deu errado. Só lê o banco local.
 */
export class ConsultarEstadoSincronizacaoUseCase {
  constructor(
    private readonly fila: IActionQueueRepository,
    private readonly syncMeta: ISyncMetaRepository,
    private readonly leituraRepo: ILeituraRepository,
    private readonly arquivoFoto: IArquivoFotoGateway,
    private readonly sessionStorage: ISessionStorage,
  ) {}

  public async executar(): Promise<EstadoSincronizacaoOutput> {
    const itens = await this.fila.obterPendentes();
    const sessao = await this.sessionStorage.obterSessao();
    const ehMeu = (i: ActionQueueItem): boolean => !sessao || i.pertenceA(sessao.usuarioId);
    const meus = itens.filter(ehMeu);

    return {
      pendentes: meus.length,
      isolados: meus.filter((i) => i.estaIsolado()).length,
      deOutrosUsuarios: itens.length - meus.length,
      ultimaSincronizacaoEm: await this.syncMeta.obter(CHAVE_ULTIMA_SYNC),
      ultimoErro: await this.syncMeta.obter(CHAVE_ULTIMO_ERRO),
      itens: itens.map((i) => ({
        itemId: i.id.value,
        tipo: i.tipoOperacao,
        descricao: DESCRICOES[i.tipoOperacao],
        criadoEm: i.timestamp.toISOString(),
        tentativas: i.tentativas,
        isolado: i.estaIsolado(),
        ultimoErro: i.ultimoErro,
        deOutroUsuario: !ehMeu(i),
      })),
    };
  }

  /**
   * Devolve à fila automática os itens que estouraram o limite de tentativas.
   * As leituras correspondentes voltam de "não enviada" para "pendente".
   */
  public async tentarDeNovo(): Promise<void> {
    for (const item of await this.fila.obterPendentes()) {
      if (!item.estaIsolado() || item.tipoOperacao !== 'UPSERT_LEITURA' || !item.registroId) {
        continue;
      }

      const leitura = await this.leituraRepo.buscarPorId(item.registroId);
      if (leitura) {
        leitura.marcarPendenteDeEnvio();
        await this.leituraRepo.atualizar(leitura);
      }
    }

    await this.fila.reativarIsolados();
  }

  /**
   * Desiste de um item que o servidor recusou até o limite — por exemplo, a
   * leitura cuja foto sumiu do aparelho e que, sem ela, nunca vai subir.
   *
   * Exceção consciente à regra de nunca apagar o que não subiu (ADR 10.15):
   * o item já não tem como chegar à nuvem, e preso na fila só faria o app
   * dizer "tente mais tarde" para sempre. Por isso vale só para item isolado,
   * e a tela pede confirmação antes.
   *
   * Para uma leitura, ela e a foto saem do aparelho (liberando a vaga do dia).
   * Para os outros tipos, só o item sai da fila; o registro local fica.
   *
   * A ordem não precisa de transação: se o app fechar entre a exclusão da
   * leitura e a do item, o item que sobra aponta para uma leitura que não
   * existe, e o envio o dá por concluído.
   */
  public async descartar(itemId: string): Promise<void> {
    const item = (await this.fila.obterPendentes()).find((i) => i.id.value === itemId);
    if (!item) return;

    if (!item.estaIsolado()) {
      throw new Error('Só um item recusado de vez pode ser descartado');
    }

    if (item.tipoOperacao === 'UPSERT_LEITURA' && item.registroId) {
      const removida = await this.leituraRepo.excluir(item.registroId);
      if (removida?.temFotoNoAparelho()) {
        try {
          await this.arquivoFoto.remover(removida.fotoLocalUri);
        } catch {
          // Arquivo que já não está lá não impede o descarte.
        }
      }
    }

    await this.fila.remover(item.id);
  }
}
