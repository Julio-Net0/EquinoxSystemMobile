import { ActionQueueItem, TIPOS_DE_OPERACAO } from '@/domain/entities/ActionQueueItem';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

const AGORA = new Date('2026-03-10T15:00:00.000Z');

describe('ActionQueueItem', () => {
  it('nasce sem tentativas e sem erro', () => {
    const id = UUIDv4.gerar();
    const item = new ActionQueueItem({
      id,
      tipoOperacao: 'UPSERT_LEITURA',
      payloadJSON: JSON.stringify({ id: id.value }),
    });

    expect(item.id.equals(id)).toBe(true);
    expect(item.tipoOperacao).toBe('UPSERT_LEITURA');
    expect(item.tentativas).toBe(0);
    expect(item.ultimoErro).toBeNull();
    expect(item.timestamp).toBeInstanceOf(Date);
    expect(item.estaIsolado()).toBe(false);
  });

  it('exige payload', () => {
    expect(
      () => new ActionQueueItem({ id: UUIDv4.gerar(), tipoOperacao: 'UPSERT_LEITURA', payloadJSON: ' ' }),
    ).toThrow('Payload JSON é obrigatório');
  });

  it('recusa tipo de operação do modelo aposentado', () => {
    expect(
      () =>
        new ActionQueueItem({
          id: UUIDv4.gerar(),
          tipoOperacao: 'INSERT_USINA' as never,
          payloadJSON: '{}',
        }),
    ).toThrow('Tipo de operação desconhecido');
  });

  it('os tipos cobrem o modelo atual e não falam em usina', () => {
    expect(TIPOS_DE_OPERACAO).toContain('UPSERT_LEITURA');
    expect(TIPOS_DE_OPERACAO).toContain('UPSERT_ENDERECO');
    expect(TIPOS_DE_OPERACAO).toContain('UPSERT_PADRAO');
    expect(TIPOS_DE_OPERACAO.join(' ')).not.toMatch(/USINA/);
  });

  describe('para()', () => {
    it('guarda só o identificador do registro, não uma cópia dele', () => {
      const leituraId = UUIDv4.gerar();
      const item = ActionQueueItem.para('UPSERT_LEITURA', leituraId, AGORA);

      expect(JSON.parse(item.payloadJSON)).toEqual({ id: leituraId.value });
      expect(item.registroId?.equals(leituraId)).toBe(true);
      expect(item.timestamp).toEqual(AGORA);
    });

    it('aceita operação sem registro (escopo global)', () => {
      const item = ActionQueueItem.para('MARCAR_NOTIFICACOES_LIDAS', null, AGORA);
      expect(item.registroId).toBeNull();
    });

    it('cada item tem id próprio', () => {
      const leituraId = UUIDv4.gerar();
      const a = ActionQueueItem.para('UPSERT_LEITURA', leituraId, AGORA);
      const b = ActionQueueItem.para('UPSERT_LEITURA', leituraId, AGORA);
      expect(a.id.equals(b.id)).toBe(false);
    });
  });

  it('payload ilegível não derruba: o item fica sem registro', () => {
    const item = new ActionQueueItem({
      id: UUIDv4.gerar(),
      tipoOperacao: 'UPSERT_LEITURA',
      payloadJSON: 'isto não é json',
    });
    expect(item.registroId).toBeNull();
  });

  describe('falhas', () => {
    it('cada recusa conta uma tentativa e guarda o motivo', () => {
      const item = ActionQueueItem.para('UPSERT_LEITURA', UUIDv4.gerar(), AGORA);

      item.registrarFalha('A nuvem recusou');

      expect(item.tentativas).toBe(1);
      expect(item.ultimoErro).toBe('A nuvem recusou');
      expect(item.estaIsolado()).toBe(false);
    });

    it('fica isolado ao atingir o limite de tentativas', () => {
      const item = ActionQueueItem.para('UPSERT_LEITURA', UUIDv4.gerar(), AGORA);

      for (let i = 0; i < ActionQueueItem.MAX_TENTATIVAS; i += 1) item.registrarFalha('recusa');

      expect(item.estaIsolado()).toBe(true);
    });

    it('reativar zera as tentativas e o erro', () => {
      const item = new ActionQueueItem({
        id: UUIDv4.gerar(),
        tipoOperacao: 'UPSERT_LEITURA',
        payloadJSON: '{"id":null}',
        tentativas: ActionQueueItem.MAX_TENTATIVAS,
        ultimoErro: 'recusa',
      });

      item.reativar();

      expect(item.tentativas).toBe(0);
      expect(item.ultimoErro).toBeNull();
      expect(item.estaIsolado()).toBe(false);
    });
  });
});
