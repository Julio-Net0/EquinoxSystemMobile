import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';

describe('Empresa Entity', () => {
  it('deve instanciar uma Empresa válida com UUID gerado', () => {
    const id = UUIDv4.gerar();
    const cnpj = new CNPJ('12.345.678/0001-95');
    const empresa = new Empresa({
      id,
      nome: 'Solar Tech Ltda',
      cnpj,
    });

    expect(empresa.id.equals(id)).toBe(true);
    expect(empresa.nome).toBe('Solar Tech Ltda');
    expect(empresa.cnpj.equals(cnpj)).toBe(true);
    expect(empresa.dataCriacao).toBeInstanceOf(Date);
  });

  it('deve lançar erro se o nome da empresa for vazio', () => {
    const id = UUIDv4.gerar();
    const cnpj = new CNPJ('12.345.678/0001-95');

    expect(
      () =>
        new Empresa({
          id,
          nome: '   ',
          cnpj,
        })
    ).toThrow('Nome da empresa é obrigatório');
  });
});
