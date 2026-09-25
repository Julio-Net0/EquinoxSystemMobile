import { ValorKwh } from '@/domain/value-objects/ValorKwh';

describe('ValorKwh Value Object', () => {
  it('deve criar um ValorKwh válido', () => {
    const kwh = new ValorKwh(150.5);
    expect(kwh.valor).toBe(150.5);
  });

  it('deve aceitar zero kWh', () => {
    const kwh = new ValorKwh(0);
    expect(kwh.valor).toBe(0);
  });

  it('deve lançar erro se o valor kWh for negativo', () => {
    expect(() => new ValorKwh(-5)).toThrow('Valor em kWh não pode ser negativo');
  });

  it('deve comparar igualdade de dois valores kWh', () => {
    const kwh1 = new ValorKwh(100);
    const kwh2 = new ValorKwh(100);
    const kwh3 = new ValorKwh(200);

    expect(kwh1.equals(kwh2)).toBe(true);
    expect(kwh1.equals(kwh3)).toBe(false);
  });
});
