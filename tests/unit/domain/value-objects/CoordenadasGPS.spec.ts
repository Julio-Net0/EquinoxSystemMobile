import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';

describe('CoordenadasGPS Value Object', () => {
  it('deve criar CoordenadasGPS válidas', () => {
    const lat = -23.55052;
    const long = -46.633308;
    const coords = new CoordenadasGPS(lat, long);

    expect(coords.latitude).toBe(lat);
    expect(coords.longitude).toBe(long);
    expect(coords.timestamp).toBeInstanceOf(Date);
  });

  it('deve lançar erro para latitude fora do intervalo [-90, 90]', () => {
    expect(() => new CoordenadasGPS(-91, -46.63)).toThrow('Latitude inválida');
    expect(() => new CoordenadasGPS(91, -46.63)).toThrow('Latitude inválida');
  });

  it('deve lançar erro para longitude fora do intervalo [-180, 180]', () => {
    expect(() => new CoordenadasGPS(-23.55, -181)).toThrow('Longitude inválida');
    expect(() => new CoordenadasGPS(-23.55, 181)).toThrow('Longitude inválida');
  });

  it('deve comparar igualdade de coordenadas', () => {
    const coords1 = new CoordenadasGPS(-23.55, -46.63);
    const coords2 = new CoordenadasGPS(-23.55, -46.63);
    const coords3 = new CoordenadasGPS(-22.00, -45.00);

    expect(coords1.equals(coords2)).toBe(true);
    expect(coords1.equals(coords3)).toBe(false);
  });
});
