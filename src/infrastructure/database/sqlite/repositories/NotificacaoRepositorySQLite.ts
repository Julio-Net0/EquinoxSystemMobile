import type { SQLiteDatabase } from 'expo-sqlite';
import {
  INotificacaoRepository,
  ListarNotificacoesFiltro,
} from '@/domain/repositories/INotificacaoRepository';
import { Notificacao } from '@/domain/entities/Notificacao';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { NotificacaoRow, notificacaoDeRow, notificacaoParaRow } from '../mappers/mappers';

const COLUNAS = `id, empresa_id, tipo, titulo, mensagem, requer_acao, leitura_id,
                 criada_em, lida, resolucao, resolvida_em, resolvida_por`;

const MARCADORES = COLUNAS.split(',')
  .map(() => '?')
  .join(', ');

const valoresDe = (notificacao: Notificacao): (string | number | null)[] => {
  const r = notificacaoParaRow(notificacao);
  return [
    r.id, r.empresa_id, r.tipo, r.titulo, r.mensagem, r.requer_acao, r.leitura_id,
    r.criada_em, r.lida, r.resolucao, r.resolvida_em, r.resolvida_por,
  ];
};

export class NotificacaoRepositorySQLite implements INotificacaoRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async salvar(notificacao: Notificacao): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO notificacoes (${COLUNAS}) VALUES (${MARCADORES})
       ON CONFLICT(id) DO UPDATE SET
         lida = excluded.lida, resolucao = excluded.resolucao,
         resolvida_em = excluded.resolvida_em, resolvida_por = excluded.resolvida_por`,
      valoresDe(notificacao),
    );
  }

  async salvarVarias(notificacoes: Notificacao[]): Promise<void> {
    if (notificacoes.length === 0) return;

    // Os avisos de uma leitura entram juntos ou não entram: uma falha no meio
    // deixaria o administrador vendo metade do que aconteceu.
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      for (const notificacao of notificacoes) {
        await tx.runAsync(
          `INSERT INTO notificacoes (${COLUNAS}) VALUES (${MARCADORES})`,
          valoresDe(notificacao),
        );
      }
    });
  }

  async atualizar(notificacao: Notificacao): Promise<void> {
    await this.db.runAsync(
      `UPDATE notificacoes SET lida = ?, resolucao = ?, resolvida_em = ?, resolvida_por = ?
       WHERE id = ?`,
      [
        notificacao.lida ? 1 : 0,
        notificacao.resolucao,
        notificacao.resolvidaEm?.toISOString() ?? null,
        notificacao.resolvidaPorId?.value ?? null,
        notificacao.id.value,
      ],
    );
  }

  async buscarPorId(id: UUIDv4): Promise<Notificacao | null> {
    const row = await this.db.getFirstAsync<NotificacaoRow>(
      'SELECT * FROM notificacoes WHERE id = ?',
      [id.value],
    );
    return row ? notificacaoDeRow(row) : null;
  }

  async listar(filtro: ListarNotificacoesFiltro): Promise<Notificacao[]> {
    // Empresa nula é o escopo global do super admin: vê tudo.
    const where = filtro.empresaId ? 'WHERE empresa_id = ?' : '';
    const parametros = filtro.empresaId
      ? [filtro.empresaId.value, filtro.limite, filtro.offset]
      : [filtro.limite, filtro.offset];

    const rows = await this.db.getAllAsync<NotificacaoRow>(
      `SELECT * FROM notificacoes ${where} ORDER BY criada_em DESC LIMIT ? OFFSET ?`,
      parametros,
    );
    return rows.map(notificacaoDeRow);
  }

  async contarNaoLidas(empresaId: UUIDv4 | null): Promise<number> {
    const where = empresaId ? 'AND empresa_id = ?' : '';
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM notificacoes WHERE lida = 0 ${where}`,
      empresaId ? [empresaId.value] : [],
    );
    return row?.total ?? 0;
  }

  async marcarTodasLidas(empresaId: UUIDv4 | null): Promise<void> {
    const where = empresaId ? 'AND empresa_id = ?' : '';
    await this.db.runAsync(
      `UPDATE notificacoes SET lida = 1 WHERE lida = 0 ${where}`,
      empresaId ? [empresaId.value] : [],
    );
  }

  async buscarPorLeitura(leituraId: UUIDv4): Promise<Notificacao[]> {
    const rows = await this.db.getAllAsync<NotificacaoRow>(
      'SELECT * FROM notificacoes WHERE leitura_id = ? ORDER BY criada_em DESC',
      [leituraId.value],
    );
    return rows.map(notificacaoDeRow);
  }

  async excluir(id: UUIDv4): Promise<void> {
    await this.db.runAsync('DELETE FROM notificacoes WHERE id = ?', [id.value]);
  }
}
