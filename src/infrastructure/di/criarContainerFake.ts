import { Container, montarCasos } from './Container';
import { IRelogio, relogioFixo } from '@/domain/services/Relogio';
import { RepositoriosDaTransacao } from '@/domain/repositories/IUnidadeDeTrabalho';
import { EmpresaRepositoryMemory } from '../fakes/EmpresaRepositoryMemory';
import { EnderecoRepositoryMemory } from '../fakes/EnderecoRepositoryMemory';
import { PadraoRepositoryMemory } from '../fakes/PadraoRepositoryMemory';
import { LeituraRepositoryMemory } from '../fakes/LeituraRepositoryMemory';
import { UsuarioRepositoryMemory } from '../fakes/UsuarioRepositoryMemory';
import { NotificacaoRepositoryMemory } from '../fakes/NotificacaoRepositoryMemory';
import { ActionQueueRepositoryMemory } from '../fakes/ActionQueueRepositoryMemory';
import { SyncMetaRepositoryMemory } from '../fakes/SyncMetaRepositoryMemory';
import { UnidadeDeTrabalhoMemory } from '../fakes/UnidadeDeTrabalhoMemory';
import { CameraGatewayFake } from '../fakes/CameraGatewayFake';
import { LocationGatewayFake } from '../fakes/LocationGatewayFake';
import { ArquivoFotoGatewayFake } from '../fakes/ArquivoFotoGatewayFake';
import { SessionStorageMemory } from '../fakes/SessionStorageMemory';
import { DiagnosticoLocalFake } from '../fakes/DiagnosticoLocalFake';
import { AutenticacaoRemotaFake } from '../fakes/AutenticacaoRemotaFake';
import { SincronizacaoRemotaFake } from '../fakes/SincronizacaoRemotaFake';
import { ConectividadeFake } from '../fakes/ConectividadeFake';
import { CredencialOfflineMemory } from '../fakes/CredencialOfflineMemory';
import { DadosLocaisMemory } from '../fakes/DadosLocaisMemory';
import { HashSenhaFake } from '../fakes/HashSenhaFake';
import { ReautenticacaoEmMemoria } from '../security/ReautenticacaoEmMemoria';

/** Instante fixo padrão dos testes: 10/03/2026, 12:00 em Brasília. */
export const AGORA_FIXO = new Date(Date.UTC(2026, 2, 10, 15));

/**
 * Container de teste, com os dublês em memória. Expõe as implementações
 * concretas para o teste poder preparar estado e inspecionar resultado.
 *
 * Monta exatamente o mesmo grafo de casos de uso que a versão SQLite, via
 * `montarCasos` — é isso que impede o teste de passar num grafo que a produção
 * não usa. Inclusive a fila: os casos de uso daqui também recebem os
 * repositórios que enfileiram, então `fakes.actionQueue` mostra o que subiria.
 */
export interface ContainerFake extends Container {
  fakes: {
    empresa: EmpresaRepositoryMemory;
    endereco: EnderecoRepositoryMemory;
    padrao: PadraoRepositoryMemory;
    leitura: LeituraRepositoryMemory;
    usuario: UsuarioRepositoryMemory;
    notificacao: NotificacaoRepositoryMemory;
    actionQueue: ActionQueueRepositoryMemory;
    syncMeta: SyncMetaRepositoryMemory;
    camera: CameraGatewayFake;
    location: LocationGatewayFake;
    arquivoFoto: ArquivoFotoGatewayFake;
    sessao: SessionStorageMemory;
    diagnostico: DiagnosticoLocalFake;
    autenticacaoRemota: AutenticacaoRemotaFake;
    sincronizacaoRemota: SincronizacaoRemotaFake;
    conectividade: ConectividadeFake;
    credenciaisOffline: CredencialOfflineMemory;
    reautenticacao: ReautenticacaoEmMemoria;
  };
}

export function criarContainerFake(relogio: IRelogio = relogioFixo(AGORA_FIXO)): ContainerFake {
  const fakes: ContainerFake['fakes'] = {
    empresa: new EmpresaRepositoryMemory(),
    endereco: new EnderecoRepositoryMemory(),
    padrao: new PadraoRepositoryMemory(),
    leitura: new LeituraRepositoryMemory(),
    usuario: new UsuarioRepositoryMemory(),
    notificacao: new NotificacaoRepositoryMemory(),
    actionQueue: new ActionQueueRepositoryMemory(),
    syncMeta: new SyncMetaRepositoryMemory(),
    camera: new CameraGatewayFake(),
    location: new LocationGatewayFake(),
    arquivoFoto: new ArquivoFotoGatewayFake(),
    sessao: new SessionStorageMemory(),
    diagnostico: new DiagnosticoLocalFake(),
    autenticacaoRemota: new AutenticacaoRemotaFake(),
    sincronizacaoRemota: new SincronizacaoRemotaFake(),
    conectividade: new ConectividadeFake(),
    credenciaisOffline: new CredencialOfflineMemory(),
    reautenticacao: new ReautenticacaoEmMemoria(),
  };

  const crus: RepositoriosDaTransacao = {
    empresa: fakes.empresa,
    endereco: fakes.endereco,
    padrao: fakes.padrao,
    leitura: fakes.leitura,
    usuario: fakes.usuario,
    notificacao: fakes.notificacao,
    actionQueue: fakes.actionQueue,
    syncMeta: fakes.syncMeta,
  };

  const gateways: Container['gateways'] = {
    camera: fakes.camera,
    location: fakes.location,
    arquivoFoto: fakes.arquivoFoto,
    sessao: fakes.sessao,
    diagnostico: fakes.diagnostico,
    autenticacaoRemota: fakes.autenticacaoRemota,
    sincronizacaoRemota: fakes.sincronizacaoRemota,
    conectividade: fakes.conectividade,
    credenciaisOffline: fakes.credenciaisOffline,
    hashSenha: new HashSenhaFake(),
    reautenticacao: fakes.reautenticacao,
    dadosLocais: new DadosLocaisMemory(fakes),
  };

  const unidadeDeTrabalho = new UnidadeDeTrabalhoMemory(crus);

  return {
    ...montarCasos(crus, unidadeDeTrabalho, gateways, relogio),
    unidadeDeTrabalho,
    gateways,
    relogio,
    fakes,
  };
}
