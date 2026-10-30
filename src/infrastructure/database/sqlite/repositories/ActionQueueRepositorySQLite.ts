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
}

/**
 * Fila de ações reservada pelo AGENTS.md seção 6. Sem nuvem ela não tem
 * consumidor: nada enfileira hoje. Fica implementada para quando houver
 * backend, e a decisão está registrada em docs/decisions.md.
 */
export class ActionQueueRepositorySQLite implements IActionQueueRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async enfileirar(item: ActionQueueItem): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO action_queue (id, tipo_acao, payload, tentativas, criado_em)
       VALUES (?, ?, ?, ?, ?)`,
      [item.id.value, item.tipoOperacao, item.payloadJSON, item.tentativas, item.timestamp.toISOString()],
    );
  }

  async obterPendentes(): Promise<ActionQueueItem[]> {
    const rows = await this.db.getAllAsync<ActionQueueRow>(
      'SELECT * FROM action_queue ORDER BY criado_em',
    );

    return rows.map(
      (row) =>
        new ActionQueueItem({
          id: new UUIDv4(row.id),
          tipoOperacao: row.tipo_acao as TipoOperacaoActionQueue,
          payloadJSON: row.payload,
          tentativas: row.tentativas,
          timestamp: new Date(row.criado_em),
        }),
    );
  }

  async remover(id: UUIDv4): Promise<void> {
    await this.db.runAsync('DELETE FROM action_queue WHERE id = ?', [id.value]);
  }

  async incrementarTentativas(id: UUIDv4): Promise<void> {
    await this.db.runAsync('UPDATE action_queue SET tentativas = tentativas + 1 WHERE id = ?', [
      id.value,
    ]);
  }
}
