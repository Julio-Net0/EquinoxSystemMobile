import { RegraLeituraAtrasadaService } from '@/domain/services/RegraLeituraAtrasadaService';
import { DataLocal } from '@/domain/value-objects/DataLocal';

const HOJE = DataLocal.parse('2026-03-10');

describe('RegraLeituraAtrasadaService', () => {
  it('o limite padrão é de 7 dias, como no app antigo', () => {
    expect(RegraLeituraAtrasadaService.DIAS_LIMITE).toBe(7);
  });

  it('não considera atrasada uma leitura do próprio dia', () => {
    expect(RegraLeituraAtrasadaService.estaAtrasada(HOJE, HOJE)).toBe(false);
  });

  it('não considera atrasada uma leitura de exatamente 7 dias', () => {
    expect(RegraLeituraAtrasadaService.estaAtrasada(DataLocal.parse('2026-03-03'), HOJE)).toBe(false);
  });

  it('considera atrasada a partir do oitavo dia', () => {
    expect(RegraLeituraAtrasadaService.estaAtrasada(DataLocal.parse('2026-03-02'), HOJE)).toBe(true);
  });

  it('não considera atrasada uma leitura de data futura', () => {
    expect(RegraLeituraAtrasadaService.estaAtrasada(DataLocal.parse('2026-03-12'), HOJE)).toBe(false);
  });

  it('aceita um limite diferente', () => {
    const umaSemanaEMeia = DataLocal.parse('2026-02-27');
    expect(RegraLeituraAtrasadaService.estaAtrasada(umaSemanaEMeia, HOJE, 30)).toBe(false);
    expect(RegraLeituraAtrasadaService.estaAtrasada(umaSemanaEMeia, HOJE, 5)).toBe(true);
  });

  it('atravessa a virada de mês', () => {
    expect(RegraLeituraAtrasadaService.estaAtrasada(DataLocal.parse('2026-02-20'), HOJE)).toBe(true);
  });

  it('informa quantos dias de atraso para compor a mensagem', () => {
    expect(RegraLeituraAtrasadaService.diasDeAtraso(DataLocal.parse('2026-03-02'), HOJE)).toBe(8);
  });
});
