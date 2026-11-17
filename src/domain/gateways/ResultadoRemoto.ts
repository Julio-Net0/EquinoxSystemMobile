/**
 * Por que uma chamada à nuvem não deu certo. A distinção decide o que o
 * aparelho faz em seguida:
 *
 * - `rede`: sem conexão ou servidor fora do ar. Não é culpa do dado — tenta de
 *   novo depois, sem contar como tentativa.
 * - `nao_autenticado`: não há sessão válida na nuvem. Precisa de novo login
 *   com rede; os dados pendentes continuam guardados.
 * - `rejeitado`: o servidor recebeu e recusou (regra de segurança, dado
 *   inválido). Repetir igual dá no mesmo, então conta como tentativa.
 */
export type MotivoFalhaRemota = 'rede' | 'nao_autenticado' | 'rejeitado';

export type ResultadoRemoto<T = void> =
  | { ok: true; valor: T }
  | {
      ok: false;
      motivo: MotivoFalhaRemota;
      mensagem: string;
      /**
       * Recusa que não muda tentando de novo (o problema está no aparelho):
       * o item da fila é isolado na hora (ADR 10.19).
       */
      definitivo?: boolean;
    };

export function remotoOk(): ResultadoRemoto<void>;
export function remotoOk<T>(valor: T): ResultadoRemoto<T>;
export function remotoOk<T>(valor?: T): ResultadoRemoto<T> {
  return { ok: true, valor: valor as T };
}

export function remotoFalhou<T = void>(
  motivo: MotivoFalhaRemota,
  mensagem: string,
  definitivo = false,
): ResultadoRemoto<T> {
  return definitivo ? { ok: false, motivo, mensagem, definitivo } : { ok: false, motivo, mensagem };
}
