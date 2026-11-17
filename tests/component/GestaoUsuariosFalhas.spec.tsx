import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { GestaoUsuariosScreen } from '@/presentation/screens/GestaoUsuariosScreen';
import { UsuarioResumoDTO } from '@/application/use-cases/GerenciarUsuariosEmpresaUseCase';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));

const usuario = (sobrescrita: Partial<UsuarioResumoDTO> = {}): UsuarioResumoDTO => ({
  usuarioId: 'u-1',
  nome: 'Carlos Administrador',
  usuario: 'admin',
  email: 'admin@equinox.dev',
  perfil: PerfilEnum.ADMIN,
  status: StatusUsuarioEnum.ATIVO,
  enderecos: [],
  enderecoIds: [],
  ...sobrescrita,
});

const montar = (props: Partial<React.ComponentProps<typeof GestaoUsuariosScreen>>) =>
  render(
    <GestaoUsuariosScreen
      usuarios={[usuario()]}
      enderecos={[]}
      filtro="todos"
      busca=""
      carregando={false}
      erro={null}
      processandoId={null}
      podeConcederSuperAdmin={false}
      onFiltro={jest.fn()}
      onBusca={jest.fn()}
      onSalvar={jest.fn(async () => null)}
      onAlternarStatus={jest.fn(async () => null)}
      onAprovarRapido={jest.fn(async () => null)}
      onExcluir={jest.fn(async () => null)}
      onVoltar={jest.fn()}
      {...props}
    />,
  );

describe('Gerenciar usuários: falhas das ações rápidas', () => {
  it('desativar recusado mostra o motivo na tela, em vez de falhar calado', async () => {
    const tela = await montar({
      onAlternarStatus: jest.fn(async () => 'Você não pode desativar a própria conta'),
    });

    await fireEvent.press(tela.getByText('Desativar'));

    expect(tela.getByText('Você não pode desativar a própria conta')).toBeTruthy();
  });

  it('aprovação rápida recusada também mostra o motivo', async () => {
    const tela = await montar({
      usuarios: [usuario({ status: StatusUsuarioEnum.RECUSADO })],
      onAprovarRapido: jest.fn(async () => 'Selecione ao menos um endereço'),
    });

    await fireEvent.press(tela.getByText('Aprovar'));

    expect(tela.getByText('Selecione ao menos um endereço')).toBeTruthy();
  });

  it('a ação seguinte que dá certo apaga o aviso anterior', async () => {
    const alternar = jest
      .fn<Promise<string | null>, [string]>()
      .mockResolvedValueOnce('Recusado')
      .mockResolvedValueOnce(null);
    const tela = await montar({ onAlternarStatus: alternar });

    await fireEvent.press(tela.getByText('Desativar'));
    expect(tela.getByText('Recusado')).toBeTruthy();

    await fireEvent.press(tela.getByText('Desativar'));
    expect(tela.queryByText('Recusado')).toBeNull();
  });
});
