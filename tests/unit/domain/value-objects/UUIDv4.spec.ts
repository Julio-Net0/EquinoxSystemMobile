import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

describe('UUIDv4 Value Object', () => {
  it('deve gerar um UUIDv4 válido se nenhum for fornecido', () => {
    const uuid = UUIDv4.gerar();
    expect(uuid.value).toBeDefined();
    expect(UUIDv4.validar(uuid.value)).toBe(true);
  });

  it('deve instanciar com sucesso quando fornecido um UUIDv4 válido', () => {
    const validUuidStr = '550e8400-e29b-41d4-a716-446655440000';
    const uuid = new UUIDv4(validUuidStr);
    expect(uuid.value).toBe(validUuidStr);
  });

  it('deve lançar erro se o formato do UUID for inválido', () => {
    expect(() => new UUIDv4('uuid-invalido-123')).toThrow('UUIDv4 inválido: uuid-invalido-123');
  });

  it('deve comparar a igualdade entre dois UUIDv4', () => {
    const id1 = new UUIDv4('550e8400-e29b-41d4-a716-446655440000');
    const id2 = new UUIDv4('550e8400-e29b-41d4-a716-446655440000');
    const id3 = UUIDv4.gerar();

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
  });
});
