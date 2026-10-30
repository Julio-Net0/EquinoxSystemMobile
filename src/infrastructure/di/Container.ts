import { IEmpresaRepository } from '@/domain/repositories/IEmpresaRepository';
import { IEnderecoRepository } from '@/domain/repositories/IEnderecoRepository';
import { IPadraoRepository } from '@/domain/repositories/IPadraoRepository';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { INotificacaoRepository } from '@/domain/repositories/INotificacaoRepository';
import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { ICameraGateway } from '@/domain/gateways/ICameraGateway';
import { ILocationGateway } from '@/domain/gateways/ILocationGateway';
import { IArquivoFotoGateway } from '@/domain/gateways/IArquivoFotoGateway';
import { IHashSenhaGateway } from '@/domain/gateways/IHashSenhaGateway';
import { ISessionStorage } from '@/domain/gateways/ISessionStorage';
import { IDiagnosticoLocalGateway } from '@/domain/gateways/IDiagnosticoLocalGateway';
import { IRelogio } from '@/domain/services/Relogio';
import { AutenticarUsuarioUseCase } from '@/application/use-cases/AutenticarUsuarioUseCase';
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
  repos: {
    empresa: IEmpresaRepository;
    endereco: IEnderecoRepository;
    padrao: IPadraoRepository;
    leitura: ILeituraRepository;
    usuario: IUsuarioRepository;
    notificacao: INotificacaoRepository;
    actionQueue: IActionQueueRepository;
  };

  gateways: {
    camera: ICameraGateway;
    location: ILocationGateway;
    arquivoFoto: IArquivoFotoGateway;
    hashSenha: IHashSenhaGateway;
    sessao: ISessionStorage;
    diagnostico: IDiagnosticoLocalGateway;
  };

  relogio: IRelogio;

  casos: {
    autenticar: AutenticarUsuarioUseCase;
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
  };
}

type Repos = Container['repos'];
type Gateways = Container['gateways'];

/**
 * Monta os casos de uso a partir dos repositórios e gateways. Compartilhada
 * entre a montagem real (SQLite) e a de teste (dublês em memória), para as
 * duas ligarem exatamente o mesmo grafo.
 */
export function montarCasos(
  repos: Repos,
  gateways: Gateways,
  relogio: IRelogio,
): Container['casos'] {
  return {
    autenticar: new AutenticarUsuarioUseCase(repos.usuario, gateways.sessao, gateways.hashSenha),
    cadastrarPendente: new CadastrarUsuarioPendenteUseCase(
      repos.usuario,
      repos.empresa,
      gateways.hashSenha,
    ),
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
    perfil: new GerenciarPerfilUseCase(repos.usuario, gateways.sessao, gateways.hashSenha),
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
    purgar: new PurgarLeiturasAntigasUseCase(repos.leitura, gateways.arquivoFoto, relogio),
    diagnostico: new ConsultarDiagnosticoUseCase(
      gateways.diagnostico,
      repos.leitura,
      gateways.arquivoFoto,
    ),
  };
}
