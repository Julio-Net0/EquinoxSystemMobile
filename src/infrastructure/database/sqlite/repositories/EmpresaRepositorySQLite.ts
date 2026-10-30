import type { SQLiteDatabase } from 'expo-sqlite';
import { IEmpresaRepository } from '@/domain/repositories/IEmpresaRepository';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { EmpresaRow, empresaDeRow, empresaParaRow } from '../mappers/mappers';

export class EmpresaRepositorySQLite implements IEmpresaRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async salvar(empresa: Empresa): Promise<void> {
    const row = empresaParaRow(empresa);
    await this.db.runAsync(
      `INSERT INTO empresas (id, nome, cnpj, criado_em) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, cnpj = excluded.cnpj`,
      [row.id, row.nome, row.cnpj, row.criado_em],
    );
  }

  async buscarPorId(id: UUIDv4): Promise<Empresa | null> {
    const row = await this.db.getFirstAsync<EmpresaRow>('SELECT * FROM empresas WHERE id = ?', [
      id.value,
    ]);
    return row ? empresaDeRow(row) : null;
  }

  async listarTodas(): Promise<Empresa[]> {
    const rows = await this.db.getAllAsync<EmpresaRow>('SELECT * FROM empresas ORDER BY nome');
    return rows.map(empresaDeRow);
  }
}
