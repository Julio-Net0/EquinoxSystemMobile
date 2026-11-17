import type { SQLiteDatabase } from 'expo-sqlite';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { StatusLeituraEnum, STATUS_VIGENTES } from '@/domain/enums/StatusLeituraEnum';
import { EstadoSyncEnum } from '@/domain/enums/EstadoSyncEnum';
import { LeituraRow, leituraDeRow, leituraParaRow } from '../mappers/mappers';
import { emTransacao } from '../emTransacao';

/**
 * Colunas que existem desde a versão 1 do schema.
 *
 * O INSERT de uma leitura nova usa SÓ estas, de propósito: a migração de seed
 * (versão 2) grava leituras por este repositório ANTES de a versão 3 criar as
 * colunas de sincronização, e ela não pode ser editada. Como toda leitura
 * nasce 'pendente' e sem foto remota — exatamente os valores padrão das
 * colunas novas — o INSERT não precisa mencioná-las.
 */
const COLUNAS_BASE = `id, padrao_id, usuario_id, valor_consumo, valor_injecao, foto_local_uri,
                      latitude, longitude, precisao_metros, medido_em, data_local, status,
                      substituida_em, substituida_por_id, decidida_em, decidida_por_id`;

/** Colunas de sincronização, criadas na versão 3 (003_sincronizacao). */
const COLUNAS_SYNC = 'foto_remota_path, sync_status';

const COLUNAS = `${COLUNAS_BASE}, ${COLUNAS_SYNC}`;

const marcadoresDe = (colunas: string): string =>
  colunas
    .split(',')
    .map(() => '?')
    .join(', ');

const MARCADORES_BASE = marcadoresDe(COLUNAS_BASE);
const MARCADORES = marcadoresDe(COLUNAS);

/** 'registrada', 'aprovada' — montado do enum para não divergir do índice parcial. */
const LISTA_VIGENTES = STATUS_VIGENTES.map((s) => `'${s}'`).join(', ');

type Valor = string | number | null;

const valoresBaseDe = (leitura: Leitura): Valor[] => {
  const r = leituraParaRow(leitura);
  return [
    r.id, r.padrao_id, r.usuario_id, r.valor_consumo, r.valor_injecao, r.foto_local_uri,
    r.latitude, r.longitude, r.precisao_metros, r.medido_em, r.data_local, r.status,
    r.substituida_em, r.substituida_por_id, r.decidida_em, r.decidida_por_id,
  ];
};

const valoresDe = (leitura: Leitura): Valor[] => [
  ...valoresBaseDe(leitura),
  leitura.fotoRemotaPath,
  leitura.estadoSync,
];

/** A leitura está com os valores padrão das colunas de sincronização? */
const nasceuAgora = (leitura: Leitura): boolean =>
  leitura.estadoSync === EstadoSyncEnum.PENDENTE && leitura.fotoRemotaPath === null;

/**
 * Insere a leitura com as colunas da versão 1 e, só se ela já vier com estado
 * de sincronização diferente do padrão, grava esse estado em seguida.
 */
async function inserir(db: SQLiteDatabase, leitura: Leitura): Promise<void> {
  await db.runAsync(
    `INSERT INTO leituras (${COLUNAS_BASE}) VALUES (${MARCADORES_BASE})`,
    valoresBaseDe(leitura),
  );

  if (!nasceuAgora(leitura)) {
    await db.runAsync('UPDATE leituras SET foto_remota_path = ?, sync_status = ? WHERE id = ?', [
      leitura.fotoRemotaPath,
      leitura.estadoSync,
      leitura.id.value,
    ]);
  }
}

