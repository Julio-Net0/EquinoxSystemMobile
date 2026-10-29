import { Notificacao } from '@/domain/entities/Notificacao';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { ResolucaoEnum } from '@/domain/enums/ResolucaoEnum';

const CRIADA_EM = new Date(Date.UTC(2026, 2, 9, 15, 0));

const informativa = () => ({
  id: UUIDv4.gerar(),
  empresaId: UUIDv4.gerar(),
  tipo: TipoNotificacaoEnum.LEITURA_SUBSTITUIDA,
  titulo: 'Leitura substituída',
  mensagem: 'A leitura do dia foi substituída por uma mais recente.',
  criadaEm: CRIADA_EM,
});

const comAcao = () => ({
  ...informativa(),
  tipo: TipoNotificacaoEnum.LEITURA_ATRASADA,
  titulo: 'Leitura atrasada',
  requerAcao: true,
  leituraId: UUIDv4.gerar(),
});

describe('Notificacao', () => {
  it('nasce não lida', () => {
    expect(new Notificacao(informativa()).lida).toBe(false);
  });

  it('uma notificação informativa não aguarda decisão', () => {
    const notificacao = new Notificacao(informativa());
    expect(notificacao.requerAcao).toBe(false);
    expect(notificacao.aguardandoDecisao).toBe(false);
  });

  it('uma notificação com ação pendente aguarda decisão', () => {
    expect(new Notificacao(comAcao()).aguardandoDecisao).toBe(true);
  });

  it('exige a leitura de referência quando requer ação', () => {
    expect(() => new Notificacao({ ...comAcao(), leituraId: undefined })).toThrow(
      'Notificação que requer ação precisa apontar para uma leitura',
    );
  });

  it.each([
    ['título', { titulo: '  ' }],
    ['mensagem', { mensagem: '' }],
  ])('recusa %s vazio', (_campo, sobrescrita) => {
    expect(() => new Notificacao({ ...informativa(), ...sobrescrita })).toThrow('obrigatóri');
  });

  it('marcar como lida é idempotente', () => {
    const notificacao = new Notificacao(informativa());
    notificacao.marcarLida();
    notificacao.marcarLida();
    expect(notificacao.lida).toBe(true);
  });

  describe('resolução', () => {
    const adminId = UUIDv4.gerar();
    const quando = new Date(Date.UTC(2026, 2, 10, 12, 0));

    it('registra resolução, autor e instante, e deixa de aguardar decisão', () => {
      const notificacao = new Notificacao(comAcao());
      notificacao.resolver(ResolucaoEnum.APROVADA, adminId, quando);

      expect(notificacao.resolucao).toBe(ResolucaoEnum.APROVADA);
      expect(notificacao.resolvidaPorId?.equals(adminId)).toBe(true);
      expect(notificacao.resolvidaEm).toEqual(quando);
      expect(notificacao.aguardandoDecisao).toBe(false);
    });

    it('marca como lida ao resolver', () => {
      const notificacao = new Notificacao(comAcao());
      notificacao.resolver(ResolucaoEnum.DESCARTADA, adminId, quando);
      expect(notificacao.lida).toBe(true);
    });

    it('recusa resolver duas vezes', () => {
      const notificacao = new Notificacao(comAcao());
      notificacao.resolver(ResolucaoEnum.APROVADA, adminId, quando);
      expect(() => notificacao.resolver(ResolucaoEnum.DESCARTADA, adminId, quando)).toThrow(
        'Esta notificação já foi resolvida',
      );
    });

    it('recusa resolver uma notificação que não requer ação', () => {
      expect(() =>
        new Notificacao(informativa()).resolver(ResolucaoEnum.APROVADA, adminId, quando),
      ).toThrow('Esta notificação não requer decisão');
    });

    it('aceita resolução automática sem autor', () => {
      const notificacao = new Notificacao(comAcao());
      notificacao.resolver(ResolucaoEnum.AUTOMATICA, null, quando);
      expect(notificacao.resolvidaPorId).toBeNull();
      expect(notificacao.resolucao).toBe(ResolucaoEnum.AUTOMATICA);
    });
  });
});
