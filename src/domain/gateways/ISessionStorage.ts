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
 * Sessão persistida no aparelho. Não há token: a autenticação é local, contra
 * a tabela de usuários do SQLite.
 */
export interface ISessionStorage {
  salvarSessao(dados: SessaoUsuarioData): Promise<void>;
  obterSessao(): Promise<SessaoUsuarioData | null>;
  salvarPinLocal(pin: string): Promise<void>;
  validarPinLocal(pin: string): Promise<boolean>;
  temPinLocal(): Promise<boolean>;
  limparSessao(): Promise<void>;
}
