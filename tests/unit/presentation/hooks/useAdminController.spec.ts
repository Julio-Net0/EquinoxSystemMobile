import { AutorizarUsuarioUseCase } from '@/application/use-cases/AutorizarUsuarioUseCase';
import { GerenciarUsuariosEmpresaUseCase } from '@/application/use-cases/GerenciarUsuariosEmpresaUseCase';
import { GerenciarEmpresasUseCase } from '@/application/use-cases/GerenciarEmpresasUseCase';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { EmpresaRepositoryMemory } from '@/infrastructure/fakes/EmpresaRepositoryMemory';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';

describe('useAdminController Integration & Business Use Cases', () => {
  let usuarioRepo: UsuarioRepositoryMemory;
  let empresaRepo: EmpresaRepositoryMemory;

  beforeEach(async () => {
    usuarioRepo = new UsuarioRepositoryMemory();
    empresaRepo = new EmpresaRepositoryMemory();

    const emp = new Empresa({
      id: UUIDv4.gerar(),
      nome: 'Empresa Teste',
      cnpj: new CNPJ('12345678000195'),
    });
    await empresaRepo.salvar(emp);
  });

  it('deve listar empresas cadastradas', async () => {
    const gerenciarEmpresasUseCase = new GerenciarEmpresasUseCase(empresaRepo);
    const empresas = await gerenciarEmpresasUseCase.listar();

    expect(empresas.length).toBe(1);
    expect(empresas[0].nome).toBe('Empresa Teste');
  });

  it('deve criar empresa com sucesso', async () => {
    const gerenciarEmpresasUseCase = new GerenciarEmpresasUseCase(empresaRepo);
    const nova = await gerenciarEmpresasUseCase.criar({
      nome: 'Solar Nova Ltda',
      cnpj: '11222333000181',
    });

    expect(nova).not.toBeNull();
    expect(nova.nome).toBe('Solar Nova Ltda');
  });
});
