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

describe('UUIDv4 — fonte de aleatoriedade injetável', () => {
  afterEach(() => UUIDv4.restaurarFonteFallback());

  it('usa a fonte configurada em vez do fallback', () => {
    // 16 bytes de 0xab: o byte 6 vira 0x4b (versao 4) e o byte 8 vira 0xab (variante).
    UUIDv4.configurarFonte(() => new Array(16).fill(0xab));
    expect(UUIDv4.gerar().value).toBe('abababab-abab-4bab-abab-abababababab');
  });

  it('corrige os bits de versão e variante seja qual for a fonte', () => {
    UUIDv4.configurarFonte(() => new Array(16).fill(0xff));
    const gerado = UUIDv4.gerar().value;
    expect(gerado[14]).toBe('4');
    expect(['8', '9', 'a', 'b']).toContain(gerado[19]);
    expect(UUIDv4.validar(gerado)).toBe(true);
  });

  it('rejeita uma fonte que não devolva 16 bytes', () => {
    UUIDv4.configurarFonte(() => [1, 2, 3]);
    expect(() => UUIDv4.gerar()).toThrow('Fonte de aleatoriedade deve devolver 16 bytes');
  });

  it('volta a gerar UUID válido com o fallback', () => {
    UUIDv4.restaurarFonteFallback();
    expect(UUIDv4.validar(UUIDv4.gerar().value)).toBe(true);
  });
});
