import type { SQLiteDatabase } from 'expo-sqlite';
import {
  IUnidadeDeTrabalho,
  RepositoriosDaTransacao,
} from '@/domain/repositories/IUnidadeDeTrabalho';
import { EmpresaRepositorySQLite } from './repositories/EmpresaRepositorySQLite';
import { EnderecoRepositorySQLite } from './repositories/EnderecoRepositorySQLite';
import { PadraoRepositorySQLite } from './repositories/PadraoRepositorySQLite';
import { LeituraRepositorySQLite } from './repositories/LeituraRepositorySQLite';
import { UsuarioRepositorySQLite } from './repositories/UsuarioRepositorySQLite';
import { NotificacaoRepositorySQLite } from './repositories/NotificacaoRepositorySQLite';
import { ActionQueueRepositorySQLite } from './repositories/ActionQueueRepositorySQLite';
import { SyncMetaRepositorySQLite } from './repositories/SyncMetaRepositorySQLite';
import { emTransacao } from './emTransacao';

/** Repositórios "crus" sobre uma conexão: gravam no SQLite e nada mais. */
export function criarRepositoriosCrus(db: SQLiteDatabase): RepositoriosDaTransacao {
  return {
    empresa: new EmpresaRepositorySQLite(db),
    endereco: new EnderecoRepositorySQLite(db),
    padrao: new PadraoRepositorySQLite(db),
    leitura: new LeituraRepositorySQLite(db),
    usuario: new UsuarioRepositorySQLite(db),
    notificacao: new NotificacaoRepositorySQLite(db),
    actionQueue: new ActionQueueRepositorySQLite(db),
    syncMeta: new SyncMetaRepositorySQLite(db),
  };
}

/**
 * Unidade de trabalho sobre o SQLite.
 *
 * A tarefa recebe repositórios criados sobre a conexão DA TRANSAÇÃO, não a de
 * fora: no aparelho a transação é exclusiva, e usar a conexão externa dentro
 * dela trava o banco (ver `emTransacao`). É por isso que os repositórios são
 * recriados a cada execução — é barato, eles só guardam a referência.
 */
export class UnidadeDeTrabalhoSQLite implements IUnidadeDeTrabalho {
  constructor(private readonly db: SQLiteDatabase) {}

  async executar<T>(tarefa: (repos: RepositoriosDaTransacao) => Promise<T>): Promise<T> {
    let resultado!: T;

    await emTransacao(this.db, async (tx) => {
      resultado = await tarefa(criarRepositoriosCrus(tx));
    });

    return resultado;
  }
}
