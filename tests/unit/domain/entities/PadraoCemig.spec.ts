import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

const base = () => ({ id: UUIDv4.gerar(), enderecoId: UUIDv4.gerar(), numero: '12345678' });

describe('PadraoCemig', () => {
  it('é criado com o número do padrão', () => {
    expect(new PadraoCemig(base()).numero).toBe('12345678');
  });

  it('remove espaços das bordas', () => {
    expect(new PadraoCemig({ ...base(), numero: '  778811 ' }).numero).toBe('778811');
  });

  it.each(['', '   '])('recusa o número %p', (numero) => {
    expect(() => new PadraoCemig({ ...base(), numero })).toThrow('Número do padrão é obrigatório');
  });

  it('guarda o endereço ao qual pertence', () => {
    const enderecoId = UUIDv4.gerar();
    expect(new PadraoCemig({ ...base(), enderecoId }).enderecoId.equals(enderecoId)).toBe(true);
  });
});
