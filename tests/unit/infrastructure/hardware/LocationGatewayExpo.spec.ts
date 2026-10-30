import * as Location from 'expo-location';
import { LocationGatewayExpo } from '@/infrastructure/hardware/location/LocationGatewayExpo';

const concedida = { granted: true, status: 'granted' };
const negada = { granted: false, status: 'denied' };

const posicao = (sobrescrita: Record<string, unknown> = {}) => ({
  coords: {
    latitude: -19.9191,
    longitude: -43.9386,
    accuracy: 8,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    ...sobrescrita,
  },
  timestamp: 1_767_225_600_000,
});

describe('LocationGatewayExpo', () => {
  let gateway: LocationGatewayExpo;

  beforeEach(() => {
    gateway = new LocationGatewayExpo();
    jest.clearAllMocks();
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue(concedida);
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(posicao());
  });

  describe('permissões', () => {
    it('consulta a permissão de primeiro plano', async () => {
      expect(await gateway.temPermissao()).toBe(true);
      expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
    });

    it('pede a permissão ao usuário', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce(concedida);

      expect(await gateway.solicitarPermissao()).toBe(true);
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('leitura da posição', () => {
    it('mapeia a posição para CoordenadasGPS', async () => {
      const coords = await gateway.obterCoordenadas();

      expect(coords?.latitude).toBeCloseTo(-19.9191);
      expect(coords?.longitude).toBeCloseTo(-43.9386);
    });

    it('carrega a precisão informada pelo aparelho', async () => {
      // 400 m de desvio com 500 m de precisão não é divergência: sem este
      // número a distância não tem como ser interpretada.
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce(
        posicao({ accuracy: 500 }),
      );

      expect((await gateway.obterCoordenadas())?.precisaoMetros).toBe(500);
    });

    it('aceita posição sem precisão informada', async () => {
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce(
        posicao({ accuracy: null }),
      );

      expect((await gateway.obterCoordenadas())?.precisaoMetros).toBeNull();
    });

    it('pede alta precisão ao sistema', async () => {
      await gateway.obterCoordenadas();

      expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith(
        expect.objectContaining({ accuracy: Location.Accuracy.High }),
      );
    });
  });

  describe('quando o GPS não responde', () => {
    it('devolve null sem permissão, e nem consulta a posição', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce(negada);

      expect(await gateway.obterCoordenadas()).toBeNull();
      expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it('devolve null quando a plataforma lança', async () => {
      // GPS desligado, sem sinal, erro do sistema: a leitura segue sem
      // localização em vez de falhar.
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValueOnce(
        new Error('location unavailable'),
      );

      expect(await gateway.obterCoordenadas()).toBeNull();
    });

    it('desiste no prazo em vez de deixar o técnico esperando', async () => {
      jest.useFakeTimers();
      (Location.getCurrentPositionAsync as jest.Mock).mockImplementationOnce(
        () => new Promise(() => {}),
      );

      const promessa = gateway.obterCoordenadas({ timeoutMs: 1000 });
      await jest.advanceTimersByTimeAsync(1000);

      expect(await promessa).toBeNull();
      jest.useRealTimers();
    });

    it('não desiste quando a posição chega antes do prazo', async () => {
      jest.useFakeTimers();

      const promessa = gateway.obterCoordenadas({ timeoutMs: 10_000 });
      await jest.advanceTimersByTimeAsync(10);

      expect(await promessa).not.toBeNull();
      jest.useRealTimers();
    });
  });
});
