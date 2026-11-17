import { Usuario } from '../entities/Usuario';
import { ResultadoRemoto } from './ResultadoRemoto';

export interface IdentidadeRemota {
  usuarioId: string;
  email: string;
}

export interface DadosDeCadastroRemoto {
  empresaId: string;
  nome: string;
  usuario: string;
  email: string;
  senha: string;
}

/** O que a busca de empresa no cadastro expõe: nada além de id e nome. */
export interface EmpresaParaCadastro {
  id: string;
  nome: string;
}

/**
 * Autenticação na nuvem. A identidade (e-mail e senha) vive no serviço de
 * autenticação remoto; o aparelho nunca guarda senha, só os tokens da sessão,
 * e esses ficam por conta do adaptador, no armazenamento seguro.
 */
export interface IAutenticacaoRemotaGateway {
  entrar(email: string, senha: string): Promise<ResultadoRemoto<IdentidadeRemota>>;

  /** Cria a identidade e o perfil Pendente. Não deixa sessão aberta. */
  cadastrar(dados: DadosDeCadastroRemoto): Promise<ResultadoRemoto<IdentidadeRemota>>;

  /** Disponível antes do login. */
  buscarEmpresasParaCadastro(termo: string): Promise<ResultadoRemoto<EmpresaParaCadastro[]>>;

  /** Perfil do usuário autenticado, lido do banco remoto. Nulo se não existir. */
  obterMeuPerfil(): Promise<ResultadoRemoto<Usuario | null>>;

  /** Confere a senha atual na nuvem antes de trocar. */
  alterarSenha(senhaAtual: string, novaSenha: string): Promise<ResultadoRemoto>;

  /**
   * Garante um token de acesso válido, renovando-o se preciso. Devolve nulo
   * quando não há sessão remota neste aparelho. Sem rede, falha com `rede` e
   * a sessão guardada continua intacta.
   */
  garantirSessao(): Promise<ResultadoRemoto<IdentidadeRemota | null>>;

  /** Encerra a sessão remota e apaga os tokens do aparelho. Nunca lança. */
  sair(): Promise<void>;
}
