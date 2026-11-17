import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import {
  CHAVE_ULTIMA_SYNC,
  CHAVE_ULTIMO_ERRO,
} from '@/domain/repositories/ISyncMetaRepository';
import { EstadoSyncEnum } from '@/domain/enums/EstadoSyncEnum';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { pacoteVazio } from '@/infrastructure/fakes/SincronizacaoRemotaFake';
import { criarContainerFake } from '@/infrastructure/di/criarContainerFake';
import {
  AGORA,
  IDS,
  SENHA,
  aparelhoLogado,
  comFotoNoAparelho,
  novaLeitura,
  novoEndereco,
  novoUsuario,
  uuid,
} from '../../../helpers/cenarioSync';

const EMAIL = 'tecnico@equinox.dev';

/** Aparelho com uma leitura registrada offline, esperando rede. */
async function comLeituraPendente() {
  const c = await aparelhoLogado();
  const leitura = novaLeitura();
  comFotoNoAparelho(c, leitura);
  await c.repos.leitura.salvar(leitura);
  return c;
}

describe('SincronizarUseCase', () => {
  it('envia a fila e depois baixa as novidades', async () => {
    const c = await comLeituraPendente();
    c.fakes.sincronizacaoRemota.pacotes.push({
      ...pacoteVazio({ enderecos: 'c1' }),
      enderecos: [novoEndereco(IDS.outroEndereco)],
    });

    const saida = await c.casos.sincronizar.executar();

    expect(saida).toEqual({
      situacao: 'concluida',
      enviados: 1,
      recebidos: 1,
      pendentes: 0,
      deOutrosUsuarios: 0,
      mensagem: undefined,
    });
    const chamadas = c.fakes.sincronizacaoRemota.chamadas.map((x) => x.split(':')[0]);
    expect(chamadas).toEqual(['enviarFoto', 'enviarLeitura', 'baixarAlteracoes']);
    expect(await c.fakes.endereco.buscarPorId(IDS.outroEndereco)).not.toBeNull();
  });

  it('registra quando foi a última sincronização e limpa o erro anterior', async () => {
    const c = await comLeituraPendente();
    await c.fakes.syncMeta.definir(CHAVE_ULTIMO_ERRO, 'erro velho');

    await c.casos.sincronizar.executar();

    expect(await c.fakes.syncMeta.obter(CHAVE_ULTIMA_SYNC)).toBe(AGORA.toISOString());
    expect(await c.fakes.syncMeta.obter(CHAVE_ULTIMO_ERRO)).toBeNull();
  });

  it('offline não tenta nada, e a leitura continua guardada no aparelho', async () => {
    const c = await comLeituraPendente();
    c.fakes.conectividade.definirOnline(false);

    const saida = await c.casos.sincronizar.executar();

    expect(saida.situacao).toBe('offline');
    expect(c.fakes.sincronizacaoRemota.chamadas).toEqual([]);
    expect(await c.fakes.actionQueue.contar()).toBe(1);
    expect((await c.fakes.leitura.buscarPorId(uuid(100)))?.estadoSync).toBe(EstadoSyncEnum.PENDENTE);
  });

  it('ao voltar a rede, a mesma leitura sobe sem intervenção', async () => {
    const c = await comLeituraPendente();
    c.fakes.conectividade.definirOnline(false);
    await c.casos.sincronizar.executar();

    c.fakes.conectividade.definirOnline(true);
    const saida = await c.casos.sincronizar.executar();

    expect(saida.situacao).toBe('concluida');
    expect(c.fakes.sincronizacaoRemota.leituras.has(uuid(100).value)).toBe(true);
    expect((await c.fakes.leitura.buscarPorId(uuid(100)))?.estaSincronizada()).toBe(true);
  });

  it('rede que cai no meio do envio conta como offline, com o que já subiu', async () => {
    const c = await comLeituraPendente();
    await c.repos.endereco.salvar(novoEndereco(IDS.outroEndereco));
    const remoto = c.fakes.sincronizacaoRemota;
    const original = remoto.enviarEndereco.bind(remoto);
    remoto.enviarEndereco = async (endereco) => {
      remoto.falha = { motivo: 'rede', mensagem: 'caiu' };
      return original(endereco);
    };

    const saida = await c.casos.sincronizar.executar();

    expect(saida.situacao).toBe('offline');
    expect(saida.enviados).toBe(1);
    expect(saida.pendentes).toBe(1);
  });

  it('sem sessão no aparelho não faz nada', async () => {
    const c = criarContainerFake();
    expect((await c.casos.sincronizar.executar()).situacao).toBe('sem_sessao');
  });

  describe('token expirado', () => {
    it('quem está offline com token vencido não é derrubado', async () => {
      const c = await comLeituraPendente();
      c.fakes.autenticacaoRemota.sessaoRevogada = true;
      c.fakes.conectividade.definirOnline(false);

      const saida = await c.casos.sincronizar.executar();

      expect(saida.situacao).toBe('offline');
      expect(await c.fakes.sessao.obterSessao()).not.toBeNull();
    });

    it('a renovação que falha por rede também conta como offline', async () => {
      const c = await comLeituraPendente();
      // O aparelho acha que tem rede, mas o serviço não responde.
      c.fakes.autenticacaoRemota.online = false;

      const saida = await c.casos.sincronizar.executar();

      expect(saida.situacao).toBe('offline');
    });

    it('com rede e sessão revogada, pede novo login e NÃO apaga os pendentes', async () => {
      const c = await comLeituraPendente();
      c.fakes.autenticacaoRemota.sessaoRevogada = true;

      const saida = await c.casos.sincronizar.executar();

      expect(saida.situacao).toBe('reautenticar');
      expect(saida.mensagem).toContain('continuam guardados');
      expect(await c.fakes.actionQueue.contar()).toBe(1);
      // A sessão local fica: o técnico segue trabalhando, só não sincroniza.
      expect(await c.fakes.sessao.obterSessao()).not.toBeNull();
      expect(c.fakes.sincronizacaoRemota.chamadas).toEqual([]);
    });

    it('sessão da nuvem de outro usuário também pede novo login', async () => {
      const c = await comLeituraPendente();
      const outro = novoUsuario({ id: uuid(40), usuario: 'outro', email: 'outro@equinox.dev' });
      c.fakes.autenticacaoRemota.registrarConta(outro, 'x');
      await c.fakes.autenticacaoRemota.entrar(outro.email, 'x');

      expect((await c.casos.sincronizar.executar()).situacao).toBe('reautenticar');
    });
  });

  describe('resultado parcial', () => {
    it('item recusado: situação parcial e mensagem que o técnico entende', async () => {
      const c = await comLeituraPendente();
      c.fakes.sincronizacaoRemota.recusar.set('enviarLeitura', 'recusada');

      const saida = await c.casos.sincronizar.executar();

      expect(saida.situacao).toBe('parcial');
      expect(saida.pendentes).toBe(1);
      expect(saida.mensagem).toBe('1 item ainda aguarda envio. O app tenta de novo sozinho');
      expect(await c.fakes.syncMeta.obter(CHAVE_ULTIMO_ERRO)).toBe(saida.mensagem);
    });

    it('item isolado: avisa que o dado está só no aparelho', async () => {
      const c = await comLeituraPendente();
      c.fakes.sincronizacaoRemota.recusar.set('enviarLeitura', 'recusada');
      let saida = await c.casos.sincronizar.executar();
      for (let i = 1; i < ActionQueueItem.MAX_TENTATIVAS; i += 1) {
        saida = await c.casos.sincronizar.executar();
      }

      expect(saida.situacao).toBe('parcial');
      expect(saida.mensagem).toContain('1 item não pôde ser enviado');
      expect(saida.mensagem).toContain('salvo só neste aparelho');
    });

    it('envio certo e pull com erro: os dados subiram, as novidades não vieram', async () => {
      const c = await comLeituraPendente();
      c.fakes.sincronizacaoRemota.recusar.set('baixarAlteracoes', 'erro no servidor');

      const saida = await c.casos.sincronizar.executar();

      expect(saida.situacao).toBe('parcial');
      expect(saida.enviados).toBe(1);
      expect(saida.mensagem).toContain('não foi possível baixar as novidades');
      expect(await c.fakes.syncMeta.obter(CHAVE_ULTIMA_SYNC)).toBeNull();
    });

    it('erro inesperado não escapa: vira situação parcial com mensagem', async () => {
      const c = await comLeituraPendente();
      c.fakes.actionQueue.obterPendentes = async () => {
        throw new Error('banco travado');
      };

      const saida = await c.casos.sincronizar.executar();

      expect(saida.situacao).toBe('parcial');
      expect(saida.mensagem).toBe('A sincronização falhou: banco travado');
    });
  });

  describe('o perfil mudou na nuvem', () => {
    it('a sessão guardada acompanha o nome e o nível novos', async () => {
      const c = await aparelhoLogado();
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio(),
        usuarios: [novoUsuario({ nome: 'João Promovido', perfil: PerfilEnum.ADMIN })],
      });

      await c.casos.sincronizar.executar();

      const sessao = await c.fakes.sessao.obterSessao();
      expect(sessao?.nome).toBe('João Promovido');
      expect(sessao?.perfil).toBe(PerfilEnum.ADMIN);
    });

    it('acesso desativado pelo administrador encerra a sessão dos dois lados', async () => {
      const c = await aparelhoLogado();
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio(),
        usuarios: [novoUsuario({ status: StatusUsuarioEnum.INATIVO })],
      });

      const saida = await c.casos.sincronizar.executar();

      expect(saida.situacao).toBe('acesso_revogado');
      expect(await c.fakes.sessao.obterSessao()).toBeNull();
      expect(c.fakes.autenticacaoRemota.sessaoAtual).toBeNull();
    });

    it('acesso desativado também apaga a verificação de senha do aparelho', async () => {
      const c = await aparelhoLogado();
      await c.casos.autenticar.executar({ login: EMAIL, senha: SENHA });
      expect(await c.fakes.credenciaisOffline.buscar(EMAIL)).not.toBeNull();
      c.fakes.sincronizacaoRemota.pacotes.push({
        ...pacoteVazio(),
        usuarios: [novoUsuario({ status: StatusUsuarioEnum.INATIVO })],
      });

      await c.casos.sincronizar.executar();

      expect(await c.fakes.credenciaisOffline.buscar(EMAIL)).toBeNull();
    });
  });

  describe('aparelho compartilhado (ADR 10.19)', () => {
    /** O técnico deixou uma leitura na fila e a Maria entrou no mesmo aparelho. */
    async function mariaEntrouDepois() {
      const c = await comLeituraPendente();
      const maria = novoUsuario({
        id: uuid(42), nome: 'Maria', usuario: 'maria', email: 'maria@equinox.dev',
      });
      await c.fakes.usuario.salvar(maria);
      c.fakes.autenticacaoRemota.registrarConta(maria, SENHA);
      await c.fakes.autenticacaoRemota.entrar(maria.email, SENHA);
      await c.fakes.sessao.salvarSessao({
        usuarioId: maria.id.value, empresaId: IDS.empresa.value, nome: maria.nome,
        usuario: maria.usuario, email: maria.email, perfil: maria.perfil,
      });
      return c;
    }

    it('não envia o que é de outro usuário com a sessão de quem está logado', async () => {
      const c = await mariaEntrouDepois();

      const saida = await c.casos.sincronizar.executar();

      expect(saida.situacao).toBe('concluida');
      expect(saida.deOutrosUsuarios).toBe(1);
      expect(c.fakes.sincronizacaoRemota.leituras.size).toBe(0);
      expect(await c.fakes.actionQueue.contar()).toBe(1);
    });

    it('o estado separa o que é meu do que espera outro usuário', async () => {
      const c = await mariaEntrouDepois();

      const estado = await c.casos.estadoSincronizacao.executar();

      expect(estado.pendentes).toBe(0);
      expect(estado.deOutrosUsuarios).toBe(1);
      expect(estado.itens[0].deOutroUsuario).toBe(true);
    });

    it('o aviso de Sair conta só os itens de quem está saindo', async () => {
      const c = await mariaEntrouDepois();
      expect(await c.casos.encerrarSessao.pendentes()).toBe(0);
    });
  });

  describe('depois de entrar sem rede (ADR 10.18)', () => {
    /** Entrou offline: sessão local sim, sessão da nuvem não, senha em memória. */
    async function entrouSemRede() {
      const c = await comLeituraPendente();
      await c.fakes.autenticacaoRemota.sair();
      c.fakes.reautenticacao.guardar({ email: EMAIL, senha: SENHA });
      return c;
    }

    it('quando a rede volta, entra na nuvem sozinho e envia a fila', async () => {
      const c = await entrouSemRede();

      const saida = await c.casos.sincronizar.executar();

      expect(saida.situacao).toBe('concluida');
      expect(saida.enviados).toBe(1);
      expect(c.fakes.autenticacaoRemota.sessaoAtual?.email).toBe(EMAIL);
      // A senha não fica em memória além do necessário.
      expect(c.fakes.reautenticacao.obter()).toBeNull();
    });

    it('ainda sem rede, nada é tentado e a senha continua à espera', async () => {
      const c = await entrouSemRede();
      c.fakes.conectividade.definirOnline(false);

      const saida = await c.casos.sincronizar.executar();

      expect(saida.situacao).toBe('offline');
      expect(c.fakes.reautenticacao.obter()).not.toBeNull();
    });

    it('a senha mudou na nuvem: pede novo login e esquece a verificação velha', async () => {
      const c = await entrouSemRede();
      await c.casos.autenticar.executar({ login: EMAIL, senha: SENHA });
      await c.fakes.autenticacaoRemota.sair();
      c.fakes.reautenticacao.guardar({ email: EMAIL, senha: SENHA });
      c.fakes.autenticacaoRemota.registrarConta(novoUsuario(), 'senha-trocada');

      const saida = await c.casos.sincronizar.executar();

      expect(saida.situacao).toBe('reautenticar');
      expect(saida.mensagem).toContain('senha');
      expect(await c.fakes.credenciaisOffline.buscar(EMAIL)).toBeNull();
      expect(c.fakes.reautenticacao.obter()).toBeNull();
      // Os pendentes continuam guardados.
      expect(await c.fakes.actionQueue.contar()).toBe(1);
    });

    it('senha em memória de outra conta não é usada', async () => {
      const c = await entrouSemRede();
      c.fakes.reautenticacao.guardar({ email: 'outra@equinox.dev', senha: SENHA });

      const saida = await c.casos.sincronizar.executar();

      expect(saida.situacao).toBe('reautenticar');
      expect(c.fakes.autenticacaoRemota.sessaoAtual).toBeNull();
    });
  });

  it('duas chamadas ao mesmo tempo: só uma roda', async () => {
    const c = await comLeituraPendente();

    const [a, b] = await Promise.all([
      c.casos.sincronizar.executar(),
      c.casos.sincronizar.executar(),
    ]);

    expect([a.situacao, b.situacao].sort()).toEqual(['concluida', 'ocupado']);
    expect(c.fakes.sincronizacaoRemota.leituras.size).toBe(1);
  });
});
