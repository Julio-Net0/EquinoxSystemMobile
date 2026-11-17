import type { SQLiteDatabase } from 'expo-sqlite';
import { Migracao } from './Migracao';

/**
 * Dá um dono a cada item da fila de envio (ADR 10.19).
 *
 * Num aparelho compartilhado, enviar um item com a sessão de outra pessoa
 * gravaria o dado em nome errado — ou seria recusado pela nuvem e gastaria
 * tentativas. Com `usuario_id`, cada sessão só envia o que é seu; o que é de
 * outro usuário espera até ele entrar.
 *
 * Para itens que já estavam na fila, o dono só pode ser deduzido com certeza
 * quando o item é uma leitura ainda não decidida (`registrada` ou
 * `substituida`), cujo autor é `leituras.usuario_id`. Decisões de
 * administrador e demais operações antigas ficam com `usuario_id` nulo e
 * continuam podendo subir por qualquer sessão.
 */
export const DDL_FILA_COM_DONO = `
ALTER TABLE action_queue ADD COLUMN usuario_id TEXT;

UPDATE action_queue
SET usuario_id = (
  SELECT l.usuario_id
  FROM leituras l
  WHERE l.id = json_extract(action_queue.payload, '$.id')
    AND l.status IN ('registrada', 'substituida')
)
WHERE tipo_acao = 'UPSERT_LEITURA';

CREATE INDEX idx_action_queue_usuario ON action_queue(usuario_id);
`;

export const migracaoFilaComDono: Migracao = {
  versao: 5,
  nome: '005_fila_com_dono',
  async aplicar(db: SQLiteDatabase): Promise<void> {
    await db.execAsync(DDL_FILA_COM_DONO);
  },
};

