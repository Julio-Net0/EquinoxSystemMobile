import { Empresa } from '../entities/Empresa';
import { UUIDv4 } from '../value-objects/UUIDv4';

export interface IEmpresaRepository {
  salvar(empresa: Empresa): Promise<void>;
  buscarPorId(id: UUIDv4): Promise<Empresa | null>;
  listarTodas(): Promise<Empresa[]>;
}
