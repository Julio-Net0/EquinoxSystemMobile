import { Usuario } from '../entities/Usuario';
import { UUIDv4 } from '../value-objects/UUIDv4';
import { PerfilEnum } from '../enums/PerfilEnum';
import { StatusUsuarioEnum } from '../enums/StatusUsuarioEnum';

export interface ListarUsuariosFiltroDTO {
  empresaId?: UUIDv4;
  status?: StatusUsuarioEnum;
  perfil?: PerfilEnum;
  termoBusca?: string;
}

export interface IUsuarioRepository {
  salvar(usuario: Usuario): Promise<void>;
  atualizar(usuario: Usuario): Promise<void>;
  buscarPorId(id: UUIDv4): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;

  /** Autenticação aceita e-mail ou login, como no app antigo. */
  buscarPorLogin(emailOuUsuario: string): Promise<Usuario | null>;

  listarPorEmpresa(empresaId: UUIDv4): Promise<Usuario[]>;
  listarPendentes(empresaId?: UUIDv4): Promise<Usuario[]>;
  listarComFiltros(filtros: ListarUsuariosFiltroDTO): Promise<Usuario[]>;
  excluir(id: UUIDv4): Promise<void>;
}
