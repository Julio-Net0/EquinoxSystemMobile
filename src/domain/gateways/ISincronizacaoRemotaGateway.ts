import { Empresa } from '../entities/Empresa';
import { Endereco } from '../entities/Endereco';
import { PadraoCemig } from '../entities/PadraoCemig';
import { Usuario } from '../entities/Usuario';
import { Leitura } from '../entities/Leitura';
import { Notificacao } from '../entities/Notificacao';
import { UUIDv4 } from '../value-objects/UUIDv4';
import { StatusLeituraEnum } from '../enums/StatusLeituraEnum';
import { ResultadoRemoto } from './ResultadoRemoto';

export type TabelaSincronizada =
  | 'empresas'
  | 'enderecos'
  | 'padroes'
  | 'usuarios'
  | 'leituras'
  | 'notificacoes'
  | 'exclusoes';

/**
 * Até onde o pull já foi em cada tabela: o maior carimbo de atualização do
 * servidor que o aparelho já recebeu. Tabela ausente = nunca baixada.
 */
export type CursoresDePull = Partial<Record<TabelaSincronizada, string>>;

export interface ExclusaoRemota {
  tabela: 'enderecos' | 'padroes' | 'usuarios';
  registroId: UUIDv4;
}

/** O que mudou na nuvem desde os cursores informados, já como entidades. */
export interface PacoteDeAlteracoes {
  empresas: Empresa[];
  enderecos: Endereco[];
  padroes: PadraoCemig[];
  usuarios: Usuario[];
  leituras: Leitura[];
  notificacoes: Notificacao[];
  exclusoes: ExclusaoRemota[];
  cursores: CursoresDePull;
  /** Linhas que vieram do servidor e não puderam ser interpretadas. */
  ignorados: string[];
}

/**
 * Envio (push) e recebimento (pull) de dados da nuvem.
 *
 * Todo envio é idempotente pelo UUID do registro: a fila pode repetir uma
 * operação depois de uma queda de rede sem duplicar nada.
 */
export interface ISincronizacaoRemotaGateway {
  /** Sobe o comprovante. Arquivo que já está lá conta como sucesso. */
  enviarFoto(caminhoRemoto: string, uriLocal: string): Promise<ResultadoRemoto>;

  /**
   * Sobe a leitura. O servidor pode devolver um status diferente do enviado
   * quando resolve um conflito de vaga com a leitura de outro aparelho.
   */
  enviarLeitura(
    leitura: Leitura,
    fotoPath: string,
  ): Promise<ResultadoRemoto<{ status: StatusLeituraEnum }>>;

  enviarNotificacao(notificacao: Notificacao): Promise<ResultadoRemoto>;
  marcarNotificacoesLidas(empresaId: UUIDv4 | null): Promise<ResultadoRemoto>;

  enviarEmpresa(empresa: Empresa): Promise<ResultadoRemoto>;
  enviarEndereco(endereco: Endereco): Promise<ResultadoRemoto>;
  excluirEndereco(id: UUIDv4): Promise<ResultadoRemoto>;
  enviarPadrao(padrao: PadraoCemig): Promise<ResultadoRemoto>;
  excluirPadrao(id: UUIDv4): Promise<ResultadoRemoto>;
  /** Perfil e vínculos de endereço, juntos. */
  enviarUsuario(usuario: Usuario): Promise<ResultadoRemoto>;
  excluirUsuario(id: UUIDv4): Promise<ResultadoRemoto>;

  /** Só devolve o que o usuário autenticado pode ver — quem filtra é o servidor. */
  baixarAlteracoes(cursores: CursoresDePull): Promise<ResultadoRemoto<PacoteDeAlteracoes>>;

  /** Endereço temporário para exibir um comprovante do bucket privado. */
  urlAssinadaDaFoto(fotoPath: string): Promise<ResultadoRemoto<string>>;
}
