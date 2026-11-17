import { SessaoUsuarioData } from './ISessionStorage';

/**
 * O que o aparelho guarda para deixar alguém entrar sem rede: quem é a pessoa
 * e uma verificação derivada da senha (`SenhaHash` serializado). Nunca a
 * senha. ADR 10.18.
 */
export interface CredencialOffline {
  sessao: SessaoUsuarioData;
  verificador: string;
}

/**
 * Armazenamento das credenciais de acesso offline, uma por e-mail. Na
 * infraestrutura fica no Keychain/Keystore, como a sessão.
 */
export interface ICredencialOfflineGateway {
  guardar(email: string, credencial: CredencialOffline): Promise<void>;
  buscar(email: string): Promise<CredencialOffline | null>;
  esquecer(email: string): Promise<void>;
}
