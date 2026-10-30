import { ExpoLocationGateway } from '@/infrastructure/hardware/ExpoLocationGateway';
import * as Location from 'expo-location';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: {
    High: 4,
  },
}));

describe('ExpoLocationGateway (Infraestrutura Concreta)', () => {
  let gateway: ExpoLocationGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new ExpoLocationGateway();
  });

  it('deve retornar true quando a permissao de localizacao for concedida', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
    });

    const concedida = await gateway.solicitarPermissao();
    expect(concedida).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('deve retornar false quando a permissao for negada', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
      granted: false,
    });

    const concedida = await gateway.solicitarPermissao();
    expect(concedida).toBe(false);
  });

  it('deve obter coordenadas GPS com alta precisao e retornar Value Object do Dominio', async () => {
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: {
        latitude: -19.9208,
        longitude: -43.9378,
      },
    });

    const coords = await gateway.obterCoordenadas();

    expect(coords).not.toBeNull();
    expect(coords?.latitude).toBe(-19.9208);
    expect(coords?.longitude).toBe(-43.9378);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.High,
    });
  });

  it('deve retornar null se ocorrer erro ao obter coordenadas', async () => {
    (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error('GPS desativado'));

    const coords = await gateway.obterCoordenadas();
    expect(coords).toBeNull();
  });
});
