/**
 * Estado da conexão do aparelho. O domínio só precisa saber "há rede ou não";
 * como isso é descoberto (NetInfo, navegador) é assunto da infraestrutura.
 */
export interface IConectividadeGateway {
  estaOnline(): Promise<boolean>;
  /** Avisa a cada mudança. Devolve a função que cancela a inscrição. */
  observar(ouvinte: (online: boolean) => void): () => void;
}
