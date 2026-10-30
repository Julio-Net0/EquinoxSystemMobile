import type { SQLiteDatabase } from 'expo-sqlite';
import { Container, montarCasos } from './Container';
import { IRelogio, relogioSistema } from '@/domain/services/Relogio';
import { EmpresaRepositorySQLite } from '../database/sqlite/repositories/EmpresaRepositorySQLite';
import { EnderecoRepositorySQLite } from '../database/sqlite/repositories/EnderecoRepositorySQLite';
import { PadraoRepositorySQLite } from '../database/sqlite/repositories/PadraoRepositorySQLite';
import { LeituraRepositorySQLite } from '../database/sqlite/repositories/LeituraRepositorySQLite';
import { UsuarioRepositorySQLite } from '../database/sqlite/repositories/UsuarioRepositorySQLite';
import { NotificacaoRepositorySQLite } from '../database/sqlite/repositories/NotificacaoRepositorySQLite';
import { ActionQueueRepositorySQLite } from '../database/sqlite/repositories/ActionQueueRepositorySQLite';
import { CameraGatewayExpo } from '../hardware/camera/CameraGatewayExpo';
import { LocationGatewayExpo } from '../hardware/location/LocationGatewayExpo';
import { ArquivoFotoGatewayExpo } from '../hardware/midia/ArquivoFotoGatewayExpo';
import { HashSenhaExpoCrypto } from '../security/HashSenhaExpoCrypto';
import { SessionStorageSecureStore } from '../adapters/SessionStorageSecureStore';
import { DiagnosticoLocalSQLite } from '../database/sqlite/DiagnosticoLocalSQLite';

/**
 * Montagem de produção. Síncrona de propósito: nada aqui faz I/O, só liga
 * objetos. O banco chega já aberto e migrado pelo SQLiteProvider.
 *
 * Expõe também o `cameraGatewayExpo` concreto, porque o componente de captura
 * precisa registrar o capturador nele — a interface do domínio não tem esse
 * método.
 */
export interface ContainerSQLite extends Container {
  cameraGatewayExpo: CameraGatewayExpo;
}

export function criarContainerSQLite(
  db: SQLiteDatabase,
  relogio: IRelogio = relogioSistema,
  nomeDoBanco = 'equinox.db',
): ContainerSQLite {
  const repos: Container['repos'] = {
    empresa: new EmpresaRepositorySQLite(db),
    endereco: new EnderecoRepositorySQLite(db),
    padrao: new PadraoRepositorySQLite(db),
    leitura: new LeituraRepositorySQLite(db),
    usuario: new UsuarioRepositorySQLite(db),
    notificacao: new NotificacaoRepositorySQLite(db),
    actionQueue: new ActionQueueRepositorySQLite(db),
  };

  const camera = new CameraGatewayExpo();

  const gateways: Container['gateways'] = {
    camera,
    location: new LocationGatewayExpo(),
    arquivoFoto: new ArquivoFotoGatewayExpo(),
    hashSenha: new HashSenhaExpoCrypto(),
    sessao: new SessionStorageSecureStore(),
    diagnostico: new DiagnosticoLocalSQLite(db, nomeDoBanco),
  };

  return {
    repos,
    gateways,
    relogio,
    casos: montarCasos(repos, gateways, relogio),
    cameraGatewayExpo: camera,
  };
}
