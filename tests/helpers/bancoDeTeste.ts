import { DatabaseSync, StatementSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Banco SQLite de verdade para os testes de integração.
 *
 * O `expo-sqlite` não roda em Node: no aparelho é um módulo nativo e na web é
 * wa-sqlite dentro de um Web Worker. Sem este adaptador, os repositórios só
 * seriam exercitados no celular — e foi essa cegueira que deixou passar o
 * deadlock de transação aninhada.
 *
 * O `node:sqlite` é o SQLite da própria runtime do Node, então o SQL, os tipos
 * e as restrições são os mesmos do aparelho. O que este adaptador faz é só
 * traduzir a API síncrona do Node para a assíncrona do expo-sqlite.
 */

type Valor = null | number | string | bigint | Uint8Array;

/** Mesma conversão que o expo-sqlite faz no bind: boolean vira 0/1. */
function paraValor(bruto: unknown): Valor {
  if (bruto === undefined || bruto === null) return null;
  if (typeof bruto === 'boolean') return bruto ? 1 : 0;
  if (typeof bruto === 'number' || typeof bruto === 'string' || typeof bruto === 'bigint') {
    return bruto;
  }
  if (bruto instanceof Uint8Array) return bruto;
  throw new TypeError(`Valor que o SQLite não aceita no bind: ${typeof bruto}`);
}

/** Aceita as duas formas do expo-sqlite: array único ou argumentos soltos. */
function paraParametros(args: unknown[]): Valor[] {
  const brutos = args.length === 1 && Array.isArray(args[0]) ? (args[0] as unknown[]) : args;
  return brutos.map(paraValor);
}

export interface BancoDeTeste {
  /** O adaptador, no formato que os repositórios esperam. */
  db: SQLiteDatabase;
  /** Consulta direta, para o teste conferir o banco sem passar pelo repositório. */
  consultar<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[];
  /** `PRAGMA user_version` cru. */
  versao(): number;
  fechar(): void;
}

export function abrirBancoDeTeste(): BancoDeTeste {
  const nativo = new DatabaseSync(':memory:');
  let profundidade = 0;

  const preparar = (sql: string): StatementSync => nativo.prepare(sql);

  const adaptador = {
    async execAsync(sql: string): Promise<void> {
      nativo.exec(sql);
    },

    async runAsync(sql: string, ...args: unknown[]) {
      const resultado = preparar(sql).run(...paraParametros(args));
      return {
        changes: Number(resultado.changes),
        lastInsertRowId: Number(resultado.lastInsertRowid),
      };
    },

    async getAllAsync<T>(sql: string, ...args: unknown[]): Promise<T[]> {
      return preparar(sql).all(...paraParametros(args)) as T[];
    },

    async getFirstAsync<T>(sql: string, ...args: unknown[]): Promise<T | null> {
      const linha = preparar(sql).get(...paraParametros(args));
      return (linha as T | undefined) ?? null;
    },

    /**
     * BEGIN IMMEDIATE é o equivalente da transação exclusiva do expo-sqlite.
     * A profundidade existe só para falhar alto se algo tentar aninhar: o
     * SQLite não aninha, e deixar passar aqui esconderia no teste exatamente o
     * bug que o `emTransacao` resolve.
     */
    async withExclusiveTransactionAsync(
      tarefa: (tx: SQLiteDatabase) => Promise<void>,
    ): Promise<void> {
      if (profundidade > 0) {
        throw new Error('Transação aninhada: o SQLite não suporta, e o aparelho travaria aqui.');
      }
      profundidade += 1;
      nativo.exec('BEGIN IMMEDIATE');
      try {
        await tarefa(adaptador as unknown as SQLiteDatabase);
        nativo.exec('COMMIT');
      } catch (erro) {
        nativo.exec('ROLLBACK');
        throw erro;
      } finally {
        profundidade -= 1;
      }
    },

    async withTransactionAsync(tarefa: () => Promise<void>): Promise<void> {
      await adaptador.withExclusiveTransactionAsync(async () => {
        await tarefa();
      });
    },

    async closeAsync(): Promise<void> {
      nativo.close();
    },
  };

  return {
    db: adaptador as unknown as SQLiteDatabase,
    consultar<T>(sql: string, ...params: unknown[]): T[] {
      return nativo.prepare(sql).all(...paraParametros(params)) as T[];
    },
    versao(): number {
      const linha = nativo.prepare('PRAGMA user_version').get() as { user_version: number };
      return linha.user_version;
    },
    fechar(): void {
      nativo.close();
    },
  };
}
