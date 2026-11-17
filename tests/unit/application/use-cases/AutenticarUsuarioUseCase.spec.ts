import { AutenticarUsuarioUseCase } from '@/application/use-cases/AutenticarUsuarioUseCase';
import { CHAVE_CURSORES, CHAVE_USUARIO_DO_CURSOR } from '@/domain/repositories/ISyncMetaRepository';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { AutenticacaoRemotaFake } from '@/infrastructure/fakes/AutenticacaoRemotaFake';
import { ActionQueueRepositoryMemory } from '@/infrastructure/fakes/ActionQueueRepositoryMemory';
import { ArquivoFotoGatewayFake } from '@/infrastructure/fakes/ArquivoFotoGatewayFake';
import { DadosLocaisMemory } from '@/infrastructure/fakes/DadosLocaisMemory';
import { SessionStorageMemory } from '@/infrastructure/fakes/SessionStorageMemory';
import { SyncMetaRepositoryMemory } from '@/infrastructure/fakes/SyncMetaRepositoryMemory';
import { CredencialOfflineMemory } from '@/infrastructure/fakes/CredencialOfflineMemory';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';
import { ReautenticacaoEmMemoria } from '@/infrastructure/security/ReautenticacaoEmMemoria';
import { AcessoOfflineService } from '@/domain/services/AcessoOfflineService';
import { TrocaDeUsuarioService } from '@/domain/services/TrocaDeUsuarioService';
import { IDS, SENHA, novoUsuario, uuid } from '../../../helpers/cenarioSync';

function cenario(sobrescrita: { status?: StatusUsuarioEnum; perfil?: PerfilEnum } = {}) {
  const remoto = new AutenticacaoRemotaFake();
  const sessionStorage = new SessionStorageMemory();
  const syncMeta = new SyncMetaRepositoryMemory();
  const credenciais = new CredencialOfflineMemory();
  const reautenticacao = new ReautenticacaoEmMemoria();
  const acessoOffline = new AcessoOfflineService(credenciais, new HashSenhaFake(), reautenticacao);
  const trocaDeUsuario = new TrocaDeUsuarioService(
    syncMeta,
    new ActionQueueRepositoryMemory(),
    new DadosLocaisMemory(),
    new ArquivoFotoGatewayFake(),
  );
  const caso = new AutenticarUsuarioUseCase(remoto, sessionStorage, acessoOffline, trocaDeUsuario);

  const perfil = sobrescrita.perfil ?? PerfilEnum.TECNICO;
  const ehSuper = perfil === PerfilEnum.SUPER_ADMIN;
  const usuario = novoUsuario({
    perfil,
    status: sobrescrita.status ?? StatusUsuarioEnum.ATIVO,
    empresaId: ehSuper ? null : IDS.empresa,
    enderecosVinculados: ehSuper ? [] : [IDS.endereco],
  });
  remoto.registrarConta(usuario, SENHA);

  return { caso, usuario, remoto, sessionStorage, syncMeta, credenciais, reautenticacao };
}

const LOGIN = 'tecnico@equinox.dev';

