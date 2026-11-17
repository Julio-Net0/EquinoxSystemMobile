import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import {
  CHAVE_DA_SESSAO_REMOTA,
  acompanharPrimeiroPlano,
  criarClienteSupabase,
} from '@/infrastructure/supabase/clienteSupabase';
import {
  ehErroDeRede,
  ehErroDeSessao,
  falhaDe,
  motivoDe,
  protegido,
} from '@/infrastructure/supabase/errosSupabase';
import { ConectividadeNetInfo } from '@/infrastructure/network/ConectividadeNetInfo';
import { HashSenhaAposentado } from '@/infrastructure/security/HashSenhaAposentado';
import { lerArquivoDoAparelho } from '@/infrastructure/hardware/midia/lerArquivoDoAparelho';
import { remotoOk } from '@/domain/gateways/ResultadoRemoto';
import { criarClienteFalso } from '../../../helpers/clienteSupabaseFalso';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ falso: true })) }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn(), addEventListener: jest.fn() },
}));

describe('clienteSupabase', () => {
  it('cria o cliente com os tokens no cofre e sem sessão por URL', () => {
    const armazenamento = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };

    criarClienteSupabase({ url: 'https://p.supabase.co', chaveAnonima: 'anon' }, armazenamento);

    expect(createClient).toHaveBeenCalledWith('https://p.supabase.co', 'anon', {
      auth: {
        storage: armazenamento,
        storageKey: CHAVE_DA_SESSAO_REMOTA,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    // O cofre só aceita letras, números, ponto, hífen e sublinhado na chave.
    expect(CHAVE_DA_SESSAO_REMOTA).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('renova o token só com o app em primeiro plano', () => {
    const { cliente, auth } = criarClienteFalso();
    let aoMudar: (estado: string) => void = () => undefined;
    const remover = jest.fn();
    const espia = jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _evento: string,
      ouvinte: (estado: string) => void,
    ) => {
      aoMudar = ouvinte;
      return { remove: remover };
    }) as never);

    const desfazer = acompanharPrimeiroPlano(cliente);

    aoMudar('active');
    expect(auth.startAutoRefresh).toHaveBeenCalled();
    aoMudar('background');
    expect(auth.stopAutoRefresh).toHaveBeenCalled();

    desfazer();
    expect(remover).toHaveBeenCalled();
    espia.mockRestore();
  });
});

describe('errosSupabase', () => {
  it.each([
    [{ name: 'AuthRetryableFetchError', message: 'x' }, undefined],
    [{ message: 'TypeError: Network request failed' }, undefined],
    [{ message: 'TypeError: Failed to fetch' }, undefined],
    [{ message: 'qualquer' }, 0],
    [{ message: 'Bad Gateway' }, 502],
    [{ message: 'x', status: 0 }, undefined],
  ])('reconhece falha de rede: %j / http %s', (erro, status) => {
    expect(ehErroDeRede(erro, status)).toBe(true);
    expect(motivoDe(erro, status)).toBe('rede');
  });

  it.each([
    [{ message: 'JWT expired', code: 'PGRST301' }, 401],
    [{ message: 'invalid JWT' }, undefined],
    [{ message: 'x', status: 401 }, undefined],
    [{ message: 'x', statusCode: '401' }, undefined],
  ])('reconhece sessão expirada: %j / http %s', (erro, status) => {
    expect(ehErroDeSessao(erro, status)).toBe(true);
    expect(motivoDe(erro, status)).toBe('nao_autenticado');
  });

  it('o resto é recusa do servidor', () => {
    expect(motivoDe({ message: 'check constraint violated', code: '23514' }, 400)).toBe('rejeitado');
    expect(ehErroDeRede(null)).toBe(false);
    expect(ehErroDeSessao(undefined)).toBe(false);
  });

  it('traduz as recusas que o técnico pode entender', () => {
    expect(falhaDe({ message: 'permission denied for table leituras', code: '42501' }, 403)).toEqual({
      ok: false, motivo: 'rejeitado',
      mensagem: 'A nuvem recusou: seu perfil não tem permissão para esta operação',
    });
    expect(falhaDe({ message: 'duplicate key value', code: '23505' }, 409)).toMatchObject({
      mensagem: 'A nuvem recusou: já existe um registro igual',
    });
    expect(falhaDe({ message: 'check constraint violated', code: '23514' }, 400)).toMatchObject({
      mensagem: 'check constraint violated',
    });
    expect(falhaDe(null)).toMatchObject({ motivo: 'rejeitado', mensagem: 'Erro desconhecido' });
    expect(falhaDe({ message: 'Network request failed' })).toEqual({
      ok: false, motivo: 'rede', mensagem: 'Sem conexão com a nuvem',
    });
  });

  it('protegido deixa passar o sucesso e converte a exceção em falha', async () => {
    expect(await protegido(async () => remotoOk(7))).toEqual({ ok: true, valor: 7 });
    expect(
      await protegido(async () => {
        throw new TypeError('Network request failed');
      }),
    ).toMatchObject({ ok: false, motivo: 'rede' });
  });
});

describe('ConectividadeNetInfo', () => {
  const netinfo = NetInfo as unknown as { fetch: jest.Mock; addEventListener: jest.Mock };
  const gateway = new ConectividadeNetInfo();

  it.each([
    [{ isConnected: true, isInternetReachable: true }, true],
    // O sistema ainda não sabe: vale o "conectado".
    [{ isConnected: true, isInternetReachable: null }, true],
    // Wi-Fi sem saída para a internet.
    [{ isConnected: true, isInternetReachable: false }, false],
    [{ isConnected: false, isInternetReachable: false }, false],
    [{ isConnected: null, isInternetReachable: null }, false],
  ])('%j → online = %s', async (estado, esperado) => {
    netinfo.fetch.mockResolvedValueOnce(estado);
    expect(await gateway.estaOnline()).toBe(esperado);
  });

  it('avisa a cada mudança e devolve o cancelamento', () => {
    const cancelar = jest.fn();
    let emitir: (estado: object) => void = () => undefined;
    netinfo.addEventListener.mockImplementationOnce((ouvinte: (estado: object) => void) => {
      emitir = ouvinte;
      return cancelar;
    });
    const visto: boolean[] = [];

    const desfazer = gateway.observar((online) => visto.push(online));
    emitir({ isConnected: false, isInternetReachable: false });
    emitir({ isConnected: true, isInternetReachable: true });

    expect(visto).toEqual([false, true]);
    expect(desfazer).toBe(cancelar);
  });
});

describe('legado e arquivos', () => {
  it('o hash aposentado não calcula nem confere nada', async () => {
    const hash = new HashSenhaAposentado();

    const a = await hash.gerar();
    const b = await hash.gerar();

    // Mesmo valor inerte para qualquer senha: não deriva nada dela.
    expect(a.serializar()).toBe(b.serializar());
    expect(a.serializar()).toContain('aposentado');
    expect(await hash.verificar()).toBe(false);
  });

  it('lê os bytes do arquivo pela API de objetos do expo-file-system', async () => {
    // O dublê de `File` do jest.setup não tem arrayBuffer; aqui basta provar
    // que é ele o chamado, com a uri recebida.
    const { File } = jest.requireMock('expo-file-system') as { File: { prototype: object } };
    const bytes = new ArrayBuffer(3);
    Object.assign(File.prototype, { arrayBuffer: jest.fn(async () => bytes) });

    expect(await lerArquivoDoAparelho('file:///documents/leituras/1.jpg')).toBe(bytes);
  });

  it('resolve a referência relativa na pasta atual do app antes de ler', async () => {
    const { File } = jest.requireMock('expo-file-system') as { File: { prototype: object } };
    const lidas: string[] = [];
    Object.assign(File.prototype, {
      arrayBuffer: jest.fn(async function (this: { uri: string }) {
        lidas.push(this.uri);
        return new ArrayBuffer(1);
      }),
    });

    await lerArquivoDoAparelho('leituras/1.jpg');

    expect(lidas).toEqual(['file:///documents/leituras/1.jpg']);
  });
});
