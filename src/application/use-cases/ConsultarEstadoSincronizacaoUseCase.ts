import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
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
}

export interface EstadoSincronizacaoOutput {
  /** Tudo o que ainda não subiu, isolados incluídos. */
  pendentes: number;
  isolados: number;
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
  ) {}

  public async executar(): Promise<EstadoSincronizacaoOutput> {
    const itens = await this.fila.obterPendentes();

    return {
      pendentes: itens.length,
      isolados: itens.filter((i) => i.estaIsolado()).length,
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
}
