import React from 'react';
import { render } from '@testing-library/react-native';
import { VisualizadorComprovante } from '@/presentation/components/VisualizadorComprovante';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));

const montar = (props: Partial<React.ComponentProps<typeof VisualizadorComprovante>>) =>
  render(
    <VisualizadorComprovante visivel carregando={false} foto={null} onFechar={jest.fn()} {...props} />,
  );

describe('VisualizadorComprovante', () => {
  it('mostra a foto vinda da nuvem e diz que veio por URL assinada', async () => {
    const tela = await montar({
      foto: { uri: 'https://p.supabase.co/sign/x?token=t', origem: 'nuvem' },
    });

    expect(tela.getByTestId('foto-comprovante').props.source).toEqual({
      uri: 'https://p.supabase.co/sign/x?token=t',
    });
    expect(tela.getByText(/endereço assinado/)).toBeTruthy();
  });

  it('mostra a foto do aparelho', async () => {
    const tela = await montar({ foto: { uri: 'file:///documents/l.jpg', origem: 'aparelho' } });
    expect(tela.getByText('Arquivo guardado neste aparelho')).toBeTruthy();
  });

  it('sem foto, mostra o motivo', async () => {
    const tela = await montar({
      foto: { uri: null, origem: null, aviso: 'A foto está na nuvem. Conecte-se para vê-la' },
    });
    expect(tela.getByTestId('aviso-comprovante').props.children).toBe(
      'A foto está na nuvem. Conecte-se para vê-la',
    );
    expect(tela.queryByTestId('foto-comprovante')).toBeNull();
  });

  it('carregando, não mostra foto nem aviso', async () => {
    const tela = await montar({ carregando: true });
    expect(tela.queryByTestId('foto-comprovante')).toBeNull();
    expect(tela.queryByTestId('aviso-comprovante')).toBeNull();
  });
});
