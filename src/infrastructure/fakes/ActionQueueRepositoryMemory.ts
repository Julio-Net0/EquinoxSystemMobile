import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

export class ActionQueueRepositoryMemory implements IActionQueueRepository {
  public items: Map<string, ActionQueueItem> = new Map();

  async enfileirar(item: ActionQueueItem): Promise<void> {
    this.items.set(item.id.value, item);
  }

  async obterPendentes(): Promise<ActionQueueItem[]> {
    return Array.from(this.items.values());
  }

  async remover(id: UUIDv4): Promise<void> {
    this.items.delete(id.value);
  }

  async incrementarTentativas(id: UUIDv4): Promise<void> {
    const item = this.items.get(id.value);
    if (item) {
      item.incrementarTentativa();
    }
  }
}
