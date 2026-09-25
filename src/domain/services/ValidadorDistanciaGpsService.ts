import { CoordenadasGPS } from '../value-objects/CoordenadasGPS';

export class ValidadorDistanciaGpsService {
  /**
   * Calcula a distância Haversine em metros entre duas coordenadas GPS.
   */
  public static calcularDistanciaMetros(pontoA: CoordenadasGPS, pontoB: CoordenadasGPS): number {
    const EARTH_RADIUS_METERS = 6371000;

    const lat1Rad = (pontoA.latitude * Math.PI) / 180;
    const lat2Rad = (pontoB.latitude * Math.PI) / 180;
    const deltaLatRad = ((pontoB.latitude - pontoA.latitude) * Math.PI) / 180;
    const deltaLongRad = ((pontoB.longitude - pontoA.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLongRad / 2) * Math.sin(deltaLongRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_METERS * c;
  }

  /**
   * Verifica se as coordenadas do técnico estão dentro do raio máximo em metros das coordenadas da usina.
   */
  public static estaDentroDoRaio(
    coordsTecnico: CoordenadasGPS,
    coordsUsina: CoordenadasGPS,
    raioMaximoMetros: number = 500
  ): boolean {
    const distancia = this.calcularDistanciaMetros(coordsTecnico, coordsUsina);
    return distancia <= raioMaximoMetros;
  }
}
