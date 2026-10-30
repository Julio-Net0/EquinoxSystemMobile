import type { SQLiteDatabase } from 'expo-sqlite';
import { Migracao } from './migrations/Migracao';
import { emTransacao } from './emTransacao';

/**
 * PRAGMAs aplicados a cada abertura do banco.
 *
 * Ficam fora das migrações porque `journal_mode` não roda dentro de transação,
 * e `foreign_keys` é por conexão: não basta ligar uma vez na migração, tem de
 * ser ligado sempre que o app abre o banco.
 */
export const PRAGMAS_DE_ABERTURA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
`;

/**
 * Aplica as migrações pendentes, no padrão documentado do expo-sqlite: o
 * `PRAGMA user_version` do banco diz até onde ele já foi migrado.
 *
 * Cada migração roda na própria transação exclusiva, e o `user_version` só
 * avança depois do commit — se uma falhar, o banco fica íntegro na versão
 * anterior e a próxima abertura tenta de novo a partir dali.
 */
export async function migrar(db: SQLiteDatabase, migracoes: Migracao[]): Promise<number> {
  await db.execAsync(PRAGMAS_DE_ABERTURA);

  const linha = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let versao = linha?.user_version ?? 0;

  const pendentes = [...migracoes]
    .sort((a, b) => a.versao - b.versao)
    .filter((m) => m.versao > versao);

  for (const migracao of pendentes) {
    await emTransacao(db, (tx) => migracao.aplicar(tx));

    // Interpolação direta porque PRAGMA não aceita parâmetro; o valor vem da
    // lista de migrações do próprio código, nunca de entrada externa.
    await db.execAsync(`PRAGMA user_version = ${migracao.versao}`);
    versao = migracao.versao;
  }

  return versao;
}
