import { SyncManager } from './SyncManager';

export class NetworkMonitor {
  private isOnline = true;
  private listeners: ((online: boolean) => void)[] = [];

  constructor(private syncManager?: SyncManager) {}

  public getConectividadeAtual(): boolean {
    return this.isOnline;
  }

  public subscrever(listener: (online: boolean) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public async simularMudancaRede(online: boolean): Promise<void> {
    const eraOffline = !this.isOnline;
    this.isOnline = online;

    this.listeners.forEach((l) => l(online));

    // Se a conexão foi reestabelecida (Offline -> Online), dispara o SyncManager
    if (eraOffline && online && this.syncManager) {
      await this.syncManager.processarFilaPush();
    }
  }
}
