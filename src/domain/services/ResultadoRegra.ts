/**
 * Resultado de uma regra de negócio que pode recusar com motivo. Usado pelas
 * regras que a camada de apresentação precisa explicar ao usuário, em vez de
 * lançar exceção.
 */
export interface ResultadoRegra {
  readonly ok: boolean;
  readonly motivo?: string;
}

export const regraAprovada = (): ResultadoRegra => ({ ok: true });

export const regraRecusada = (motivo: string): ResultadoRegra => ({ ok: false, motivo });
