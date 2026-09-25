import { RegraSincronizacaoService } from '@/domain/services/RegraSincronizacaoService';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';

describe('RegraSincronizacaoService Domain Service', () => {
  it('deve aplicar a regra Last Write Wins escolhendo a leitura mais recente', () => {
    const usinaId = UUIDv4.gerar();
    const usuarioId = UUIDv4.gerar();
    const coords = new CoordenadasGPS(-23.55, -46.63);

    const dataAntiga = new Date('2026-09-20T10:00:00Z');
    const dataNova = new Date('2026-09-20T10:05:00Z');

    const leituraAntiga = new Leitura({
      id: UUIDv4.gerar(),
      usinaId,
      usuarioId,
      valorKwh: new ValorKwh(100),
      caminhoImagemLocal: '/cache/foto1.jpg',
      coordenadas: coords,
      dataHora: dataAntiga,
    });

    const leituraNova = new Leitura({
      id: UUIDv4.gerar(),
      usinaId,
      usuarioId,
      valorKwh: new ValorKwh(105),
      caminhoImagemLocal: '/cache/foto2.jpg',
      coordenadas: coords,
      dataHora: dataNova,
    });

    const vencedora = RegraSincronizacaoService.resolverConflitoLastWriteWins(leituraAntiga, leituraNova);
    expect(vencedora.id.equals(leituraNova.id)).toBe(true);
    expect(vencedora.valorKwh.valor).toBe(105);
  });
});
