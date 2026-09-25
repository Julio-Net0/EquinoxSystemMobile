export class ValorKwh {
  public readonly valor: number;

  constructor(valor: number) {
    if (typeof valor !== 'number' || isNaN(valor) || valor < 0) {
      throw new Error('Valor em kWh não pode ser negativo');
    }
    this.valor = valor;
  }

  public equals(other: ValorKwh): boolean {
    if (!other) return false;
    return this.valor === other.valor;
  }
}
