import { GerenciarPerfilUseCase } from '@/application/use-cases/GerenciarPerfilUseCase';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { SessionStorageMemory } from '@/infrastructure/fakes/SessionStorageMemory';
import { AutenticacaoRemotaFake } from '@/infrastructure/fakes/AutenticacaoRemotaFake';
import { CredencialOfflineMemory } from '@/infrastructure/fakes/CredencialOfflineMemory';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';
import { ReautenticacaoEmMemoria } from '@/infrastructure/security/ReautenticacaoEmMemoria';
import { AcessoOfflineService } from '@/domain/services/AcessoOfflineService';
import { IDS, SENHA, novoUsuario, uuid } from '../../../helpers/cenarioSync';

async function cenario() {
  const usuarioRepo = new UsuarioRepositoryMemory();
  const sessionStorage = new SessionStorageMemory();
  const remoto = new AutenticacaoRemotaFake();
  const credenciais = new CredencialOfflineMemory();
  const acessoOffline = new AcessoOfflineService(
    credenciais,
    new HashSenhaFake(),
    new ReautenticacaoEmMemoria(),
  );
  const caso = new GerenciarPerfilUseCase(usuarioRepo, sessionStorage, remoto, acessoOffline);

  const eu = novoUsuario({ nome: 'João da Silva', usuario: 'joao', email: 'joao@equinox.dev' });
  const outro = novoUsuario({
    id: uuid(40), nome: 'Maria', usuario: 'maria', email: 'maria@equinox.dev',
  });
  await usuarioRepo.salvar(eu);
  await usuarioRepo.salvar(outro);

  remoto.registrarConta(eu, SENHA);
  await remoto.entrar(eu.email, SENHA);
  await sessionStorage.salvarSessao({
    usuarioId: eu.id.value, empresaId: IDS.empresa.value, nome: eu.nome,
    usuario: eu.usuario, email: eu.email, perfil: PerfilEnum.TECNICO,
  });

  return { caso, usuarioRepo, sessionStorage, remoto, eu, outro, credenciais, acessoOffline };
}

