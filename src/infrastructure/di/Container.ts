import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { IDadosLocaisRepository } from '@/domain/repositories/IDadosLocaisRepository';
import { ISyncMetaRepository } from '@/domain/repositories/ISyncMetaRepository';
import {
  IUnidadeDeTrabalho,
  RepositoriosDaTransacao,
} from '@/domain/repositories/IUnidadeDeTrabalho';
import { ICameraGateway } from '@/domain/gateways/ICameraGateway';
import { ILocationGateway } from '@/domain/gateways/ILocationGateway';
import { IArquivoFotoGateway } from '@/domain/gateways/IArquivoFotoGateway';
import { ISessionStorage } from '@/domain/gateways/ISessionStorage';
import { IDiagnosticoLocalGateway } from '@/domain/gateways/IDiagnosticoLocalGateway';
import { IAutenticacaoRemotaGateway } from '@/domain/gateways/IAutenticacaoRemotaGateway';
import { ISincronizacaoRemotaGateway } from '@/domain/gateways/ISincronizacaoRemotaGateway';
import { IConectividadeGateway } from '@/domain/gateways/IConectividadeGateway';
import { ICredencialOfflineGateway } from '@/domain/gateways/ICredencialOfflineGateway';
import { IHashSenhaGateway } from '@/domain/gateways/IHashSenhaGateway';
import { IReautenticacaoPendente } from '@/domain/gateways/IReautenticacaoPendente';
import { AcessoOfflineService } from '@/domain/services/AcessoOfflineService';
import { TrocaDeUsuarioService } from '@/domain/services/TrocaDeUsuarioService';
import { IRelogio } from '@/domain/services/Relogio';
import { AutenticarUsuarioUseCase } from '@/application/use-cases/AutenticarUsuarioUseCase';
import { EncerrarSessaoUseCase } from '@/application/use-cases/EncerrarSessaoUseCase';
import { CadastrarUsuarioPendenteUseCase } from '@/application/use-cases/CadastrarUsuarioPendenteUseCase';
import { AutorizarUsuarioUseCase } from '@/application/use-cases/AutorizarUsuarioUseCase';
import { GerenciarUsuariosEmpresaUseCase } from '@/application/use-cases/GerenciarUsuariosEmpresaUseCase';
import { GerenciarEmpresasUseCase } from '@/application/use-cases/GerenciarEmpresasUseCase';
import { GerenciarEstruturaUseCase } from '@/application/use-cases/GerenciarEstruturaUseCase';
import { GerenciarPerfilUseCase } from '@/application/use-cases/GerenciarPerfilUseCase';
import { ConsultarCatalogoUseCase } from '@/application/use-cases/ConsultarCatalogoUseCase';
import { RegistrarLeituraUseCase } from '@/application/use-cases/RegistrarLeituraUseCase';
import { DecidirLeituraUseCase } from '@/application/use-cases/DecidirLeituraUseCase';
import { GerenciarNotificacoesUseCase } from '@/application/use-cases/GerenciarNotificacoesUseCase';
import { AvaliarLeiturasAtrasadasUseCase } from '@/application/use-cases/AvaliarLeiturasAtrasadasUseCase';
import { PurgarLeiturasAntigasUseCase } from '@/application/use-cases/PurgarLeiturasAntigasUseCase';
import { ConsultarDiagnosticoUseCase } from '@/application/use-cases/ConsultarDiagnosticoUseCase';
import { ConsultarLeiturasDiaUsinaUseCase } from '@/application/use-cases/ConsultarLeiturasDiaUsinaUseCase';
import { ProcessarFilaSincronizacaoUseCase } from '@/application/use-cases/ProcessarFilaSincronizacaoUseCase';
import { BaixarAlteracoesUseCase } from '@/application/use-cases/BaixarAlteracoesUseCase';
import { SincronizarUseCase } from '@/application/use-cases/SincronizarUseCase';
import { ConsultarEstadoSincronizacaoUseCase } from '@/application/use-cases/ConsultarEstadoSincronizacaoUseCase';
import { ObterFotoDaLeituraUseCase } from '@/application/use-cases/ObterFotoDaLeituraUseCase';
import { RepositoriosComFila, repositoriosComFila } from '../sync/repositoriosComFila';

/**
 * Grafo de dependências do app, montado uma única vez.
 *
 * Existe para resolver um problema concreto da versão anterior: cada tela
 * instanciava os próprios repositórios no escopo do módulo, então cada uma
 * tinha um armazenamento isolado — um usuário cadastrado em /cadastro nunca
 * aparecia em /admin/autorizacoes.
 *
 * Nenhuma tela instancia repositório ou caso de uso: todas pedem ao container.
 */
