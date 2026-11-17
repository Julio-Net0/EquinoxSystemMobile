import type { SQLiteDatabase } from 'expo-sqlite';
import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { ActionQueueItem, TipoOperacaoActionQueue } from '@/domain/entities/ActionQueueItem';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

interface ActionQueueRow {
  id: string;
  tipo_acao: string;
  payload: string;
  tentativas: number;
  criado_em: string;
  ultimo_erro: string | null;
}

/**
 * Fila de envio (outbox). Cada escrita local que precisa chegar à nuvem deixa
 * uma linha aqui, na mesma transação — ver `repositoriosComFila`.
 */
export class ActionQueueRepositorySQLite implements IActionQueueRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async enfileirar(item: ActionQueueItem): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO action_queue (id, tipo_acao, payload, tentativas, criado_em, ultimo_erro)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        item.id.value,
        item.tipoOperacao,
        item.payloadJSON,
        item.tentativas,
        item.timestamp.toISOString(),
        item.ultimoErro,
      ],
    );
  }

  async obterPendentes(): Promise<ActionQueueItem[]> {
    // rowid desempata itens criados no mesmo milissegundo, na ordem de inserção.
    const rows = await this.db.getAllAsync<ActionQueueRow>(
      'SELECT * FROM action_queue ORDER BY criado_em, rowid',
    );

    return rows.map(
      (row) =>
        new ActionQueueItem({
          id: new UUIDv4(row.id),
          tipoOperacao: row.tipo_acao as TipoOperacaoActionQueue,
          payloadJSON: row.payload,
          tentativas: row.tentativas,
          timestamp: new Date(row.criado_em),
          ultimoErro: row.ultimo_erro,
        }),
    );
  }

  async contar(): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM action_queue',
    );
    return row?.total ?? 0;
  }

  async remover(id: UUIDv4): Promise<void> {
    await this.db.runAsync('DELETE FROM action_queue WHERE id = ?', [id.value]);
  }

  async registrarFalha(id: UUIDv4, mensagem: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE action_queue SET tentativas = tentativas + 1, ultimo_erro = ? WHERE id = ?',
      [mensagem, id.value],
    );
  }

  async reativarIsolados(): Promise<void> {
    await this.db.runAsync(
      'UPDATE action_queue SET tentativas = 0, ultimo_erro = NULL WHERE tentativas >= ?',
      [ActionQueueItem.MAX_TENTATIVAS],
    );
  }
}
