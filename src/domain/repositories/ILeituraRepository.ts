import { Leitura } from '../entities/Leitura';
import { UUIDv4 } from '../value-objects/UUIDv4';
import { StatusSyncEnum } from '../enums/StatusSyncEnum';

export interface ILeituraRepository {
  salvar(leitura: Leitura): Promise<void>;
  buscarPorId(id: UUIDv4): Promise<Leitura | null>;
  listarPorUsina(usinaId: UUIDv4): Promise<Leitura[]>;
  atualizarStatus(id: UUIDv4, statusSync: StatusSyncEnum, urlRemota?: string): Promise<void>;
}
