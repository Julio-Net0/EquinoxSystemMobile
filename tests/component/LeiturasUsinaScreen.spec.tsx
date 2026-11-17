import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LeiturasUsinaScreen, LeiturasUsinaScreenProps } from '@/presentation/screens/LeiturasUsinaScreen';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const USINA_1 = {
  id: 'u1',
  apelido: 'Usina Pampulha',
  uc: '3003456789',
  empresaId: 'emp1',
  empresaNome: 'Equinox Energia',
  logradouro: 'Av. Negrão de Lima · Belo Horizonte',
  temGeocerca: true,
  totalMedidores: 2,
  ehUsina: true,
};

const SEDE = {
  id: 'e3',
  apelido: 'Sede administrativa',
  uc: '3001234567',
  empresaId: 'emp1',
  empresaNome: 'Equinox Energia',
  logradouro: 'Avenida Afonso Pena, 1500 · Belo Horizonte',
  temGeocerca: true,
  totalMedidores: 2,
  ehUsina: false,
};

const USINA_2 = {
  id: 'u2',
  apelido: 'Usina Solar do Vale',
  uc: '3006789012',
  empresaId: 'emp2',
  empresaNome: 'Condomínio Solar',
  logradouro: 'Rua das Palmeiras, 45 · Nova Lima',
  temGeocerca: true,
  totalMedidores: 1,
  ehUsina: true,
};

const MEDIDOR_COM_LEITURA = {
  padraoId: 'pad1',
  numero: '993344',
  teveLeitura: true,
  leituraVigente: {
    id: 'l1',
    valorConsumo: 32_050,
    valorInjecao: 19_120,
    medidoEm: '2026-03-10T14:30:00.000Z',
    horaFormatada: '14:30',
    status: StatusLeituraEnum.REGISTRADA,
    autorNome: 'João da Silva',
    fotoLocalUri: 'file:///foto1.jpg',
    temLocalizacao: true,
  },
  substituicoes: [
    {
      id: 'sub1',
      valorConsumo: 31_900,
      valorInjecao: 19_000,
      medidoEm: '2026-03-10T10:15:00.000Z',
      horaFormatada: '10:15',
      status: StatusLeituraEnum.SUBSTITUIDA,
      autorNome: 'João da Silva',
      fotoLocalUri: 'file:///foto_sub.jpg',
      temLocalizacao: true,
      substituidaEm: '2026-03-10T14:30:00.000Z',
      substituidaPorId: 'l1',
    },
  ],
  temSubstituicao: true,
  alertaForaPadrao: 'A última leitura deste padrão foi 35.000 kWh. Você digitou 32.050 kWh. Está certo?',
  referenciaHistorico: {
    valorConsumo: 35_000,
    valorInjecao: 20_000,
    dataLocal: '2026-03-09',
  },
};

const MEDIDOR_SEM_LEITURA = {
  padraoId: 'pad2',
  numero: '993345',
  teveLeitura: false,
  leituraVigente: null,
  substituicoes: [],
  temSubstituicao: false,
  alertaForaPadrao: null,
  referenciaHistorico: {
    valorConsumo: 15_000,
    valorInjecao: 8_000,
    dataLocal: '2026-03-08',
  },
};

async function montar(sobrescrita: Partial<LeiturasUsinaScreenProps> = {}) {
  const props: LeiturasUsinaScreenProps = {
    usinas: [USINA_1, USINA_2],
    usinaSelecionada: USINA_1,
    dataLocal: '2026-03-10',
    dataLocalFormatada: '10/03/2026',
    diasComLeitura: ['2026-03-05', '2026-03-10'],
    resumo: {
      totalMedidores: 2,
      medidoresComLeitura: 1,
      medidoresSemLeitura: 1,
      totalSubstituicoes: 1,
      totalAlertas: 1,
    },
    medidores: [MEDIDOR_COM_LEITURA, MEDIDOR_SEM_LEITURA],
    carregando: false,
    erro: null,
    onSelecionarUsina: jest.fn(),
    onDesmarcarUsina: jest.fn(),
    onMudarData: jest.fn(),
    onDiaAnterior: jest.fn(),
    onDiaSeguinte: jest.fn(),
    onRecarregar: jest.fn(),
    onVoltar: jest.fn(),
    ...sobrescrita,
  };

  const tela = await render(<LeiturasUsinaScreen {...props} />);
  return { props, tela };
}

