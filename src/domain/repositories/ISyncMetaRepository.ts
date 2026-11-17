/** Chaves conhecidas do estado local da sincronização. */
export const CHAVE_CURSORES = 'cursores_pull';
export const CHAVE_ULTIMA_SYNC = 'ultima_sync_em';
export const CHAVE_ULTIMO_ERRO = 'ultimo_erro';
export const CHAVE_USUARIO_DO_CURSOR = 'usuario_do_cursor';

/**
 * Pequeno chave-valor local com o estado da sincronização: até onde o pull já
 * foi (os cursores), quando foi a última sincronização e o último erro.
 *
 * Fica no SQLite, e não no secure store, porque não é segredo e precisa ser
 * gravado na mesma transação dos dados que o pull aplica: cursor adiantado sem
 * os dados correspondentes faria o aparelho pular alterações para sempre.
 */
export interface ISyncMetaRepository {
  obter(chave: string): Promise<string | null>;
  definir(chave: string, valor: string | null): Promise<void>;
}
