import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { ContainerProvider } from '@/presentation/context/ContainerProvider';
import { AuthProvider } from '@/presentation/context/AuthContext';
import {
  ConectividadeProvider,
  useConectividade,
} from '@/presentation/context/ConectividadeContext';
import {
  SincronizacaoContextData,
  SincronizacaoProvider,
  useSincronizacao,
} from '@/presentation/context/SincronizacaoContext';
import { AuthContextData } from '@/presentation/context/AuthContext';
import { useAuth } from '@/presentation/hooks/useAuth';
import {
  PainelSincronizacao,
  formatarInstante,
  resumoDaSincronizacao,
} from '@/presentation/components/PainelSincronizacao';
import { usePainelSincronizacao } from '@/presentation/hooks/usePainelSincronizacao';
import { ContainerFake, criarContainerFake } from '@/infrastructure/di/criarContainerFake';
import { pacoteVazio } from '@/infrastructure/fakes/SincronizacaoRemotaFake';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import {
  IDS,
  SENHA,
  aparelhoLogado,
  comFotoNoAparelho,
  novaEmpresa,
  novaLeitura,
  novoEndereco,
  novoPadrao,
  novoUsuario,
  uuid,
} from '../helpers/cenarioSync';

jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));

/** O que os contextos expõem, capturado para o teste chamar e conferir. */
const visto: { auth?: AuthContextData; sync?: SincronizacaoContextData } = {};

function Sonda() {
  const auth = useAuth();
  const sync = useSincronizacao();
  const { online } = useConectividade();
  const painel = usePainelSincronizacao();
  visto.auth = auth;
  visto.sync = sync;

  return (
    <>
      <Text testID="autenticado">{String(auth.isAutenticado)}</Text>
      <Text testID="carregando">{String(auth.isCarregando)}</Text>
      <Text testID="nome">{auth.usuario?.nome ?? ''}</Text>
      <Text testID="online">{String(online)}</Text>
      <Text testID="pendentes">{String(sync.pendentes)}</Text>
      <Text testID="versao">{String(sync.versaoDosDados)}</Text>
      <PainelSincronizacao {...painel} />
    </>
  );
}

async function montar(container: ContainerFake) {
  const tela = await render(
    <ContainerProvider container={container}>
      <AuthProvider>
        <ConectividadeProvider>
          <SincronizacaoProvider>
            <Sonda />
          </SincronizacaoProvider>
        </ConectividadeProvider>
      </AuthProvider>
    </ContainerProvider>,
  );
  await waitFor(() => expect(tela.getByTestId('carregando').props.children).toBe('false'));
  return tela;
}

const texto = (tela: Awaited<ReturnType<typeof montar>>, id: string): string =>
  String(tela.getByTestId(id).props.children);

