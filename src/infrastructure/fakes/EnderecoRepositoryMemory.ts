import { IEnderecoRepository } from '@/domain/repositories/IEnderecoRepository';
import { Endereco } from '@/domain/entities/Endereco';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

export class EnderecoRepositoryMemory implements IEnderecoRepository {
  public items: Map<string, Endereco> = new Map();
  /** Relação N:N usuario -> endereços, espelhando a tabela usuario_enderecos. */
  public vinculos: Map<string, Set<string>> = new Map();

  async salvar(endereco: Endereco): Promise<void> {
    this.items.set(endereco.id.value, endereco);
  }

  async atualizar(endereco: Endereco): Promise<void> {
    this.items.set(endereco.id.value, endereco);
  }

  async buscarPorId(id: UUIDv4): Promise<Endereco | null> {
    return this.items.get(id.value) ?? null;
  }

  async listarPorEmpresa(empresaId: UUIDv4): Promise<Endereco[]> {
    return Array.from(this.items.values()).filter((e) => e.empresaId.equals(empresaId));
  }

  async listarTodos(): Promise<Endereco[]> {
    return Array.from(this.items.values());
  }

  async listarPorUsuario(usuarioId: UUIDv4): Promise<Endereco[]> {
    const ids = this.vinculos.get(usuarioId.value) ?? new Set<string>();
    return Array.from(ids)
      .map((id) => this.items.get(id))
      .filter((e): e is Endereco => e !== undefined);
  }

  async excluir(id: UUIDv4): Promise<void> {
    this.items.delete(id.value);
    this.vinculos.forEach((ids) => ids.delete(id.value));
  }

  /** Atalho de teste: define os vínculos de um usuário. */
  public vincular(usuarioId: UUIDv4, enderecoIds: UUIDv4[]): void {
    this.vinculos.set(usuarioId.value, new Set(enderecoIds.map((i) => i.value)));
  }
}
