import { SQLiteDatabaseManager } from './SQLiteDatabaseManager';

export class MigrationRunner {
  public static async runMigrations(): Promise<boolean> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return false;
    }

    try {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS empresas (
          id TEXT PRIMARY KEY NOT NULL,
          nome TEXT NOT NULL,
          cnpj TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS usuarios (
          id TEXT PRIMARY KEY NOT NULL,
          empresa_id TEXT NOT NULL,
          nome TEXT NOT NULL,
          usuario TEXT,
          email TEXT NOT NULL UNIQUE,
          perfil TEXT NOT NULL,
          status TEXT NOT NULL,
          usinas_vinculadas TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        );

        CREATE TABLE IF NOT EXISTS usinas (
          id TEXT PRIMARY KEY NOT NULL,
          empresa_id TEXT NOT NULL,
          nome TEXT NOT NULL,
          codigo_uc TEXT NOT NULL,
          capacidade_nominal REAL NOT NULL,
          latitude REAL,
          longitude REAL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        );

        CREATE TABLE IF NOT EXISTS leituras (
          id TEXT PRIMARY KEY NOT NULL,
          usina_id TEXT NOT NULL,
          usuario_id TEXT NOT NULL,
          valor_kwh REAL NOT NULL,
          foto_local_uri TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          data_hora TEXT NOT NULL,
          status_sync TEXT NOT NULL DEFAULT 'Pendente',
          created_at TEXT NOT NULL,
          FOREIGN KEY (usina_id) REFERENCES usinas(id)
        );

        CREATE TABLE IF NOT EXISTS action_queue (
          id TEXT PRIMARY KEY NOT NULL,
          tipo_acao TEXT NOT NULL,
          payload TEXT NOT NULL,
          tentativas INTEGER NOT NULL DEFAULT 0,
          criado_em TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_leituras_status_sync ON leituras(status_sync);
        CREATE INDEX IF NOT EXISTS idx_action_queue_criado_em ON action_queue(criado_em);
      `);
      return true;
    } catch (err) {
      console.error('Erro ao executar migrações SQLite:', err);
      return false;
    }
  }
}
