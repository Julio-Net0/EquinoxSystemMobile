import { Usuario } from '../entities/Usuario';
import { UUIDv4 } from '../value-objects/UUIDv4';

export interface ListarUsuariosFiltroDTO {
  empresaId?: UUIDv4;
  status?: string;
  perfil?: PerfilEnum;
  termoBusca?: string;
}

export interface IUsuarioRepository {
  salvar(usuario: Usuario): Promise<void>;
  buscarPorId(id: UUIDv4): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;
  listarPorEmpresa(empresaId: UUIDv4): Promise<Usuario[]>;
  listarPendentes(empresaId?: UUIDv4): Promise<Usuario[]>;
  listarComFiltros(filtros: ListarUsuariosFiltroDTO): Promise<Usuario[]>;
  excluir(id: UUIDv4): Promise<void>;
}

