import { Notificacao } from '../entities/Notificacao';
import { UUIDv4 } from '../value-objects/UUIDv4';

export interface ListarNotificacoesFiltro {
  /** Nulo lista as globais junto com todas: é o escopo do super admin. */
  empresaId: UUIDv4 | null;
  /**
   * Janela em offset/limite, não em página. A camada de aplicação pede um item
   * além da página para saber se existe próxima, e derivar o offset do tamanho
   * inflado pularia registros.
   */
  offset: number;
  limite: number;
}

export interface INotificacaoRepository {
  salvar(notificacao: Notificacao): Promise<void>;
  salvarVarias(notificacoes: Notificacao[]): Promise<void>;
  atualizar(notificacao: Notificacao): Promise<void>;
  buscarPorId(id: UUIDv4): Promise<Notificacao | null>;

  /** Mais recentes primeiro, paginado como no app antigo (30 por página). */
  listar(filtro: ListarNotificacoesFiltro): Promise<Notificacao[]>;

  contarNaoLidas(empresaId: UUIDv4 | null): Promise<number>;
  marcarTodasLidas(empresaId: UUIDv4 | null): Promise<void>;
  buscarPorLeitura(leituraId: UUIDv4): Promise<Notificacao[]>;
  excluir(id: UUIDv4): Promise<void>;
}
