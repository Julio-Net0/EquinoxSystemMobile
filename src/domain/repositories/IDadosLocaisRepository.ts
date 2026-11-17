/**
 * Operação sobre o banco local inteiro, usada na troca de usuário (ADR 10.19).
 */
export interface IDadosLocaisRepository {
  /**
   * Apaga empresas, endereços, padrões, usuários, vínculos, leituras e avisos.
   * Mantém a fila de envio e o estado da sincronização. Devolve as
   * referências das fotos das leituras apagadas, para quem chamou removê-las
   * do armazenamento.
   */
  limparTudo(): Promise<string[]>;
}
