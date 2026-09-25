import { Leitura } from '../entities/Leitura';

export class RegraSincronizacaoService {
  /**
   * Aplica a estratégia Last Write Wins escolhendo a leitura com o carimbo de dataHora mais recente.
   */
  public static resolverConflitoLastWriteWins(leituraA: Leitura, leituraB: Leitura): Leitura {
    if (leituraB.dataHora.getTime() > leituraA.dataHora.getTime()) {
      return leituraB;
    }
    return leituraA;
  }
}
