import {
  CredencialOffline,
  ICredencialOfflineGateway,
} from '@/domain/gateways/ICredencialOfflineGateway';

export class CredencialOfflineMemory implements ICredencialOfflineGateway {
  private itens = new Map<string, CredencialOffline>();

  async guardar(email: string, credencial: CredencialOffline): Promise<void> {
    this.itens.set(email.trim().toLowerCase(), { ...credencial });
  }

  async buscar(email: string): Promise<CredencialOffline | null> {
    return this.itens.get(email.trim().toLowerCase()) ?? null;
  }

  async esquecer(email: string): Promise<void> {
    this.itens.delete(email.trim().toLowerCase());
  }
}
