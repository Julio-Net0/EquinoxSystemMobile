export class CNPJ {
  public readonly valorLimpo: string;
  public readonly formatado: string;

  constructor(valor: string) {
    const limpo = (valor || '').replace(/\D/g, '');

    if (limpo.length !== 14) {
      throw new Error('CNPJ deve conter 14 dígitos');
    }

    if (!CNPJ.validar(limpo)) {
      throw new Error(`CNPJ inválido: ${valor}`);
    }

    this.valorLimpo = limpo;
    this.formatado = CNPJ.formatar(limpo);
  }

  public static validar(cnpj: string): boolean {
    const limpo = cnpj.replace(/\D/g, '');
    if (limpo.length !== 14) return false;

    // Elimina CNPJs conhecidos inválidos (ex: 00000000000000, 11111111111111, etc.)
    if (/^(\d)\1+$/.test(limpo)) return false;

    // Validação do 1º Dígito Verificador
    let tamanho = limpo.length - 2;
    let numeros = limpo.substring(0, tamanho);
    const digitos = limpo.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
      if (pos < 2) pos = 9;
    }

    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0), 10)) return false;

    // Validação do 2º Dígito Verificador
    tamanho = tamanho + 1;
    numeros = limpo.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
      if (pos < 2) pos = 9;
    }

    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(1), 10)) return false;

    return true;
  }

  public static formatar(cnpjLimpo: string): string {
    return cnpjLimpo.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5'
    );
  }

  public equals(other: CNPJ): boolean {
    if (!other) return false;
    return this.valorLimpo === other.valorLimpo;
  }
}