export interface Container {
  /**
   * Os repositórios que os casos de uso de negócio recebem. São os "com
   * fila": toda escrita por eles deixa um item de envio na `action_queue`, na
   * mesma transação.
   */
  repos: RepositoriosComFila & {
    actionQueue: IActionQueueRepository;
    syncMeta: ISyncMetaRepository;
  };

  unidadeDeTrabalho: IUnidadeDeTrabalho;

  /**
   * Avisa quando uma escrita local entrou na fila de envio. A interface usa
   * para atualizar a contagem de pendentes e tentar sincronizar em seguida.
   * Devolve a função que cancela a inscrição.
   */
  observarFila(ouvinte: () => void): () => void;

  gateways: {
    camera: ICameraGateway;
    location: ILocationGateway;
    arquivoFoto: IArquivoFotoGateway;
    sessao: ISessionStorage;
    diagnostico: IDiagnosticoLocalGateway;
    autenticacaoRemota: IAutenticacaoRemotaGateway;
    sincronizacaoRemota: ISincronizacaoRemotaGateway;
    conectividade: IConectividadeGateway;
    /** Acesso offline (ADR 10.18): verificações de senha, hash e senha em memória. */
    credenciaisOffline: ICredencialOfflineGateway;
    hashSenha: IHashSenhaGateway;
    reautenticacao: IReautenticacaoPendente;
    /** Limpeza dos dados locais na troca de usuário (ADR 10.19). */
    dadosLocais: IDadosLocaisRepository;
  };

  relogio: IRelogio;

  casos: {
    autenticar: AutenticarUsuarioUseCase;
    encerrarSessao: EncerrarSessaoUseCase;
    cadastrarPendente: CadastrarUsuarioPendenteUseCase;
    autorizar: AutorizarUsuarioUseCase;
    gerenciarUsuarios: GerenciarUsuariosEmpresaUseCase;
    gerenciarEmpresas: GerenciarEmpresasUseCase;
    gerenciarEstrutura: GerenciarEstruturaUseCase;
    perfil: GerenciarPerfilUseCase;
    consultarCatalogo: ConsultarCatalogoUseCase;
    registrarLeitura: RegistrarLeituraUseCase;
    decidirLeitura: DecidirLeituraUseCase;
    notificacoes: GerenciarNotificacoesUseCase;
    avaliarAtrasadas: AvaliarLeiturasAtrasadasUseCase;
    purgar: PurgarLeiturasAntigasUseCase;
    diagnostico: ConsultarDiagnosticoUseCase;
    consultarLeiturasUsina: ConsultarLeiturasDiaUsinaUseCase;
    processarFila: ProcessarFilaSincronizacaoUseCase;
    baixarAlteracoes: BaixarAlteracoesUseCase;
    sincronizar: SincronizarUseCase;
    estadoSincronizacao: ConsultarEstadoSincronizacaoUseCase;
    fotoDaLeitura: ObterFotoDaLeituraUseCase;
  };
}

type Gateways = Container['gateways'];

/**
 * Monta os repositórios com fila e os casos de uso a partir dos repositórios
 * crus e dos gateways. Compartilhada entre a montagem real (SQLite) e a de
 * teste (dublês em memória), para as duas ligarem exatamente o mesmo grafo.
 *
 * Há dois jogos de repositórios, e a diferença é o coração da sincronização:
 *
 * - os casos de uso de **negócio** recebem os repositórios **com fila**, e
 *   assim tudo o que o usuário faz no aparelho é enfileirado para a nuvem;
 * - os casos de uso de **sincronização** recebem os **crus**, porque o que
 *   veio da nuvem (ou a confirmação de um envio) não pode voltar para a fila.
 */
