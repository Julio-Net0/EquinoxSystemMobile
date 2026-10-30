import { ISessionStorage, SessaoUsuarioData } from '@/domain/gateways/ISessionStorage';

const CHAVE_SESSAO = 'equinox_user_session_v1';
const CHAVE_PIN = 'equinox_user_pin_v1';

/**
 * Variante web do armazenamento de sessão. O Metro resolve este arquivo no
 * lugar do `.ts` quando a plataforma é web.
 *
 * `expo-secure-store` existe só em Android, iOS e tvOS — na web ele nem expõe
 * as funções, e chamá-las quebra o app.
 *
 * **Isto não é armazenamento seguro.** `localStorage` é legível por qualquer
 * script da mesma origem e não é cifrado. A web aqui serve apenas para
 * conferir a interface durante o desenvolvimento; o app de verdade roda no
 * aparelho, onde a sessão vai para o Keychain ou o Keystore.
 */
export class SessionStorageSecureStore implements ISessionStorage {
  async salvarSessao(dados: SessaoUsuarioData): Promise<void> {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(dados));
  }

  async obterSessao(): Promise<SessaoUsuarioData | null> {
    const json = localStorage.getItem(CHAVE_SESSAO);
    if (!json) return null;

    try {
      return JSON.parse(json) as SessaoUsuarioData;
    } catch {
      localStorage.removeItem(CHAVE_SESSAO);
      return null;
    }
  }

  async salvarPinLocal(pin: string): Promise<void> {
    localStorage.setItem(CHAVE_PIN, pin);
  }

  async validarPinLocal(pin: string): Promise<boolean> {
    const salvo = localStorage.getItem(CHAVE_PIN);
    return salvo !== null && salvo === pin;
  }

  async temPinLocal(): Promise<boolean> {
    return localStorage.getItem(CHAVE_PIN) !== null;
  }

  async limparSessao(): Promise<void> {
    localStorage.removeItem(CHAVE_SESSAO);
    localStorage.removeItem(CHAVE_PIN);
  }
}
