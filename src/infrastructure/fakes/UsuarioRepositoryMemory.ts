import {
  IUsuarioRepository,
  ListarUsuariosFiltroDTO,
} from '@/domain/repositories/IUsuarioRepository';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';

export class UsuarioRepositoryMemory implements IUsuarioRepository {
  public items: Map<string, Usuario> = new Map();

  async salvar(usuario: Usuario): Promise<void> {
    this.items.set(usuario.id.value, usuario);
  }

  async atualizar(usuario: Usuario): Promise<void> {
    this.items.set(usuario.id.value, usuario);
  }

  async buscarPorId(id: UUIDv4): Promise<Usuario | null> {
    return this.items.get(id.value) ?? null;
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const procurado = email.trim().toLowerCase();
    return Array.from(this.items.values()).find((u) => u.email === procurado) ?? null;
  }

  async buscarPorLogin(emailOuUsuario: string): Promise<Usuario | null> {
    const procurado = emailOuUsuario.trim().toLowerCase();
    return (
      Array.from(this.items.values()).find(
        (u) => u.email === procurado || u.usuario === procurado,
      ) ?? null
    );
  }

  async listarPorEmpresa(empresaId: UUIDv4): Promise<Usuario[]> {
    return Array.from(this.items.values()).filter((u) => u.empresaId?.equals(empresaId));
  }

  async listarPendentes(empresaId?: UUIDv4): Promise<Usuario[]> {
    return Array.from(this.items.values()).filter(
      (u) =>
        u.status === StatusUsuarioEnum.PENDENTE &&
        (!empresaId || (u.empresaId?.equals(empresaId) ?? false)),
    );
  }

  async listarComFiltros(filtros: ListarUsuariosFiltroDTO): Promise<Usuario[]> {
    const termo = filtros.termoBusca?.trim().toLowerCase();

    return Array.from(this.items.values()).filter((u) => {
      if (filtros.empresaId && !(u.empresaId?.equals(filtros.empresaId) ?? false)) return false;
      if (filtros.status && u.status !== filtros.status) return false;
      if (filtros.perfil && u.perfil !== filtros.perfil) return false;
      if (termo) {
        const alvo = `${u.nome} ${u.email} ${u.usuario}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }

  async excluir(id: UUIDv4): Promise<void> {
    this.items.delete(id.value);
  }
}
