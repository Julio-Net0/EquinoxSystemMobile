import { Leitura } from '../entities/Leitura';

export type EscolhaVigente = 'nova' | 'atual';

/**
 * Resolve o conflito de duas leituras para o mesmo padrão no mesmo dia local.
 *
 * Last-write-wins pela medição: vale a leitura medida mais tarde. No app antigo
 * quem decidia isso era o servidor; aqui a regra roda no aparelho, que é o
 * único lugar onde os dados existem.
 */
export class RegraSubstituicaoLeituraService {
  public static escolherVigente(atual: Leitura | null, nova: Leitura): EscolhaVigente {
    if (!atual) return 'nova';
    // Empate fica com a nova: é a correção mais recente que o técnico fez.
    return nova.medidoEm.getTime() >= atual.medidoEm.getTime() ? 'nova' : 'atual';
  }

  public static aplicar(atual: Leitura, nova: Leitura, quando: Date): void {
    const mesmaVaga =
      atual.padraoId.equals(nova.padraoId) && atual.dataLocal.equals(nova.dataLocal);

    if (!mesmaVaga) {
      throw new Error('Substituição só vale entre leituras do mesmo padrão e do mesmo dia');
    }

    atual.substituirPor(nova, quando);
  }
}
