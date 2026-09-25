import { Usuario } from '../entities/Usuario';
import { UUIDv4 } from '../value-objects/UUIDv4';

export interface IUsuarioRepository {
  salvar(usuario: Usuario): Promise<void>;
  buscarPorId(id: UUIDv4): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;
  listarPorEmpresa(empresaId: UUIDv4): Promise<Usuario[]>;
}
