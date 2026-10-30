import { ReferenciaLeitura } from './ReferenciaLeituraService';
import { formatarKwh } from './FormatadorKwh';

/**
 * Pergunta de conferência quando o valor digitado é menor que o da última
 * leitura conhecida.
 *
 * Só pergunta — nunca bloqueia. Um medidor trocado, zerado ou um registro
 * legítimo fora de ordem existem em campo, e travar a leitura deixaria o
 * técnico sem saída no local.
 */
export class AvisoValorMenorService {
  public static mensagem(
    valorConsumo: number,
    valorInjecao: number | null,
    referencia: ReferenciaLeitura | null,
  ): string | null {
    if (!referencia) return null;

    const consumoMenor = valorConsumo < referencia.valorConsumo;
    const injecaoMenor =
      valorInjecao !== null &&
      referencia.valorInjecao !== null &&
      valorInjecao < referencia.valorInjecao;

    if (!consumoMenor && !injecaoMenor) return null;

    const quando = referencia.dataLocal.paraBr();

    if (consumoMenor && injecaoMenor) {
      return (
        `A última leitura deste padrão foi ${formatarKwh(referencia.valorConsumo)} `
        + `e a injeção ${formatarKwh(referencia.valorInjecao as number)}, em ${quando}. `
        + `Você digitou ${formatarKwh(valorConsumo)} e ${formatarKwh(valorInjecao as number)}. Está certo?`
      );
    }

    if (consumoMenor) {
      return (
        `A última leitura deste padrão foi ${formatarKwh(referencia.valorConsumo)} em ${quando}. `
        + `Você digitou ${formatarKwh(valorConsumo)}. Está certo?`
      );
    }

    return (
      `A última injeção deste padrão foi ${formatarKwh(referencia.valorInjecao as number)} em ${quando}. `
      + `Você digitou ${formatarKwh(valorInjecao as number)}. Está certo?`
    );
  }
}
