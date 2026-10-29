import { GerenciarPerfilUseCase } from '@/application/use-cases/GerenciarPerfilUseCase';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { SessionStorageMemory } from '@/infrastructure/fakes/SessionStorageMemory';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';

const SENHA = 'Equinox@2026';
const empresaId = UUIDv4.gerar();

async function cenario() {
  const usuarioRepo = new UsuarioRepositoryMemory();
  const sessionStorage = new SessionStorageMemory();
  const hash = new HashSenhaFake();
  const caso = new GerenciarPerfilUseCase(usuarioRepo, sessionStorage, hash);

  const eu = new Usuario({
    id: UUIDv4.gerar(), empresaId, nome: 'João da Silva', usuario: 'joao',
    email: 'joao@equinox.dev', senha: await hash.gerar(SENHA),
    perfil: PerfilEnum.TECNICO, status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: [UUIDv4.gerar()],
  });
  await usuarioRepo.salvar(eu);

  const outro = new Usuario({
    id: UUIDv4.gerar(), empresaId, nome: 'Maria', usuario: 'maria',
    email: 'maria@equinox.dev', senha: await hash.gerar(SENHA),
    perfil: PerfilEnum.TECNICO, status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: [UUIDv4.gerar()],
  });
  await usuarioRepo.salvar(outro);

  return { caso, usuarioRepo, sessionStorage, hash, eu, outro };
}

describe('GerenciarPerfilUseCase', () => {
  describe('alterarDados', () => {
    it('altera nome, e-mail e login', async () => {
      const { caso, usuarioRepo, eu } = await cenario();

      const saida = await caso.alterarDados({
        usuarioId: eu.id.value, nome: 'João S. Silva',
        email: 'joao.novo@equinox.dev', usuario: 'joao.s',
      });

      expect(saida.sucesso).toBe(true);
      const salvo = await usuarioRepo.buscarPorId(eu.id);
      expect(salvo?.nome).toBe('João S. Silva');
      expect(salvo?.email).toBe('joao.novo@equinox.dev');
      expect(salvo?.usuario).toBe('joao.s');
    });

    it('atualiza a sessão guardada, para o cabeçalho não mostrar o nome velho', async () => {
      const { caso, sessionStorage, eu } = await cenario();
      await sessionStorage.salvarSessao({
        usuarioId: eu.id.value, empresaId: empresaId.value, nome: 'João da Silva',
        usuario: 'joao', email: 'joao@equinox.dev', perfil: PerfilEnum.TECNICO,
      });

      await caso.alterarDados({
        usuarioId: eu.id.value, nome: 'João S. Silva',
        email: 'joao@equinox.dev', usuario: 'joao',
      });

      expect((await sessionStorage.obterSessao())?.nome).toBe('João S. Silva');
    });

    it('recusa campos vazios', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarDados({
        usuarioId: eu.id.value, nome: '  ', email: 'joao@equinox.dev', usuario: 'joao',
      });
      expect(saida.erro).toBe('Nome, e-mail e usuário são obrigatórios');
    });

    it('recusa e-mail mal formado', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarDados({
        usuarioId: eu.id.value, nome: 'João', email: 'nao-e-email', usuario: 'joao',
      });
      expect(saida.erro).toBe('O e-mail informado não parece válido');
    });

    it('recusa e-mail de outra pessoa', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarDados({
        usuarioId: eu.id.value, nome: 'João', email: 'maria@equinox.dev', usuario: 'joao',
      });
      expect(saida.erro).toBe('Este e-mail já está em uso');
    });

    it('recusa login de outra pessoa', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarDados({
        usuarioId: eu.id.value, nome: 'João', email: 'joao@equinox.dev', usuario: 'maria',
      });
      expect(saida.erro).toBe('Este usuário já está em uso');
    });

    it('aceita manter o próprio e-mail', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarDados({
        usuarioId: eu.id.value, nome: 'João S.', email: 'joao@equinox.dev', usuario: 'joao',
      });
      expect(saida.sucesso).toBe(true);
    });
  });

  describe('alterarSenha', () => {
    const nova = 'NovaSenha@1';

    it('troca a senha quando a atual confere', async () => {
      const { caso, usuarioRepo, hash, eu } = await cenario();

      const saida = await caso.alterarSenha({
        usuarioId: eu.id.value, senhaAtual: SENHA, novaSenha: nova, confirmacao: nova,
      });

      expect(saida.sucesso).toBe(true);
      const salvo = await usuarioRepo.buscarPorId(eu.id);
      expect(await hash.verificar(nova, salvo!.senha)).toBe(true);
    });

    it('limpa a sessão: o app antigo força entrar de novo', async () => {
      const { caso, sessionStorage, eu } = await cenario();
      await sessionStorage.salvarSessao({
        usuarioId: eu.id.value, empresaId: empresaId.value, nome: 'João',
        usuario: 'joao', email: 'joao@equinox.dev', perfil: PerfilEnum.TECNICO,
      });

      await caso.alterarSenha({
        usuarioId: eu.id.value, senhaAtual: SENHA, novaSenha: nova, confirmacao: nova,
      });

      expect(await sessionStorage.obterSessao()).toBeNull();
    });

    it('recusa quando a senha atual está errada', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarSenha({
        usuarioId: eu.id.value, senhaAtual: 'errada', novaSenha: nova, confirmacao: nova,
      });
      expect(saida.erro).toBe('A senha atual está incorreta');
    });

    it('exige ao menos 6 caracteres', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarSenha({
        usuarioId: eu.id.value, senhaAtual: SENHA, novaSenha: '12345', confirmacao: '12345',
      });
      expect(saida.erro).toBe('A nova senha precisa ter pelo menos 6 caracteres');
    });

    it('exige que a confirmação coincida', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarSenha({
        usuarioId: eu.id.value, senhaAtual: SENHA, novaSenha: nova, confirmacao: 'outra',
      });
      expect(saida.erro).toBe('A nova senha e a confirmação não conferem');
    });

    it('exige que a nova senha seja diferente da atual', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarSenha({
        usuarioId: eu.id.value, senhaAtual: SENHA, novaSenha: SENHA, confirmacao: SENHA,
      });
      expect(saida.erro).toBe('A nova senha precisa ser diferente da atual');
    });

    it('não troca nada quando a validação falha', async () => {
      const { caso, usuarioRepo, hash, eu } = await cenario();
      await caso.alterarSenha({
        usuarioId: eu.id.value, senhaAtual: 'errada', novaSenha: nova, confirmacao: nova,
      });
      const salvo = await usuarioRepo.buscarPorId(eu.id);
      expect(await hash.verificar(SENHA, salvo!.senha)).toBe(true);
    });
  });
});
