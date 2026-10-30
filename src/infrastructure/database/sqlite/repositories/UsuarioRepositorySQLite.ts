import type { SQLiteDatabase } from 'expo-sqlite';
import {
  IUsuarioRepository,
  ListarUsuariosFiltroDTO,
} from '@/domain/repositories/IUsuarioRepository';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { nivelDe } from '@/domain/enums/PerfilEnum';
import { UsuarioRow, usuarioDeRow, usuarioParaRow } from '../mappers/mappers';

const COLUNAS = `id, empresa_id, nome, usuario, email, senha_hash, nivel_acesso,
                 nivel_anterior, status, criado_em, autorizado_em, autorizado_por`;

export class UsuarioRepositorySQLite implements IUsuarioRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  /**
   * Grava o usuário e sincroniza os vínculos de endereço na mesma transação.
   *
   * Os vínculos moram em usuario_enderecos (N:N), então salvar o usuário sem
   * reescrever a tabela de ligação deixaria os dois fora de sincronia.
   */
  async salvar(usuario: Usuario): Promise<void> {
    const r = usuarioParaRow(usuario);

    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT INTO usuarios (${COLUNAS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           nome = excluded.nome, usuario = excluded.usuario, email = excluded.email,
           senha_hash = excluded.senha_hash, nivel_acesso = excluded.nivel_acesso,
           nivel_anterior = excluded.nivel_anterior, status = excluded.status,
           autorizado_em = excluded.autorizado_em, autorizado_por = excluded.autorizado_por`,
        [
          r.id, r.empresa_id, r.nome, r.usuario, r.email, r.senha_hash, r.nivel_acesso,
          r.nivel_anterior, r.status, r.criado_em, r.autorizado_em, r.autorizado_por,
        ],
      );

      await tx.runAsync('DELETE FROM usuario_enderecos WHERE usuario_id = ?', [r.id]);
      for (const enderecoId of usuario.enderecosVinculados) {
        await tx.runAsync(
          'INSERT INTO usuario_enderecos (usuario_id, endereco_id) VALUES (?, ?)',
          [r.id, enderecoId.value],
        );
      }
    });
  }

  async atualizar(usuario: Usuario): Promise<void> {
    await this.salvar(usuario);
  }

  async buscarPorId(id: UUIDv4): Promise<Usuario | null> {
    return this.primeiro('SELECT * FROM usuarios WHERE id = ?', [id.value]);
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    // A coluna é UNIQUE COLLATE NOCASE, então a comparação já ignora a caixa.
    return this.primeiro('SELECT * FROM usuarios WHERE email = ?', [email.trim()]);
  }

  async buscarPorLogin(emailOuUsuario: string): Promise<Usuario | null> {
    const procurado = emailOuUsuario.trim();
    return this.primeiro('SELECT * FROM usuarios WHERE email = ? OR usuario = ?', [
      procurado,
      procurado,
    ]);
  }

  async listarPorEmpresa(empresaId: UUIDv4): Promise<Usuario[]> {
    return this.varios('SELECT * FROM usuarios WHERE empresa_id = ? ORDER BY nome', [
      empresaId.value,
    ]);
  }

  async listarPendentes(empresaId?: UUIDv4): Promise<Usuario[]> {
    if (empresaId) {
      return this.varios(
        "SELECT * FROM usuarios WHERE status = 'Pendente' AND empresa_id = ? ORDER BY criado_em",
        [empresaId.value],
      );
    }
    return this.varios("SELECT * FROM usuarios WHERE status = 'Pendente' ORDER BY criado_em");
  }

  async listarComFiltros(filtros: ListarUsuariosFiltroDTO): Promise<Usuario[]> {
    const condicoes: string[] = [];
    const parametros: (string | number)[] = [];

    if (filtros.empresaId) {
      condicoes.push('empresa_id = ?');
      parametros.push(filtros.empresaId.value);
    }
    if (filtros.status) {
      condicoes.push('status = ?');
      parametros.push(filtros.status);
    }
    if (filtros.perfil) {
      condicoes.push('nivel_acesso = ?');
      parametros.push(nivelDe(filtros.perfil));
    }
    if (filtros.termoBusca?.trim()) {
      condicoes.push('(nome LIKE ? OR email LIKE ? OR usuario LIKE ?)');
      const curinga = `%${filtros.termoBusca.trim()}%`;
      parametros.push(curinga, curinga, curinga);
    }

    const where = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';
    return this.varios(`SELECT * FROM usuarios ${where} ORDER BY nome`, parametros);
  }

  async excluir(id: UUIDv4): Promise<void> {
    await this.db.runAsync('DELETE FROM usuarios WHERE id = ?', [id.value]);
  }

  private async primeiro(
    sql: string,
    parametros: (string | number)[] = [],
  ): Promise<Usuario | null> {
    const row = await this.db.getFirstAsync<UsuarioRow>(sql, parametros);
    if (!row) return null;
    return usuarioDeRow(row, await this.enderecosDe(row.id));
  }

  private async varios(sql: string, parametros: (string | number)[] = []): Promise<Usuario[]> {
    const rows = await this.db.getAllAsync<UsuarioRow>(sql, parametros);

    const usuarios: Usuario[] = [];
    for (const row of rows) {
      usuarios.push(usuarioDeRow(row, await this.enderecosDe(row.id)));
    }
    return usuarios;
  }

  private async enderecosDe(usuarioId: string): Promise<UUIDv4[]> {
    const rows = await this.db.getAllAsync<{ endereco_id: string }>(
      'SELECT endereco_id FROM usuario_enderecos WHERE usuario_id = ?',
      [usuarioId],
    );
    return rows.map((r) => new UUIDv4(r.endereco_id));
  }
}
