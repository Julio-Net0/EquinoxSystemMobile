import { IConectividadeGateway } from '@/domain/gateways/IConectividadeGateway';

/** Rede de mentira: o teste liga e desliga com `definirOnline`. */
export class ConectividadeFake implements IConectividadeGateway {
  private ouvintes = new Set<(online: boolean) => void>();

  constructor(private online = true) {}

  async estaOnline(): Promise<boolean> {
    return this.online;
  }

  observar(ouvinte: (online: boolean) => void): () => void {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  }

  definirOnline(online: boolean): void {
    this.online = online;
    this.ouvintes.forEach((ouvinte) => ouvinte(online));
  }
}
