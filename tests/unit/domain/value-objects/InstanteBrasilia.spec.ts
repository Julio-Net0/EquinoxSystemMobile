import { OFFSET_MINUTOS_BRASILIA, isoComOffset } from '@/domain/value-objects/InstanteBrasilia';

describe('InstanteBrasilia', () => {
  it('usa o offset fixo de -180 minutos (UTC-3, sem horário de verão desde 2019)', () => {
    expect(OFFSET_MINUTOS_BRASILIA).toBe(-180);
  });

  it('formata o instante em ISO com o sufixo -03:00', () => {
    const instante = new Date(Date.UTC(2026, 8, 30, 15, 4, 5, 678));
    expect(isoComOffset(instante)).toBe('2026-09-30T12:04:05.678-03:00');
  });

  it('preenche com zero à esquerda os campos de um dígito', () => {
    const instante = new Date(Date.UTC(2026, 0, 5, 6, 7, 8, 9));
    expect(isoComOffset(instante)).toBe('2026-01-05T03:07:08.009-03:00');
  });

  it('recua o dia quando o instante UTC está na madrugada', () => {
    const instante = new Date(Date.UTC(2026, 9, 29, 1, 30, 0, 0));
    expect(isoComOffset(instante)).toBe('2026-10-28T22:30:00.000-03:00');
  });
});