describe('AutenticarUsuarioUseCase', () => {
  it('autentica na nuvem pelo e-mail e grava a sessão no aparelho', async () => {
    const { caso, usuario, sessionStorage, remoto } = cenario();

    const saida = await caso.executar({ login: LOGIN, senha: SENHA });

    expect(saida.sucesso).toBe(true);
    expect(saida.usuario).toEqual({
      usuarioId: usuario.id.value,
      empresaId: IDS.empresa.value,
      nome: 'João da Silva',
      usuario: 'tecnico',
      email: LOGIN,
      perfil: PerfilEnum.TECNICO,
    });
    expect(await sessionStorage.obterSessao()).toEqual(saida.usuario);
    expect(remoto.sessaoAtual?.usuarioId).toBe(usuario.id.value);
  });

  it('ignora diferença de caixa e espaços no e-mail', async () => {
    const { caso } = cenario();
    expect((await caso.executar({ login: '  TECNICO@Equinox.DEV ', senha: SENHA })).sucesso).toBe(
      true,
    );
  });

  it('não aceita mais o nome de usuário como login, e explica', async () => {
    const { caso, remoto } = cenario();

    const saida = await caso.executar({ login: 'tecnico', senha: SENHA });

    expect(saida.sucesso).toBe(false);
    expect(saida.erro).toContain('e-mail');
    // Nem chega a consultar a nuvem.
    expect(remoto.sessaoAtual).toBeNull();
  });

  it('recusa a senha errada', async () => {
    const { caso, sessionStorage } = cenario();

    const saida = await caso.executar({ login: LOGIN, senha: 'outra-senha' });

    expect(saida).toEqual({ sucesso: false, erro: 'E-mail ou senha incorretos' });
    expect(await sessionStorage.obterSessao()).toBeNull();
  });

  it('dá o mesmo erro para conta inexistente, para não revelar quem existe', async () => {
    const { caso } = cenario();

    const inexistente = await caso.executar({ login: 'ninguem@equinox.dev', senha: SENHA });
    const senhaErrada = await caso.executar({ login: LOGIN, senha: 'errada' });

    expect(inexistente.erro).toBe(senhaErrada.erro);
  });

  describe('entrar sem rede (ADR 10.18)', () => {
    /** Entra uma vez com internet, sai, e o aparelho fica sem sinal. */
    async function jaEntrouNesteAparelho() {
      const c = cenario();
      await c.caso.executar({ login: LOGIN, senha: SENHA });
      await c.sessionStorage.limparSessao();
      c.remoto.online = false;
      return c;
    }

    it('o login com internet deixa no aparelho uma verificação da senha, nunca a senha', async () => {
      const { caso, credenciais } = cenario();

      await caso.executar({ login: LOGIN, senha: SENHA });

      const guardada = await credenciais.buscar(LOGIN);
      expect(guardada?.sessao.email).toBe(LOGIN);
      expect(guardada?.verificador).toMatch(/^[\w-]+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);
      expect(JSON.stringify(guardada)).not.toContain(SENHA);
    });

    it('depois de um login com internet, entra sem rede com a mesma senha', async () => {
      const { caso, sessionStorage, usuario } = await jaEntrouNesteAparelho();

      const saida = await caso.executar({ login: '  Tecnico@Equinox.dev ', senha: SENHA });

      expect(saida.sucesso).toBe(true);
      expect(saida.offline).toBe(true);
      expect((await sessionStorage.obterSessao())?.usuarioId).toBe(usuario.id.value);
    });

    it('guarda a senha só em memória, para entrar na nuvem quando a rede voltar', async () => {
      const { caso, reautenticacao } = await jaEntrouNesteAparelho();

      await caso.executar({ login: LOGIN, senha: SENHA });

      expect(reautenticacao.obter()).toEqual({ email: LOGIN, senha: SENHA });
    });

    it('sem rede, senha errada é recusada com a mesma frase de sempre', async () => {
      const { caso, sessionStorage } = await jaEntrouNesteAparelho();

      const saida = await caso.executar({ login: LOGIN, senha: 'outra-senha' });

      expect(saida).toEqual({ sucesso: false, erro: 'E-mail ou senha incorretos' });
      expect(await sessionStorage.obterSessao()).toBeNull();
    });

    it('sem rede, conta que nunca entrou neste aparelho precisa de internet', async () => {
      const { caso } = await jaEntrouNesteAparelho();

      const saida = await caso.executar({ login: 'admin@equinox.dev', senha: SENHA });

      expect(saida.sucesso).toBe(false);
      expect(saida.erro).toContain('precisa de internet');
    });

    it('a nuvem recusando a senha que o aparelho conhecia: a verificação velha é esquecida', async () => {
      const { caso, remoto, credenciais } = await jaEntrouNesteAparelho();
      remoto.online = true;
      // A senha foi trocada em outro aparelho.
      remoto.registrarConta(
        novoUsuario({ empresaId: IDS.empresa, enderecosVinculados: [IDS.endereco] }),
        'senha-nova',
      );

      await caso.executar({ login: LOGIN, senha: SENHA });

      expect(await credenciais.buscar(LOGIN)).toBeNull();
    });

    it('senha errada com rede não apaga a verificação de quem só errou a digitação', async () => {
      const { caso, remoto, credenciais } = await jaEntrouNesteAparelho();
      remoto.online = true;

      await caso.executar({ login: LOGIN, senha: 'digitou-errado' });

      expect(await credenciais.buscar(LOGIN)).not.toBeNull();
    });

    it('conta desativada na nuvem perde o acesso offline neste aparelho', async () => {
      const c = cenario();
      await c.caso.executar({ login: LOGIN, senha: SENHA });
      c.remoto.registrarConta(
        novoUsuario({
          status: StatusUsuarioEnum.INATIVO,
          empresaId: IDS.empresa,
          enderecosVinculados: [IDS.endereco],
        }),
        SENHA,
      );

      await c.caso.executar({ login: LOGIN, senha: SENHA });

      expect(await c.credenciais.buscar(LOGIN)).toBeNull();
    });
  });

  it('sem rede e sem login anterior, explica que o primeiro acesso precisa de internet', async () => {
    const { caso, remoto, sessionStorage } = cenario();
    remoto.online = false;

    const saida = await caso.executar({ login: LOGIN, senha: SENHA });

    expect(saida.sucesso).toBe(false);
    expect(saida.erro).toContain('precisa de internet');
    expect(await sessionStorage.obterSessao()).toBeNull();
  });

  it.each([
    [StatusUsuarioEnum.PENDENTE, 'aguarda autorização'],
    [StatusUsuarioEnum.RECUSADO, 'não foi autorizado'],
    [StatusUsuarioEnum.INATIVO, 'inativo'],
  ])('barra o usuário %s, diz o motivo e não deixa token no aparelho', async (status, trecho) => {
    const { caso, remoto, sessionStorage } = cenario({ status });

    const saida = await caso.executar({ login: LOGIN, senha: SENHA });

    expect(saida.sucesso).toBe(false);
    expect(saida.erro).toContain(trecho);
    expect(await sessionStorage.obterSessao()).toBeNull();
    // A senha conferiu, então a nuvem abriu sessão — e ela é encerrada.
    expect(remoto.sessaoAtual).toBeNull();
    expect(remoto.saidas).toBe(1);
  });

  it('barra a conta que autentica mas não tem perfil no app', async () => {
    const { caso, remoto } = cenario();
    remoto.registrarContaSemPerfil('avulso@equinox.dev', SENHA);

    const saida = await caso.executar({ login: 'avulso@equinox.dev', senha: SENHA });

    expect(saida.sucesso).toBe(false);
    expect(saida.erro).toContain('não tem perfil');
    expect(remoto.sessaoAtual).toBeNull();
  });

  it('recusa e-mail vazio', async () => {
    const { caso } = cenario();
    expect((await caso.executar({ login: '   ', senha: SENHA })).erro).toBe('Informe o e-mail');
  });

  it('recusa senha vazia', async () => {
    const { caso } = cenario();
    expect((await caso.executar({ login: LOGIN, senha: '' })).erro).toBe('Informe a senha');
  });

  it('a sessão do super admin fica sem empresa', async () => {
    const { caso } = cenario({ perfil: PerfilEnum.SUPER_ADMIN });

    const saida = await caso.executar({ login: LOGIN, senha: SENHA });

    expect(saida.usuario?.empresaId).toBeNull();
    expect(saida.usuario?.perfil).toBe(PerfilEnum.SUPER_ADMIN);
  });

  it('a sessão não guarda nada da senha nem token', async () => {
    const { caso, sessionStorage } = cenario();
    await caso.executar({ login: LOGIN, senha: SENHA });

    const guardado = JSON.stringify(await sessionStorage.obterSessao());

    expect(guardado).not.toContain(SENHA);
    expect(guardado.toLowerCase()).not.toContain('token');
  });

  describe('cursores do pull', () => {
    it('zera os cursores quando quem entra é outro usuário', async () => {
      const { caso, syncMeta, usuario } = cenario();
      await syncMeta.definir(CHAVE_CURSORES, '{"leituras":"2026-03-01T00:00:00Z"}');
      await syncMeta.definir(CHAVE_USUARIO_DO_CURSOR, uuid(999).value);

      await caso.executar({ login: LOGIN, senha: SENHA });

      expect(await syncMeta.obter(CHAVE_CURSORES)).toBeNull();
      expect(await syncMeta.obter(CHAVE_USUARIO_DO_CURSOR)).toBe(usuario.id.value);
    });

    it('mantém os cursores quando o mesmo usuário entra de novo', async () => {
      const { caso, syncMeta, usuario } = cenario();
      await syncMeta.definir(CHAVE_CURSORES, '{"leituras":"2026-03-01T00:00:00Z"}');
      await syncMeta.definir(CHAVE_USUARIO_DO_CURSOR, usuario.id.value);

      await caso.executar({ login: LOGIN, senha: SENHA });

      expect(await syncMeta.obter(CHAVE_CURSORES)).toBe('{"leituras":"2026-03-01T00:00:00Z"}');
    });
  });
});
