import { AppState } from 'react-native';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { ConfiguracaoSupabase } from '../config/ambiente';
import { ArmazenamentoDeSessao } from '../adapters/CofreSeguroEmPartes';

/** Nome sob o qual a sessão fica no cofre. Só letras e ponto: o cofre exige. */
export const CHAVE_DA_SESSAO_REMOTA = 'equinox.auth';

/** Bucket privado dos comprovantes (supabase/migrations). */
export const BUCKET_COMPROVANTES = 'comprovantes';

/**
 * Cliente do Supabase para o app.
 *
 * - `storage`: os tokens vão para o armazenamento seguro, nunca para
 *   AsyncStorage em claro.
 * - `autoRefreshToken`: o token de acesso é renovado em segundo plano enquanto
 *   o app está aberto e há rede.
 * - `detectSessionInUrl: false`: não há fluxo de OAuth por URL num app nativo.
 *
 * Só recebe a chave anônima — quem garante isso é `lerConfiguracaoSupabase`.
 */
export function criarClienteSupabase(
  configuracao: ConfiguracaoSupabase,
  armazenamento: ArmazenamentoDeSessao,
): SupabaseClient {
  return createClient(configuracao.url, configuracao.chaveAnonima, {
    auth: {
      storage: armazenamento,
      storageKey: CHAVE_DA_SESSAO_REMOTA,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Liga a renovação automática só enquanto o app está em primeiro plano, como
 * a documentação do Supabase orienta para React Native: em segundo plano o
 * temporizador não é confiável e só gastaria bateria. Devolve a função que
 * desfaz a inscrição.
 */
export function acompanharPrimeiroPlano(cliente: SupabaseClient): () => void {
  const aoMudar = (estado: string | null | undefined): void => {
    if (estado === 'active') {
      void cliente.auth.startAutoRefresh();
    } else {
      void cliente.auth.stopAutoRefresh();
    }
  };

  const inscricao = AppState.addEventListener('change', aoMudar);
  aoMudar(AppState.currentState);

  return () => inscricao.remove();
}
