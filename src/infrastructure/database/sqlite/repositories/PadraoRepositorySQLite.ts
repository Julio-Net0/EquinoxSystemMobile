import type { SQLiteDatabase } from 'expo-sqlite';
import { IPadraoRepository } from '@/domain/repositories/IPadraoRepository';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PadraoRow, padraoDeRow, padraoParaRow } from '../mappers/mappers';

export class PadraoRepositorySQLite implements IPadraoRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async salvar(padrao: PadraoCemig): Promise<void> {
    const r = padraoParaRow(padrao);
    await this.db.runAsync(
      `INSERT INTO padroes_cemig (id, endereco_id, numero, criado_em) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET numero = excluded.numero`,
      [r.id, r.endereco_id, r.numero, r.criado_em],
    );
  }

  async atualizar(padrao: PadraoCemig): Promise<void> {
    await this.salvar(padrao);
  }

  async buscarPorId(id: UUIDv4): Promise<PadraoCemig | null> {
    const row = await this.db.getFirstAsync<PadraoRow>(
      'SELECT * FROM padroes_cemig WHERE id = ?',
      [id.value],
    );
    return row ? padraoDeRow(row) : null;
  }

  async listarPorEndereco(enderecoId: UUIDv4): Promise<PadraoCemig[]> {
    const rows = await this.db.getAllAsync<PadraoRow>(
      'SELECT * FROM padroes_cemig WHERE endereco_id = ? ORDER BY numero',
      [enderecoId.value],
    );
    return rows.map(padraoDeRow);
  }

  async listarPorEnderecos(enderecoIds: UUIDv4[]): Promise<PadraoCemig[]> {
    if (enderecoIds.length === 0) return [];

    // Placeholders montados a partir da quantidade, nunca dos valores.
    const marcadores = enderecoIds.map(() => '?').join(', ');
    const rows = await this.db.getAllAsync<PadraoRow>(
      `SELECT * FROM padroes_cemig WHERE endereco_id IN (${marcadores}) ORDER BY numero`,
      enderecoIds.map((i) => i.value),
    );
    return rows.map(padraoDeRow);
  }

  async excluir(id: UUIDv4): Promise<void> {
    await this.db.runAsync('DELETE FROM padroes_cemig WHERE id = ?', [id.value]);
  }
}
