import { ISyncMetaRepository } from '@/domain/repositories/ISyncMetaRepository';

export class SyncMetaRepositoryMemory implements ISyncMetaRepository {
  public items: Map<string, string | null> = new Map();

  async obter(chave: string): Promise<string | null> {
    return this.items.get(chave) ?? null;
  }

  async definir(chave: string, valor: string | null): Promise<void> {
    this.items.set(chave, valor);
  }
}
