/**
 * Ciclo de vida de uma leitura. "Aprovada" substitui o "enviada" do app antigo:
 * offline não existe planilha para onde enviar, o que existe é a decisão do
 * administrador sobre uma leitura que caiu em exceção.
 */
export enum StatusLeituraEnum {
  REGISTRADA = 'registrada',
  APROVADA = 'aprovada',
  SUBSTITUIDA = 'substituida',
  DESCARTADA = 'descartada',
}

/** Status que ocupam a vaga única de (padrão, dia local). */
export const STATUS_VIGENTES: readonly StatusLeituraEnum[] = [
  StatusLeituraEnum.REGISTRADA,
  StatusLeituraEnum.APROVADA,
];
