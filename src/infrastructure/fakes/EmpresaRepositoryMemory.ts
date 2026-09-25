import { IEmpresaRepository } from '@/domain/repositories/IEmpresaRepository';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

export class EmpresaRepositoryMemory implements IEmpresaRepository {
  public items: Map<string, Empresa> = new Map();

  async salvar(empresa: Empresa): Promise<void> {
    this.items.set(empresa.id.value, empresa);
  }

  async buscarPorId(id: UUIDv4): Promise<Empresa | null> {
    const item = this.items.get(id.value);
    return item ?? null;
  }

  async listarTodas(): Promise<Empresa[]> {
    return Array.from(this.items.values());
  }
}
