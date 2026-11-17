import type { SQLiteDatabase } from 'expo-sqlite';
import { IDadosLocaisRepository } from '@/domain/repositories/IDadosLocaisRepository';
import { emTransacao } from '../emTransacao';

/**
 * Limpa os dados de negócio do SQLite na troca de usuário (ADR 10.19).
 *
 * `action_queue` e `sync_meta` ficam de fora: a fila guarda o que ainda não
 * subiu, e os metadados de sincronização são atualizados pelo serviço de
 * troca logo em seguida.
 */
export class DadosLocaisSQLite implements IDadosLocaisRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async limparTudo(): Promise<string[]> {
    let fotos: string[] = [];

    await emTransacao(this.db, async (tx) => {
      const linhas = await tx.getAllAsync<{ foto_local_uri: string }>(
        "SELECT DISTINCT foto_local_uri FROM leituras WHERE foto_local_uri <> ''",
      );
      fotos = linhas.map((l) => l.foto_local_uri);

      // Filhos antes dos pais, para respeitar chaves estrangeiras mesmo onde
      // não há ON DELETE CASCADE (decidida_por_id, resolvida_por, autorizado_por).
      await tx.execAsync(`
        DELETE FROM notificacoes;
        DELETE FROM leituras;
        DELETE FROM usuario_enderecos;
        DELETE FROM padroes_cemig;
        DELETE FROM enderecos;
        DELETE FROM usuarios;
        DELETE FROM empresas;
      `);
    });

    return fotos;
  }
}

