import { CadastrarUsuarioPendenteUseCase } from '@/application/use-cases/CadastrarUsuarioPendenteUseCase';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { EmpresaRepositoryMemory } from '@/infrastructure/fakes/EmpresaRepositoryMemory';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

describe('CadastrarUsuarioPendenteUseCase', () => {
  let usuarioRepository: UsuarioRepositoryMemory;
  let empresaRepository: EmpresaRepositoryMemory;
  let useCase: CadastrarUsuarioPendenteUseCase;
  let empresaId: UUIDv4;

  beforeEach(async () => {
    usuarioRepository = new UsuarioRepositoryMemory();
    empresaRepository = new EmpresaRepositoryMemory();
    useCase = new CadastrarUsuarioPendenteUseCase(usuarioRepository, empresaRepository);

    empresaId = UUIDv4.gerar();
    const empresa = new Empresa({
      id: empresaId,
      nome: 'Solar Energy Ltda',
      cnpj: new CNPJ('12345678000195'),
    });
    await empresaRepository.salvar(empresa);
  });

  it('deve realizar pré-cadastro de usuário com status Pendente', async () => {
    const input = {
      empresaId: empresaId.value,
      nome: 'Mariana Souza',
      usuario: 'msouza',
      email: 'mariana@solarenergy.com',
    };

    const output = await useCase.execute(input);

    expect(output.id).toBeDefined();
    expect(output.status).toBe('Pendente');
    expect(output.perfil).toBe(PerfilEnum.TECNICO);
    expect(output.nome).toBe('Mariana Souza');

    const usuarioSalvo = await usuarioRepository.buscarPorEmail('mariana@solarenergy.com');
    expect(usuarioSalvo).not.toBeNull();
    expect(usuarioSalvo?.status).toBe('Pendente');
  });

  it('deve lançar erro se empresa não for encontrada', async () => {
    const input = {
      empresaId: UUIDv4.gerar().value,
      nome: 'Mariana Souza',
      usuario: 'msouza',
      email: 'mariana@solarenergy.com',
    };

    await expect(useCase.execute(input)).rejects.toThrow('Empresa não encontrada');
  });

  it('deve lançar erro se o e-mail já estiver cadastrado', async () => {
    const input = {
      empresaId: empresaId.value,
      nome: 'Mariana Souza',
      usuario: 'msouza',
      email: 'mariana@solarenergy.com',
    };

    await useCase.execute(input);
    await expect(useCase.execute(input)).rejects.toThrow('Já existe um usuário cadastrado com este e-mail');
  });
});
