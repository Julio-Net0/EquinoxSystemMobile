import { IUsinaRepository } from '@/domain/repositories/IUsinaRepository';
import { Usina } from '@/domain/entities/Usina';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

export class UsinaRepositoryMemory implements IUsinaRepository {
  public items: Map<string, Usina> = new Map();

  async salvar(usina: Usina): Promise<void> {
    this.items.set(usina.id.value, usina);
  }

  async buscarPorId(id: UUIDv4): Promise<Usina | null> {
    const item = this.items.get(id.value);
    return item ?? null;
  }

  async listarPorEmpresa(empresaId: UUIDv4): Promise<Usina[]> {
    const result: Usina[] = [];
    for (const usina of this.items.values()) {
      if (usina.empresaId.equals(empresaId)) {
        result.push(usina);
      }
    }
    return result;
  }

  async listarTodas(): Promise<Usina[]> {
    return Array.from(this.items.values());
  }

  async atualizar(usina: Usina): Promise<void> {
    this.items.set(usina.id.value, usina);
  }
}
