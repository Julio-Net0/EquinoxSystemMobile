import * as SecureStore from 'expo-secure-store';
import { ISessionStorage, SessaoUsuarioData } from '@/domain/gateways/ISessionStorage';

const KEY_SESSION = 'equinox_user_session_v1';
const KEY_PIN = 'equinox_user_pin_v1';

export class SessionStorageSecureStore implements ISessionStorage {
  private memoryFallbackSession: SessaoUsuarioData | null = null;
  private memoryFallbackPin: string | null = null;

  async salvarSessao(dados: SessaoUsuarioData): Promise<void> {
    const json = JSON.stringify(dados);
    try {
      await SecureStore.setItemAsync(KEY_SESSION, json);
    } catch {
      this.memoryFallbackSession = { ...dados };
    }
  }

  async obterSessao(): Promise<SessaoUsuarioData | null> {
    try {
      const json = await SecureStore.getItemAsync(KEY_SESSION);
      if (json) {
        return JSON.parse(json) as SessaoUsuarioData;
      }
    } catch {
      return this.memoryFallbackSession;
    }
    return this.memoryFallbackSession;
  }

  async salvarPinLocal(pin: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEY_PIN, pin);
    } catch {
      this.memoryFallbackPin = pin;
    }
  }

  async validarPinLocal(pin: string): Promise<boolean> {
    try {
      const savedPin = await SecureStore.getItemAsync(KEY_PIN);
      if (savedPin) {
        return savedPin === pin;
      }
    } catch {
      return this.memoryFallbackPin !== null && this.memoryFallbackPin === pin;
    }
    return this.memoryFallbackPin !== null && this.memoryFallbackPin === pin;
  }

  async limparSessao(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY_SESSION);
      await SecureStore.deleteItemAsync(KEY_PIN);
    } catch {
      // Ignora erro de exclusão se a chave não existir
    }
    this.memoryFallbackSession = null;
    this.memoryFallbackPin = null;
  }
}
