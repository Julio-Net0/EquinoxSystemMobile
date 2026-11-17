export interface CredencialEmMemoria {
  email: string;
  senha: string;
}

/**
 * A senha digitada num login sem rede, guardada **só em memória** até a
 * conexão voltar e o app conseguir entrar na nuvem com ela. Fechar o app a
 * apaga; nada disso vai para disco. ADR 10.18.
 */
export interface IReautenticacaoPendente {
  guardar(credencial: CredencialEmMemoria): void;
  obter(): CredencialEmMemoria | null;
  limpar(): void;
}
