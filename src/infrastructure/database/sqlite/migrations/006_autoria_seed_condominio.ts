import type { SQLiteDatabase } from 'expo-sqlite';
import { Migracao } from './Migracao';

/**
 * Corrige a autoria das leituras do Condomínio Solar do Vale no seed local
 * (ADR 10.19).
 *
 * A migração 002 (que não pode ser editada) criou as leituras 10 e 11 dos
 * padrões do Condomínio (`1a…002`) com o técnico (`4d…003`) e o administrador
 * (`4d…002`) da Equinox, e citou João da Silva no aviso `6f…003`. Aqui a
 * administradora do Condomínio — Helena Síndica (`4d…005`), a mesma de
 * `supabase/seed.sql` — passa a existir também no seed local e assume a
 * autoria e a decisão dessas duas leituras.
 *
 * Num aparelho onde o seed já foi limpo pela troca de usuário, a empresa
 * `1a…002` não está lá e nada acontece.
 */
export const DDL_AUTORIA_SEED_CONDOMINIO = `
INSERT INTO usuarios (
  id, empresa_id, nome, usuario, email, senha_hash,
  nivel_acesso, status, criado_em, autorizado_em
)
SELECT
  '4d000000-0000-4000-8000-000000000005',
  e.id,
  'Helena Síndica',
  'sindica',
  'sindica@solardovale.dev',
  '',
  2,
  'Ativo',
  e.criado_em,
  e.criado_em
FROM empresas e
WHERE e.id = '1a000000-0000-4000-8000-000000000002'
  AND NOT EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = '4d000000-0000-4000-8000-000000000005'
       OR u.email = 'sindica@solardovale.dev'
       OR u.usuario = 'sindica'
  );

INSERT OR IGNORE INTO usuario_enderecos (usuario_id, endereco_id)
SELECT '4d000000-0000-4000-8000-000000000005', e.id
FROM enderecos e
WHERE e.empresa_id = '1a000000-0000-4000-8000-000000000002'
  AND EXISTS (
    SELECT 1 FROM usuarios WHERE id = '4d000000-0000-4000-8000-000000000005'
  );

UPDATE leituras
SET
  usuario_id = '4d000000-0000-4000-8000-000000000005',
  decidida_por_id = CASE
    WHEN decidida_por_id IS NULL THEN NULL
    ELSE '4d000000-0000-4000-8000-000000000005'
  END
WHERE id IN (
  '5e000000-0000-4000-8000-000000000010',
  '5e000000-0000-4000-8000-000000000011'
)
  AND EXISTS (
    SELECT 1 FROM usuarios WHERE id = '4d000000-0000-4000-8000-000000000005'
  );

UPDATE notificacoes
SET mensagem = replace(
  mensagem,
  'Registrada por João da Silva.',
  'Registrada por Helena Síndica.'
)
WHERE id = '6f000000-0000-4000-8000-000000000003';
`;

export const migracaoAutoriaSeedCondominio: Migracao = {
  versao: 6,
  nome: '006_autoria_seed_condominio',
  async aplicar(db: SQLiteDatabase): Promise<void> {
    await db.execAsync(DDL_AUTORIA_SEED_CONDOMINIO);
  },
};

