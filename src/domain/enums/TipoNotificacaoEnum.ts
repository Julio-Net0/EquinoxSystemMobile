/**
 * Tipos gerados por regras locais. O app antigo também tinha PLANILHA_FALHA,
 * que não existe aqui por não haver planilha.
 */
export enum TipoNotificacaoEnum {
  LEITURA_ATRASADA = 'LEITURA_ATRASADA',
  LEITURA_SUBSTITUIDA = 'LEITURA_SUBSTITUIDA',
  LEITURA_VALOR_MENOR = 'LEITURA_VALOR_MENOR',
  LEITURA_FORA_DE_RAIO = 'LEITURA_FORA_DE_RAIO',
  LEITURA_SEM_GPS = 'LEITURA_SEM_GPS',
  CADASTRO_PENDENTE = 'CADASTRO_PENDENTE',
}
