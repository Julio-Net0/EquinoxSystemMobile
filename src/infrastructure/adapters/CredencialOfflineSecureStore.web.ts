import {
  CredencialOffline,
  ICredencialOfflineGateway,
} from '@/domain/gateways/ICredencialOfflineGateway';

/**
 * Variante web, só para conferir a interface durante o desenvolvimento.
 * **Não é armazenamento seguro** — `localStorage` é legível por qualquer
 * script da origem. O app de verdade usa o Keychain/Keystore (arquivo `.ts`).
 */
export class CredencialOfflineSecureStore implements ICredencialOfflineGateway {
  async guardar(email: string, credencial: CredencialOffline): Promise<void> {
    localStorage.setItem(chaveDe(email), JSON.stringify(credencial));
  }

  async buscar(email: string): Promise<CredencialOffline | null> {
    const json = localStorage.getItem(chaveDe(email));
    if (!json) return null;

    try {
      return JSON.parse(json) as CredencialOffline;
    } catch {
      localStorage.removeItem(chaveDe(email));
      return null;
    }
  }

  async esquecer(email: string): Promise<void> {
    localStorage.removeItem(chaveDe(email));
  }
}

const chaveDe = (email: string): string => `equinox.offline.${email.trim().toLowerCase()}`;
