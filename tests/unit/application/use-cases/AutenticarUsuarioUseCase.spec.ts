import { AutenticarUsuarioUseCase } from '@/application/use-cases/AutenticarUsuarioUseCase';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { SessionStorageMemory } from '@/infrastructure/fakes/SessionStorageMemory';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

describe('AutenticarUsuarioUseCase', () => {
  let usuarioRepo: UsuarioRepositoryMemory;
  let sessionStorage: SessionStorageMemory;
  let useCase: AutenticarUsuarioUseCase;

  beforeEach(async () => {
    usuarioRepo = new UsuarioRepositoryMemory();
    sessionStorage = new SessionStorageMemory();
    useCase = new AutenticarUsuarioUseCase(usuarioRepo, sessionStorage);

    await usuarioRepo.salvar(
      new Usuario({
        id: UUIDv4.gerar(),
        empresaId: UUIDv4.gerar(),
        nome: 'Carlos Técnico',
        email: 'carlos@equinox.com',
        perfil: PerfilEnum.TECNICO,
        status: 'Ativo',
      })
    );
  });

  it('deve autenticar usuário cadastrado e salvar a sessão no storage', async () => {
    const resultado = await useCase.executar({
      email: 'carlos@equinox.com',
    });

    expect(resultado.sucesso).toBe(true);
    expect(resultado.usuario?.email).toBe('carlos@equinox.com');

    const sessaoSalva = await sessionStorage.obterSessao();
    expect(sessaoSalva).not.toBeNull();
    expect(sessaoSalva?.email).toBe('carlos@equinox.com');
  });

  it('deve falhar se o email não estiver cadastrado', async () => {
    const resultado = await useCase.executar({
      email: 'naoexistente@equinox.com',
    });

    expect(resultado.sucesso).toBe(false);
    expect(resultado.erro).toBe('Usuário não encontrado');
  });
});
