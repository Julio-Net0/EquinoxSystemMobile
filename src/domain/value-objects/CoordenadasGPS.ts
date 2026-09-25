export class CoordenadasGPS {
  public readonly latitude: number;
  public readonly longitude: number;
  public readonly timestamp: Date;

  constructor(latitude: number, longitude: number, timestamp?: Date) {
    if (latitude < -90 || latitude > 90) {
      throw new Error('Latitude inválida: deve estar entre -90 e 90');
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error('Longitude inválida: deve estar entre -180 e 180');
    }
    this.latitude = latitude;
    this.longitude = longitude;
    this.timestamp = timestamp ?? new Date();
  }

  public equals(other: CoordenadasGPS): boolean {
    if (!other) return false;
    return this.latitude === other.latitude && this.longitude === other.longitude;
  }
}
