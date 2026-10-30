import { AutenticarUsuarioUseCase } from '@/application/use-cases/AutenticarUsuarioUseCase';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { SessionStorageMemory } from '@/infrastructure/fakes/SessionStorageMemory';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';

const SENHA = 'Equinox@2026';

async function cenario(sobrescrita: { status?: StatusUsuarioEnum; perfil?: PerfilEnum } = {}) {
  const usuarioRepo = new UsuarioRepositoryMemory();
  const sessionStorage = new SessionStorageMemory();
  const hash = new HashSenhaFake();
  const caso = new AutenticarUsuarioUseCase(usuarioRepo, sessionStorage, hash);

  const perfil = sobrescrita.perfil ?? PerfilEnum.TECNICO;
  const usuario = new Usuario({
    id: UUIDv4.gerar(),
    empresaId: perfil === PerfilEnum.SUPER_ADMIN ? null : UUIDv4.gerar(),
    nome: 'João da Silva',
    usuario: 'joao.silva',
    email: 'joao@equinox.dev',
    senha: await hash.gerar(SENHA),
    perfil,
    status: sobrescrita.status ?? StatusUsuarioEnum.ATIVO,
    enderecosVinculados: perfil === PerfilEnum.SUPER_ADMIN ? [] : [UUIDv4.gerar()],
  });
  await usuarioRepo.salvar(usuario);

  return { caso, usuario, usuarioRepo, sessionStorage };
}

describe('AutenticarUsuarioUseCase', () => {
  it('autentica pelo e-mail e grava a sessão', async () => {
    const { caso, usuario, sessionStorage } = await cenario();

    const saida = await caso.executar({ login: 'joao@equinox.dev', senha: SENHA });

    expect(saida.sucesso).toBe(true);
    expect(saida.usuario?.usuarioId).toBe(usuario.id.value);
    expect((await sessionStorage.obterSessao())?.email).toBe('joao@equinox.dev');
  });

  it('autentica pelo login, como no app antigo', async () => {
    const { caso } = await cenario();
    expect((await caso.executar({ login: 'joao.silva', senha: SENHA })).sucesso).toBe(true);
  });

  it('ignora diferença de caixa e espaços no login', async () => {
    const { caso } = await cenario();
    expect((await caso.executar({ login: '  JOAO@Equinox.DEV ', senha: SENHA })).sucesso).toBe(true);
  });

  it('recusa a senha errada', async () => {
    const { caso, sessionStorage } = await cenario();

    const saida = await caso.executar({ login: 'joao.silva', senha: 'outra-senha' });

    expect(saida.sucesso).toBe(false);
    expect(saida.erro).toBe('E-mail, usuário ou senha incorretos');
    expect(await sessionStorage.obterSessao()).toBeNull();
  });

  it('dá o mesmo erro para usuário inexistente, para não revelar quem existe', async () => {
    const { caso } = await cenario();

    const saida = await caso.executar({ login: 'ninguem@equinox.dev', senha: SENHA });

    expect(saida.sucesso).toBe(false);
    expect(saida.erro).toBe('E-mail, usuário ou senha incorretos');
  });

  it.each([
    [StatusUsuarioEnum.PENDENTE, 'Seu cadastro ainda aguarda autorização de um administrador'],
    [StatusUsuarioEnum.RECUSADO, 'Seu cadastro não foi autorizado'],
    [StatusUsuarioEnum.INATIVO, 'Seu acesso está inativo. Procure um administrador'],
  ])('recusa usuário %s com mensagem própria', async (status, erro) => {
    const { caso, sessionStorage } = await cenario({ status });

    const saida = await caso.executar({ login: 'joao.silva', senha: SENHA });

    expect(saida.sucesso).toBe(false);
    expect(saida.erro).toBe(erro);
    expect(await sessionStorage.obterSessao()).toBeNull();
  });

  it.each(['', '   '])('recusa login vazio (%p) sem consultar o repositório', async (login) => {
    const { caso } = await cenario();
    expect((await caso.executar({ login, senha: SENHA })).erro).toBe('Informe o e-mail ou usuário');
  });

  it('recusa senha vazia', async () => {
    const { caso } = await cenario();
    expect((await caso.executar({ login: 'joao.silva', senha: '' })).erro).toBe('Informe a senha');
  });

  it('a sessão do super admin fica sem empresa', async () => {
    const { caso, sessionStorage } = await cenario({ perfil: PerfilEnum.SUPER_ADMIN });

    await caso.executar({ login: 'joao.silva', senha: SENHA });

    const sessao = await sessionStorage.obterSessao();
    expect(sessao?.empresaId).toBeNull();
    expect(sessao?.perfil).toBe(PerfilEnum.SUPER_ADMIN);
  });

  it('a sessão não guarda nada da senha', async () => {
    const { caso, sessionStorage } = await cenario();

    await caso.executar({ login: 'joao.silva', senha: SENHA });

    expect(JSON.stringify(await sessionStorage.obterSessao())).not.toContain(SENHA);
  });
});
