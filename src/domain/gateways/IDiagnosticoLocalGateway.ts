/** Quantidade de linhas por tabela do banco local. */
export interface ContagemTabelas {
  empresas: number;
  enderecos: number;
  padroes: number;
  usuarios: number;
  vinculos: number;
  leituras: number;
  notificacoes: number;
}

export interface EstadoDoBanco {
  nomeDoArquivo: string;
  /** PRAGMA user_version: até que migração o banco foi levado. */
  versaoDoSchema: number;
  contagens: ContagemTabelas;
}

/**
 * Lê o estado bruto do banco local.
 *
 * Existe para responder "isto está mesmo sendo salvo no aparelho?" sem precisar
 * extrair o arquivo do SQLite — o que no Expo Go não é possível. É ferramenta
 * de conferência, não faz parte de nenhuma regra de negócio.
 */
export interface IDiagnosticoLocalGateway {
  coletar(): Promise<EstadoDoBanco>;
}
