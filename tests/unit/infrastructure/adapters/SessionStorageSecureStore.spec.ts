import * as SecureStore from 'expo-secure-store';
import { SessionStorageSecureStore } from '@/infrastructure/adapters/SessionStorageSecureStore';
import { SessionStorageSecureStore as SessionStorageWeb } from '@/infrastructure/adapters/SessionStorageSecureStore.web';
import { SessaoUsuarioData } from '@/domain/gateways/ISessionStorage';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

const SESSAO: SessaoUsuarioData = {
  usuarioId: '00000000-0000-4000-8000-000000000001',
  empresaId: '00000000-0000-4000-8000-000000000002',
  nome: 'João da Silva',
  usuario: 'tecnico',
  email: 'tecnico@equinox.dev',
  perfil: PerfilEnum.TECNICO,
};

describe('SessionStorageSecureStore (nativo)', () => {
  let sessao: SessionStorageSecureStore;

  beforeEach(async () => {
    sessao = new SessionStorageSecureStore();
    await sessao.limparSessao();
    jest.clearAllMocks();
  });

  it('grava e lê a sessão de volta', async () => {
    await sessao.salvarSessao(SESSAO);
    expect(await sessao.obterSessao()).toEqual(SESSAO);
  });

  it('devolve null quando não há sessão gravada', async () => {
    expect(await sessao.obterSessao()).toBeNull();
  });

  it('pede o armazenamento acessível depois do primeiro desbloqueio', async () => {
    await sessao.salvarSessao(SESSAO);

    // O técnico abre o app em campo logo após ligar o aparelho: com o padrão
    // WHEN_UNLOCKED a leitura falharia nesse momento.
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK },
    );
  });

  it('trata conteúdo corrompido como ausência de sessão, e o descarta', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('{isto não é json');

    // Travar o app por um valor ilegível deixaria o usuário sem como entrar.
    expect(await sessao.obterSessao()).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });

  it('valida o PIN local só quando ele confere', async () => {
    expect(await sessao.temPinLocal()).toBe(false);

    await sessao.salvarPinLocal('4321');

    expect(await sessao.temPinLocal()).toBe(true);
    expect(await sessao.validarPinLocal('4321')).toBe(true);
    expect(await sessao.validarPinLocal('0000')).toBe(false);
  });

  it('limpar apaga a sessão e o PIN juntos', async () => {
    await sessao.salvarSessao(SESSAO);
    await sessao.salvarPinLocal('4321');

    await sessao.limparSessao();

    expect(await sessao.obterSessao()).toBeNull();
    expect(await sessao.temPinLocal()).toBe(false);
  });
});

describe('SessionStorageSecureStore (web)', () => {
  let sessao: SessionStorageWeb;
  let cofre: Map<string, string>;

  beforeEach(() => {
    cofre = new Map();
    // localStorage não existe no ambiente de teste do jest-expo em modo node.
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => cofre.get(k) ?? null,
      setItem: (k: string, v: string) => void cofre.set(k, v),
      removeItem: (k: string) => void cofre.delete(k),
    };
    sessao = new SessionStorageWeb();
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('grava e lê a sessão', async () => {
    await sessao.salvarSessao(SESSAO);
    expect(await sessao.obterSessao()).toEqual(SESSAO);
  });

  it('devolve null sem sessão', async () => {
    expect(await sessao.obterSessao()).toBeNull();
  });

  it('descarta conteúdo corrompido', async () => {
    cofre.set('equinox_user_session_v1', 'nada de json');

    expect(await sessao.obterSessao()).toBeNull();
    expect(cofre.has('equinox_user_session_v1')).toBe(false);
  });

  it('cumpre o mesmo contrato de PIN da variante nativa', async () => {
    expect(await sessao.temPinLocal()).toBe(false);

    await sessao.salvarPinLocal('4321');

    expect(await sessao.validarPinLocal('4321')).toBe(true);
    expect(await sessao.validarPinLocal('1111')).toBe(false);
  });

  it('limpar apaga sessão e PIN', async () => {
    await sessao.salvarSessao(SESSAO);
    await sessao.salvarPinLocal('4321');

    await sessao.limparSessao();

    expect(cofre.size).toBe(0);
  });

  it('guarda em claro, e por isso não serve para o aparelho', async () => {
    await sessao.salvarSessao(SESSAO);

    // Asserção deliberada sobre uma limitação conhecida: localStorage é legível
    // por qualquer script da mesma origem. A variante web existe só para
    // conferir a interface no navegador durante o desenvolvimento.
    expect(cofre.get('equinox_user_session_v1')).toContain('tecnico@equinox.dev');
  });
});
