import { GeradorNotificacoesService } from '@/domain/services/GeradorNotificacoesService';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { ReferenciaLeitura } from '@/domain/services/ReferenciaLeituraService';
import { AvaliacaoLocalizacao } from '@/domain/services/RegraLocalizacaoLeituraService';

const HOJE = DataLocal.parse('2026-03-10');
const AGORA = new Date(Date.UTC(2026, 2, 10, 15));
const empresaId = UUIDv4.gerar();
const padraoId = UUIDv4.gerar();

function leituraEm(dataLocalIso: string, valorConsumo = 1800): Leitura {
  const [ano, mes, dia] = dataLocalIso.split('-').map(Number);
  const medidoEm = new Date(Date.UTC(ano, mes - 1, dia, 15));
  return new Leitura({
    id: UUIDv4.gerar(),
    padraoId,
    usuarioId: UUIDv4.gerar(),
    valorConsumo: new ValorKwh(valorConsumo),
    fotoLocalUri: 'file:///documents/leituras/foto.jpg',
    medidoEm,
    dataLocal: DataLocal.de(medidoEm),
  });
}

const dentroDoRaio: AvaliacaoLocalizacao = {
  situacao: 'dentro_do_raio',
  distanciaMetros: 120,
  impedeRegistro: false,
};

const contexto = (sobrescrita: Partial<Parameters<typeof GeradorNotificacoesService.paraLeituraRegistrada>[0]> = {}) => ({
  leitura: leituraEm('2026-03-10'),
  referencia: null as ReferenciaLeitura | null,
  substituida: null as Leitura | null,
  localizacao: dentroDoRaio,
  empresaId,
  padraoNumero: '778811',
  enderecoApelido: 'Sede administrativa',
  autorNome: 'João da Silva',
  hoje: HOJE,
  agora: AGORA,
  ...sobrescrita,
});

describe('GeradorNotificacoesService', () => {
  it('uma leitura normal e no local não gera notificação alguma', () => {
    expect(GeradorNotificacoesService.paraLeituraRegistrada(contexto())).toEqual([]);
  });

  describe('valor menor que o anterior', () => {
    const referencia: ReferenciaLeitura = {
      valorConsumo: 2000,
      valorInjecao: null,
      dataLocal: DataLocal.parse('2026-03-09'),
    };

    it('avisa o administrador, sem exigir decisão', () => {
      const [notificacao] = GeradorNotificacoesService.paraLeituraRegistrada(
        contexto({ leitura: leituraEm('2026-03-10', 1500), referencia }),
      );

      expect(notificacao.tipo).toBe(TipoNotificacaoEnum.LEITURA_VALOR_MENOR);
      expect(notificacao.requerAcao).toBe(false);
      expect(notificacao.mensagem).toContain('2.000 kWh');
      expect(notificacao.mensagem).toContain('1.500 kWh');
      expect(notificacao.titulo).toContain('778811');
    });

    it('não avisa quando o valor subiu', () => {
      expect(
        GeradorNotificacoesService.paraLeituraRegistrada(
          contexto({ leitura: leituraEm('2026-03-10', 2500), referencia }),
        ),
      ).toEqual([]);
    });
  });

  describe('leitura substituída', () => {
    it('avisa citando o autor da leitura que saiu', () => {
      const [notificacao] = GeradorNotificacoesService.paraLeituraRegistrada(
        contexto({ substituida: leituraEm('2026-03-10', 1700) }),
      );

      expect(notificacao.tipo).toBe(TipoNotificacaoEnum.LEITURA_SUBSTITUIDA);
      expect(notificacao.requerAcao).toBe(false);
      expect(notificacao.mensagem).toContain('1.700 kWh');
      expect(notificacao.mensagem).toContain('João da Silva');
    });
  });

  describe('leitura atrasada', () => {
    it('exige decisão do administrador e aponta para a leitura', () => {
      const atrasada = leituraEm('2026-03-01');
      const [notificacao] = GeradorNotificacoesService.paraLeituraRegistrada(
        contexto({ leitura: atrasada }),
      );

      expect(notificacao.tipo).toBe(TipoNotificacaoEnum.LEITURA_ATRASADA);
      expect(notificacao.requerAcao).toBe(true);
      expect(notificacao.aguardandoDecisao).toBe(true);
      expect(notificacao.leituraId?.equals(atrasada.id)).toBe(true);
      expect(notificacao.mensagem).toContain('9 dias');
    });

    it('não avisa quando o atraso está dentro do limite', () => {
      expect(
        GeradorNotificacoesService.paraLeituraRegistrada(contexto({ leitura: leituraEm('2026-03-05') })),
      ).toEqual([]);
    });
  });

  describe('localização', () => {
    it('avisa quando a leitura foi feita fora do raio', () => {
      const [notificacao] = GeradorNotificacoesService.paraLeituraRegistrada(
        contexto({
          localizacao: { situacao: 'fora_do_raio', distanciaMetros: 15_400, impedeRegistro: false },
        }),
      );

      expect(notificacao.tipo).toBe(TipoNotificacaoEnum.LEITURA_FORA_DE_RAIO);
      expect(notificacao.requerAcao).toBe(false);
      expect(notificacao.mensagem).toContain('15,4 km');
    });

    it('avisa quando o GPS não respondeu', () => {
      const [notificacao] = GeradorNotificacoesService.paraLeituraRegistrada(
        contexto({
          localizacao: { situacao: 'sem_gps', distanciaMetros: null, impedeRegistro: false },
        }),
      );
      expect(notificacao.tipo).toBe(TipoNotificacaoEnum.LEITURA_SEM_GPS);
    });

    it('não avisa quando o endereço não tem geocerca cadastrada', () => {
      expect(
        GeradorNotificacoesService.paraLeituraRegistrada(
          contexto({
            localizacao: {
              situacao: 'endereco_sem_geocerca',
              distanciaMetros: null,
              impedeRegistro: false,
            },
          }),
        ),
      ).toEqual([]);
    });
  });

  it('acumula as notificações quando várias regras disparam juntas', () => {
    const notificacoes = GeradorNotificacoesService.paraLeituraRegistrada(
      contexto({
        leitura: leituraEm('2026-03-01', 1500),
        referencia: { valorConsumo: 2000, valorInjecao: null, dataLocal: DataLocal.parse('2026-02-20') },
        substituida: leituraEm('2026-03-01', 1700),
        localizacao: { situacao: 'sem_gps', distanciaMetros: null, impedeRegistro: false },
      }),
    );

    expect(notificacoes.map((n) => n.tipo).sort()).toEqual(
      [
        TipoNotificacaoEnum.LEITURA_ATRASADA,
        TipoNotificacaoEnum.LEITURA_SEM_GPS,
        TipoNotificacaoEnum.LEITURA_SUBSTITUIDA,
        TipoNotificacaoEnum.LEITURA_VALOR_MENOR,
      ].sort(),
    );
  });

  it('todas as notificações herdam a empresa e o instante informados', () => {
    const notificacoes = GeradorNotificacoesService.paraLeituraRegistrada(
      contexto({ leitura: leituraEm('2026-03-01') }),
    );
    expect(notificacoes.every((n) => n.empresaId?.equals(empresaId))).toBe(true);
    expect(notificacoes.every((n) => n.criadaEm === AGORA)).toBe(true);
  });
});
