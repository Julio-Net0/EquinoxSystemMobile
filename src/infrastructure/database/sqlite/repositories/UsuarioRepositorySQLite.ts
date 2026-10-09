import { IUsuarioRepository, ListarUsuariosFiltroDTO } from '@/domain/repositories/IUsuarioRepository';
import { Usuario, StatusUsuarioType } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { SQLiteDatabaseManager } from '../SQLiteDatabaseManager';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';

export class UsuarioRepositorySQLite implements IUsuarioRepository {
  private fallbackMemory = new UsuarioRepositoryMemory();

  async salvar(usuario: Usuario): Promise<void> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      await this.fallbackMemory.salvar(usuario);
      return;
    }

    const usinasJson = JSON.stringify(usuario.usinasVinculadas.map((u) => u.value));

    await db.runAsync(
      `INSERT OR REPLACE INTO usuarios 
       (id, empresa_id, nome, usuario, email, perfil, status, usinas_vinculadas, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario.id.value,
        usuario.empresaId.value,
        usuario.nome,
        usuario.usuario ?? null,
        usuario.email,
        usuario.perfil,
        usuario.status,
        usinasJson,
        new Date().toISOString(),
      ]
    );
  }

  async buscarPorId(id: UUIDv4): Promise<Usuario | null> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return this.fallbackMemory.buscarPorId(id);
    }

    const row = (await db.getFirstAsync('SELECT * FROM usuarios WHERE id = ?', [id.value])) as any;
    if (!row) return null;

    return this.mapRowToUsuario(row);
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return this.fallbackMemory.buscarPorEmail(email);
    }

    const row = (await db.getFirstAsync('SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)', [email.trim()])) as any;
    if (!row) return null;

    return this.mapRowToUsuario(row);
  }

  async listarPorEmpresa(empresaId: UUIDv4): Promise<Usuario[]> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return this.fallbackMemory.listarPorEmpresa(empresaId);
    }

    const rows = (await db.getAllAsync('SELECT * FROM usuarios WHERE empresa_id = ? ORDER BY nome ASC', [empresaId.value])) as any[];
    return (rows || []).map((row) => this.mapRowToUsuario(row));
  }

  async listarPendentes(empresaId?: UUIDv4): Promise<Usuario[]> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return this.fallbackMemory.listarPendentes(empresaId);
    }

    let sql = "SELECT * FROM usuarios WHERE status = 'Pendente'";
    const params: any[] = [];
    if (empresaId) {
      sql += ' AND empresa_id = ?';
      params.push(empresaId.value);
    }
    sql += ' ORDER BY created_at DESC';

    const rows = (await db.getAllAsync(sql, params)) as any[];
    return (rows || []).map((row) => this.mapRowToUsuario(row));
  }

  async listarComFiltros(filtros: ListarUsuariosFiltroDTO): Promise<Usuario[]> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return this.fallbackMemory.listarComFiltros(filtros);
    }

    let sql = 'SELECT * FROM usuarios WHERE 1=1';
    const params: any[] = [];

    if (filtros.empresaId) {
      sql += ' AND empresa_id = ?';
      params.push(filtros.empresaId.value);
    }
    if (filtros.status) {
      sql += ' AND LOWER(status) = LOWER(?)';
      params.push(filtros.status);
    }
    if (filtros.perfil) {
      sql += ' AND perfil = ?';
      params.push(filtros.perfil);
    }
    if (filtros.termoBusca) {
      sql += ' AND (LOWER(nome) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?) OR LOWER(usuario) LIKE LOWER(?))';
      const term = `%${filtros.termoBusca}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY nome ASC';

    const rows = (await db.getAllAsync(sql, params)) as any[];
    return (rows || []).map((row) => this.mapRowToUsuario(row));
  }

  async excluir(id: UUIDv4): Promise<void> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      await this.fallbackMemory.excluir(id);
      return;
    }

    await db.runAsync('DELETE FROM usuarios WHERE id = ?', [id.value]);
  }

  private mapRowToUsuario(row: any): Usuario {
    let usinasIds: UUIDv4[] = [];
    if (row.usinas_vinculadas) {
      try {
        const arr = JSON.parse(row.usinas_vinculadas);
        if (Array.isArray(arr)) {
          usinasIds = arr.map((idStr: string) => new UUIDv4(idStr));
        }
      } catch {
        usinasIds = [];
      }
    }

    return new Usuario({
      id: new UUIDv4(row.id),
      empresaId: new UUIDv4(row.empresa_id),
      nome: row.nome,
      usuario: row.usuario ?? undefined,
      email: row.email,
      perfil: row.perfil as PerfilEnum,
      status: row.status as StatusUsuarioType,
      usinasVinculadas: usinasIds,
    });
  }
}
