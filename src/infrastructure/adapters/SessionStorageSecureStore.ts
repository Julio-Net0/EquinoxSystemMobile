import { ISessionStorage, SessaoUsuarioData } from '@/domain/gateways/ISessionStorage';

export class SessionStorageSecureStore implements ISessionStorage {
  private memSession: SessaoUsuarioData | null = null;
  private memPin: string | null = null;

  async salvarSessao(dados: SessaoUsuarioData): Promise<void> {
    this.memSession = { ...dados };
  }

  async obterSessao(): Promise<SessaoUsuarioData | null> {
    return this.memSession;
  }

  async salvarPinLocal(pin: string): Promise<void> {
    this.memPin = pin;
  }

  async validarPinLocal(pin: string): Promise<boolean> {
    return this.memPin !== null && this.memPin === pin;
  }

  async limparSessao(): Promise<void> {
    this.memSession = null;
    this.memPin = null;
  }
}
