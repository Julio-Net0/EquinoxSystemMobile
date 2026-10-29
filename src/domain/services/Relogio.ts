/**
 * Relógio injetável. Sem isso, qualquer regra que dependa de "hoje" (leitura
 * atrasada, referência de valor menor, expurgo) fica impossível de testar.
 * É uma porta, mas sem dependência externa, então vive no domínio.
 */
export interface IRelogio {
  agora(): Date;
}

export const relogioSistema: IRelogio = {
  agora: (): Date => new Date(),
};

/** Relógio de teste: devolve sempre o mesmo instante, protegido de mutação. */
export function relogioFixo(instante: Date): IRelogio {
  const congelado = instante.getTime();
  return { agora: (): Date => new Date(congelado) };
}
