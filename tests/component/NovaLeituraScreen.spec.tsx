import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NovaLeituraScreen } from '@/presentation/screens/NovaLeituraScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const ENDERECO = {
  enderecoId: 'e1',
  apelido: 'Sede administrativa',
  uc: '3001234567',
  ehUsina: false,
  logradouro: 'Avenida Afonso Pena, 1500',
  temGeocerca: true,
  padroes: [],
};

const PADRAO = {
  padraoId: 'p1',
  numero: '778811',
  ultimaLeitura: { valorConsumo: 11_150, valorInjecao: null, dataLocal: '2026-10-29' },
};

type Props = React.ComponentProps<typeof NovaLeituraScreen>;

/**
 * No testing-library 14 `render` e `fireEvent` sao assincronos, entao todo
 * teste aqui e async e as consultas vem do retorno aguardado.
 */
async function montar(sobrescrita: Partial<Props> = {}) {
  const props = {
    carregando: false,
    erro: null,
    endereco: ENDERECO,
    padrao: PADRAO,
    consumo: '',
    injecao: '',
    onConsumo: jest.fn(),
    onInjecao: jest.fn(),
    fotoUri: null,
    onAbrirCamera: jest.fn(),
    gps: 'obtido' as const,
    onTentarGps: jest.fn(),
    salvando: false,
    avisoValorMenor: null,
    sucesso: false,
    onSalvar: jest.fn(),
    onConfirmarValorMenor: jest.fn(),
    onCancelarAviso: jest.fn(),
    onVoltar: jest.fn(),
    onConcluir: jest.fn(),
    ...sobrescrita,
  } as Props;

  const tela = await render(<NovaLeituraScreen {...props} />);
  return { props, tela };
}

describe('NovaLeituraScreen', () => {
  describe('contexto do padrão', () => {
    it('mostra o padrão, o endereço e a leitura anterior', async () => {
      const { tela } = await montar();

      expect(tela.getByText('Padrão 778811')).toBeTruthy();
      expect(tela.getAllByText('Sede administrativa').length).toBeGreaterThan(0);
      // Ver o valor anterior antes de digitar evita o erro, em vez de só avisar.
      expect(tela.getAllByText(/11\.150 kWh/).length).toBeGreaterThan(0);
    });

    it('avisa quando o endereço não tem geocerca', async () => {
      const { tela } = await montar({ endereco: { ...ENDERECO, temGeocerca: false } });
      expect(tela.getByText(/não tem coordenada cadastrada/)).toBeTruthy();
    });
  });

  describe('câmera', () => {
    it('oferece abrir a câmera e diz que a foto é obrigatória', async () => {
      const { tela } = await montar();

      expect(tela.getByText('Abrir câmera')).toBeTruthy();
      expect(tela.getByText(/é obrigatória/)).toBeTruthy();
    });

    it('abre a câmera ao tocar no botão', async () => {
      const { tela, props } = await montar();

      await fireEvent.press(tela.getByText('Abrir câmera'));

      expect(props.onAbrirCamera).toHaveBeenCalled();
    });

    it('troca o botão pela prévia depois da captura', async () => {
      const { tela } = await montar({ fotoUri: 'file:///documents/leituras/foto.jpg' });

      expect(tela.queryByText('Abrir câmera')).toBeNull();
      expect(tela.getByText('Tirar de novo')).toBeTruthy();
    });
  });

  describe('localização', () => {
    it.each([
      ['buscando', 'Obtendo localização…'],
      ['obtido', 'Localização obtida'],
      ['indisponivel', 'Sem localização'],
    ] as const)('mostra o estado %s', async (gps, rotulo) => {
      const { tela } = await montar({ gps });
      expect(tela.getByText(rotulo)).toBeTruthy();
    });

    it('explica que a leitura segue sem localização', async () => {
      const { tela } = await montar({ gps: 'indisponivel' });

      // A foto é obrigatória, o GPS não: casa de medidor tem sinal ruim.
      expect(tela.getByText(/pode ser registrada sem localização/)).toBeTruthy();
    });

    it('oferece tentar de novo quando o GPS falhou', async () => {
      const { tela, props } = await montar({ gps: 'indisponivel' });

      await fireEvent.press(tela.getByText('Tentar'));

      expect(props.onTentarGps).toHaveBeenCalled();
    });

    it('não oferece tentar quando a localização já veio', async () => {
      const { tela } = await montar({ gps: 'obtido' });
      expect(tela.queryByText('Tentar')).toBeNull();
    });
  });

  describe('usina', () => {
    it('não mostra o campo de injeção num endereço comum', async () => {
      const { tela } = await montar();
      expect(tela.queryByText(/Injeção \(103\)/)).toBeNull();
    });

    it('mostra o campo de injeção num endereço de usina', async () => {
      const { tela } = await montar({ endereco: { ...ENDERECO, ehUsina: true } });
      expect(tela.getByText(/Injeção \(103\)/)).toBeTruthy();
    });
  });

  describe('aviso de valor menor', () => {
    const aviso =
      'A última leitura deste padrão foi 11.150 kWh em 29/10/2026. '
      + 'Você digitou 9.000 kWh. Está certo?';

    it('mostra o texto que veio do domínio', async () => {
      const { tela } = await montar({ avisoValorMenor: aviso });

      expect(tela.getByText('Confira o valor')).toBeTruthy();
      expect(tela.getByText(aviso)).toBeTruthy();
    });

    it('confirmar manda salvar assim mesmo', async () => {
      const { tela, props } = await montar({ avisoValorMenor: aviso });

      await fireEvent.press(tela.getByText('Está certo, salvar'));

      expect(props.onConfirmarValorMenor).toHaveBeenCalled();
    });

    it('corrigir volta ao formulário sem salvar', async () => {
      const { tela, props } = await montar({ avisoValorMenor: aviso });

      await fireEvent.press(tela.getByText('Corrigir'));

      expect(props.onCancelarAviso).toHaveBeenCalled();
      expect(props.onConfirmarValorMenor).not.toHaveBeenCalled();
    });
  });

  it('mostra o erro de foto faltando vindo do controlador', async () => {
    const { tela } = await montar({ erro: 'Tire a foto do visor do medidor antes de registrar.' });
    expect(tela.getByText('Tire a foto do visor do medidor antes de registrar.')).toBeTruthy();
  });

  it('confirma o registro na tela de sucesso', async () => {
    const { tela, props } = await montar({ sucesso: true, consumo: '11600' });

    expect(tela.getByText('Leitura registrada!')).toBeTruthy();
    expect(tela.getByText(/11\.600 kWh/)).toBeTruthy();

    await fireEvent.press(tela.getByText('Voltar ao início'));
    expect(props.onConcluir).toHaveBeenCalled();
  });

  it('avisa quando o padrão não pertence ao usuário', async () => {
    const { tela } = await montar({ endereco: null, padrao: null });
    expect(tela.getByText('Padrão não encontrado')).toBeTruthy();
  });
});
