import { ActionQueueItem } from '../entities/ActionQueueItem';
import { UUIDv4 } from '../value-objects/UUIDv4';

/**
 * Fila de envio (outbox): toda escrita local que precisa chegar à nuvem deixa
 * um item aqui, na mesma transação da escrita.
 */
export interface IActionQueueRepository {
  enfileirar(item: ActionQueueItem): Promise<void>;
  /** Todos os itens, em ordem de criação — inclusive os isolados. */
  obterPendentes(): Promise<ActionQueueItem[]>;
  contar(): Promise<number>;
  remover(id: UUIDv4): Promise<void>;
  /** Conta uma recusa e guarda o motivo, para a tela poder explicá-lo. */
  registrarFalha(id: UUIDv4, mensagem: string): Promise<void>;
  /** Devolve os itens isolados à fila (tentativa manual). */
  reativarIsolados(): Promise<void>;
}
