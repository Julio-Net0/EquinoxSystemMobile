import { PRAGMAS_DE_ABERTURA, migrar } from '@/infrastructure/database/sqlite/migrar';
import { Migracao } from '@/infrastructure/database/sqlite/migrations/Migracao';

/**
 * Dublê do SQLiteDatabase com o mínimo que o runner usa. expo-sqlite é módulo
 * nativo e não carrega sob o Jest, mas a lógica de versionamento é justamente
 * o que precisa de teste.
 */
function bancoDuble(versaoInicial = 0) {
  const executados: string[] = [];
  let userVersion = versaoInicial;
  let transacoesAbertas = 0;

  const db = {
    executados,
    get userVersion() {
      return userVersion;
    },
    async execAsync(sql: string): Promise<void> {
      executados.push(sql.trim());
      const pragma = /PRAGMA user_version\s*=\s*(\d+)/.exec(sql);
      if (pragma) userVersion = Number(pragma[1]);
    },
    async getFirstAsync<T>(sql: string): Promise<T | null> {
      if (sql.includes('user_version')) return { user_version: userVersion } as unknown as T;
      return null;
    },
    async withExclusiveTransactionAsync(tarefa: (tx: unknown) => Promise<void>): Promise<void> {
      transacoesAbertas += 1;
      executados.push('BEGIN');
      await tarefa(db);
      executados.push('COMMIT');
    },
    get transacoes() {
      return transacoesAbertas;
    },
  };

  return db;
}

function migracaoFalsa(versao: number, registro: number[]): Migracao {
  return {
    versao,
    nome: `${versao}_teste`,
    async aplicar() {
      registro.push(versao);
    },
  };
}

type BancoDuble = ReturnType<typeof bancoDuble>;
const comoDb = (db: BancoDuble) => db as unknown as Parameters<typeof migrar>[0];

describe('migrar', () => {
  it('aplica as migrações em ordem num banco novo', async () => {
    const db = bancoDuble(0);
    const aplicadas: number[] = [];

    const versao = await migrar(comoDb(db), [
      migracaoFalsa(2, aplicadas),
      migracaoFalsa(1, aplicadas),
    ]);

    expect(aplicadas).toEqual([1, 2]);
    expect(versao).toBe(2);
    expect(db.userVersion).toBe(2);
  });

  it('não reaplica migração já registrada no user_version', async () => {
    const db = bancoDuble(1);
    const aplicadas: number[] = [];

    await migrar(comoDb(db), [migracaoFalsa(1, aplicadas), migracaoFalsa(2, aplicadas)]);

    expect(aplicadas).toEqual([2]);
  });

  it('não faz nada quando o banco já está na última versão', async () => {
    const db = bancoDuble(2);
    const aplicadas: number[] = [];

    const versao = await migrar(comoDb(db), [
      migracaoFalsa(1, aplicadas),
      migracaoFalsa(2, aplicadas),
    ]);

    expect(aplicadas).toEqual([]);
    expect(versao).toBe(2);
    expect(db.transacoes).toBe(0);
  });

  it('cada migração roda na própria transação exclusiva', async () => {
    const db = bancoDuble(0);
    const aplicadas: number[] = [];

    await migrar(comoDb(db), [migracaoFalsa(1, aplicadas), migracaoFalsa(2, aplicadas)]);

    expect(db.transacoes).toBe(2);
  });

  it('grava o user_version fora da transação, porque PRAGMA não é transacional', async () => {
    const db = bancoDuble(0);
    await migrar(comoDb(db), [migracaoFalsa(1, [])]);

    const posicaoCommit = db.executados.indexOf('COMMIT');
    const posicaoPragma = db.executados.findIndex((s) => s.includes('PRAGMA user_version = 1'));

    expect(posicaoPragma).toBeGreaterThan(posicaoCommit);
  });

  it('aplica os PRAGMAs de abertura antes de qualquer migração', async () => {
    const db = bancoDuble(0);
    await migrar(comoDb(db), [migracaoFalsa(1, [])]);

    // Os dois PRAGMAs vão numa única chamada, antes de qualquer transação.
    expect(db.executados[0]).toContain('journal_mode = WAL');
    expect(db.executados[0]).toContain('foreign_keys = ON');
    expect(db.executados.indexOf('BEGIN')).toBe(1);
  });

  it('os PRAGMAs de abertura ligam WAL e chaves estrangeiras', () => {
    expect(PRAGMAS_DE_ABERTURA).toContain('PRAGMA journal_mode = WAL');
    expect(PRAGMAS_DE_ABERTURA).toContain('PRAGMA foreign_keys = ON');
  });

  it('interrompe e propaga quando uma migração falha, sem avançar a versão', async () => {
    const db = bancoDuble(0);
    const aplicadas: number[] = [];
    const quebrada: Migracao = {
      versao: 2,
      nome: '2_quebrada',
      async aplicar() {
        throw new Error('coluna duplicada');
      },
    };

    await expect(
      migrar(comoDb(db), [migracaoFalsa(1, aplicadas), quebrada, migracaoFalsa(3, aplicadas)]),
    ).rejects.toThrow('coluna duplicada');

    expect(aplicadas).toEqual([1]);
    expect(db.userVersion).toBe(1);
  });

  it('trata user_version ausente como banco novo', async () => {
    const db = bancoDuble(0);
    db.getFirstAsync = async () => null;
    const aplicadas: number[] = [];

    await migrar(comoDb(db), [migracaoFalsa(1, aplicadas)]);

    expect(aplicadas).toEqual([1]);
  });
});
