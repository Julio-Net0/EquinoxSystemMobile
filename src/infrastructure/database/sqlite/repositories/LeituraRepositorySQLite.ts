import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusSyncEnum } from '@/domain/enums/StatusSyncEnum';
import { SQLiteDatabaseManager } from '../SQLiteDatabaseManager';
import { LeituraRepositoryMemory } from '@/infrastructure/fakes/LeituraRepositoryMemory';

export class LeituraRepositorySQLite implements ILeituraRepository {
  private fallbackMemory = new LeituraRepositoryMemory();

  async salvar(leitura: Leitura): Promise<void> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      await this.fallbackMemory.salvar(leitura);
      return;
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO leituras 
       (id, usina_id, usuario_id, valor_kwh, foto_local_uri, latitude, longitude, data_hora, status_sync, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        leitura.id.value,
        leitura.usinaId.value,
        leitura.usuarioId.value,
        leitura.valorKwh.valor,
        leitura.caminhoImagemLocal,
        leitura.coordenadas.latitude,
        leitura.coordenadas.longitude,
        leitura.dataHora.toISOString(),
        leitura.statusSync,
        new Date().toISOString(),
      ]
    );
  }

  async buscarPorId(id: UUIDv4): Promise<Leitura | null> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return this.fallbackMemory.buscarPorId(id);
    }

    const row = (await db.getFirstAsync('SELECT * FROM leituras WHERE id = ?', [id.value])) as any;
    if (!row) return null;

    return new Leitura({
      id: new UUIDv4(row.id),
      usinaId: new UUIDv4(row.usina_id),
      usuarioId: new UUIDv4(row.usuario_id),
      valorKwh: new ValorKwh(row.valor_kwh),
      caminhoImagemLocal: row.foto_local_uri,
      coordenadas: new CoordenadasGPS(row.latitude, row.longitude),
      dataHora: new Date(row.data_hora),
      statusSync: row.status_sync as StatusSyncEnum,
    });
  }

  async listarPorUsina(usinaId: UUIDv4): Promise<Leitura[]> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      return this.fallbackMemory.listarPorUsina(usinaId);
    }

    const rows = (await db.getAllAsync('SELECT * FROM leituras WHERE usina_id = ? ORDER BY data_hora DESC', [usinaId.value])) as any[];
    return (rows || []).map(
      (row: any) =>
        new Leitura({
          id: new UUIDv4(row.id),
          usinaId: new UUIDv4(row.usina_id),
          usuarioId: new UUIDv4(row.usuario_id),
          valorKwh: new ValorKwh(row.valor_kwh),
          caminhoImagemLocal: row.foto_local_uri,
          coordenadas: new CoordenadasGPS(row.latitude, row.longitude),
          dataHora: new Date(row.data_hora),
          statusSync: row.status_sync as StatusSyncEnum,
        })
    );
  }

  async atualizarStatus(id: UUIDv4, statusSync: StatusSyncEnum, urlRemota?: string): Promise<void> {
    const db = await SQLiteDatabaseManager.getDatabase();
    if (!db) {
      await this.fallbackMemory.atualizarStatus(id, statusSync, urlRemota);
      return;
    }

    await db.runAsync('UPDATE leituras SET status_sync = ? WHERE id = ?', [statusSync, id.value]);
  }
}
