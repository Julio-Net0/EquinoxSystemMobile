import * as SecureStore from 'expo-secure-store';
import { CredencialOfflineSecureStore } from '@/infrastructure/adapters/CredencialOfflineSecureStore';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

const SESSAO = {
  usuarioId: '4d000000-0000-4000-8000-000000000003',
  empresaId: '1a000000-0000-4000-8000-000000000001',
  nome: 'João da Silva',
  usuario: 'tecnico',
  email: 'tecnico@equinox.dev',
  perfil: PerfilEnum.TECNICO,
};
const VERIFICADOR = `pbkdf2-sha256$30000$${'a'.repeat(32)}$${'b'.repeat(64)}`;

describe('CredencialOfflineSecureStore', () => {
  const cofre = new CredencialOfflineSecureStore();

  beforeEach(async () => {
    await cofre.esquecer('tecnico@equinox.dev');
    jest.clearAllMocks();
  });

  it('guarda e devolve a credencial pelo e-mail, ignorando caixa e espaços', async () => {
    await cofre.guardar('tecnico@equinox.dev', { sessao: SESSAO, verificador: VERIFICADOR });

    expect(await cofre.buscar('  TECNICO@Equinox.dev ')).toEqual({
      sessao: SESSAO,
      verificador: VERIFICADOR,
    });
  });

  it('usa só caracteres que o expo-secure-store aceita na chave', async () => {
    await cofre.guardar('tecnico+campo@equinox.dev', { sessao: SESSAO, verificador: VERIFICADOR });

    const chave = (SecureStore.setItemAsync as jest.Mock).mock.calls[0][0] as string;
    expect(chave).toMatch(/^[A-Za-z0-9._-]+$/);
    await cofre.esquecer('tecnico+campo@equinox.dev');
  });

  it('esquecer apaga', async () => {
    await cofre.guardar('tecnico@equinox.dev', { sessao: SESSAO, verificador: VERIFICADOR });
    await cofre.esquecer('tecnico@equinox.dev');

    expect(await cofre.buscar('tecnico@equinox.dev')).toBeNull();
  });

  it('conteúdo corrompido vale como nada guardado, e é apagado', async () => {
    await cofre.guardar('tecnico@equinox.dev', { sessao: SESSAO, verificador: VERIFICADOR });
    const chave = (SecureStore.setItemAsync as jest.Mock).mock.calls[0][0] as string;
    await SecureStore.setItemAsync(chave, '{quebrado');

    expect(await cofre.buscar('tecnico@equinox.dev')).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(chave, expect.anything());
  });
});
