export interface SessaoUsuarioData {
  usuarioId: string;
  empresaId: string;
  nome: string;
  email: string;
  perfil: 'SuperAdmin' | 'Admin' | 'Tecnico';
  tokenJwt?: string;
}

export interface ISessionStorage {
  salvarSessao(dados: SessaoUsuarioData): Promise<void>;
  obterSessao(): Promise<SessaoUsuarioData | null>;
  salvarPinLocal(pin: string): Promise<void>;
  validarPinLocal(pin: string): Promise<boolean>;
  limparSessao(): Promise<void>;
}
