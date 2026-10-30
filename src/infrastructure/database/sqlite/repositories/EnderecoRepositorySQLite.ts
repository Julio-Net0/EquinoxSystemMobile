import type { SQLiteDatabase } from 'expo-sqlite';
import { IEnderecoRepository } from '@/domain/repositories/IEnderecoRepository';
import { Endereco } from '@/domain/entities/Endereco';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { EnderecoRow, enderecoDeRow, enderecoParaRow } from '../mappers/mappers';

const COLUNAS = `id, empresa_id, apelido, uc, rua, numero, bairro, cidade,
                 eh_usina, latitude, longitude, criado_em`;

export class EnderecoRepositorySQLite implements IEnderecoRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async salvar(endereco: Endereco): Promise<void> {
    const r = enderecoParaRow(endereco);
    await this.db.runAsync(
      `INSERT INTO enderecos (${COLUNAS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         apelido = excluded.apelido, uc = excluded.uc, rua = excluded.rua,
         numero = excluded.numero, bairro = excluded.bairro, cidade = excluded.cidade,
         eh_usina = excluded.eh_usina, latitude = excluded.latitude,
         longitude = excluded.longitude`,
      [
        r.id, r.empresa_id, r.apelido, r.uc, r.rua, r.numero, r.bairro, r.cidade,
        r.eh_usina, r.latitude, r.longitude, r.criado_em,
      ],
    );
  }

  /** A empresa de um endereço nunca muda, então o update não a inclui. */
  async atualizar(endereco: Endereco): Promise<void> {
    await this.salvar(endereco);
  }

  async buscarPorId(id: UUIDv4): Promise<Endereco | null> {
    const row = await this.db.getFirstAsync<EnderecoRow>('SELECT * FROM enderecos WHERE id = ?', [
      id.value,
    ]);
    return row ? enderecoDeRow(row) : null;
  }

  async listarPorEmpresa(empresaId: UUIDv4): Promise<Endereco[]> {
    const rows = await this.db.getAllAsync<EnderecoRow>(
      'SELECT * FROM enderecos WHERE empresa_id = ? ORDER BY apelido',
      [empresaId.value],
    );
    return rows.map(enderecoDeRow);
  }

  async listarTodos(): Promise<Endereco[]> {
    const rows = await this.db.getAllAsync<EnderecoRow>('SELECT * FROM enderecos ORDER BY apelido');
    return rows.map(enderecoDeRow);
  }

  async listarPorUsuario(usuarioId: UUIDv4): Promise<Endereco[]> {
    const rows = await this.db.getAllAsync<EnderecoRow>(
      `SELECT e.* FROM enderecos e
         JOIN usuario_enderecos ue ON ue.endereco_id = e.id
        WHERE ue.usuario_id = ?
        ORDER BY e.apelido`,
      [usuarioId.value],
    );
    return rows.map(enderecoDeRow);
  }

  async excluir(id: UUIDv4): Promise<void> {
    // Padrões, leituras e vínculos saem por ON DELETE CASCADE.
    await this.db.runAsync('DELETE FROM enderecos WHERE id = ?', [id.value]);
  }
}
