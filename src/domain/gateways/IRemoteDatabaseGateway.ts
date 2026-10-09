import { Leitura } from '../entities/Leitura';
import { Usina } from '../entities/Usina';
import { Usuario } from '../entities/Usuario';
import { Empresa } from '../entities/Empresa';

export interface IRemoteDatabaseGateway {
  enviarLeitura(leitura: Leitura): Promise<boolean>;
  enviarUsina(usina: Usina): Promise<boolean>;
  enviarUsuario(usuario: Usuario): Promise<boolean>;
  enviarEmpresa(empresa: Empresa): Promise<boolean>;
  buscarNovasLeituras(empresaId: string, desde: Date): Promise<Leitura[]>;
  buscarNovasUsinas(empresaId: string, desde: Date): Promise<Usina[]>;
}
