/**
 * Situação de uma leitura em relação à nuvem. É o que a tela mostra ao
 * técnico: "ainda só no aparelho", "já subiu" ou "não conseguiu subir".
 */
export enum EstadoSyncEnum {
  PENDENTE = 'pendente',
  SINCRONIZADA = 'sincronizada',
  FALHOU = 'falhou',
}

export function rotuloDoEstadoSync(estado: EstadoSyncEnum): string {
  switch (estado) {
    case EstadoSyncEnum.SINCRONIZADA:
      return 'Sincronizada';
    case EstadoSyncEnum.FALHOU:
      return 'Não enviada';
    default:
      return 'Pendente de envio';
  }
}
