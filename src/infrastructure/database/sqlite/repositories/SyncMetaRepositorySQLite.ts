import type { SQLiteDatabase } from 'expo-sqlite';
import { ISyncMetaRepository } from '@/domain/repositories/ISyncMetaRepository';

export class SyncMetaRepositorySQLite implements ISyncMetaRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async obter(chave: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ valor: string | null }>(
      'SELECT valor FROM sync_meta WHERE chave = ?',
      [chave],
    );
    return row?.valor ?? null;
  }

  async definir(chave: string, valor: string | null): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO sync_meta (chave, valor) VALUES (?, ?)
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
      [chave, valor],
    );
  }
}
