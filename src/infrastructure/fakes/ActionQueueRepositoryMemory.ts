import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

export class ActionQueueRepositoryMemory implements IActionQueueRepository {
  public items: Map<string, ActionQueueItem> = new Map();
  /** Quando preenchido, o próximo `enfileirar` falha — para testar atomicidade. */
  public falharAoEnfileirar: Error | null = null;

  async enfileirar(item: ActionQueueItem): Promise<void> {
    if (this.falharAoEnfileirar) throw this.falharAoEnfileirar;
    this.items.set(item.id.value, item);
  }

  /** Map preserva a ordem de inserção, que é a ordem de criação. */
  async obterPendentes(): Promise<ActionQueueItem[]> {
    return Array.from(this.items.values());
  }

  async contar(): Promise<number> {
    return this.items.size;
  }

  async remover(id: UUIDv4): Promise<void> {
    this.items.delete(id.value);
  }

  async registrarFalha(id: UUIDv4, mensagem: string): Promise<void> {
    this.items.get(id.value)?.registrarFalha(mensagem);
  }

  async reativarIsolados(): Promise<void> {
    for (const item of this.items.values()) {
      if (item.estaIsolado()) item.reativar();
    }
  }
}
