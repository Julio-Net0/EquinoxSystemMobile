import { AutorizarUsuarioUseCase } from '@/application/use-cases/AutorizarUsuarioUseCase';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

describe('AutorizarUsuarioUseCase', () => {
  let usuarioRepository: UsuarioRepositoryMemory;
  let useCase: AutorizarUsuarioUseCase;
  let usuarioPendenteId: UUIDv4;
  let empresaId: UUIDv4;
  let usinaId1: UUIDv4;
  let usinaId2: UUIDv4;

  beforeEach(async () => {
    usuarioRepository = new UsuarioRepositoryMemory();
    useCase = new AutorizarUsuarioUseCase(usuarioRepository);

    empresaId = UUIDv4.gerar();
    usuarioPendenteId = UUIDv4.gerar();
    usinaId1 = UUIDv4.gerar();
    usinaId2 = UUIDv4.gerar();

    const usuarioPendente = new Usuario({
      id: usuarioPendenteId,
      empresaId,
      nome: 'Lucas Silva',
      usuario: 'lucassilva',
      email: 'lucas@empresa.com',
      perfil: PerfilEnum.TECNICO,
      status: 'Pendente',
    });

    await usuarioRepository.salvar(usuarioPendente);
  });

  it('deve autorizar usuário atribuindo perfil e vinculando usinas', async () => {
    const input = {
      usuarioId: usuarioPendenteId.value,
      perfil: PerfilEnum.ADMIN,
      usinasIds: [usinaId1.value, usinaId2.value],
      acao: 'autorizar' as const,
    };

    const output = await useCase.execute(input);

    expect(output.status).toBe('Ativo');
    expect(output.perfil).toBe(PerfilEnum.ADMIN);
    expect(output.usinasVinculadas.length).toBe(2);

    const usuarioSalvo = await usuarioRepository.buscarPorId(usuarioPendenteId);
    expect(usuarioSalvo?.isAtivo()).toBe(true);
    expect(usuarioSalvo?.perfil).toBe(PerfilEnum.ADMIN);
  });

  it('deve recusar usuário se a acao for recusar', async () => {
    const input = {
      usuarioId: usuarioPendenteId.value,
      perfil: PerfilEnum.TECNICO,
      usinasIds: [],
      acao: 'recusar' as const,
    };

    const output = await useCase.execute(input);

    expect(output.status).toBe('Recusado');
    expect(output.isAtivo).toBe(false);

    const usuarioSalvo = await usuarioRepository.buscarPorId(usuarioPendenteId);
    expect(usuarioSalvo?.status).toBe('Recusado');
  });

  it('deve lançar erro se usuário não for encontrado', async () => {
    const input = {
      usuarioId: UUIDv4.gerar().value,
      perfil: PerfilEnum.TECNICO,
      usinasIds: [],
      acao: 'autorizar' as const,
    };

    await expect(useCase.execute(input)).rejects.toThrow('Usuário não encontrado');
  });
});
