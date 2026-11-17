import type { SQLiteDatabase } from 'expo-sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Container, montarCasos } from './Container';
import { IRelogio, relogioSistema } from '@/domain/services/Relogio';
import {
  UnidadeDeTrabalhoSQLite,
  criarRepositoriosCrus,
} from '../database/sqlite/UnidadeDeTrabalhoSQLite';
import { DiagnosticoLocalSQLite } from '../database/sqlite/DiagnosticoLocalSQLite';
import { CameraGatewayExpo } from '../hardware/camera/CameraGatewayExpo';
import { LocationGatewayExpo } from '../hardware/location/LocationGatewayExpo';
import { ArquivoFotoGatewayExpo } from '../hardware/midia/ArquivoFotoGatewayExpo';
import { lerArquivoDoAparelho } from '../hardware/midia/lerArquivoDoAparelho';
import { SessionStorageSecureStore } from '../adapters/SessionStorageSecureStore';
import { CofreSeguroEmPartes } from '../adapters/CofreSeguroEmPartes';
import { ConfiguracaoSupabase, lerConfiguracaoSupabase } from '../config/ambiente';
import { acompanharPrimeiroPlano, criarClienteSupabase } from '../supabase/clienteSupabase';
import { AutenticacaoSupabase } from '../supabase/AutenticacaoSupabase';
import { SincronizacaoSupabase } from '../supabase/SincronizacaoSupabase';
import { ConectividadeNetInfo } from '../network/ConectividadeNetInfo';

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

/**
 * Um cliente do Supabase por app. Dois clientes sobre o mesmo cofre
 * disputariam a renovação do token e um invalidaria a sessão do outro.
 */
let clienteUnico: { chave: string; cliente: SupabaseClient } | null = null;

function clienteSupabase(configuracao: ConfiguracaoSupabase): SupabaseClient {
  const chave = `${configuracao.url}|${configuracao.chaveAnonima}`;

  if (clienteUnico?.chave !== chave) {
    const cliente = criarClienteSupabase(configuracao, new CofreSeguroEmPartes());
    acompanharPrimeiroPlano(cliente);
    clienteUnico = { chave, cliente };
  }

  return clienteUnico.cliente;
}

/**
 * Lança `ConfiguracaoAusenteError` quando as variáveis do Supabase faltam: o
 * app para na tela de erro, com a explicação, em vez de subir com um cliente
 * de mentira.
 */
export function criarContainerSQLite(
  db: SQLiteDatabase,
  relogio: IRelogio = relogioSistema,
  nomeDoBanco = 'equinox.db',
  configuracao: ConfiguracaoSupabase = lerConfiguracaoSupabase(),
): ContainerSQLite {
  const supabase = clienteSupabase(configuracao);
  const camera = new CameraGatewayExpo();

  const gateways: Container['gateways'] = {
    camera,
    location: new LocationGatewayExpo(),
    arquivoFoto: new ArquivoFotoGatewayExpo(),
    sessao: new SessionStorageSecureStore(),
    diagnostico: new DiagnosticoLocalSQLite(db, nomeDoBanco),
    autenticacaoRemota: new AutenticacaoSupabase(supabase),
    sincronizacaoRemota: new SincronizacaoSupabase(supabase, lerArquivoDoAparelho),
    conectividade: new ConectividadeNetInfo(),
  };

  const unidadeDeTrabalho = new UnidadeDeTrabalhoSQLite(db);

  return {
    ...montarCasos(criarRepositoriosCrus(db), unidadeDeTrabalho, gateways, relogio),
    unidadeDeTrabalho,
    gateways,
    relogio,
    cameraGatewayExpo: camera,
  };
}
