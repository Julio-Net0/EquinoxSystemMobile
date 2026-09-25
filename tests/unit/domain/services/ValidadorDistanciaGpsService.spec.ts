import { ValidadorDistanciaGpsService } from '@/domain/services/ValidadorDistanciaGpsService';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';

describe('ValidadorDistanciaGpsService Domain Service', () => {
  it('deve calcular a distância em metros corretamente (Haversine)', () => {
    // Ponto A: Praça da Sé, São Paulo (-23.55052, -46.633308)
    const pontoA = new CoordenadasGPS(-23.55052, -46.633308);
    // Ponto B: Avenida Paulista (-23.56168, -46.655981) - aprox ~2.6 km
    const pontoB = new CoordenadasGPS(-23.56168, -46.655981);

    const distanciaMetros = ValidadorDistanciaGpsService.calcularDistanciaMetros(pontoA, pontoB);
    expect(distanciaMetros).toBeGreaterThan(2500);
    expect(distanciaMetros).toBeLessThan(2800);
  });

  it('deve validar se o técnico está dentro do raio máximo de presença', () => {
    const coordsUsina = new CoordenadasGPS(-23.55052, -46.633308);
    const coordsTecnicoProximo = new CoordenadasGPS(-23.55060, -46.633350); // poucos metros de distância
    const coordsTecnicoLonge = new CoordenadasGPS(-23.60000, -46.700000); // muitos km de distância

    const estaProximo = ValidadorDistanciaGpsService.estaDentroDoRaio(
      coordsTecnicoProximo,
      coordsUsina,
      500 // raio máximo 500 metros
    );

    const estaLonge = ValidadorDistanciaGpsService.estaDentroDoRaio(
      coordsTecnicoLonge,
      coordsUsina,
      500
    );

    expect(estaProximo).toBe(true);
    expect(estaLonge).toBe(false);
  });
});
