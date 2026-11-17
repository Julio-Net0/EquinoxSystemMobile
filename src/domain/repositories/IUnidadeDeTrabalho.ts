import { IEmpresaRepository } from './IEmpresaRepository';
import { IEnderecoRepository } from './IEnderecoRepository';
import { IPadraoRepository } from './IPadraoRepository';
import { ILeituraRepository } from './ILeituraRepository';
import { IUsuarioRepository } from './IUsuarioRepository';
import { INotificacaoRepository } from './INotificacaoRepository';
import { IActionQueueRepository } from './IActionQueueRepository';
import { ISyncMetaRepository } from './ISyncMetaRepository';

/**
 * Repositórios ligados à transação corrente. São os "crus": gravam no banco
 * local e nada mais — quem enfileira é quem abriu a transação.
 */
export interface RepositoriosDaTransacao {
  empresa: IEmpresaRepository;
  endereco: IEnderecoRepository;
  padrao: IPadraoRepository;
  leitura: ILeituraRepository;
  usuario: IUsuarioRepository;
  notificacao: INotificacaoRepository;
  actionQueue: IActionQueueRepository;
  syncMeta: ISyncMetaRepository;
}

/**
 * Executa um conjunto de escritas como uma coisa só: ou todas acontecem, ou
 * nenhuma.
 *
 * É o que torna a gravação de um registro e o enfileiramento do envio dele
 * atômicos. Sem isso uma falha entre as duas escritas deixaria uma leitura
 * salva que nunca sobe, ou um item de fila apontando para o nada.
 *
 * A tarefa deve usar só os repositórios que recebe: dentro de uma transação
 * exclusiva do SQLite, falar com a conexão de fora trava o banco.
 */
export interface IUnidadeDeTrabalho {
  executar<T>(tarefa: (repos: RepositoriosDaTransacao) => Promise<T>): Promise<T>;
}
