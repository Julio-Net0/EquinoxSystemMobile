import { PerfilEnum } from '../enums/PerfilEnum';

export interface SessaoUsuarioData {
  usuarioId: string;
  /** Nulo para super admin, que tem escopo global. */
  empresaId: string | null;
  nome: string;
  usuario: string;
  email: string;
  perfil: PerfilEnum;
}

/**
 * Sessão persistida no armazenamento seguro do aparelho: quem está logado e
 * com que perfil. É ela que libera o uso offline depois do primeiro login.
 *
 * Os tokens de acesso e de renovação da nuvem NÃO passam por aqui: ficam no
 * mesmo armazenamento seguro, mas por conta do adaptador de autenticação
 * remota, que é quem sabe renová-los.
 */
export interface ISessionStorage {
  salvarSessao(dados: SessaoUsuarioData): Promise<void>;
  obterSessao(): Promise<SessaoUsuarioData | null>;
  salvarPinLocal(pin: string): Promise<void>;
  validarPinLocal(pin: string): Promise<boolean>;
  temPinLocal(): Promise<boolean>;
  limparSessao(): Promise<void>;
}