describe('contextos de sessão, rede e sincronização', () => {
  it('reabre autenticado em modo avião, só com a sessão do armazenamento seguro', async () => {
    const c = await aparelhoLogado();
    c.fakes.conectividade.definirOnline(false);
    c.fakes.autenticacaoRemota.online = false;
    c.fakes.autenticacaoRemota.sessaoRevogada = true;

    const tela = await montar(c);

    expect(texto(tela, 'autenticado')).toBe('true');
    expect(texto(tela, 'nome')).toBe('João da Silva');
    await waitFor(() => expect(texto(tela, 'online')).toBe('false'));
    // Nada foi pedido à nuvem.
    expect(c.fakes.sincronizacaoRemota.chamadas).toEqual([]);
    await waitFor(() =>
      expect(texto(tela, 'sync-titulo')).toBe('Offline · trabalhando sem conexão'),
    );
  });

  it('sem sessão guardada, abre deslogado', async () => {
    const tela = await montar(criarContainerFake());
    expect(texto(tela, 'autenticado')).toBe('false');
  });

  it('o login traz os dados da nuvem para o banco local antes de liberar a interface', async () => {
    const c = criarContainerFake();
    const tecnico = novoUsuario();
    c.fakes.autenticacaoRemota.registrarConta(tecnico, SENHA);
    c.fakes.sincronizacaoRemota.pacotes.push({
      ...pacoteVazio({ padroes: 'c1' }),
      empresas: [novaEmpresa()],
      enderecos: [novoEndereco()],
      padroes: [novoPadrao()],
      usuarios: [tecnico],
    });
    const tela = await montar(c);

    let saida: { sucesso: boolean; erro?: string } | undefined;
    await act(async () => {
      saida = await visto.auth!.entrar('tecnico@equinox.dev', SENHA);
    });

    expect(saida).toEqual({ sucesso: true });
    expect(texto(tela, 'autenticado')).toBe('true');
    expect(await c.fakes.padrao.buscarPorId(IDS.padrao)).not.toBeNull();
    expect(await c.fakes.sessao.obterSessao()).not.toBeNull();
  });

  it('login recusado não autentica e devolve o motivo', async () => {
    const c = criarContainerFake();
    c.fakes.autenticacaoRemota.registrarConta(novoUsuario(), SENHA);
    const tela = await montar(c);

    let saida: { sucesso: boolean; erro?: string } | undefined;
    await act(async () => {
      saida = await visto.auth!.entrar('tecnico@equinox.dev', 'errada');
    });

    expect(saida).toEqual({ sucesso: false, erro: 'E-mail ou senha incorretos' });
    expect(texto(tela, 'autenticado')).toBe('false');
  });

  it('a leitura feita offline aparece como pendente e sobe sozinha quando a rede volta', async () => {
    const c = await aparelhoLogado();
    c.fakes.conectividade.definirOnline(false);
    const tela = await montar(c);

    const leitura = novaLeitura();
    comFotoNoAparelho(c, leitura);
    await act(async () => {
      await c.repos.leitura.salvar(leitura);
    });

    await waitFor(() => expect(texto(tela, 'pendentes')).toBe('1'));
    expect(texto(tela, 'sync-titulo')).toBe('Offline · 1 item pendente de envio');
    expect(c.fakes.sincronizacaoRemota.leituras.size).toBe(0);

    await act(async () => {
      c.fakes.conectividade.definirOnline(true);
    });

    await waitFor(() => expect(texto(tela, 'pendentes')).toBe('0'));
    expect(c.fakes.sincronizacaoRemota.leituras.has(uuid(100).value)).toBe(true);
    expect((await c.fakes.leitura.buscarPorId(uuid(100)))?.estaSincronizada()).toBe(true);
    await waitFor(() => expect(texto(tela, 'sync-titulo')).toBe('Tudo sincronizado'));
  });

  it('sincroniza ao abrir o app autenticado e avisa as telas quando chegam dados', async () => {
    const c = await aparelhoLogado();
    c.fakes.sincronizacaoRemota.pacotes.push({
      ...pacoteVazio({ enderecos: 'c1' }),
      enderecos: [novoEndereco(IDS.outroEndereco)],
    });

    const tela = await montar(c);

    await waitFor(() => expect(texto(tela, 'versao')).toBe('1'));
    expect(await c.fakes.endereco.buscarPorId(IDS.outroEndereco)).not.toBeNull();
  });

  it('o botão manual sincroniza', async () => {
    const c = await aparelhoLogado();
    const tela = await montar(c);
    await waitFor(() => expect(c.fakes.sincronizacaoRemota.chamadas).toContain('baixarAlteracoes'));
    c.fakes.sincronizacaoRemota.chamadas = [];

    await act(async () => {
      await visto.sync!.sincronizar();
    });

    expect(c.fakes.sincronizacaoRemota.chamadas).toEqual(['baixarAlteracoes']);
    expect(texto(tela, 'sync-ultima')).toContain('Última sincronização: 10/03/2026 às 12:00');
  });

  it('acesso desativado na nuvem derruba a sessão na sincronização seguinte', async () => {
    const c = await aparelhoLogado();
    c.fakes.sincronizacaoRemota.pacotes.push({
      ...pacoteVazio(),
      usuarios: [novoUsuario({ status: StatusUsuarioEnum.INATIVO })],
    });

    const tela = await montar(c);

    await waitFor(() => expect(texto(tela, 'autenticado')).toBe('false'));
    expect(await c.fakes.sessao.obterSessao()).toBeNull();
  });

  it('sair apaga a sessão local e a da nuvem', async () => {
    const c = await aparelhoLogado();
    const tela = await montar(c);

    await act(async () => {
      await visto.auth!.sair();
    });

    expect(texto(tela, 'autenticado')).toBe('false');
    expect(c.fakes.autenticacaoRemota.sessaoAtual).toBeNull();
  });

  it('item recusado até o limite mostra o aviso e o "Tentar de novo"', async () => {
    const c = await aparelhoLogado();
    const leitura = novaLeitura();
    comFotoNoAparelho(c, leitura);
    await c.repos.leitura.salvar(leitura);
    c.fakes.sincronizacaoRemota.recusar.set('enviarLeitura', 'recusada');
    for (let i = 0; i < 5; i += 1) await c.casos.processarFila.executar();

    const tela = await montar(c);

    await waitFor(() =>
      expect(texto(tela, 'sync-titulo')).toBe('1 item não pôde ser enviado'),
    );
    expect(tela.getByTestId('botao-tentar-de-novo')).toBeTruthy();

    c.fakes.sincronizacaoRemota.recusar.clear();
    await act(async () => {
      await visto.sync!.tentarDeNovo();
    });

    await waitFor(() => expect(texto(tela, 'sync-titulo')).toBe('Tudo sincronizado'));
  });
});

