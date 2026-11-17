import { Leitura } from '../entities/Leitura';
import { UUIDv4 } from '../value-objects/UUIDv4';
import { DataLocal } from '../value-objects/DataLocal';

export interface ILeituraRepository {
  salvar(leitura: Leitura): Promise<void>;
  atualizar(leitura: Leitura): Promise<void>;
  buscarPorId(id: UUIDv4): Promise<Leitura | null>;

  /**
   * Grava a nova leitura e marca a vigente como substituída numa só transação.
   *
   * A ordem importa: o índice parcial único de (padrão, dia local) só admite
   * uma leitura vigente, então a antiga tem de sair de vigente ANTES de a nova
   * entrar. Separar em duas chamadas faria o insert falhar sempre.
   */
  salvarSubstituindo(nova: Leitura, vigente: Leitura): Promise<void>;

  /** A leitura que ocupa a vaga do dia, se houver. */
  buscarVigenteDoDia(padraoId: UUIDv4, dataLocal: DataLocal): Promise<Leitura | null>;

  /**
   * Só as leituras que ainda valem. A referência de valor menor usa esta lista:
   * incluir as substituídas elegeria como referência um valor que já foi
   * corrigido.
   */
  listarVigentesDoPadrao(padraoId: UUIDv4): Promise<Leitura[]>;

  listarDoPadrao(padraoId: UUIDv4): Promise<Leitura[]>;
  listarPorUsuario(usuarioId: UUIDv4, limite?: number): Promise<Leitura[]>;

  /** Leituras ainda sem decisão com dia local anterior ao informado. */
  listarRegistradasAntesDe(dataLocal: DataLocal): Promise<Leitura[]>;

  /**
   * Aplica uma leitura vinda da nuvem (pull): insere ou atualiza pelo id e
   * resolve a vaga do dia — se outra leitura local ocupa a mesma vaga, ela
   * sai de vigente antes de a remota entrar. Preserva a foto que já estiver
   * no aparelho.
   */
  aplicarRemota(leitura: Leitura): Promise<void>;

  /**
   * Expurgo: remove leituras já decididas mais antigas que o corte e devolve
   * as removidas, para quem chamou poder apagar as fotos correspondentes.
   * Leitura ainda sem decisão nunca é removida — nem a que ainda não subiu
   * para a nuvem, porque o aparelho é o único lugar onde ela existe.
   */
  excluirDecididasAntesDe(dataLocal: DataLocal): Promise<Leitura[]>;

  /**
   * Apaga uma leitura do aparelho, com os avisos ligados a ela, e devolve a
   * removida (ou nulo, se não existia). Só o descarte de um envio impossível
   * usa isto — ver `ConsultarEstadoSincronizacaoUseCase.descartar`.
   */
  excluir(id: UUIDv4): Promise<Leitura | null>;
}
