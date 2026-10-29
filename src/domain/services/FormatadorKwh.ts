/**
 * Formatação pt-BR feita à mão, de propósito: o Hermes não garante ICU completo,
 * então Intl.NumberFormat pode devolver "1234.56" no aparelho e "1.234,56" no
 * Node dos testes. Os textos de aviso de leitura são comparados em teste e
 * mostrados ao técnico, então precisam ser idênticos nos dois lugares.
 */
const MAXIMO_CASAS = 2;

export function formatarNumeroBr(valor: number): string {
  const negativo = valor < 0;
  const absoluto = Math.abs(valor);

  // toFixed arredonda meio-para-cima no decimal pedido, que é o que queremos.
  const [inteiro, decimais = ''] = absoluto.toFixed(MAXIMO_CASAS).split('.');
  const decimaisSignificativos = decimais.replace(/0+$/, '');

  const milhares = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const corpo = decimaisSignificativos ? `${milhares},${decimaisSignificativos}` : milhares;

  return negativo && Number(absoluto.toFixed(MAXIMO_CASAS)) !== 0 ? `-${corpo}` : corpo;
}

export function formatarKwh(valor: number): string {
  return `${formatarNumeroBr(valor)} kWh`;
}

/**
 * Distância em metros abaixo de 1 km e em quilômetros acima — ler "15400 m"
 * num aviso não ajuda ninguém.
 */
export function formatarDistancia(metros: number): string {
  if (metros < 1000) {
    return `${formatarNumeroBr(Math.round(metros))} m`;
  }
  return `${formatarNumeroBr(Math.round(metros / 100) / 10)} km`;
}
