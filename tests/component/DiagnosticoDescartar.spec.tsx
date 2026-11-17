import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DiagnosticoScreen } from '@/presentation/screens/DiagnosticoScreen';
import { ItemDaFilaDTO } from '@/application/use-cases/ConsultarEstadoSincronizacaoUseCase';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));

const item = (sobrescrita: Partial<ItemDaFilaDTO> = {}): ItemDaFilaDTO => ({
  itemId: 'item-1',
  tipo: 'UPSERT_LEITURA',
  descricao: 'Leitura',
  criadoEm: '2026-11-03T18:49:25.038Z',
  tentativas: 5,
  isolado: true,
  ultimoErro: 'A foto do medidor não foi encontrada no aparelho, e sem ela a leitura não pode subir',
  deOutroUsuario: false,
  ...sobrescrita,
});

const sincronizacao = {
  online: true,
  sincronizando: false,
  pendentes: 1,
  isolados: 1,
  ultimaSincronizacaoEm: null,
  aviso: null,
  onSincronizar: jest.fn(),
  onTentarDeNovo: jest.fn(),
};

const montar = (
  fila: ItemDaFilaDTO[],
  onDescartar: (itemId: string) => Promise<string | null> = jest.fn(async () => null),
) =>
  render(
    <DiagnosticoScreen
      dados={null}
      carregando={false}
      erro={null}
      onRecarregar={jest.fn()}
      onVoltar={jest.fn()}
      sincronizacao={sincronizacao}
      fila={fila}
      onDescartar={onDescartar}
    />,
  );

describe('Diagnóstico: descartar item recusado de vez', () => {
  it('só o item fora da fila automática oferece o descarte', async () => {
    const tela = await montar([item(), item({ itemId: 'item-2', isolado: false, tentativas: 1 })]);

    expect(tela.getAllByTestId(/^descartar-/)).toHaveLength(1);
    expect(tela.getByTestId('descartar-item-1')).toBeTruthy();
  });

  it('pede confirmação, dizendo que a leitura sai do aparelho, e só então descarta', async () => {
    const onDescartar = jest.fn(async () => null);
    const tela = await montar([item()], onDescartar);

    await fireEvent.press(tela.getByTestId('descartar-item-1'));

    expect(onDescartar).not.toHaveBeenCalled();
    expect(tela.getByText('Descartar este item?')).toBeTruthy();
    expect(tela.getByText(/apagada deste aparelho e não pode ser recuperada/)).toBeTruthy();

    await fireEvent.press(tela.getByText('Descartar'));

    expect(onDescartar).toHaveBeenCalledWith('item-1');
  });

  it('mostra no próprio aviso o motivo de uma falha ao descartar', async () => {
    const tela = await montar([item()], jest.fn(async () => 'Não foi possível descartar'));

    await fireEvent.press(tela.getByTestId('descartar-item-1'));
    await fireEvent.press(tela.getByText('Descartar'));

    expect(tela.getByText('Não foi possível descartar')).toBeTruthy();
  });

  it('item de outro usuário avisa que espera o dono e não oferece descarte', async () => {
    const tela = await montar([item({ deOutroUsuario: true })]);

    expect(tela.getByText('De outros usuários')).toBeTruthy();
    expect(tela.getByText('Aguardando o dono entrar')).toBeTruthy();
    expect(tela.queryByTestId('descartar-item-1')).toBeNull();
  });
});
