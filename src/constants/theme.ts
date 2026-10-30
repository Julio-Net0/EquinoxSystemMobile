import { Platform, TextStyle } from 'react-native';

/**
 * Identidade visual do Equinox, portada do app em produção
 * (example/Equinox.MOBILE/src/style.css).
 *
 * O app é só escuro: o técnico usa em casa de medidor, garagem e subsolo, onde
 * um tema claro atrapalha. Por isso não há par claro/escuro aqui.
 */
export const Cores = {
  /** Âmbar da marca: ações principais, ícones, destaques. */
  primary: '#f9a825',
  primaryContainer: '#e09303',
  /** Fim do gradiente do botão assinatura. */
  primaryDim: '#e99b13',
  secondary: '#fcbc27',

  /** Fundo do app. */
  surface: '#0e0e0e',
  surfaceContainerLow: '#131313',
  surfaceContainer: '#1a1919',
  surfaceContainerHigh: '#201f1f',
  surfaceContainerHighest: '#262626',

  onSurface: '#ffffff',
  onSurfaceVariant: '#adaaaa',

  outline: '#767575',
  outlineVariant: '#484847',

  error: '#ef4444',
  errorDim: '#d53d18',
  /** Status positivo: ativo, aprovado. */
  sucesso: '#34d399',
} as const;

/** Sobreposições translúcidas recorrentes nas bordas e nos fundos de card. */
export const Overlay = {
  borda: 'rgba(255, 255, 255, 0.05)',
  bordaForte: 'rgba(255, 255, 255, 0.10)',
  primaryFraco: 'rgba(249, 168, 37, 0.10)',
  primaryBorda: 'rgba(249, 168, 37, 0.30)',
  errorFraco: 'rgba(239, 68, 68, 0.10)',
  errorBorda: 'rgba(239, 68, 68, 0.30)',
  sucessoFraco: 'rgba(52, 211, 153, 0.10)',
  sucessoBorda: 'rgba(52, 211, 153, 0.30)',
  modal: 'rgba(0, 0, 0, 0.70)',
  brilhoPrimary: 'rgba(249, 168, 37, 0.30)',
} as const;

export const Espaco = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Raio = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pilula: 999,
} as const;

export const Fontes = Platform.select({
  ios: { sans: 'Inter', mono: 'ui-monospace' },
  default: { sans: 'Inter', mono: 'monospace' },
}) as { sans: string; mono: string };

/**
 * Escala tipográfica. Antes não existia e cada tela fixava fontSize e
 * fontWeight na mão, o que fazia o mesmo papel aparecer em três tamanhos
 * diferentes ao longo do app.
 */
export const Tipografia = {
  /** Nome da tela, em caixa alta e âmbar, como o app antigo. */
  display: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  } as TextStyle,

  titulo: { fontSize: 20, fontWeight: '700' } as TextStyle,
  tituloCard: { fontSize: 16, fontWeight: '700' } as TextStyle,

  corpo: { fontSize: 16, fontWeight: '400' } as TextStyle,
  corpoSm: { fontSize: 14, fontWeight: '400' } as TextStyle,
  meta: { fontSize: 12, fontWeight: '400' } as TextStyle,

  /** Rótulo de campo e eyebrow de seção: 10px, peso 900, caixa alta. */
  rotulo: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  } as TextStyle,

  /** Texto de botão principal. */
  botao: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  } as TextStyle,

  /** Texto de botão pequeno e de pílula de status. */
  botaoSm: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as TextStyle,

  /**
   * Valor numérico de leitura. tabular-nums mantém os dígitos alinhados, o que
   * importa quando o técnico compara o valor digitado com o anterior.
   */
  valor: {
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  } as TextStyle,
} as const;

/**
 * Campos usam 16px de propósito: abaixo disso o iOS dá zoom automático ao
 * focar o input, o que desloca a tela toda.
 */
export const TAMANHO_MINIMO_INPUT = 16;

/** Alvo de toque mínimo confortável num celular. */
export const ALVO_TOQUE = 44;

/**
 * Alias de compatibilidade com o nome usado antes. Mantido para não quebrar
 * imports durante a migração das telas; sai quando todas estiverem portadas.
 */
export const SolarTheme = {
  background: Cores.surface,
  text: Cores.onSurface,
  textSecondary: Cores.onSurfaceVariant,
  primary: Cores.primary,
  surfaceContainer: Cores.surfaceContainer,
  surfaceContainerHigh: Cores.surfaceContainerHigh,
  emerald: Cores.sucesso,
  rose: Cores.error,
} as const;
