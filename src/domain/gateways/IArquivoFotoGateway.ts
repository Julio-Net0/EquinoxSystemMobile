export interface FotoPersistida {
  uri: string;
  bytes: number;
  largura: number;
  altura: number;
}

/**
 * Comprime a foto do medidor e move do cache para o armazenamento permanente
 * do app. Sem isso a foto desaparece quando o sistema limpa o cache, e a
 * leitura fica sem comprovante.
 */
export interface IArquivoFotoGateway {
  /** Redimensiona para 1080p, salva em JPEG (~300 KB) e persiste. */
  comprimirEPersistir(uriTemporaria: string, nomeBase: string): Promise<FotoPersistida>;
  remover(uri: string): Promise<void>;
  existe(uri: string): Promise<boolean>;
}
