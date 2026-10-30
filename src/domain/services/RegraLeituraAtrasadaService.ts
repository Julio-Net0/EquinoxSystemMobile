import { DataLocal } from '../value-objects/DataLocal';

/**
 * Leitura com mais de uma semana de atraso vira decisão do administrador: pode
 * ser um registro legítimo recuperado do papel ou um engano de data, e só quem
 * administra tem contexto para dizer.
 */
export class RegraLeituraAtrasadaService {
  public static readonly DIAS_LIMITE = 7;

  public static diasDeAtraso(dataLeitura: DataLocal, hoje: DataLocal): number {
    return dataLeitura.diasAte(hoje);
  }

  public static estaAtrasada(
    dataLeitura: DataLocal,
    hoje: DataLocal,
    diasLimite: number = RegraLeituraAtrasadaService.DIAS_LIMITE,
  ): boolean {
    return RegraLeituraAtrasadaService.diasDeAtraso(dataLeitura, hoje) > diasLimite;
  }
}
