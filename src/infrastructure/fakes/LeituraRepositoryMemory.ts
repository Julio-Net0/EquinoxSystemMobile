import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { StatusSyncEnum } from '@/domain/enums/StatusSyncEnum';

export class LeituraRepositoryMemory implements ILeituraRepository {
  public items: Map<string, Leitura> = new Map();

  async salvar(leitura: Leitura): Promise<void> {
    this.items.set(leitura.id.value, leitura);
  }

  async buscarPorId(id: UUIDv4): Promise<Leitura | null> {
    const item = this.items.get(id.value);
    return item ?? null;
  }

  async listarPorUsina(usinaId: UUIDv4): Promise<Leitura[]> {
    const result: Leitura[] = [];
    for (const leitura of this.items.values()) {
      if (leitura.usinaId.equals(usinaId)) {
        result.push(leitura);
      }
    }
    return result;
  }

  async atualizarStatus(id: UUIDv4, statusSync: StatusSyncEnum, urlRemota?: string): Promise<void> {
    const item = this.items.get(id.value);
    if (!item) {
      throw new Error(`Leitura não encontrada para atualizar status: ${id.value}`);
    }

    if (statusSync === StatusSyncEnum.SINCRONIZADA && urlRemota) {
      item.marcarComoSincronizada(urlRemota);
    } else if (statusSync === StatusSyncEnum.CONFLITO) {
      item.marcarComoConflito();
    } else if (statusSync === StatusSyncEnum.REJEITADA) {
      item.marcarComoRejeitada();
    }
  }
}
