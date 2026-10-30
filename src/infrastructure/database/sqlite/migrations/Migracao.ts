import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Uma migração versionada. `versao` é comparada com o `PRAGMA user_version` do
 * banco: só roda o que ainda não rodou.
 *
 * Migração já publicada nunca é editada — a correção vem como uma versão nova,
 * senão aparelhos que já migraram ficam com um schema diferente do código.
 */
export interface Migracao {
  versao: number;
  nome: string;
  aplicar(db: SQLiteDatabase): Promise<void>;
}
