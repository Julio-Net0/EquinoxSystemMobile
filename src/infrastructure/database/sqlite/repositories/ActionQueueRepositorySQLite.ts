import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { ActionQueueItem, TipoOperacaoActionQueue } from '@/domain/entities/ActionQueueItem';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { SQLiteDatabaseManager } from '../SQLiteDatabaseManager';
import { ActionQueueRepositoryMemory } from '@/infrastructure/fakes/ActionQueueRepositoryMemory';

export class ActionQueueRepositorySQLite implements IActionQueueRepository {
  private fallbackMemory = new ActionQueueRepositoryMemory();

  async enfileirar(item: ActionQueueItem): Promise<void> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      await this.fallbackMemory.enfileirar(item);
      return;
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO action_queue (id, tipo_acao, payload, tentativas, criado_em)
       VALUES (?, ?, ?, ?, ?)`,
      [
        item.id.value,
        item.tipoOperacao,
        item.payloadJSON,
        item.tentativas,
        item.timestamp.toISOString(),
      ]
    );
  }

  async obterPendentes(): Promise<ActionQueueItem[]> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return this.fallbackMemory.obterPendentes();
    }

    const rows = (await db.getAllAsync('SELECT * FROM action_queue ORDER BY criado_em ASC')) as any[];
    return (rows || []).map(
      (row: any) =>
        new ActionQueueItem({
          id: new UUIDv4(row.id),
          tipoOperacao: row.tipo_acao as TipoOperacaoActionQueue,
          payloadJSON: row.payload,
          tentativas: row.tentativas,
          timestamp: new Date(row.criado_em),
        })
    );
  }

  async remover(id: UUIDv4): Promise<void> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      await this.fallbackMemory.remover(id);
      return;
    }

    await db.runAsync('DELETE FROM action_queue WHERE id = ?', [id.value]);
  }

  async incrementarTentativas(id: UUIDv4): Promise<void> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      await this.fallbackMemory.incrementarTentativas(id);
      return;
    }

    await db.runAsync('UPDATE action_queue SET tentativas = tentativas + 1 WHERE id = ?', [id.value]);
  }
}
