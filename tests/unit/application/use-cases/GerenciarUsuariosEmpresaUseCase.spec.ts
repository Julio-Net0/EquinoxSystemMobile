import { GerenciarUsuariosEmpresaUseCase } from '@/application/use-cases/GerenciarUsuariosEmpresaUseCase';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

describe('GerenciarUsuariosEmpresaUseCase', () => {
  let usuarioRepository: UsuarioRepositoryMemory;
  let useCase: GerenciarUsuariosEmpresaUseCase;
  let empresaId: UUIDv4;
  let u1: Usuario;
  let u2: Usuario;

  beforeEach(async () => {
    usuarioRepository = new UsuarioRepositoryMemory();
    useCase = new GerenciarUsuariosEmpresaUseCase(usuarioRepository);
    empresaId = UUIDv4.gerar();

    u1 = new Usuario({
      id: UUIDv4.gerar(),
      empresaId,
      nome: 'Ana Costa',
      usuario: 'anacosta',
      email: 'ana@empresa.com',
      perfil: PerfilEnum.TECNICO,
      status: 'Ativo',
    });

    u2 = new Usuario({
      id: UUIDv4.gerar(),
      empresaId,
      nome: 'Bruno Lima',
      usuario: 'brunolima',
      email: 'bruno@empresa.com',
      perfil: PerfilEnum.ADMIN,
      status: 'Inativo',
    });

    await usuarioRepository.salvar(u1);
    await usuarioRepository.salvar(u2);
  });

  it('deve listar usuários com filtros', async () => {
    const result = await useCase.listar({ empresaId: empresaId.value, status: 'Ativo' });

    expect(result.length).toBe(1);
    expect(result[0].nome).toBe('Ana Costa');
  });

  it('deve alternar status do usuário entre Ativo e Inativo', async () => {
    const output = await useCase.alternarStatus({ usuarioId: u1.id.value });

    expect(output.status).toBe('Inativo');
    expect(output.isAtivo).toBe(false);

    const u1Salvo = await usuarioRepository.buscarPorId(u1.id);
    expect(u1Salvo?.isAtivo()).toBe(false);
  });

  it('deve excluir usuário', async () => {
    await useCase.excluir({ usuarioId: u2.id.value });

    const u2Salvo = await usuarioRepository.buscarPorId(u2.id);
    expect(u2Salvo).toBeNull();
  });
});
