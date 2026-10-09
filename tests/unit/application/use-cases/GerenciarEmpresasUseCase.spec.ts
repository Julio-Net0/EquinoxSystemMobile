import { GerenciarEmpresasUseCase } from '@/application/use-cases/GerenciarEmpresasUseCase';
import { EmpresaRepositoryMemory } from '@/infrastructure/fakes/EmpresaRepositoryMemory';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';

describe('GerenciarEmpresasUseCase', () => {
  let empresaRepository: EmpresaRepositoryMemory;
  let useCase: GerenciarEmpresasUseCase;

  beforeEach(() => {
    empresaRepository = new EmpresaRepositoryMemory();
    useCase = new GerenciarEmpresasUseCase(empresaRepository);
  });

  it('deve cadastrar uma nova empresa com CNPJ válido', async () => {
    const input = {
      nome: 'Empresa Solar Brasil',
      cnpj: '12345678000195',
    };

    const output = await useCase.criar(input);

    expect(output.id).toBeDefined();
    expect(output.nome).toBe('Empresa Solar Brasil');
    expect(output.cnpj).toBe('12.345.678/0001-95');

    const empresaSalva = await empresaRepository.buscarPorId(new UUIDv4(output.id));
    expect(empresaSalva).not.toBeNull();
  });

  it('deve listar todas as empresas cadastradas', async () => {
    const e1 = new Empresa({ id: UUIDv4.gerar(), nome: 'Empresa A', cnpj: new CNPJ('12345678000195') });
    const e2 = new Empresa({ id: UUIDv4.gerar(), nome: 'Empresa B', cnpj: new CNPJ('11222333000181') });

    await empresaRepository.salvar(e1);
    await empresaRepository.salvar(e2);

    const lista = await useCase.listar();

    expect(lista.length).toBe(2);
    expect(lista[0].nome).toBe('Empresa A');
    expect(lista[1].nome).toBe('Empresa B');
  });
});
