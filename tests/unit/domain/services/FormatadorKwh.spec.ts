import { formatarDistancia, formatarKwh, formatarNumeroBr } from '@/domain/services/FormatadorKwh';

// Formatador próprio em vez de Intl.NumberFormat: o Hermes não garante ICU
// completo, e o texto do aviso de valor menor é comparado em teste.
describe('formatarNumeroBr', () => {
  it('usa ponto como separador de milhar e vírgula como decimal', () => {
    expect(formatarNumeroBr(1234.56)).toBe('1.234,56');
  });

  it('não força casas decimais quando o valor é inteiro', () => {
    expect(formatarNumeroBr(12345)).toBe('12.345');
    expect(formatarNumeroBr(0)).toBe('0');
  });

  it('mantém uma casa quando só há uma', () => {
    expect(formatarNumeroBr(1234.5)).toBe('1.234,5');
  });

  it('arredonda para no máximo duas casas', () => {
    expect(formatarNumeroBr(1234.567)).toBe('1.234,57');
    expect(formatarNumeroBr(0.005)).toBe('0,01');
  });

  it('agrupa milhares em valores grandes', () => {
    expect(formatarNumeroBr(9876543.21)).toBe('9.876.543,21');
  });

  it('preserva o sinal negativo', () => {
    expect(formatarNumeroBr(-1234.5)).toBe('-1.234,5');
  });

  it('descarta o zero decimal do arredondamento', () => {
    expect(formatarNumeroBr(10.999)).toBe('11');
  });
});

describe('formatarKwh', () => {
  it('acrescenta a unidade', () => {
    expect(formatarKwh(12345.6)).toBe('12.345,6 kWh');
  });

  it('formata zero', () => {
    expect(formatarKwh(0)).toBe('0 kWh');
  });
});

describe('formatarDistancia', () => {
  it('usa metros arredondados abaixo de 1 km', () => {
    expect(formatarDistancia(320.4)).toBe('320 m');
    expect(formatarDistancia(999)).toBe('999 m');
  });

  it('usa quilômetros com uma casa a partir de 1 km', () => {
    expect(formatarDistancia(1000)).toBe('1 km');
    expect(formatarDistancia(15_400)).toBe('15,4 km');
    expect(formatarDistancia(1_250)).toBe('1,3 km');
  });

  it('agrupa milhares em distâncias grandes', () => {
    expect(formatarDistancia(1_500_000)).toBe('1.500 km');
  });
});
