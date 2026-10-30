import * as Location from 'expo-location';
import { ILocationGateway } from '@/domain/gateways/ILocationGateway';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';

/**
 * Casa de medidor costuma ser lugar de sinal ruim. Em vez de deixar o técnico
 * esperando, desiste e devolve null — a leitura é gravada sem localização e o
 * administrador recebe um aviso.
 */
const TIMEOUT_PADRAO_MS = 10_000;

export class LocationGatewayExpo implements ILocationGateway {
  async temPermissao(): Promise<boolean> {
    const { granted } = await Location.getForegroundPermissionsAsync();
    return granted;
  }

  async solicitarPermissao(): Promise<boolean> {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    return granted;
  }

  async obterCoordenadas(opcoes?: { timeoutMs?: number }): Promise<CoordenadasGPS | null> {
    if (!(await this.temPermissao())) return null;

    const timeoutMs = opcoes?.timeoutMs ?? TIMEOUT_PADRAO_MS;

    let cancelarTimeout: ReturnType<typeof setTimeout> | undefined;
    const desistir = new Promise<null>((resolve) => {
      cancelarTimeout = setTimeout(() => resolve(null), timeoutMs);
    });

    try {
      const posicao = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        desistir,
      ]);

      if (!posicao) return null;

      return new CoordenadasGPS(
        posicao.coords.latitude,
        posicao.coords.longitude,
        posicao.coords.accuracy ?? null,
        new Date(posicao.timestamp),
      );
    } catch {
      // GPS desligado, sem sinal ou erro da plataforma: a leitura segue sem
      // localização em vez de falhar.
      return null;
    } finally {
      if (cancelarTimeout) clearTimeout(cancelarTimeout);
    }
  }
}
