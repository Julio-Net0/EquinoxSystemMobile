export interface FotoPersistida {
  /**
   * Referência para achar a foto depois: o que a leitura grava em
   * `fotoLocalUri`. Só o próprio gateway sabe interpretá-la — na
   * infraestrutura, é o caminho relativo à pasta do app (ADR 10.15).
   */
  uri: string;
  bytes: number;
  largura: number;
  altura: number;
}

/**
 * Comprime a foto do medidor e move do cache para o armazenamento permanente
 * do app. Sem isso a foto desaparece quando o sistema limpa o cache, e a
 * leitura fica sem comprovante.
 *
 * Todos os métodos recebem a referência devolvida por `comprimirEPersistir`.
 */
export interface IArquivoFotoGateway {
  /** Redimensiona para 1080p, salva em JPEG (~300 KB) e persiste. */
  comprimirEPersistir(uriTemporaria: string, nomeBase: string): Promise<FotoPersistida>;
  remover(referencia: string): Promise<void>;
  existe(referencia: string): Promise<boolean>;
  /** Endereço completo, pronto para um componente de imagem. */
  uriParaExibir(referencia: string): string;
}
