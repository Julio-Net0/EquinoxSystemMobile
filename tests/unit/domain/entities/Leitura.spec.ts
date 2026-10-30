import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';

const MEDIDO_EM = new Date(Date.UTC(2026, 2, 9, 15, 0)); // 09/03/2026 12:00 em Brasília

const base = () => ({
  id: UUIDv4.gerar(),
  padraoId: UUIDv4.gerar(),
  usuarioId: UUIDv4.gerar(),
  valorConsumo: new ValorKwh(12_345),
  fotoLocalUri: 'file:///documents/leituras/abc.jpg',
  medidoEm: MEDIDO_EM,
  dataLocal: DataLocal.de(MEDIDO_EM),
});

describe('Leitura', () => {
  describe('criação', () => {
    it('nasce registrada', () => {
      const leitura = new Leitura(base());
      expect(leitura.status).toBe(StatusLeituraEnum.REGISTRADA);
      expect(leitura.estaVigente()).toBe(true);
    });

    it('guarda o consumo do campo 003', () => {
      expect(new Leitura(base()).valorConsumo.valor).toBe(12_345);
    });

    it.each(['', '   '])('exige a foto comprobatória (uri %p)', (fotoLocalUri) => {
      expect(() => new Leitura({ ...base(), fotoLocalUri })).toThrow(
        'Foto comprobatória do medidor é obrigatória',
      );
    });

    it('aceita ficar sem GPS: a foto é obrigatória, a localização não', () => {
      const leitura = new Leitura(base());
      expect(leitura.coordenadas).toBeNull();
      expect(leitura.temLocalizacao()).toBe(false);
    });

    it('guarda as coordenadas quando o GPS respondeu', () => {
      const leitura = new Leitura({ ...base(), coordenadas: new CoordenadasGPS(-19.9191, -43.9386) });
      expect(leitura.temLocalizacao()).toBe(true);
    });

    it('recusa um dia local que não corresponde ao instante medido', () => {
      expect(() => new Leitura({ ...base(), dataLocal: DataLocal.parse('2026-03-10') })).toThrow(
        'Dia local da leitura não corresponde ao instante medido',
      );
    });
  });

  describe('injeção (campo 103)', () => {
    it('é nula numa leitura de endereço comum', () => {
      const leitura = new Leitura(base());
      expect(leitura.valorInjecao).toBeNull();
      expect(leitura.ehDeUsina()).toBe(false);
    });

    it('é preenchida numa leitura de usina', () => {
      const leitura = new Leitura({ ...base(), valorInjecao: new ValorKwh(8_421) });
      expect(leitura.valorInjecao?.valor).toBe(8_421);
      expect(leitura.ehDeUsina()).toBe(true);
    });
  });

  describe('substituição', () => {
    it('sai de vigente e aponta para a leitura que a substituiu', () => {
      const antiga = new Leitura(base());
      const nova = new Leitura(base());
      const quando = new Date(Date.UTC(2026, 2, 9, 18, 0));

      antiga.substituirPor(nova, quando);

      expect(antiga.status).toBe(StatusLeituraEnum.SUBSTITUIDA);
      expect(antiga.estaVigente()).toBe(false);
      expect(antiga.substituidaPorId?.equals(nova.id)).toBe(true);
      expect(antiga.substituidaEm).toEqual(quando);
    });

    it('recusa substituir uma leitura que já saiu de vigente', () => {
      const antiga = new Leitura(base());
      antiga.substituirPor(new Leitura(base()), MEDIDO_EM);
      expect(() => antiga.substituirPor(new Leitura(base()), MEDIDO_EM)).toThrow(
        'Só uma leitura vigente pode ser substituída',
      );
    });

    it('recusa ser substituída por si mesma', () => {
      const leitura = new Leitura(base());
      expect(() => leitura.substituirPor(leitura, MEDIDO_EM)).toThrow(
        'Uma leitura não pode substituir a si mesma',
      );
    });
  });

  describe('decisão do administrador', () => {
    const adminId = UUIDv4.gerar();
    const quando = new Date(Date.UTC(2026, 2, 10, 12, 0));

    it('aprovar mantém a leitura vigente e registra quem decidiu', () => {
      const leitura = new Leitura(base());
      leitura.aprovar(adminId, quando);
      expect(leitura.status).toBe(StatusLeituraEnum.APROVADA);
      expect(leitura.estaVigente()).toBe(true);
      expect(leitura.decididaPorId?.equals(adminId)).toBe(true);
      expect(leitura.decididaEm).toEqual(quando);
    });

    it('descartar tira a leitura de vigente', () => {
      const leitura = new Leitura(base());
      leitura.descartar(adminId, quando);
      expect(leitura.status).toBe(StatusLeituraEnum.DESCARTADA);
      expect(leitura.estaVigente()).toBe(false);
    });

    it('recusa decidir duas vezes', () => {
      const leitura = new Leitura(base());
      leitura.aprovar(adminId, quando);
      expect(() => leitura.descartar(adminId, quando)).toThrow('Esta leitura já foi decidida');
    });

    it('recusa decidir uma leitura já substituída', () => {
      const leitura = new Leitura(base());
      leitura.substituirPor(new Leitura(base()), MEDIDO_EM);
      expect(() => leitura.aprovar(adminId, quando)).toThrow('Esta leitura já foi decidida');
    });
  });
});
