import { IPadraoRepository } from '@/domain/repositories/IPadraoRepository';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

export class PadraoRepositoryMemory implements IPadraoRepository {
  public items: Map<string, PadraoCemig> = new Map();

  async salvar(padrao: PadraoCemig): Promise<void> {
    this.items.set(padrao.id.value, padrao);
  }

  async atualizar(padrao: PadraoCemig): Promise<void> {
    this.items.set(padrao.id.value, padrao);
  }

  async buscarPorId(id: UUIDv4): Promise<PadraoCemig | null> {
    return this.items.get(id.value) ?? null;
  }

  async listarPorEndereco(enderecoId: UUIDv4): Promise<PadraoCemig[]> {
    return Array.from(this.items.values()).filter((p) => p.enderecoId.equals(enderecoId));
  }

  async listarPorEnderecos(enderecoIds: UUIDv4[]): Promise<PadraoCemig[]> {
    const procurados = new Set(enderecoIds.map((i) => i.value));
    return Array.from(this.items.values()).filter((p) => procurados.has(p.enderecoId.value));
  }

  async excluir(id: UUIDv4): Promise<void> {
    this.items.delete(id.value);
  }
}
