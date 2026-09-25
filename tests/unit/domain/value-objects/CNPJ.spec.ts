import { CNPJ } from '@/domain/value-objects/CNPJ';

describe('CNPJ Value Object', () => {
  it('deve aceitar e formatar um CNPJ válido', () => {
    const validCnpjStr = '12345678000195';
    const cnpj = new CNPJ(validCnpjStr);

    expect(cnpj.valorLimpo).toBe('12345678000195');
    expect(cnpj.formatado).toBe('12.345.678/0001-95');
  });

  it('deve aceitar um CNPJ já formatado', () => {
    const formattedCnpj = '12.345.678/0001-95';
    const cnpj = new CNPJ(formattedCnpj);

    expect(cnpj.valorLimpo).toBe('12345678000195');
    expect(cnpj.formatado).toBe(formattedCnpj);
  });

  it('deve lançar erro se o CNPJ não tiver 14 dígitos ou tiver dígitos repetidos', () => {
    expect(() => new CNPJ('123')).toThrow('CNPJ deve conter 14 dígitos');
    expect(() => new CNPJ('00000000000000')).toThrow('CNPJ inválido');
  });

  it('deve lançar erro se os dígitos verificadores forem inválidos', () => {
    expect(() => new CNPJ('12.345.678/0001-00')).toThrow('CNPJ inválido');
  });

  it('deve comparar igualdade de dois CNPJs', () => {
    const c1 = new CNPJ('12.345.678/0001-95');
    const c2 = new CNPJ('12345678000195');
    const c4 = new CNPJ('11222333000181');

    expect(c1.equals(c2)).toBe(true);
    expect(c1.equals(c4)).toBe(false);
  });
});
