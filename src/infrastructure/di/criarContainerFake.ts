import { Container, montarCasos } from './Container';
import { IRelogio, relogioFixo } from '@/domain/services/Relogio';
import { EmpresaRepositoryMemory } from '../fakes/EmpresaRepositoryMemory';
import { EnderecoRepositoryMemory } from '../fakes/EnderecoRepositoryMemory';
import { PadraoRepositoryMemory } from '../fakes/PadraoRepositoryMemory';
import { LeituraRepositoryMemory } from '../fakes/LeituraRepositoryMemory';
import { UsuarioRepositoryMemory } from '../fakes/UsuarioRepositoryMemory';
import { NotificacaoRepositoryMemory } from '../fakes/NotificacaoRepositoryMemory';
import { ActionQueueRepositoryMemory } from '../fakes/ActionQueueRepositoryMemory';
import { CameraGatewayFake } from '../fakes/CameraGatewayFake';
import { LocationGatewayFake } from '../fakes/LocationGatewayFake';
import { ArquivoFotoGatewayFake } from '../fakes/ArquivoFotoGatewayFake';
import { HashSenhaFake } from '../fakes/HashSenhaFake';
import { SessionStorageMemory } from '../fakes/SessionStorageMemory';

/** Instante fixo padrão dos testes: 10/03/2026, 12:00 em Brasília. */
export const AGORA_FIXO = new Date(Date.UTC(2026, 2, 10, 15));

/**
 * Container de teste, com os dublês em memória. Expõe as implementações
 * concretas para o teste poder preparar estado e inspecionar resultado.
 *
 * Monta exatamente o mesmo grafo de casos de uso que a versão SQLite, via
 * `montarCasos` — é isso que impede o teste de passar num grafo que a produção
 * não usa.
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
    camera: CameraGatewayFake;
    location: LocationGatewayFake;
    arquivoFoto: ArquivoFotoGatewayFake;
    hashSenha: HashSenhaFake;
    sessao: SessionStorageMemory;
  };
}

export function criarContainerFake(relogio: IRelogio = relogioFixo(AGORA_FIXO)): ContainerFake {
  const fakes = {
    empresa: new EmpresaRepositoryMemory(),
    endereco: new EnderecoRepositoryMemory(),
    padrao: new PadraoRepositoryMemory(),
    leitura: new LeituraRepositoryMemory(),
    usuario: new UsuarioRepositoryMemory(),
    notificacao: new NotificacaoRepositoryMemory(),
    actionQueue: new ActionQueueRepositoryMemory(),
    camera: new CameraGatewayFake(),
    location: new LocationGatewayFake(),
    arquivoFoto: new ArquivoFotoGatewayFake(),
    hashSenha: new HashSenhaFake(),
    sessao: new SessionStorageMemory(),
  };

  const repos: Container['repos'] = {
    empresa: fakes.empresa,
    endereco: fakes.endereco,
    padrao: fakes.padrao,
    leitura: fakes.leitura,
    usuario: fakes.usuario,
    notificacao: fakes.notificacao,
    actionQueue: fakes.actionQueue,
  };

  const gateways: Container['gateways'] = {
    camera: fakes.camera,
    location: fakes.location,
    arquivoFoto: fakes.arquivoFoto,
    hashSenha: fakes.hashSenha,
    sessao: fakes.sessao,
  };

  return {
    repos,
    gateways,
    relogio,
    casos: montarCasos(repos, gateways, relogio),
    fakes,
  };
}
