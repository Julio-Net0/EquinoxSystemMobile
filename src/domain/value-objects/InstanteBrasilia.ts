/**
 * Horário de Brasília com offset fixo de UTC-3: o Brasil não adota horário de
 * verão desde 2019, e o "dia" de uma leitura é sempre medido por essa régua.
 */
export const OFFSET_MINUTOS_BRASILIA = -180;

const OFFSET_MS = OFFSET_MINUTOS_BRASILIA * 60 * 1000;

const doisDigitos = (n: number): string => String(n).padStart(2, '0');
const tresDigitos = (n: number): string => String(n).padStart(3, '0');

/** Instante em ISO com o sufixo -03:00, ex.: 2026-09-30T12:04:05.678-03:00. */
export function isoComOffset(instante: Date): string {
  const local = new Date(instante.getTime() + OFFSET_MS);
  const data = `${local.getUTCFullYear()}-${doisDigitos(local.getUTCMonth() + 1)}-${doisDigitos(local.getUTCDate())}`;
  const hora = `${doisDigitos(local.getUTCHours())}:${doisDigitos(local.getUTCMinutes())}:${doisDigitos(local.getUTCSeconds())}`;
  return `${data}T${hora}.${tresDigitos(local.getUTCMilliseconds())}-03:00`;
}