describe('PainelSincronizacao', () => {
  const base = { online: true, sincronizando: false, pendentes: 0, isolados: 0 };

  it.each([
    [{ ...base }, 'Tudo sincronizado'],
    [{ ...base, pendentes: 1 }, '1 item pendente de envio'],
    [{ ...base, pendentes: 3 }, '3 itens pendentes de envio'],
    [{ ...base, online: false }, 'Offline · trabalhando sem conexão'],
    [{ ...base, online: false, pendentes: 2 }, 'Offline · 2 itens pendentes de envio'],
    [{ ...base, sincronizando: true, pendentes: 2 }, 'Sincronizando…'],
    [{ ...base, pendentes: 2, isolados: 2 }, '2 itens não puderam ser enviados'],
  ])('%j → "%s"', (estado, titulo) => {
    expect(resumoDaSincronizacao(estado).titulo).toBe(titulo);
  });

  it('formata o instante no horário de Brasília', () => {
    expect(formatarInstante('2026-03-10T15:00:00.000Z')).toBe('10/03/2026 às 12:00');
    // 01:30 UTC ainda é o dia anterior em Brasília.
    expect(formatarInstante('2026-03-10T01:30:00.000Z')).toBe('09/03/2026 às 22:30');
  });

  it('sem conexão o botão de sincronizar fica desabilitado e diz por quê', async () => {
    const tela = await render(
      <PainelSincronizacao
        {...base}
        online={false}
        ultimaSincronizacaoEm={null}
        aviso="Uma leitura ainda aguarda envio"
        onSincronizar={jest.fn()}
        onTentarDeNovo={jest.fn()}
      />,
    );

    expect(tela.getByTestId('sync-aviso').props.children).toBe('Uma leitura ainda aguarda envio');
    expect(tela.getByTestId('sync-ultima').props.children).toBe(
      'Ainda não sincronizou neste aparelho',
    );
    expect(tela.getByText('Sem conexão')).toBeTruthy();
    expect(tela.queryByText('Sincronizar agora')).toBeNull();
    expect(tela.queryByTestId('botao-tentar-de-novo')).toBeNull();
  });
});
