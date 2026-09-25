import { Usina } from '../entities/Usina';
import { UUIDv4 } from '../value-objects/UUIDv4';

export interface IUsinaRepository {
  salvar(usina: Usina): Promise<void>;
  buscarPorId(id: UUIDv4): Promise<Usina | null>;
  listarPorEmpresa(empresaId: UUIDv4): Promise<Usina[]>;
  atualizar(usina: Usina): Promise<void>;
}
