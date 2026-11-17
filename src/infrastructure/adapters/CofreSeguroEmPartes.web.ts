/** Mesmo formato que o supabase-js espera do armazenamento de sessão. */
export interface ArmazenamentoDeSessao {
  getItem(chave: string): Promise<string | null>;
  setItem(chave: string, valor: string): Promise<void>;
  removeItem(chave: string): Promise<void>;
}

export const TAMANHO_DA_PARTE = 600;

/**
 * Variante web do cofre dos tokens. O Metro resolve este arquivo no lugar do
 * `.ts` quando a plataforma é web.
 *
 * `expo-secure-store` não existe na web. **Isto não é armazenamento seguro:**
 * `localStorage` é legível por qualquer script da mesma origem e não é
 * cifrado. A web serve só para conferir a interface durante o
 * desenvolvimento; o app de verdade roda no aparelho, onde os tokens ficam no
 * Keychain ou no Keystore.
 */
export class CofreSeguroEmPartes implements ArmazenamentoDeSessao {
  async getItem(chave: string): Promise<string | null> {
    return localStorage.getItem(chave);
  }

  async setItem(chave: string, valor: string): Promise<void> {
    localStorage.setItem(chave, valor);
  }

  async removeItem(chave: string): Promise<void> {
    localStorage.removeItem(chave);
  }
}
