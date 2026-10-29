import { PadraoCemig } from '../entities/PadraoCemig';
import { UUIDv4 } from '../value-objects/UUIDv4';

export interface IPadraoRepository {
  salvar(padrao: PadraoCemig): Promise<void>;
  atualizar(padrao: PadraoCemig): Promise<void>;
  buscarPorId(id: UUIDv4): Promise<PadraoCemig | null>;
  listarPorEndereco(enderecoId: UUIDv4): Promise<PadraoCemig[]>;

  /** Em lote, para montar o catálogo do técnico sem N consultas. */
  listarPorEnderecos(enderecoIds: UUIDv4[]): Promise<PadraoCemig[]>;

  excluir(id: UUIDv4): Promise<void>;
}
