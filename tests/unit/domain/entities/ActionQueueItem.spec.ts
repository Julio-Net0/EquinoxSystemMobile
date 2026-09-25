import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

describe('ActionQueueItem Entity', () => {
  it('deve instanciar um ActionQueueItem válido', () => {
    const id = UUIDv4.gerar();
    const item = new ActionQueueItem({
      id,
      tipoOperacao: 'INSERT_LEITURA',
      payloadJSON: JSON.stringify({ leituraId: id.value }),
    });

    expect(item.id.equals(id)).toBe(true);
    expect(item.tipoOperacao).toBe('INSERT_LEITURA');
    expect(item.tentativas).toBe(0);
    expect(item.timestamp).toBeInstanceOf(Date);
  });

  it('deve incrementar tentativas', () => {
    const item = new ActionQueueItem({
      id: UUIDv4.gerar(),
      tipoOperacao: 'INSERT_USINA',
      payloadJSON: '{"test": true}',
    });

    expect(item.tentativas).toBe(0);
    item.incrementarTentativa();
    expect(item.tentativas).toBe(1);
  });
});
