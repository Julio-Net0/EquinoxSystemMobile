import { ActionQueueItem } from '../entities/ActionQueueItem';
import { UUIDv4 } from '../value-objects/UUIDv4';

export interface IActionQueueRepository {
  enfileirar(item: ActionQueueItem): Promise<void>;
  obterPendentes(): Promise<ActionQueueItem[]>;
  remover(id: UUIDv4): Promise<void>;
  incrementarTentativas(id: UUIDv4): Promise<void>;
}
