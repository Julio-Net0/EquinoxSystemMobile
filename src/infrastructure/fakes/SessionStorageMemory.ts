import { ISessionStorage, SessaoUsuarioData } from '@/domain/gateways/ISessionStorage';

export class SessionStorageMemory implements ISessionStorage {
  private sessao: SessaoUsuarioData | null = null;
  private pinLocal: string | null = null;

  async salvarSessao(dados: SessaoUsuarioData): Promise<void> {
    this.sessao = { ...dados };
  }

  async obterSessao(): Promise<SessaoUsuarioData | null> {
    return this.sessao;
  }

  async salvarPinLocal(pin: string): Promise<void> {
    this.pinLocal = pin;
  }

  async validarPinLocal(pin: string): Promise<boolean> {
    return this.pinLocal !== null && this.pinLocal === pin;
  }

  async limparSessao(): Promise<void> {
    this.sessao = null;
    this.pinLocal = null;
  }
}
