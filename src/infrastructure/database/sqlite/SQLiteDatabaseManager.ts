export class SQLiteDatabaseManager {
  private static instance: any = null;

  public static async getDatabase(): Promise<any | null> {
    if (this.instance) {
      return this.instance;
    }

    try {
      // Import dinâmico com fallback para compatibilidade com ambiente Node/Jest
      const SQLite = require('expo-sqlite');
      if (SQLite && typeof SQLite.openDatabaseAsync === 'function') {
        this.instance = await SQLite.openDatabaseAsync('equinox_mobile.db');
        return this.instance;
      }
    } catch {
      // Fallback gracioso para modo de teste em memória desacoplado
    }

    return null;
  }

  public static async resetDatabase(): Promise<void> {
    this.instance = null;
  }
}
