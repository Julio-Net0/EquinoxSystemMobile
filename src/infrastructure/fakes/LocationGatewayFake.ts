import { ILocationGateway } from '@/domain/gateways/ILocationGateway';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';

export class LocationGatewayFake implements ILocationGateway {
  public permissaoConcedida = true;
  /** Praça Sete, Belo Horizonte — mesma região do seed. */
  public coordenadasFake: CoordenadasGPS | null = new CoordenadasGPS(-19.9191, -43.9386);

  async temPermissao(): Promise<boolean> {
    return this.permissaoConcedida;
  }

  async solicitarPermissao(): Promise<boolean> {
    return this.permissaoConcedida;
  }

  async obterCoordenadas(): Promise<CoordenadasGPS | null> {
    if (!this.permissaoConcedida) return null;
    return this.coordenadasFake;
  }
}
