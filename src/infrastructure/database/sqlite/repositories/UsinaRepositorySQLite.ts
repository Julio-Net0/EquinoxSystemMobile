import { IUsinaRepository } from '@/domain/repositories/IUsinaRepository';
import { Usina } from '@/domain/entities/Usina';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';
import { SQLiteDatabaseManager } from '../SQLiteDatabaseManager';
import { UsinaRepositoryMemory } from '@/infrastructure/fakes/UsinaRepositoryMemory';

export class UsinaRepositorySQLite implements IUsinaRepository {
  private fallbackMemory = new UsinaRepositoryMemory();

  async salvar(usina: Usina): Promise<void> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      await this.fallbackMemory.salvar(usina);
      return;
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO usinas 
       (id, empresa_id, nome, codigo_uc, capacidade_nominal, latitude, longitude, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usina.id.value,
        usina.empresaId.value,
        usina.nome,
        usina.codigoUC,
        usina.capacidadeNominal,
        usina.coordenadas ? usina.coordenadas.latitude : null,
        usina.coordenadas ? usina.coordenadas.longitude : null,
        usina.status,
        new Date().toISOString(),
      ]
    );
  }

  async buscarPorId(id: UUIDv4): Promise<Usina | null> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return this.fallbackMemory.buscarPorId(id);
    }

    const row = (await db.getFirstAsync('SELECT * FROM usinas WHERE id = ?', [id.value])) as any;
    if (!row) return null;

    return new Usina({
      id: new UUIDv4(row.id),
      empresaId: new UUIDv4(row.empresa_id),
      nome: row.nome,
      codigoUC: row.codigo_uc,
      capacidadeNominal: row.capacidade_nominal,
      coordenadas: new CoordenadasGPS(row.latitude ?? 0, row.longitude ?? 0),
      status: row.status as StatusUsinaEnum,
    });
  }

  async listarPorEmpresa(empresaId: UUIDv4): Promise<Usina[]> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return this.fallbackMemory.listarPorEmpresa(empresaId);
    }

    const rows = (await db.getAllAsync('SELECT * FROM usinas WHERE empresa_id = ? ORDER BY nome ASC', [empresaId.value])) as any[];
    return (rows || []).map(
      (row) =>
        new Usina({
          id: new UUIDv4(row.id),
          empresaId: new UUIDv4(row.empresa_id),
          nome: row.nome,
          codigoUC: row.codigo_uc,
          capacidadeNominal: row.capacidade_nominal,
          coordenadas: new CoordenadasGPS(row.latitude ?? 0, row.longitude ?? 0),
          status: row.status as StatusUsinaEnum,
        })
    );
  }

  async listarTodas(): Promise<Usina[]> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return this.fallbackMemory.listarTodas();
    }

    const rows = (await db.getAllAsync('SELECT * FROM usinas ORDER BY nome ASC')) as any[];
    return (rows || []).map(
      (row) =>
        new Usina({
          id: new UUIDv4(row.id),
          empresaId: new UUIDv4(row.empresa_id),
          nome: row.nome,
          codigoUC: row.codigo_uc,
          capacidadeNominal: row.capacidade_nominal,
          coordenadas: new CoordenadasGPS(row.latitude ?? 0, row.longitude ?? 0),
          status: row.status as StatusUsinaEnum,
        })
    );
  }

  async atualizar(usina: Usina): Promise<void> {
    await this.salvar(usina);
  }
}
