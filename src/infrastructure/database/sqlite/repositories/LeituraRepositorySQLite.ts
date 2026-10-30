import type { SQLiteDatabase } from 'expo-sqlite';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { StatusLeituraEnum, STATUS_VIGENTES } from '@/domain/enums/StatusLeituraEnum';
import { LeituraRow, leituraDeRow, leituraParaRow } from '../mappers/mappers';

const COLUNAS = `id, padrao_id, usuario_id, valor_consumo, valor_injecao, foto_local_uri,
                 latitude, longitude, precisao_metros, medido_em, data_local, status,
                 substituida_em, substituida_por_id, decidida_em, decidida_por_id`;

const MARCADORES = COLUNAS.split(',')
  .map(() => '?')
  .join(', ');

/** 'registrada', 'aprovada' — montado do enum para não divergir do índice parcial. */
const LISTA_VIGENTES = STATUS_VIGENTES.map((s) => `'${s}'`).join(', ');

const valoresDe = (leitura: Leitura): (string | number | null)[] => {
  const r = leituraParaRow(leitura);
  return [
    r.id, r.padrao_id, r.usuario_id, r.valor_consumo, r.valor_injecao, r.foto_local_uri,
    r.latitude, r.longitude, r.precisao_metros, r.medido_em, r.data_local, r.status,
    r.substituida_em, r.substituida_por_id, r.decidida_em, r.decidida_por_id,
  ];
};

export class LeituraRepositorySQLite implements ILeituraRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async salvar(leitura: Leitura): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO leituras (${COLUNAS}) VALUES (${MARCADORES})`,
      valoresDe(leitura),
    );
  }

  async atualizar(leitura: Leitura): Promise<void> {
    await this.db.runAsync(
      `UPDATE leituras SET
         status = ?, substituida_em = ?, substituida_por_id = ?,
         decidida_em = ?, decidida_por_id = ?
       WHERE id = ?`,
      [
        leitura.status,
        leitura.substituidaEm?.toISOString() ?? null,
        leitura.substituidaPorId?.value ?? null,
        leitura.decididaEm?.toISOString() ?? null,
        leitura.decididaPorId?.value ?? null,
        leitura.id.value,
      ],
    );
  }

  /**
   * A ordem aqui não é estética: o índice parcial único de (padrao_id,
   * data_local) só admite uma leitura vigente, então a antiga tem de SAIR de
   * vigente antes de a nova entrar. Invertido, o INSERT falha sempre.
   *
   * As duas operações vão na mesma transação exclusiva para nunca existir um
   * instante em que o dia ficou sem leitura vigente.
   */
  async salvarSubstituindo(nova: Leitura, vigente: Leitura): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `UPDATE leituras SET status = ?, substituida_em = ?, substituida_por_id = ?
         WHERE id = ?`,
        [
          vigente.status,
          vigente.substituidaEm?.toISOString() ?? null,
          vigente.substituidaPorId?.value ?? null,
          vigente.id.value,
        ],
      );

      await tx.runAsync(
        `INSERT INTO leituras (${COLUNAS}) VALUES (${MARCADORES})`,
        valoresDe(nova),
      );
    });
  }

  async buscarPorId(id: UUIDv4): Promise<Leitura | null> {
    const row = await this.db.getFirstAsync<LeituraRow>('SELECT * FROM leituras WHERE id = ?', [
      id.value,
    ]);
    return row ? leituraDeRow(row) : null;
  }

  async buscarVigenteDoDia(padraoId: UUIDv4, dataLocal: DataLocal): Promise<Leitura | null> {
    const row = await this.db.getFirstAsync<LeituraRow>(
      `SELECT * FROM leituras
        WHERE padrao_id = ? AND data_local = ? AND status IN (${LISTA_VIGENTES})`,
      [padraoId.value, dataLocal.value],
    );
    return row ? leituraDeRow(row) : null;
  }

  async listarVigentesDoPadrao(padraoId: UUIDv4): Promise<Leitura[]> {
    const rows = await this.db.getAllAsync<LeituraRow>(
      `SELECT * FROM leituras
        WHERE padrao_id = ? AND status IN (${LISTA_VIGENTES})
        ORDER BY medido_em`,
      [padraoId.value],
    );
    return rows.map(leituraDeRow);
  }

  async listarDoPadrao(padraoId: UUIDv4): Promise<Leitura[]> {
    const rows = await this.db.getAllAsync<LeituraRow>(
      'SELECT * FROM leituras WHERE padrao_id = ? ORDER BY medido_em',
      [padraoId.value],
    );
    return rows.map(leituraDeRow);
  }

  async listarPorUsuario(usuarioId: UUIDv4, limite?: number): Promise<Leitura[]> {
    const rows = await this.db.getAllAsync<LeituraRow>(
      `SELECT * FROM leituras WHERE usuario_id = ? ORDER BY medido_em DESC${
        limite ? ' LIMIT ?' : ''
      }`,
      limite ? [usuarioId.value, limite] : [usuarioId.value],
    );
    return rows.map(leituraDeRow);
  }

  async listarRegistradasAntesDe(dataLocal: DataLocal): Promise<Leitura[]> {
    const rows = await this.db.getAllAsync<LeituraRow>(
      'SELECT * FROM leituras WHERE status = ? AND data_local < ? ORDER BY data_local',
      [StatusLeituraEnum.REGISTRADA, dataLocal.value],
    );
    return rows.map(leituraDeRow);
  }

  async excluirDecididasAntesDe(dataLocal: DataLocal): Promise<Leitura[]> {
    // Leitura ainda REGISTRADA nunca sai: ela aguarda decisão do administrador.
    const rows = await this.db.getAllAsync<LeituraRow>(
      'SELECT * FROM leituras WHERE status <> ? AND data_local < ?',
      [StatusLeituraEnum.REGISTRADA, dataLocal.value],
    );
    if (rows.length === 0) return [];

    await this.db.runAsync('DELETE FROM leituras WHERE status <> ? AND data_local < ?', [
      StatusLeituraEnum.REGISTRADA,
      dataLocal.value,
    ]);

    return rows.map(leituraDeRow);
  }
}
