import { Leitura } from '../entities/Leitura';
import { DataLocal } from '../value-objects/DataLocal';

export interface ReferenciaLeitura {
  valorConsumo: number;
  valorInjecao: number | null;
  dataLocal: DataLocal;
}

/**
 * Escolhe contra qual leitura comparar o valor que o técnico acabou de digitar.
 *
 * O medidor é acumulado, então um valor menor que o da última leitura conhecida
 * quase sempre é erro de digitação. Duas decisões herdadas do app antigo:
 *
 * - só entram leituras de dia ANTERIOR. Uma leitura do mesmo dia é justamente a
 *   que está sendo corrigida, e compará-la com ela mesma avisaria sempre.
 * - empate de dia é resolvido pela medição mais tardia.
 *
 * Quem chama deve passar só leituras vigentes: uma substituída carrega o valor
 * que já foi corrigido e elegê-la daria um aviso errado.
 */
export class ReferenciaLeituraService {
  public static selecionar(hoje: DataLocal, leituras: Leitura[]): ReferenciaLeitura | null {
    const candidatas = leituras.filter((l) => l.dataLocal.antesDe(hoje));
    if (candidatas.length === 0) return null;

    const maisRecente = candidatas.reduce((atual, proxima) =>
      ReferenciaLeituraService.ehMaisRecente(proxima, atual) ? proxima : atual,
    );

    return {
      valorConsumo: maisRecente.valorConsumo.valor,
      valorInjecao: maisRecente.valorInjecao?.valor ?? null,
      dataLocal: maisRecente.dataLocal,
    };
  }

  private static ehMaisRecente(candidata: Leitura, atual: Leitura): boolean {
    const comparacao = candidata.dataLocal.compare(atual.dataLocal);
    if (comparacao !== 0) return comparacao > 0;
    return candidata.medidoEm.getTime() > atual.medidoEm.getTime();
  }
}
