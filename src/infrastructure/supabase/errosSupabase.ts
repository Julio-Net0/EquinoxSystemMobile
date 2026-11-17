import { MotivoFalhaRemota, ResultadoRemoto, remotoFalhou } from '@/domain/gateways/ResultadoRemoto';

/**
 * Formato comum dos erros que o supabase-js devolve (Auth, PostgREST e
 * Storage usam nomes de campo diferentes para a mesma ideia).
 */
export interface ErroSupabase {
  message?: string;
  name?: string;
  code?: string | number;
  status?: number;
  statusCode?: string | number;
}

const PADROES_DE_REDE = /network request failed|failed to fetch|fetch failed|network error|timeout|aborted/i;

/** Sem resposta do servidor: avião, sem sinal, DNS, servidor fora do ar. */
export function ehErroDeRede(erro: ErroSupabase | null | undefined, statusHttp?: number): boolean {
  if (!erro) return false;
  if (erro.name === 'AuthRetryableFetchError') return true;
  if (statusHttp === 0 || erro.status === 0) return true;
  if (typeof statusHttp === 'number' && statusHttp >= 502 && statusHttp <= 504) return true;
  return PADROES_DE_REDE.test(erro.message ?? '');
}

/** O servidor respondeu que o token não vale mais. */
export function ehErroDeSessao(erro: ErroSupabase | null | undefined, statusHttp?: number): boolean {
  if (!erro) return false;
  const status = Number(statusHttp ?? erro.status ?? erro.statusCode);
  if (status === 401) return true;
  if (erro.code === 'PGRST301' || erro.code === 'PGRST302') return true;
  return /jwt expired|invalid jwt|refresh token/i.test(erro.message ?? '');
}

export function motivoDe(
  erro: ErroSupabase | null | undefined,
  statusHttp?: number,
): MotivoFalhaRemota {
  if (ehErroDeRede(erro, statusHttp)) return 'rede';
  if (ehErroDeSessao(erro, statusHttp)) return 'nao_autenticado';
  return 'rejeitado';
}

/**
 * Traduz as recusas do servidor que o técnico pode entender. O que não tem
 * tradução segue com a mensagem original, que vai para a tela de diagnóstico.
 */
function mensagemLegivel(erro: ErroSupabase): string {
  const original = erro.message ?? 'Erro desconhecido';

  // A recusa seca do RLS vem em inglês e não diz nada ao técnico. Já as
  // funções do banco levantam o mesmo código 42501 com o motivo em português,
  // e essa mensagem segue como veio.
  if (/row-level security|permission denied/i.test(original)) {
    return 'A nuvem recusou: seu perfil não tem permissão para esta operação';
  }
  if (erro.code === '23503') {
    return 'A nuvem recusou: este registro depende de outro que não existe mais lá';
  }
  if (erro.code === '23505') {
    return 'A nuvem recusou: já existe um registro igual';
  }
  return original;
}

export function falhaDe<T = void>(
  erro: ErroSupabase | null | undefined,
  statusHttp?: number,
): ResultadoRemoto<T> {
  const motivo = motivoDe(erro, statusHttp);

  if (motivo === 'rede') return remotoFalhou<T>('rede', 'Sem conexão com a nuvem');
  if (motivo === 'nao_autenticado') {
    return remotoFalhou<T>('nao_autenticado', 'A sessão na nuvem expirou');
  }
  return remotoFalhou<T>('rejeitado', mensagemLegivel(erro ?? {}));
}

/**
 * O supabase-js devolve erro em vez de lançar, mas uma falha de rede crua
 * (fetch rejeitado antes de virar resposta) ainda pode escapar como exceção.
 */
export async function protegido<T>(
  tarefa: () => Promise<ResultadoRemoto<T>>,
): Promise<ResultadoRemoto<T>> {
  try {
    return await tarefa();
  } catch (erro) {
    return falhaDe<T>(erro as ErroSupabase);
  }
}
