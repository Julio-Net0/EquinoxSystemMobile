export class UUIDv4 {
  private static readonly REGEX_UUIDV4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  public readonly value: string;

  constructor(value?: string) {
    const val = value ?? UUIDv4.gerarUUIDString();
    if (!UUIDv4.validar(val)) {
      throw new Error(`UUIDv4 inválido: ${val}`);
    }
    this.value = val;
  }

  public static validar(value: string): boolean {
    return UUIDv4.REGEX_UUIDV4.test(value);
  }

  public static gerar(): UUIDv4 {
    return new UUIDv4(UUIDv4.gerarUUIDString());
  }

  private static gerarUUIDString(): string {
    // Implementação pura de UUIDv4 sem dependências externas
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  public equals(other: UUIDv4): boolean {
    if (!other) return false;
    return this.value.toLowerCase() === other.value.toLowerCase();
  }
}
