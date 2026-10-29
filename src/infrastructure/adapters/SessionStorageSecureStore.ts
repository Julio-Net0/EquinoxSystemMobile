import * as SecureStore from 'expo-secure-store';
import { ISessionStorage, SessaoUsuarioData } from '@/domain/gateways/ISessionStorage';

const CHAVE_SESSAO = 'equinox_user_session_v1';
const CHAVE_PIN = 'equinox_user_pin_v1';

/**
 * Sessão no armazenamento seguro da plataforma (Keychain no iOS, Keystore no
 * Android).
 *
 * AFTER_FIRST_UNLOCK em vez do padrão WHEN_UNLOCKED porque o técnico abre o app
 * em campo logo após ligar o aparelho; ALWAYS está deprecado no SDK 57.
 */
const OPCOES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export class SessionStorageSecureStore implements ISessionStorage {
  async salvarSessao(dados: SessaoUsuarioData): Promise<void> {
    await SecureStore.setItemAsync(CHAVE_SESSAO, JSON.stringify(dados), OPCOES);
  }

  async obterSessao(): Promise<SessaoUsuarioData | null> {
    const json = await SecureStore.getItemAsync(CHAVE_SESSAO, OPCOES);
    if (!json) return null;

    try {
      return JSON.parse(json) as SessaoUsuarioData;
    } catch {
      // Conteúdo corrompido não deve travar o app: trata como sem sessão.
      await SecureStore.deleteItemAsync(CHAVE_SESSAO, OPCOES);
      return null;
    }
  }

  async salvarPinLocal(pin: string): Promise<void> {
    await SecureStore.setItemAsync(CHAVE_PIN, pin, OPCOES);
  }

  async validarPinLocal(pin: string): Promise<boolean> {
    const salvo = await SecureStore.getItemAsync(CHAVE_PIN, OPCOES);
    return salvo !== null && salvo === pin;
  }

  async temPinLocal(): Promise<boolean> {
    return (await SecureStore.getItemAsync(CHAVE_PIN, OPCOES)) !== null;
  }

  async limparSessao(): Promise<void> {
    await SecureStore.deleteItemAsync(CHAVE_SESSAO, OPCOES);
    await SecureStore.deleteItemAsync(CHAVE_PIN, OPCOES);
  }
}
