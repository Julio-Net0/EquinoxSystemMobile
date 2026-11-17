import type { SQLiteDatabase } from 'expo-sqlite';
import { Migracao } from './Migracao';

/**
 * Leva o banco local de "100% no aparelho" para "offline-first com nuvem".
 *
 * As migrações 001 e 002 não foram tocadas: aparelhos que já rodaram o app
 * estão na versão 2 e só recebem o que está aqui.
 */
export const DDL_SINCRONIZACAO = `
-- Leitura: onde está o comprovante na nuvem e se ela já subiu. Toda leitura
-- nasce 'pendente'; só o envio bem-sucedido a torna 'sincronizada'.
ALTER TABLE leituras ADD COLUMN foto_remota_path TEXT;
ALTER TABLE leituras ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pendente'
  CHECK (sync_status IN ('pendente', 'sincronizada', 'falhou'));

CREATE INDEX idx_leituras_sync ON leituras(sync_status);

-- As leituras do seed de demonstração existem dos dois lados com os mesmos
-- UUIDs (supabase/seed.sql), então já contam como sincronizadas.
UPDATE leituras SET sync_status = 'sincronizada' WHERE id LIKE '5e000000-0000-4000-8000-%';

-- Fila de envio: o motivo da última recusa, para a tela poder explicá-lo.
ALTER TABLE action_queue ADD COLUMN ultimo_erro TEXT;

-- Estado da sincronização: cursores do pull, última sincronização, último erro.
CREATE TABLE sync_meta (
  chave TEXT PRIMARY KEY NOT NULL,
  valor TEXT
);

-- A senha deixou de existir no aparelho: a identidade é do Supabase Auth. A
-- coluna fica porque a migração 002 ainda a preenche em instalação nova (e
-- não pode ser editada); aqui ela é esvaziada, e nada mais a lê nem a grava.
-- Isso encerra a dívida do ADR 9.5.
UPDATE usuarios SET senha_hash = '';

-- Leituras feitas antes de a nuvem existir só estão neste aparelho: entram na
-- fila, na ordem em que foram medidas, para subir no primeiro login online.
INSERT INTO action_queue (id, tipo_acao, payload, tentativas, criado_em)
SELECT
  lower(
    hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2)
    || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2)
    || '-' || hex(randomblob(6))
  ),
  'UPSERT_LEITURA',
  '{"id":"' || id || '"}',
  0,
  medido_em
FROM leituras
WHERE id NOT LIKE '5e000000-0000-4000-8000-%'
ORDER BY medido_em;
`;

export const migracaoSincronizacao: Migracao = {
  versao: 3,
  nome: '003_sincronizacao',
  async aplicar(db: SQLiteDatabase): Promise<void> {
    await db.execAsync(DDL_SINCRONIZACAO);
  },
};
