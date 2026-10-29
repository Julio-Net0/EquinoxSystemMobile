import { isoComOffset } from './InstanteBrasilia';

/**
 * Chave do dia (YYYY-MM-DD) no horário de Brasília. É por ela que vale a regra
 * de uma única leitura vigente por padrão por dia, então precisa ser um tipo
 * próprio e não uma string solta.
 *
 * A comparação é lexicográfica de propósito: no formato YYYY-MM-DD ela coincide
 * com a ordem cronológica, o que dispensa parse na hora de ordenar.
 */
export class DataLocal {
  private static readonly REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** Dia de Brasília correspondente ao instante informado. */
  public static de(instante: Date): DataLocal {
    return new DataLocal(isoComOffset(instante).slice(0, 10));
  }

  public static parse(value: string): DataLocal {
    const partes = DataLocal.REGEX.exec(value ?? '');
    if (!partes) {
      throw new Error(`Data local inválida: ${value}`);
    }
    const [, ano, mes, dia] = partes.map(Number) as unknown as [string, number, number, number];
    if (mes < 1 || mes > 12 || dia < 1 || dia > DataLocal.diasNoMes(ano, mes)) {
      throw new Error(`Data local inválida: ${value}`);
    }
    return new DataLocal(value);
  }

  private static diasNoMes(ano: number, mes: number): number {
    return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  }

  private paraUtc(): number {
    const [ano, mes, dia] = this.value.split('-').map(Number);
    return Date.UTC(ano, mes - 1, dia);
  }

  public compare(outra: DataLocal): -1 | 0 | 1 {
    if (this.value < outra.value) return -1;
    if (this.value > outra.value) return 1;
    return 0;
  }

  public antesDe(outra: DataLocal): boolean {
    return this.compare(outra) === -1;
  }

  public equals(outra: DataLocal): boolean {
    if (!outra) return false;
    return this.value === outra.value;
  }

  /** Dias de distância até `outra`; negativo quando `outra` é anterior. */
  public diasAte(outra: DataLocal): number {
    return Math.round((outra.paraUtc() - this.paraUtc()) / 86_400_000);
  }

  public paraBr(): string {
    const [ano, mes, dia] = this.value.split('-');
    return `${dia}/${mes}/${ano}`;
  }
}