export function montarCasos(
  crus: RepositoriosDaTransacao,
  unidadeDeTrabalho: IUnidadeDeTrabalho,
  gateways: Gateways,
  relogio: IRelogio,
): Pick<Container, 'repos' | 'casos' | 'observarFila'> {
  const ouvintesDaFila = new Set<() => void>();
  const observarFila = (ouvinte: () => void): (() => void) => {
    ouvintesDaFila.add(ouvinte);
    return () => {
      ouvintesDaFila.delete(ouvinte);
    };
  };

  const donoAtual = async () => (await gateways.sessao.obterSessao())?.usuarioId ?? null;
  const comFila = repositoriosComFila(
    crus,
    unidadeDeTrabalho,
    relogio,
    () => {
      ouvintesDaFila.forEach((ouvinte) => ouvinte());
    },
    donoAtual,
  );
  const repos: Container['repos'] = {
    ...comFila,
    actionQueue: crus.actionQueue,
    syncMeta: crus.syncMeta,
  };

  const processarFila = new ProcessarFilaSincronizacaoUseCase(
    crus.actionQueue,
    crus,
    gateways.sincronizacaoRemota,
    gateways.arquivoFoto,
  );
  const baixarAlteracoes = new BaixarAlteracoesUseCase(
    gateways.sincronizacaoRemota,
    unidadeDeTrabalho,
    crus.syncMeta,
  );

  const acessoOffline = new AcessoOfflineService(
    gateways.credenciaisOffline,
    gateways.hashSenha,
    gateways.reautenticacao,
  );
  const trocaDeUsuario = new TrocaDeUsuarioService(
    crus.syncMeta,
    crus.actionQueue,
    gateways.dadosLocais,
    gateways.arquivoFoto,
  );

  const casos: Container['casos'] = {
    autenticar: new AutenticarUsuarioUseCase(
      gateways.autenticacaoRemota,
      gateways.sessao,
      acessoOffline,
      trocaDeUsuario,
    ),
    encerrarSessao: new EncerrarSessaoUseCase(
      gateways.autenticacaoRemota,
      gateways.sessao,
      crus.actionQueue,
      acessoOffline,
    ),
    cadastrarPendente: new CadastrarUsuarioPendenteUseCase(gateways.autenticacaoRemota),
    autorizar: new AutorizarUsuarioUseCase(repos.usuario, repos.endereco, relogio),
    gerenciarUsuarios: new GerenciarUsuariosEmpresaUseCase(
      repos.usuario,
      repos.endereco,
      relogio,
    ),
    gerenciarEmpresas: new GerenciarEmpresasUseCase(repos.empresa, repos.usuario),
    gerenciarEstrutura: new GerenciarEstruturaUseCase(
      repos.endereco,
      repos.padrao,
      repos.usuario,
    ),
    perfil: new GerenciarPerfilUseCase(
      repos.usuario,
      gateways.sessao,
      gateways.autenticacaoRemota,
      acessoOffline,
    ),
    consultarCatalogo: new ConsultarCatalogoUseCase(repos.endereco, repos.padrao, repos.leitura),
    registrarLeitura: new RegistrarLeituraUseCase(
      repos.leitura,
      repos.padrao,
      repos.endereco,
      repos.notificacao,
      repos.usuario,
      gateways.arquivoFoto,
      relogio,
    ),
    decidirLeitura: new DecidirLeituraUseCase(
      repos.notificacao,
      repos.leitura,
      repos.usuario,
      relogio,
    ),
    notificacoes: new GerenciarNotificacoesUseCase(repos.notificacao, repos.usuario),
    avaliarAtrasadas: new AvaliarLeiturasAtrasadasUseCase(
      repos.leitura,
      repos.padrao,
      repos.endereco,
      repos.notificacao,
      repos.usuario,
      relogio,
    ),
    // Expurgo é limpeza do aparelho, não alteração de negócio: usa o cru e
    // não enfileira nada.
    purgar: new PurgarLeiturasAntigasUseCase(crus.leitura, gateways.arquivoFoto, relogio),
    diagnostico: new ConsultarDiagnosticoUseCase(
      gateways.diagnostico,
      repos.leitura,
      gateways.arquivoFoto,
    ),
    consultarLeiturasUsina: new ConsultarLeiturasDiaUsinaUseCase(
      repos.endereco,
      repos.padrao,
      repos.leitura,
      repos.usuario,
      repos.empresa,
      relogio,
    ),
    processarFila,
    baixarAlteracoes,
    sincronizar: new SincronizarUseCase(
      gateways.conectividade,
      gateways.autenticacaoRemota,
      gateways.sessao,
      processarFila,
      baixarAlteracoes,
      crus.usuario,
      crus.syncMeta,
      acessoOffline,
      relogio,
    ),
    estadoSincronizacao: new ConsultarEstadoSincronizacaoUseCase(
      crus.actionQueue,
      crus.syncMeta,
      crus.leitura,
      gateways.arquivoFoto,
      gateways.sessao,
    ),
    fotoDaLeitura: new ObterFotoDaLeituraUseCase(
      crus.leitura,
      gateways.arquivoFoto,
      gateways.sincronizacaoRemota,
    ),
  };

  return { repos, casos, observarFila };
}
