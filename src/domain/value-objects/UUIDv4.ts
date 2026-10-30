/** 16 bytes aleatórios. Implementada na infraestrutura com expo-crypto. */
export type FonteAleatoria = () => number[] | Uint8Array;

export class UUIDv4 {
  private static readonly REGEX_UUIDV4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  /**
   * Fallback com Math.random: previsível e inadequado para identidade, mas o
   * domínio não pode importar expo-crypto. A raiz de composição troca a fonte
   * no boot via configurarFonte; os testes usam este fallback.
   */
  private static readonly FONTE_FALLBACK: FonteAleatoria = () =>
    Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));

  private static fonte: FonteAleatoria = UUIDv4.FONTE_FALLBACK;

  public readonly value: string;

  constructor(value?: string) {
    const val = value ?? UUIDv4.gerarUUIDString();
    if (!UUIDv4.validar(val)) {
      throw new Error(`UUIDv4 inválido: ${val}`);
    }
    this.value = val;
  }

  public static configurarFonte(fonte: FonteAleatoria): void {
    UUIDv4.fonte = fonte;
  }

  public static restaurarFonteFallback(): void {
    UUIDv4.fonte = UUIDv4.FONTE_FALLBACK;
  }

  public static validar(value: string): boolean {
    return UUIDv4.REGEX_UUIDV4.test(value);
  }

  public static gerar(): UUIDv4 {
    return new UUIDv4(UUIDv4.gerarUUIDString());
  }

  private static gerarUUIDString(): string {
    const bytes = Array.from(UUIDv4.fonte());
    if (bytes.length !== 16) {
      throw new Error('Fonte de aleatoriedade deve devolver 16 bytes');
    }

    bytes[6] = (bytes[6] & 0x0f) | 0x40; // versão 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122

    const hex = bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }

  public equals(other: UUIDv4): boolean {
    if (!other) return false;
    return this.value.toLowerCase() === other.value.toLowerCase();
  }
}
