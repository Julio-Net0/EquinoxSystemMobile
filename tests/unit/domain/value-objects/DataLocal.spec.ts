import { DataLocal } from '@/domain/value-objects/DataLocal';

describe('DataLocal', () => {
  describe('criação a partir de um instante', () => {
    it('usa o dia de Brasília, não o dia UTC', () => {
      // 01:30 UTC de 29/10 ainda é 28/10 às 22:30 em Brasília.
      expect(DataLocal.de(new Date(Date.UTC(2026, 9, 29, 1, 30))).value).toBe('2026-10-28');
    });

    it('mantém o mesmo dia quando o instante está no meio da tarde', () => {
      expect(DataLocal.de(new Date(Date.UTC(2026, 9, 29, 18, 0))).value).toBe('2026-10-29');
    });

    it('recua o ano na virada', () => {
      expect(DataLocal.de(new Date(Date.UTC(2026, 0, 1, 2, 0))).value).toBe('2025-12-31');
    });
  });

  describe('parse', () => {
    it('aceita uma data no formato YYYY-MM-DD', () => {
      expect(DataLocal.parse('2026-03-09').value).toBe('2026-03-09');
    });

    it.each(['09/03/2026', '2026-3-9', '2026-13-01', '2026-02-30', '', 'ontem'])(
      'rejeita %p',
      (entrada) => {
        expect(() => DataLocal.parse(entrada)).toThrow('Data local inválida');
      },
    );
  });

  describe('comparação', () => {
    it('ordena cronologicamente', () => {
      expect(DataLocal.parse('2026-03-09').antesDe(DataLocal.parse('2026-03-10'))).toBe(true);
      expect(DataLocal.parse('2026-03-10').antesDe(DataLocal.parse('2026-03-09'))).toBe(false);
      expect(DataLocal.parse('2026-03-09').antesDe(DataLocal.parse('2026-03-09'))).toBe(false);
    });

    it('compara retornando -1, 0 ou 1', () => {
      expect(DataLocal.parse('2026-01-01').compare(DataLocal.parse('2026-02-01'))).toBe(-1);
      expect(DataLocal.parse('2026-02-01').compare(DataLocal.parse('2026-01-01'))).toBe(1);
      expect(DataLocal.parse('2026-02-01').compare(DataLocal.parse('2026-02-01'))).toBe(0);
    });

    it('reconhece igualdade', () => {
      expect(DataLocal.parse('2026-05-04').equals(DataLocal.parse('2026-05-04'))).toBe(true);
      expect(DataLocal.parse('2026-05-04').equals(DataLocal.parse('2026-05-05'))).toBe(false);
    });
  });

  describe('distância em dias', () => {
    it('conta os dias entre duas datas', () => {
      expect(DataLocal.parse('2026-03-01').diasAte(DataLocal.parse('2026-03-08'))).toBe(7);
    });

    it('atravessa a virada de mês', () => {
      expect(DataLocal.parse('2026-01-28').diasAte(DataLocal.parse('2026-02-04'))).toBe(7);
    });

    it('devolve negativo quando a outra data é anterior', () => {
      expect(DataLocal.parse('2026-03-08').diasAte(DataLocal.parse('2026-03-01'))).toBe(-7);
    });
  });

  it('formata no padrão brasileiro', () => {
    expect(DataLocal.parse('2026-03-09').paraBr()).toBe('09/03/2026');
  });
});
