import { Endereco } from '../entities/Endereco';
import { UUIDv4 } from '../value-objects/UUIDv4';

export interface IEnderecoRepository {
  salvar(endereco: Endereco): Promise<void>;
  atualizar(endereco: Endereco): Promise<void>;
  buscarPorId(id: UUIDv4): Promise<Endereco | null>;
  listarPorEmpresa(empresaId: UUIDv4): Promise<Endereco[]>;
  listarTodos(): Promise<Endereco[]>;

  /** Endereços vinculados ao usuário (relação N:N). */
  listarPorUsuario(usuarioId: UUIDv4): Promise<Endereco[]>;

  excluir(id: UUIDv4): Promise<void>;
}
