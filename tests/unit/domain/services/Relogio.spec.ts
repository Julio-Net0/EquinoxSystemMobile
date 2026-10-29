import { relogioFixo, relogioSistema } from '@/domain/services/Relogio';

describe('Relogio', () => {
  it('o relógio do sistema devolve o instante atual', () => {
    const antes = Date.now();
    const agora = relogioSistema.agora().getTime();
    expect(agora).toBeGreaterThanOrEqual(antes);
    expect(agora).toBeLessThanOrEqual(Date.now());
  });

  it('o relógio fixo devolve sempre o mesmo instante', () => {
    const instante = new Date('2026-03-09T12:00:00.000Z');
    const relogio = relogioFixo(instante);
    expect(relogio.agora()).toEqual(instante);
    expect(relogio.agora()).toEqual(instante);
  });

  it('o relógio fixo não entrega a mesma referência mutável', () => {
    const instante = new Date('2026-03-09T12:00:00.000Z');
    const relogio = relogioFixo(instante);
    relogio.agora().setFullYear(1999);
    expect(relogio.agora().getFullYear()).toBe(2026);
  });
});
