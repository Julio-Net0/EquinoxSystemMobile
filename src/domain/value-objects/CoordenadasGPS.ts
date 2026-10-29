export class CoordenadasGPS {
  public readonly latitude: number;
  public readonly longitude: number;
  /**
   * Raio de incerteza informado pelo GPS, em metros. Nulo quando o aparelho
   * não informou. Serve para interpretar uma divergência de distância: 400 m de
   * desvio com precisão de 500 m não quer dizer nada.
   */
  public readonly precisaoMetros: number | null;
  public readonly timestamp: Date;

  constructor(
    latitude: number,
    longitude: number,
    precisaoMetros?: number | null,
    timestamp?: Date,
  ) {
    if (latitude < -90 || latitude > 90) {
      throw new Error('Latitude inválida: deve estar entre -90 e 90');
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error('Longitude inválida: deve estar entre -180 e 180');
    }
    if (precisaoMetros !== undefined && precisaoMetros !== null && precisaoMetros < 0) {
      throw new Error('Precisão do GPS não pode ser negativa');
    }

    this.latitude = latitude;
    this.longitude = longitude;
    this.precisaoMetros = precisaoMetros ?? null;
    this.timestamp = timestamp ?? new Date();
  }

  /** Ignora precisão e instante: o que identifica o ponto é a coordenada. */
  public equals(other: CoordenadasGPS): boolean {
    if (!other) return false;
    return this.latitude === other.latitude && this.longitude === other.longitude;
  }
}
