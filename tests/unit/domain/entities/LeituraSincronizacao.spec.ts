import { Leitura } from '@/domain/entities/Leitura';
import { EstadoSyncEnum, rotuloDoEstadoSync } from '@/domain/enums/EstadoSyncEnum';
import { CaminhoComprovanteService } from '@/domain/services/CaminhoComprovanteService';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { remotoFalhou, remotoOk } from '@/domain/gateways/ResultadoRemoto';

const MEDIDO_EM = new Date(Date.UTC(2026, 2, 10, 15));

const leitura = (sobrescrita: Partial<ConstructorParameters<typeof Leitura>[0]> = {}) =>
  new Leitura({
    id: UUIDv4.gerar(),
    padraoId: UUIDv4.gerar(),
    usuarioId: UUIDv4.gerar(),
    valorConsumo: new ValorKwh(11_300),
    fotoLocalUri: 'file:///documents/leituras/1.jpg',
    medidoEm: MEDIDO_EM,
    dataLocal: DataLocal.de(MEDIDO_EM),
    ...sobrescrita,
  });

describe('Leitura — sincronização', () => {
  it('nasce pendente de envio e sem foto remota', () => {
    const nova = leitura();

    expect(nova.estadoSync).toBe(EstadoSyncEnum.PENDENTE);
    expect(nova.estaSincronizada()).toBe(false);
    expect(nova.fotoRemotaPath).toBeNull();
    expect(nova.temFotoNoAparelho()).toBe(true);
  });

  it('fica sincronizada quando a nuvem confirma, guardando onde está o comprovante', () => {
    const enviada = leitura();

    enviada.marcarSincronizada(' empresa/endereco/leitura.jpg ');

    expect(enviada.estaSincronizada()).toBe(true);
    expect(enviada.fotoRemotaPath).toBe('empresa/endereco/leitura.jpg');
  });

  it('não aceita "sincronizada" sem o caminho remoto do comprovante', () => {
    expect(() => leitura().marcarSincronizada('  ')).toThrow('caminho remoto do comprovante');
  });

  it('volta a pendente quando muda no aparelho depois de sincronizada', () => {
    const decidida = leitura();
    decidida.marcarSincronizada('e/n/l.jpg');

    decidida.marcarPendenteDeEnvio();

    expect(decidida.estadoSync).toBe(EstadoSyncEnum.PENDENTE);
    // O comprovante continua onde estava: só o estado mudou.
    expect(decidida.fotoRemotaPath).toBe('e/n/l.jpg');
  });

  it('registra a falha de envio', () => {
    const recusada = leitura();
    recusada.marcarFalhaDeEnvio();
    expect(recusada.estadoSync).toBe(EstadoSyncEnum.FALHOU);
  });

  describe('comprovante obrigatório, no aparelho ou na nuvem', () => {
    it('aceita leitura vinda da nuvem, sem arquivo no aparelho', () => {
      const remota = leitura({ fotoLocalUri: '', fotoRemotaPath: 'e/n/l.jpg' });

      expect(remota.temFotoNoAparelho()).toBe(false);
      expect(remota.fotoRemotaPath).toBe('e/n/l.jpg');
    });

    it('recusa leitura sem comprovante em lugar nenhum', () => {
      expect(() => leitura({ fotoLocalUri: ' ', fotoRemotaPath: null })).toThrow(
        'Foto comprobatória do medidor é obrigatória',
      );
      expect(() => leitura({ fotoLocalUri: '', fotoRemotaPath: '  ' })).toThrow(
        'Foto comprobatória do medidor é obrigatória',
      );
    });
  });
});

describe('EstadoSyncEnum', () => {
  it.each([
    [EstadoSyncEnum.PENDENTE, 'Pendente de envio'],
    [EstadoSyncEnum.SINCRONIZADA, 'Sincronizada'],
    [EstadoSyncEnum.FALHOU, 'Não enviada'],
  ])('%s é mostrado como "%s"', (estado, rotulo) => {
    expect(rotuloDoEstadoSync(estado)).toBe(rotulo);
  });
});

describe('CaminhoComprovanteService', () => {
  it('monta empresa/endereço/leitura.jpg, que é o que as políticas do bucket conferem', () => {
    const empresa = new UUIDv4('1a000000-0000-4000-8000-000000000001');
    const endereco = new UUIDv4('2b000000-0000-4000-8000-000000000001');
    const id = new UUIDv4('5e000000-0000-4000-8000-000000000001');

    const caminho = CaminhoComprovanteService.de(empresa, endereco, id);

    expect(caminho).toBe(`${empresa.value}/${endereco.value}/${id.value}.jpg`);
    expect(caminho.split('/')).toHaveLength(3);
  });
});

describe('ResultadoRemoto', () => {
  it('sucesso com e sem valor', () => {
    expect(remotoOk()).toEqual({ ok: true, valor: undefined });
    expect(remotoOk(42)).toEqual({ ok: true, valor: 42 });
  });

  it('falha carrega o motivo e a mensagem', () => {
    expect(remotoFalhou('rede', 'sem sinal')).toEqual({
      ok: false, motivo: 'rede', mensagem: 'sem sinal',
    });
  });
});
