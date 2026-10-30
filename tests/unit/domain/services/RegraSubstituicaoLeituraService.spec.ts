import { RegraSubstituicaoLeituraService } from '@/domain/services/RegraSubstituicaoLeituraService';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';

const padraoId = UUIDv4.gerar();

function leituraAs(horaBrasilia: number, padrao: UUIDv4 = padraoId): Leitura {
  const medidoEm = new Date(Date.UTC(2026, 2, 9, horaBrasilia + 3));
  return new Leitura({
    id: UUIDv4.gerar(),
    padraoId: padrao,
    usuarioId: UUIDv4.gerar(),
    valorConsumo: new ValorKwh(1800),
    fotoLocalUri: 'file:///documents/leituras/foto.jpg',
    medidoEm,
    dataLocal: DataLocal.de(medidoEm),
  });
}

describe('RegraSubstituicaoLeituraService', () => {
  describe('escolha da vigente (last-write-wins por medição)', () => {
    it('a nova vence quando foi medida depois', () => {
      expect(RegraSubstituicaoLeituraService.escolherVigente(leituraAs(8), leituraAs(15))).toBe('nova');
    });

    it('a atual permanece quando a nova foi medida antes', () => {
      expect(RegraSubstituicaoLeituraService.escolherVigente(leituraAs(15), leituraAs(8))).toBe('atual');
    });

    it('no empate a nova vence, porque é a correção mais recente do técnico', () => {
      const atual = leituraAs(10);
      const nova = leituraAs(10);
      expect(RegraSubstituicaoLeituraService.escolherVigente(atual, nova)).toBe('nova');
    });

    it('sem leitura vigente no dia, a nova entra direto', () => {
      expect(RegraSubstituicaoLeituraService.escolherVigente(null, leituraAs(10))).toBe('nova');
    });
  });

  describe('aplicação da substituição', () => {
    it('tira a antiga de vigente e aponta para a nova', () => {
      const atual = leituraAs(8);
      const nova = leituraAs(15);
      const quando = new Date(Date.UTC(2026, 2, 9, 18));

      RegraSubstituicaoLeituraService.aplicar(atual, nova, quando);

      expect(atual.status).toBe(StatusLeituraEnum.SUBSTITUIDA);
      expect(atual.substituidaPorId?.equals(nova.id)).toBe(true);
      expect(nova.estaVigente()).toBe(true);
    });

    it('recusa substituir entre padrões diferentes', () => {
      const atual = leituraAs(8);
      const nova = leituraAs(15, UUIDv4.gerar());
      expect(() => RegraSubstituicaoLeituraService.aplicar(atual, nova, new Date())).toThrow(
        'Substituição só vale entre leituras do mesmo padrão e do mesmo dia',
      );
    });

    it('recusa substituir entre dias diferentes', () => {
      const atual = leituraAs(8);
      const outroDia = new Date(Date.UTC(2026, 2, 10, 13));
      const nova = new Leitura({
        id: UUIDv4.gerar(),
        padraoId,
        usuarioId: UUIDv4.gerar(),
        valorConsumo: new ValorKwh(1900),
        fotoLocalUri: 'file:///documents/leituras/foto.jpg',
        medidoEm: outroDia,
        dataLocal: DataLocal.de(outroDia),
      });

      expect(() => RegraSubstituicaoLeituraService.aplicar(atual, nova, new Date())).toThrow(
        'Substituição só vale entre leituras do mesmo padrão e do mesmo dia',
      );
    });
  });
});
