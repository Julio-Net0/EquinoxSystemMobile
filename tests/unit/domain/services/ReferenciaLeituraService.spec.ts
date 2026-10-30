import { ReferenciaLeituraService } from '@/domain/services/ReferenciaLeituraService';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';

const HOJE = DataLocal.parse('2026-03-10');
const padraoId = UUIDv4.gerar();

/** Monta uma leitura num dia e hora de Brasília. */
function leitura(
  dataLocalIso: string,
  horaBrasilia: number,
  valorConsumo: number,
  valorInjecao: number | null = null,
): Leitura {
  const [ano, mes, dia] = dataLocalIso.split('-').map(Number);
  const medidoEm = new Date(Date.UTC(ano, mes - 1, dia, horaBrasilia + 3));

  return new Leitura({
    id: UUIDv4.gerar(),
    padraoId,
    usuarioId: UUIDv4.gerar(),
    valorConsumo: new ValorKwh(valorConsumo),
    valorInjecao: valorInjecao === null ? null : new ValorKwh(valorInjecao),
    fotoLocalUri: 'file:///documents/leituras/foto.jpg',
    medidoEm,
    dataLocal: DataLocal.de(medidoEm),
  });
}

describe('ReferenciaLeituraService', () => {
  it('não encontra referência quando não há leitura alguma', () => {
    expect(ReferenciaLeituraService.selecionar(HOJE, [])).toBeNull();
  });

  it('escolhe a leitura de dia anterior mais recente', () => {
    const ref = ReferenciaLeituraService.selecionar(HOJE, [
      leitura('2026-03-01', 10, 1000),
      leitura('2026-03-09', 10, 1800),
      leitura('2026-03-05', 10, 1400),
    ]);
    expect(ref?.valorConsumo).toBe(1800);
    expect(ref?.dataLocal.value).toBe('2026-03-09');
  });

  it('ignora leituras do próprio dia: a referência é sempre de um dia anterior', () => {
    const ref = ReferenciaLeituraService.selecionar(HOJE, [
      leitura('2026-03-09', 10, 1800),
      leitura('2026-03-10', 8, 9999),
    ]);
    expect(ref?.valorConsumo).toBe(1800);
  });

  it('não encontra referência quando só existe leitura do próprio dia', () => {
    expect(ReferenciaLeituraService.selecionar(HOJE, [leitura('2026-03-10', 8, 9999)])).toBeNull();
  });

  it('ignora leituras de dias futuros', () => {
    expect(ReferenciaLeituraService.selecionar(HOJE, [leitura('2026-03-12', 8, 9999)])).toBeNull();
  });

  it('no mesmo dia, vence a de medição mais tardia', () => {
    const ref = ReferenciaLeituraService.selecionar(HOJE, [
      leitura('2026-03-09', 18, 1850),
      leitura('2026-03-09', 7, 1800),
    ]);
    expect(ref?.valorConsumo).toBe(1850);
  });

  it('o desempate por hora não depende da ordem da entrada', () => {
    const crescente = ReferenciaLeituraService.selecionar(HOJE, [
      leitura('2026-03-09', 7, 1800),
      leitura('2026-03-09', 18, 1850),
    ]);
    expect(crescente?.valorConsumo).toBe(1850);
  });

  it('carrega a injeção da leitura escolhida', () => {
    const ref = ReferenciaLeituraService.selecionar(HOJE, [leitura('2026-03-09', 10, 1800, 900)]);
    expect(ref?.valorInjecao).toBe(900);
  });

  it('devolve injeção nula quando a leitura escolhida não é de usina', () => {
    const ref = ReferenciaLeituraService.selecionar(HOJE, [leitura('2026-03-09', 10, 1800)]);
    expect(ref?.valorInjecao).toBeNull();
  });
});
