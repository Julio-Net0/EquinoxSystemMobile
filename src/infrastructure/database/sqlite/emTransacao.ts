import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Conexões que já estão dentro de uma transação.
 *
 * WeakSet para não segurar referência ao banco depois que ele fecha.
 */
const dentroDeTransacao = new WeakSet<object>();

/**
 * Executa a tarefa numa transação, de forma reentrante.
 *
 * Duas coisas acontecem aqui, e as duas vieram de bugs reais:
 *
 * 1. **Reentrância.** A migração de seed roda dentro de uma transação e usa os
 *    repositórios, que por sua vez pedem transação. O SQLite não aninha: a
 *    segunda tentativa trava a conexão. Quando já estamos dentro de uma, a
 *    tarefa simplesmente participa dela.
 *
 * 2. **Plataforma.** No aparelho usa `withExclusiveTransactionAsync`, que
 *    isola de outras conexões — é o que garante que a substituição de uma
 *    leitura (UPDATE da vigente + INSERT da nova) não seja vista pela metade.
 *    Na web essa variante não existe (o expo-sqlite roda sobre wa-sqlite num
 *    Web Worker) e trava a promessa; ali a transação comum dá a atomicidade
 *    que importa, porque há uma conexão só.
 *
 * A tarefa recebe a conexão que deve usar. Dentro de uma transação exclusiva é
 * obrigatório usar o objeto recebido, e não o banco de fora — usar o de fora é
 * exatamente o que causa o travamento.
 */
export async function emTransacao(
  db: SQLiteDatabase,
  tarefa: (tx: SQLiteDatabase) => Promise<void>,
): Promise<void> {
  if (dentroDeTransacao.has(db)) {
    await tarefa(db);
    return;
  }

  if (Platform.OS === 'web') {
    dentroDeTransacao.add(db);
    try {
      await db.withTransactionAsync(async () => {
        await tarefa(db);
      });
    } finally {
      dentroDeTransacao.delete(db);
    }
    return;
  }

  await db.withExclusiveTransactionAsync(async (tx) => {
    const conexao = tx as SQLiteDatabase;
    dentroDeTransacao.add(conexao);
    try {
      await tarefa(conexao);
    } finally {
      dentroDeTransacao.delete(conexao);
    }
  });
}
