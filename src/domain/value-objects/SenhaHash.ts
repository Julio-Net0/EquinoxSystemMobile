/**
 * Hash de senha já calculado. O domínio nunca vê a senha em texto nem sabe
 * calcular o hash — isso é responsabilidade de IHashSenhaGateway, na
 * infraestrutura. Aqui só mora o formato e a comparação.
 */
export class SenhaHash {
  private static readonly SEPARADOR = '$';
  private static readonly MINIMO_ITERACOES = 1000;
  private static readonly MINIMO_SALT = 32;
  private static readonly HEX = /^[0-9a-f]+$/i;

  public readonly algoritmo: string;
  public readonly iteracoes: number;
  public readonly salt: string;
  public readonly hash: string;

  constructor(algoritmo: string, iteracoes: number, salt: string, hash: string) {
    const formatoValido =
      !!algoritmo &&
      !algoritmo.includes(SenhaHash.SEPARADOR) &&
      Number.isInteger(iteracoes) &&
      iteracoes >= SenhaHash.MINIMO_ITERACOES &&
      salt.length >= SenhaHash.MINIMO_SALT &&
      SenhaHash.HEX.test(salt) &&
      hash.length > 0 &&
      SenhaHash.HEX.test(hash);

    if (!formatoValido) {
      throw new Error('Hash de senha inválido');
    }

    this.algoritmo = algoritmo;
    this.iteracoes = iteracoes;
    this.salt = salt;
    this.hash = hash;
  }

  /** Reconstrói a partir de "algoritmo$iteracoes$salt$hash" (uma coluna no SQLite). */
  public static deSerializado(serializado: string): SenhaHash {
    const partes = (serializado ?? '').split(SenhaHash.SEPARADOR);
    if (partes.length !== 4) {
      throw new Error('Hash de senha inválido');
    }
    const [algoritmo, iteracoes, salt, hash] = partes;
    if (!/^\d+$/.test(iteracoes)) {
      throw new Error('Hash de senha inválido');
    }
    return new SenhaHash(algoritmo, Number(iteracoes), salt, hash);
  }

  public serializar(): string {
    return [this.algoritmo, this.iteracoes, this.salt, this.hash].join(SenhaHash.SEPARADOR);
  }

  /**
   * Compara em tempo aproximadamente constante: percorre todos os caracteres
   * mesmo depois de achar uma diferença, para não vazar o prefixo correto.
   */
  public equals(outra: SenhaHash): boolean {
    if (!outra) return false;
    if (this.algoritmo !== outra.algoritmo || this.iteracoes !== outra.iteracoes) return false;
    if (this.salt !== outra.salt || this.hash.length !== outra.hash.length) return false;

    let diferenca = 0;
    for (let i = 0; i < this.hash.length; i += 1) {
      diferenca |= this.hash.charCodeAt(i) ^ outra.hash.charCodeAt(i);
    }
    return diferenca === 0;
  }
}
