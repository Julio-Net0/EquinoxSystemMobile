import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente do Supabase de mentira para os testes dos adaptadores.
 *
 * Nenhum teste fala com a nuvem. Este dublê imita só a forma da API que os
 * adaptadores usam — o construtor de consultas encadeável do PostgREST, `rpc`,
 * `auth` e `storage` — e registra o que foi pedido, para o teste conferir.
 */

export interface Resposta {
  data?: unknown;
  error?: { message: string; code?: string; status?: number; statusCode?: string; name?: string } | null;
  status?: number;
}

export interface ConsultaRegistrada {
  tabela: string;
  operacao: string;
  carga?: unknown;
  opcoes?: unknown;
  filtros: [string, ...unknown[]][];
}

const OK: Resposta = { data: null, error: null, status: 200 };

export function criarClienteFalso() {
  const consultas: ConsultaRegistrada[] = [];
  const rpcs: { nome: string; args: unknown }[] = [];
  /** Fila de respostas por "tabela:operacao" (ou "rpc:nome"). Vazia = sucesso. */
  const respostas = new Map<string, Resposta[]>();

  const responder = (chave: string, ...lista: Resposta[]): void => {
    respostas.set(chave, [...(respostas.get(chave) ?? []), ...lista]);
  };

  const proxima = (chave: string): Resposta => {
    const fila = respostas.get(chave);
    const resposta = fila?.shift();
    return { ...OK, ...(resposta ?? {}) };
  };

  function from(tabela: string) {
    const registro: ConsultaRegistrada = { tabela, operacao: '', filtros: [] };

    const construtor: Record<string, unknown> = {};
    const verbo =
      (operacao: string) =>
      (carga?: unknown, opcoes?: unknown) => {
        if (registro.operacao === '') {
          registro.operacao = operacao;
          registro.carga = carga;
          registro.opcoes = opcoes;
          consultas.push(registro);
        }
        return construtor;
      };
    const filtro =
      (nome: string) =>
      (...args: unknown[]) => {
        registro.filtros.push([nome, ...args]);
        return construtor;
      };

    for (const operacao of ['select', 'insert', 'update', 'upsert', 'delete']) {
      construtor[operacao] = verbo(operacao);
    }
    for (const nome of ['eq', 'gt', 'gte', 'order', 'range', 'maybeSingle']) {
      construtor[nome] = filtro(nome);
    }
    // O construtor do PostgREST é "thenable": a requisição sai no await.
    construtor.then = (resolver: (r: Resposta) => unknown, rejeitar?: (e: unknown) => unknown) =>
      Promise.resolve(proxima(`${tabela}:${registro.operacao}`)).then(resolver, rejeitar);

    return construtor;
  }

  const auth = {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(async () => ({ error: null })),
    getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
    updateUser: jest.fn(async () => ({ data: {}, error: null })),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  };

  const balde = {
    upload: jest.fn(async () => ({ data: { path: 'ok' }, error: null as Resposta['error'] })),
    createSignedUrl: jest.fn(async () => ({
      data: { signedUrl: 'https://projeto.supabase.co/storage/v1/object/sign/x?token=t' } as
        | { signedUrl: string }
        | null,
      error: null as Resposta['error'],
    })),
  };
  const storage = { from: jest.fn(() => balde) };

  const rpc = jest.fn(async (nome: string, args: unknown) => {
    rpcs.push({ nome, args });
    return proxima(`rpc:${nome}`);
  });

  return {
    cliente: { from, auth, storage, rpc } as unknown as SupabaseClient,
    auth,
    balde,
    storage,
    rpc,
    consultas,
    rpcs,
    responder,
  };
}

/** Sessão no formato que `auth.getSession()` devolve. */
export const sessaoDe = (id: string, email: string) => ({
  data: { session: { user: { id, email } } },
  error: null,
});

export const ERRO_DE_REDE = { message: 'TypeError: Network request failed' };
