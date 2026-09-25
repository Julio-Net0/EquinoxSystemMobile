import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

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
}
