import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { IConectividadeGateway } from '@/domain/gateways/IConectividadeGateway';

/**
 * "Conectado" e "com internet" não são a mesma coisa: o aparelho pode estar
 * num Wi-Fi sem saída. `isInternetReachable` vem nulo enquanto o sistema ainda
 * não sabe — nesse caso vale o `isConnected`, para não segurar a sincronização
 * à toa; se a rede não responder, o envio falha como falta de rede e nada se
 * perde.
 */
function online(estado: NetInfoState): boolean {
  return estado.isConnected === true && estado.isInternetReachable !== false;
}

/** Monitor de rede sobre o `@react-native-community/netinfo` (incluso no Expo Go). */
export class ConectividadeNetInfo implements IConectividadeGateway {
  async estaOnline(): Promise<boolean> {
    return online(await NetInfo.fetch());
  }

  observar(ouvinte: (online: boolean) => void): () => void {
    return NetInfo.addEventListener((estado) => ouvinte(online(estado)));
  }
}
