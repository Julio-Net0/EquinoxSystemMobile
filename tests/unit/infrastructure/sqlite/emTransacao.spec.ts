import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { emTransacao } from '@/infrastructure/database/sqlite/emTransacao';

/** Dublê que registra qual variante de transação foi usada. */
function dbFalso() {
  const chamadas: string[] = [];
  const db = {
    async withExclusiveTransactionAsync(tarefa: (tx: unknown) => Promise<void>) {
      chamadas.push('exclusiva');
      await tarefa(db);
    },
    async withTransactionAsync(tarefa: () => Promise<void>) {
      chamadas.push('comum');
      await tarefa();
    },
  };
  return { db: db as unknown as SQLiteDatabase, chamadas };
}

function definirPlataforma(os: string) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

describe('emTransacao', () => {
  const osOriginal = Platform.OS;

  afterEach(() => {
    definirPlataforma(osOriginal);
  });

  describe('no aparelho', () => {
    beforeEach(() => definirPlataforma('android'));

    it('usa a transação exclusiva, que isola de outras conexões', async () => {
      const { db, chamadas } = dbFalso();

      await emTransacao(db, async () => {});

      expect(chamadas).toEqual(['exclusiva']);
    });

    it('entrega à tarefa a conexão da transação, não a de fora', async () => {
      const { db } = dbFalso();
      let recebida: unknown = null;

      await emTransacao(db, async (tx) => {
        recebida = tx;
      });

      // Usar o banco de fora dentro de uma transação exclusiva é exatamente o
      // que trava a conexão no aparelho.
      expect(recebida).toBe(db);
    });

    it('não abre uma segunda transação quando já está dentro de uma', async () => {
      const { db, chamadas } = dbFalso();

      await emTransacao(db, async (tx) => {
        // É o caso real da migração de seed, que roda em transação e chama os
        // repositórios, que por sua vez pedem transação.
        await emTransacao(tx, async () => {});
      });

      expect(chamadas).toEqual(['exclusiva']);
    });

    it('libera a marca ao terminar, para a próxima transação abrir de novo', async () => {
      const { db, chamadas } = dbFalso();

      await emTransacao(db, async () => {});
      await emTransacao(db, async () => {});

      expect(chamadas).toEqual(['exclusiva', 'exclusiva']);
    });

    it('libera a marca mesmo quando a tarefa falha', async () => {
      const { db, chamadas } = dbFalso();

      await expect(
        emTransacao(db, async () => {
          throw new Error('falhou no meio');
        }),
      ).rejects.toThrow('falhou no meio');

      // Sem o finally, a conexão ficaria marcada para sempre e toda transação
      // seguinte rodaria sem transação nenhuma.
      await emTransacao(db, async () => {});
      expect(chamadas).toEqual(['exclusiva', 'exclusiva']);
    });
  });

  describe('na web', () => {
    beforeEach(() => definirPlataforma('web'));

    it('usa a transação comum, porque a exclusiva não existe ali', async () => {
      const { db, chamadas } = dbFalso();

      // O expo-sqlite na web roda sobre wa-sqlite num Web Worker: a variante
      // exclusiva trava a promessa e o app nunca termina de abrir.
      await emTransacao(db, async () => {});

      expect(chamadas).toEqual(['comum']);
    });

    it('também é reentrante', async () => {
      const { db, chamadas } = dbFalso();

      await emTransacao(db, async (tx) => {
        await emTransacao(tx, async () => {});
      });

      expect(chamadas).toEqual(['comum']);
    });

    it('libera a marca quando a tarefa falha', async () => {
      const { db, chamadas } = dbFalso();

      await expect(
        emTransacao(db, async () => {
          throw new Error('falhou na web');
        }),
      ).rejects.toThrow('falhou na web');

      await emTransacao(db, async () => {});
      expect(chamadas).toEqual(['comum', 'comum']);
    });
  });
});
