import { ILocationGateway } from '@/domain/gateways/ILocationGateway';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import * as Location from 'expo-location';

export class ExpoLocationGateway implements ILocationGateway {
  async solicitarPermissao(): Promise<boolean> {
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      return response.status === 'granted';
    } catch {
      return false;
    }
  }

  async obterCoordenadas(): Promise<CoordenadasGPS | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (!location || !location.coords) {
        return null;
      }

      return new CoordenadasGPS(location.coords.latitude, location.coords.longitude);
    } catch {
      return null;
    }
  }
}
