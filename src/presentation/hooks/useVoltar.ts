import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

/**
 * Volta na pilha, ou vai para um destino quando não há para onde voltar.
 *
 * `router.back()` sozinho falha com "GO_BACK was not handled by any navigator"
 * sempre que a tela é a primeira da pilha — abrir por link direto, recarregar
 * o app nela, ou chegar nela logo após o login. No aparelho isso vira um botão
 * de voltar que não faz nada.
 */
export function useVoltar(destinoPadrao: Href) {
  const router = useRouter();

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(destinoPadrao);
  }, [router, destinoPadrao]);
}