describe('GerenciarPerfilUseCase', () => {
  describe('alterarDados', () => {
    it('altera nome e apelido', async () => {
      const { caso, usuarioRepo, eu } = await cenario();

      const saida = await caso.alterarDados({
        usuarioId: eu.id.value, nome: 'João S. Silva', email: eu.email, usuario: 'joao.s',
      });

      expect(saida.sucesso).toBe(true);
      const salvo = await usuarioRepo.buscarPorId(eu.id);
      expect(salvo?.nome).toBe('João S. Silva');
      expect(salvo?.usuario).toBe('joao.s');
      expect(salvo?.email).toBe('joao@equinox.dev');
    });

    it('atualiza a sessão guardada, para o cabeçalho não mostrar o nome velho', async () => {
      const { caso, sessionStorage, eu } = await cenario();

      await caso.alterarDados({
        usuarioId: eu.id.value, nome: 'João S. Silva', email: eu.email, usuario: 'joao.s',
      });

      const sessao = await sessionStorage.obterSessao();
      expect(sessao?.nome).toBe('João S. Silva');
      expect(sessao?.usuario).toBe('joao.s');
    });

    it('não troca o e-mail: ele é a identidade na nuvem', async () => {
      const { caso, usuarioRepo, eu } = await cenario();

      const saida = await caso.alterarDados({
        usuarioId: eu.id.value, nome: eu.nome, email: 'joao.novo@equinox.dev', usuario: eu.usuario,
      });

      expect(saida.sucesso).toBe(false);
      expect(saida.erro).toContain('identidade de acesso');
      expect((await usuarioRepo.buscarPorId(eu.id))?.email).toBe('joao@equinox.dev');
    });

    it('aceita o próprio e-mail escrito com outra caixa', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarDados({
        usuarioId: eu.id.value, nome: 'João', email: ' JOAO@equinox.dev ', usuario: 'joao',
      });
      expect(saida.sucesso).toBe(true);
    });

    it('recusa campos vazios', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarDados({
        usuarioId: eu.id.value, nome: ' ', email: eu.email, usuario: 'joao',
      });
      expect(saida.erro).toBe('Nome, e-mail e usuário são obrigatórios');
    });

    it('recusa e-mail mal formado', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarDados({
        usuarioId: eu.id.value, nome: 'João', email: 'sem-arroba', usuario: 'joao',
      });
      expect(saida.erro).toBe('O e-mail informado não parece válido');
    });

    it('recusa apelido de outra pessoa', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarDados({
        usuarioId: eu.id.value, nome: 'João', email: eu.email, usuario: 'maria',
      });
      expect(saida.erro).toBe('Este usuário já está em uso');
    });

    it('recusa sessão inválida', async () => {
      const { caso } = await cenario();
      const saida = await caso.alterarDados({
        usuarioId: uuid(999).value, nome: 'X', email: 'x@equinox.dev', usuario: 'x',
      });
      expect(saida.erro).toBe('Sessão inválida. Entre de novo');
    });
  });

  describe('alterarSenha', () => {
    const troca = (usuarioId: string, sobrescrita: Record<string, string> = {}) => ({
      usuarioId, senhaAtual: SENHA, novaSenha: 'NovaSenha@1', confirmacao: 'NovaSenha@1',
      ...sobrescrita,
    });

    it('troca a senha na nuvem quando a atual confere', async () => {
      const { caso, remoto, eu } = await cenario();

      const saida = await caso.alterarSenha(troca(eu.id.value));

      expect(saida.sucesso).toBe(true);
      expect((await remoto.entrar(eu.email, 'NovaSenha@1')).ok).toBe(true);
      expect((await remoto.entrar(eu.email, SENHA)).ok).toBe(false);
    });

    it('esquece a verificação da senha antiga: entrar sem rede com ela deixa de valer', async () => {
      const { caso, eu, credenciais, acessoOffline } = await cenario();
      await acessoOffline.lembrar(eu.email, SENHA, {
        usuarioId: eu.id.value, empresaId: IDS.empresa.value, nome: eu.nome,
        usuario: eu.usuario, email: eu.email, perfil: PerfilEnum.TECNICO,
      });

      await caso.alterarSenha(troca(eu.id.value));

      expect(await credenciais.buscar(eu.email)).toBeNull();
    });

    it('encerra a sessão dos dois lados: é preciso entrar com a senha nova', async () => {
      const { caso, sessionStorage, remoto, eu } = await cenario();

      await caso.alterarSenha(troca(eu.id.value));

      expect(await sessionStorage.obterSessao()).toBeNull();
      expect(remoto.sessaoAtual).toBeNull();
    });

    it('nada da senha fica no aparelho', async () => {
      const { caso, usuarioRepo, eu } = await cenario();

      await caso.alterarSenha(troca(eu.id.value));

      const guardado = JSON.stringify(Array.from(usuarioRepo.items.values()));
      expect(guardado).not.toContain('NovaSenha@1');
      expect(guardado).not.toContain(SENHA);
    });

    it('recusa quando a senha atual está errada', async () => {
      const { caso, sessionStorage, eu } = await cenario();

      const saida = await caso.alterarSenha(troca(eu.id.value, { senhaAtual: 'errada' }));

      expect(saida.erro).toBe('A senha atual está incorreta');
      expect(await sessionStorage.obterSessao()).not.toBeNull();
    });

    it('sem rede, explica que a troca precisa de internet e mantém a sessão', async () => {
      const { caso, remoto, sessionStorage, eu } = await cenario();
      remoto.online = false;

      const saida = await caso.alterarSenha(troca(eu.id.value));

      expect(saida.erro).toBe('Sem conexão. A troca de senha precisa de internet');
      expect(await sessionStorage.obterSessao()).not.toBeNull();
    });

    it('avisa quando a sessão da nuvem expirou', async () => {
      const { caso, remoto, eu } = await cenario();
      await remoto.sair();

      const saida = await caso.alterarSenha(troca(eu.id.value));

      expect(saida.erro).toContain('sessão na nuvem expirou');
    });

    it('exige os três campos', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarSenha(troca(eu.id.value, { confirmacao: '' }));
      expect(saida.erro).toBe('Informe a senha atual, a nova senha e a confirmação');
    });

    it('exige ao menos 6 caracteres', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarSenha(
        troca(eu.id.value, { novaSenha: '12345', confirmacao: '12345' }),
      );
      expect(saida.erro).toBe('A nova senha precisa ter pelo menos 6 caracteres');
    });

    it('exige que a confirmação coincida', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarSenha(troca(eu.id.value, { confirmacao: 'Outra@123' }));
      expect(saida.erro).toBe('A nova senha e a confirmação não conferem');
    });

    it('exige que a nova senha seja diferente da atual', async () => {
      const { caso, eu } = await cenario();
      const saida = await caso.alterarSenha(
        troca(eu.id.value, { novaSenha: SENHA, confirmacao: SENHA }),
      );
      expect(saida.erro).toBe('A nova senha precisa ser diferente da atual');
    });

    it('não troca nada quando a validação falha', async () => {
      const { caso, remoto, eu } = await cenario();

      await caso.alterarSenha(troca(eu.id.value, { confirmacao: 'Outra@123' }));

      expect((await remoto.entrar(eu.email, SENHA)).ok).toBe(true);
    });

    it('recusa sessão inválida', async () => {
      const { caso } = await cenario();
      const saida = await caso.alterarSenha(troca(uuid(999).value));
      expect(saida.erro).toBe('Sessão inválida. Entre de novo');
    });
  });
});
