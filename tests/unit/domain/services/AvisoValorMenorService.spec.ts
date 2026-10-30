import { AvisoValorMenorService } from '@/domain/services/AvisoValorMenorService';
import { ReferenciaLeitura } from '@/domain/services/ReferenciaLeituraService';
import { DataLocal } from '@/domain/value-objects/DataLocal';

const referencia = (valorConsumo: number, valorInjecao: number | null = null): ReferenciaLeitura => ({
  valorConsumo,
  valorInjecao,
  dataLocal: DataLocal.parse('2026-03-09'),
});

describe('AvisoValorMenorService', () => {
  it('não avisa quando não há referência', () => {
    expect(AvisoValorMenorService.mensagem(100, null, null)).toBeNull();
  });

  it('não avisa quando o consumo subiu, como esperado num medidor acumulado', () => {
    expect(AvisoValorMenorService.mensagem(2000, null, referencia(1800))).toBeNull();
  });

  it('não avisa quando o consumo é igual ao anterior', () => {
    expect(AvisoValorMenorService.mensagem(1800, null, referencia(1800))).toBeNull();
  });

  it('avisa quando o consumo é menor que o anterior', () => {
    expect(AvisoValorMenorService.mensagem(1500, null, referencia(1800))).toBe(
      'A última leitura deste padrão foi 1.800 kWh em 09/03/2026. Você digitou 1.500 kWh. Está certo?',
    );
  });

  it('avisa quando só a injeção é menor', () => {
    expect(AvisoValorMenorService.mensagem(2000, 700, referencia(1800, 900))).toBe(
      'A última injeção deste padrão foi 900 kWh em 09/03/2026. Você digitou 700 kWh. Está certo?',
    );
  });

  it('junta consumo e injeção numa só pergunta quando os dois caíram', () => {
    expect(AvisoValorMenorService.mensagem(1500, 700, referencia(1800, 900))).toBe(
      'A última leitura deste padrão foi 1.800 kWh e a injeção 900 kWh, em 09/03/2026. '
        + 'Você digitou 1.500 kWh e 700 kWh. Está certo?',
    );
  });

  it('formata os decimais no padrão brasileiro', () => {
    expect(AvisoValorMenorService.mensagem(1234.5, null, referencia(1800.75))).toBe(
      'A última leitura deste padrão foi 1.800,75 kWh em 09/03/2026. Você digitou 1.234,5 kWh. Está certo?',
    );
  });

  it('não compara injeção quando a referência não tem', () => {
    expect(AvisoValorMenorService.mensagem(2000, 700, referencia(1800, null))).toBeNull();
  });

  it('não compara injeção quando a leitura nova não tem', () => {
    expect(AvisoValorMenorService.mensagem(2000, null, referencia(1800, 900))).toBeNull();
  });
});
