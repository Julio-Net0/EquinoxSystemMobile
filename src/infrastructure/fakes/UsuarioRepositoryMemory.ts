import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

export class UsuarioRepositoryMemory implements IUsuarioRepository {
  public items: Map<string, Usuario> = new Map();

  async salvar(usuario: Usuario): Promise<void> {
    this.items.set(usuario.id.value, usuario);
  }

  async buscarPorId(id: UUIDv4): Promise<Usuario | null> {
    const item = this.items.get(id.value);
    return item ?? null;
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const cleanEmail = email.toLowerCase().trim();
    for (const usuario of this.items.values()) {
      if (usuario.email.toLowerCase() === cleanEmail) {
        return usuario;
      }
    }
    return null;
  }

  async listarPorEmpresa(empresaId: UUIDv4): Promise<Usuario[]> {
    const result: Usuario[] = [];
    for (const usuario of this.items.values()) {
      if (usuario.empresaId.equals(empresaId)) {
        result.push(usuario);
      }
    }
    return result;
  }

  async listarPendentes(empresaId?: UUIDv4): Promise<Usuario[]> {
    const result: Usuario[] = [];
    for (const usuario of this.items.values()) {
      if (usuario.status === 'Pendente') {
        if (!empresaId || usuario.empresaId.equals(empresaId)) {
          result.push(usuario);
        }
      }
    }
    return result;
  }

  async listarComFiltros(filtros: {
    empresaId?: UUIDv4;
    status?: string;
    perfil?: PerfilEnum;
    termoBusca?: string;
  }): Promise<Usuario[]> {
    let result = Array.from(this.items.values());

    if (filtros.empresaId) {
      result = result.filter((u) => u.empresaId.equals(filtros.empresaId!));
    }
    if (filtros.status) {
      result = result.filter((u) => u.status.toLowerCase() === filtros.status!.toLowerCase());
    }
    if (filtros.perfil) {
      result = result.filter((u) => u.perfil === filtros.perfil);
    }
    if (filtros.termoBusca) {
      const termo = filtros.termoBusca.toLowerCase().trim();
      result = result.filter(
        (u) =>
          u.nome.toLowerCase().includes(termo) ||
          u.email.toLowerCase().includes(termo) ||
          (u.usuario && u.usuario.toLowerCase().includes(termo))
      );
    }

    return result;
  }

  async excluir(id: UUIDv4): Promise<void> {
    this.items.delete(id.value);
  }
}

