import { CoordenadasGPS } from '../value-objects/CoordenadasGPS';

export interface ILocationGateway {
  solicitarPermissao(): Promise<boolean>;
  obterCoordenadas(): Promise<CoordenadasGPS | null>;
}
