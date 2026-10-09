import { IEmpresaRepository } from '@/domain/repositories/IEmpresaRepository';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';
import { SQLiteDatabaseManager } from '../SQLiteDatabaseManager';
import { EmpresaRepositoryMemory } from '@/infrastructure/fakes/EmpresaRepositoryMemory';

export class EmpresaRepositorySQLite implements IEmpresaRepository {
  private fallbackMemory = new EmpresaRepositoryMemory();

  async salvar(empresa: Empresa): Promise<void> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      await this.fallbackMemory.salvar(empresa);
      return;
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO empresas (id, nome, cnpj, created_at)
       VALUES (?, ?, ?, ?)`,
      [empresa.id.value, empresa.nome, empresa.cnpj.valorLimpo, empresa.dataCriacao.toISOString()]
    );
  }

  async buscarPorId(id: UUIDv4): Promise<Empresa | null> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return this.fallbackMemory.buscarPorId(id);
    }

    const row = (await db.getFirstAsync('SELECT * FROM empresas WHERE id = ?', [id.value])) as any;
    if (!row) return null;

    return new Empresa({
      id: new UUIDv4(row.id),
      nome: row.nome,
      cnpj: new CNPJ(row.cnpj),
      dataCriacao: new Date(row.created_at),
    });
  }

  async listarTodas(): Promise<Empresa[]> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return this.fallbackMemory.listarTodas();
    }

    const rows = (await db.getAllAsync('SELECT * FROM empresas ORDER BY nome ASC')) as any[];
    return (rows || []).map(
      (row) =>
        new Empresa({
          id: new UUIDv4(row.id),
          nome: row.nome,
          cnpj: new CNPJ(row.cnpj),
          dataCriacao: new Date(row.created_at),
        })
    );
  }
}