describe('LeiturasUsinaScreen', () => {
  it('o selo da foto abre o comprovante da leitura vigente', async () => {
    const onVerFoto = jest.fn();
    const { tela } = await montar({ onVerFoto });

    await fireEvent.press(await tela.findByTestId('ver-foto-l1'));

    expect(onVerFoto).toHaveBeenCalledWith('l1');
  });

  it('renderiza título, cabeçalho e informações da usina', async () => {
    const { tela } = await montar();

    expect(await tela.findByText('Leituras diárias')).toBeTruthy();
    expect((await tela.findAllByText('Usina Pampulha')).length).toBeGreaterThan(0);
    expect(await tela.findByText('UC 3003456789 · Equinox Energia')).toBeTruthy();
    expect(await tela.findByText('10/03/2026')).toBeTruthy();
  });

  it('exibe lista de escolha de usinas quando nenhuma usina estiver aberta e existirem várias', async () => {
    const { props, tela } = await montar({ usinaSelecionada: null });

    expect(await tela.findByText('Endereços disponíveis (2)')).toBeTruthy();
    expect(await tela.findByText('Usina Pampulha')).toBeTruthy();
    expect(await tela.findByText('Usina Solar do Vale')).toBeTruthy();

    const cardUsina1 = await tela.findByText('Usina Pampulha');
    await fireEvent.press(cardUsina1);

    expect(props.onSelecionarUsina).toHaveBeenCalledWith('u1');
  });

  it('lista também endereços que não são usina, com o selo Usina só nas usinas', async () => {
    const { tela } = await montar({ usinas: [USINA_1, SEDE], usinaSelecionada: null });

    expect(await tela.findByText('Endereços disponíveis (2)')).toBeTruthy();
    expect(await tela.findByText('Sede administrativa')).toBeTruthy();
    expect(tela.getAllByText('Usina')).toHaveLength(1);
  });

  it('endereço comum aberto não leva o selo Usina', async () => {
    const { tela } = await montar({ usinas: [USINA_1, SEDE], usinaSelecionada: SEDE });

    expect((await tela.findAllByText('Sede administrativa')).length).toBeGreaterThan(0);
    expect(tela.queryByText('Usina')).toBeNull();
    expect(await tela.findByText('Medidores do endereço (2)')).toBeTruthy();
  });

  it('permite trocar de usina tocando no botão Trocar', async () => {
    const { props, tela } = await montar();

    const btnTrocar = await tela.findByLabelText('Trocar endereço');
    await fireEvent.press(btnTrocar);

    expect(props.onDesmarcarUsina).toHaveBeenCalledTimes(1);
  });

  it('abre calendário mensal ao tocar na data central e permite selecionar outro dia', async () => {
    const { props, tela } = await montar();

    const botaoData = await tela.findByLabelText('Abrir calendário mensal');
    await fireEvent.press(botaoData);

    // O modal abre exibindo o mês do dia atual
    expect(await tela.findByText('Março 2026')).toBeTruthy();

    // Dia 5 está na lista de dias com leituras
    const dia5 = await tela.findByLabelText('Dia 5 com leituras');
    expect(dia5).toBeTruthy();

    // Seleciona o dia 5
    await fireEvent.press(dia5);

    expect(props.onMudarData).toHaveBeenCalledWith('2026-03-05');
  });

  it('exibe resumo consolidado de métricas', async () => {
    const { tela } = await montar();

    expect(await tela.findByText('Medidores lidos')).toBeTruthy();
    expect(await tela.findByText('Substituições')).toBeTruthy();
    expect(await tela.findByText('Alertas')).toBeTruthy();
  });

  it('mostra medidor lido com valores de consumo e injeção formatados', async () => {
    const { tela } = await montar();

    expect(await tela.findByText('Padrão 993344')).toBeTruthy();
    expect(await tela.findByText('32.050 kWh')).toBeTruthy();
    expect(await tela.findByText('19.120 kWh')).toBeTruthy();
    expect(await tela.findByText(/Medido às 14:30 por João da Silva/)).toBeTruthy();
  });

  it('mostra medidor sem leitura no dia com status pendente', async () => {
    const { tela } = await montar();

    expect(await tela.findByText('Padrão 993345')).toBeTruthy();
    expect(await tela.findByText('Pendente de leitura')).toBeTruthy();
    expect(await tela.findByText('Sem leitura')).toBeTruthy();
    expect(
      await tela.findByText('Nenhuma leitura registrada para este medidor na data selecionada.'),
    ).toBeTruthy();
  });

  it('exibe alerta de leitura fora do padrão do histórico', async () => {
    const { tela } = await montar();

    expect(await tela.findByText('Leitura fora do padrão do histórico')).toBeTruthy();
    expect(
      await tela.findByText(
        'A última leitura deste padrão foi 35.000 kWh. Você digitou 32.050 kWh. Está certo?',
      ),
    ).toBeTruthy();
  });

  it('expande o histórico de substituições ao tocar no botão de substituição', async () => {
    const { tela } = await montar();

    const botaoExpansao = await tela.findByLabelText(
      'Ver histórico de substituição do padrão 993344',
    );
    expect(botaoExpansao).toBeTruthy();

    // Antes de expandir, os detalhes da leitura antiga não estão visíveis
    expect(tela.queryByText('Medições anteriores substituídas:')).toBeNull();

    // Toca para expandir
    await fireEvent.press(botaoExpansao);

    // Agora o histórico expandido deve estar visível
    expect(await tela.findByText('Medições anteriores substituídas:')).toBeTruthy();
    expect(await tela.findByText('Tentativa #1')).toBeTruthy();
    expect(await tela.findByText('31.900 kWh')).toBeTruthy();
    expect(await tela.findByText('19.000 kWh')).toBeTruthy();
    expect(await tela.findByText(/Medido às 10:15 por João da Silva/)).toBeTruthy();
  });

  it('chama onDiaAnterior e onDiaSeguinte ao tocar nos botões de navegação', async () => {
    const { props, tela } = await montar();

    const btnAnterior = await tela.findByLabelText('Dia anterior');
    const btnSeguinte = await tela.findByLabelText('Dia seguinte');

    await fireEvent.press(btnAnterior);
    expect(props.onDiaAnterior).toHaveBeenCalledTimes(1);

    await fireEvent.press(btnSeguinte);
    expect(props.onDiaSeguinte).toHaveBeenCalledTimes(1);
  });

  it('exibe estado vazio quando não há usinas disponíveis', async () => {
    const { tela } = await montar({ usinas: [], usinaSelecionada: null, medidores: [] });

    expect(await tela.findByText('Nenhum endereço encontrado')).toBeTruthy();
  });
});
