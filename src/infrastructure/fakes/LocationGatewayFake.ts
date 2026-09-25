import { ILocationGateway } from '@/domain/gateways/ILocationGateway';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';

export class LocationGatewayFake implements ILocationGateway {
  public permissaoConcedida: boolean = true;
  public coordenadasFake: CoordenadasGPS = new CoordenadasGPS(-23.55052, -46.633308);

  async solicitarPermissao(): Promise<boolean> {
    return this.permissaoConcedida;
  }

  async obterCoordenadas(): Promise<CoordenadasGPS | null> {
    if (!this.permissaoConcedida) {
      return null;
    }
    return this.coordenadasFake;
  }
}