export class LeituraRepositorySQLite implements ILeituraRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async salvar(leitura: Leitura): Promise<void> {
    if (nasceuAgora(leitura)) {
      await inserir(this.db, leitura);
      return;
    }
    await emTransacao(this.db, (tx) => inserir(tx, leitura));
  }

  async atualizar(leitura: Leitura): Promise<void> {
    await this.db.runAsync(
      `UPDATE leituras SET
         status = ?, substituida_em = ?, substituida_por_id = ?,
         decidida_em = ?, decidida_por_id = ?, foto_remota_path = ?, sync_status = ?
       WHERE id = ?`,
      [
        leitura.status,
        leitura.substituidaEm?.toISOString() ?? null,
        leitura.substituidaPorId?.value ?? null,
        leitura.decididaEm?.toISOString() ?? null,
        leitura.decididaPorId?.value ?? null,
        leitura.fotoRemotaPath,
        leitura.estadoSync,
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
    await emTransacao(this.db, async (tx) => {
      await tx.runAsync(
        `UPDATE leituras SET status = ?, substituida_em = ?, substituida_por_id = ?, sync_status = ?
         WHERE id = ?`,
        [
          vigente.status,
          vigente.substituidaEm?.toISOString() ?? null,
          vigente.substituidaPorId?.value ?? null,
          vigente.estadoSync,
          vigente.id.value,
        ],
      );

      await inserir(tx, nova);
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

  /**
   * Upsert de uma leitura vinda da nuvem.
   *
   * Mesma lógica de ordem de `salvarSubstituindo`: se outra leitura local
   * ocupa a vaga de (padrão, dia), ela sai de vigente ANTES de a remota
   * entrar, senão o índice parcial único recusaria a escrita. A nuvem é a
   * autoridade sobre quem fica com a vaga.
   *
   * `foto_local_uri` fica fora do UPDATE de propósito: a foto que já está no
   * aparelho continua valendo, e a remota entra ao lado dela.
   */
  async aplicarRemota(leitura: Leitura): Promise<void> {
    const r = leituraParaRow(leitura);

    await emTransacao(this.db, async (tx) => {
      if (leitura.estaVigente()) {
        await tx.runAsync(
          `UPDATE leituras SET status = ?, substituida_em = ?, substituida_por_id = ?
            WHERE padrao_id = ? AND data_local = ? AND id <> ? AND status IN (${LISTA_VIGENTES})`,
          [StatusLeituraEnum.SUBSTITUIDA, r.medido_em, r.id, r.padrao_id, r.data_local, r.id],
        );
      }

      await tx.runAsync(
        `INSERT INTO leituras (${COLUNAS}) VALUES (${MARCADORES})
         ON CONFLICT(id) DO UPDATE SET
           padrao_id = excluded.padrao_id, usuario_id = excluded.usuario_id,
           valor_consumo = excluded.valor_consumo, valor_injecao = excluded.valor_injecao,
           latitude = excluded.latitude, longitude = excluded.longitude,
           precisao_metros = excluded.precisao_metros, medido_em = excluded.medido_em,
           data_local = excluded.data_local, status = excluded.status,
           substituida_em = excluded.substituida_em,
           substituida_por_id = excluded.substituida_por_id,
           decidida_em = excluded.decidida_em, decidida_por_id = excluded.decidida_por_id,
           foto_remota_path = excluded.foto_remota_path, sync_status = excluded.sync_status`,
        valoresDe(leitura),
      );
    });
  }

  async excluirDecididasAntesDe(dataLocal: DataLocal): Promise<Leitura[]> {
    // Leitura ainda REGISTRADA nunca sai: ela aguarda decisão do administrador.
    // E só sai o que já está na nuvem: apagar uma leitura que ainda não subiu
    // seria perder o único exemplar dela.
    const filtro = 'status <> ? AND data_local < ? AND sync_status = ?';
    const parametros = [StatusLeituraEnum.REGISTRADA, dataLocal.value, EstadoSyncEnum.SINCRONIZADA];

    const rows = await this.db.getAllAsync<LeituraRow>(
      `SELECT * FROM leituras WHERE ${filtro}`,
      parametros,
    );
    if (rows.length === 0) return [];

    await this.db.runAsync(`DELETE FROM leituras WHERE ${filtro}`, parametros);

    return rows.map(leituraDeRow);
  }

  async excluir(id: UUIDv4): Promise<Leitura | null> {
    const leitura = await this.buscarPorId(id);
    if (!leitura) return null;

    // Os avisos ligados a ela saem junto, pelo ON DELETE CASCADE.
    await this.db.runAsync('DELETE FROM leituras WHERE id = ?', [id.value]);
    return leitura;
  }
}
