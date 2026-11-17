import * as SecureStore from 'expo-secure-store';
import {
  CredencialOffline,
  ICredencialOfflineGateway,
} from '@/domain/gateways/ICredencialOfflineGateway';

/** Mesmo nível de acesso da sessão (ver `SessionStorageSecureStore`). */
const OPCOES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/**
 * Credenciais de acesso offline no Keychain/Keystore, uma chave por e-mail.
 *
 * O expo-secure-store só aceita letras, números, ".", "-" e "_" na chave, e
 * um e-mail tem "@" e às vezes "+"; por isso o e-mail entra em hexadecimal.
 * Cada valor tem a sessão e a verificação da senha — algumas centenas de
 * bytes, longe do limite do cofre.
 */
export class CredencialOfflineSecureStore implements ICredencialOfflineGateway {
  async guardar(email: string, credencial: CredencialOffline): Promise<void> {
    await SecureStore.setItemAsync(chaveDe(email), JSON.stringify(credencial), OPCOES);
  }

  async buscar(email: string): Promise<CredencialOffline | null> {
    const chave = chaveDe(email);
    const json = await SecureStore.getItemAsync(chave, OPCOES);
    if (!json) return null;

    try {
      return JSON.parse(json) as CredencialOffline;
    } catch {
      await SecureStore.deleteItemAsync(chave, OPCOES);
      return null;
    }
  }

  async esquecer(email: string): Promise<void> {
    await SecureStore.deleteItemAsync(chaveDe(email), OPCOES);
  }
}

export function chaveDe(email: string): string {
  const normalizado = email.trim().toLowerCase();
  let hex = '';
  for (const byte of new TextEncoder().encode(normalizado)) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return `equinox.offline.${hex}`;
}
