import { IConectividadeGateway } from '@/domain/gateways/IConectividadeGateway';
import { IAutenticacaoRemotaGateway } from '@/domain/gateways/IAutenticacaoRemotaGateway';
import { ISessionStorage } from '@/domain/gateways/ISessionStorage';
import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import {
  CHAVE_ULTIMA_SYNC,
  CHAVE_ULTIMO_ERRO,
  ISyncMetaRepository,
} from '@/domain/repositories/ISyncMetaRepository';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { IRelogio, relogioSistema } from '@/domain/services/Relogio';
import { AcessoOfflineService } from '@/domain/services/AcessoOfflineService';
import { IdentidadeRemota } from '@/domain/gateways/IAutenticacaoRemotaGateway';
import { ResultadoRemoto } from '@/domain/gateways/ResultadoRemoto';
import { ProcessarFilaSincronizacaoUseCase } from './ProcessarFilaSincronizacaoUseCase';
import { BaixarAlteracoesUseCase } from './BaixarAlteracoesUseCase';

export type SituacaoDaSincronizacao =
  /** Enviou e recebeu tudo. */
  | 'concluida'
  /** Rodou, mas ficou coisa para trás (item recusado ou pull que falhou). */
  | 'parcial'
  /** Sem rede: nada foi tentado. Os dados seguem guardados no aparelho. */
  | 'offline'
  /** A sessão da nuvem expirou e não pôde ser renovada: precisa de novo login. */
  | 'reautenticar'
  /** O administrador desativou este usuário: a sessão local foi encerrada. */
  | 'acesso_revogado'
  /** Ninguém logado. */
  | 'sem_sessao'
  /** Já havia uma sincronização em andamento. */
  | 'ocupado';

export interface SincronizarOutput {
  situacao: SituacaoDaSincronizacao;
  enviados: number;
  recebidos: number;
  /** O que continua na fila de envio, de quem está logado. */
  pendentes: number;
  /** Itens de outra pessoa que usou o aparelho, esperando o dono (ADR 10.19). */
  deOutrosUsuarios?: number;
  /** Frase pronta para o técnico, quando há algo a dizer. */
  mensagem?: string;
}

/**
 * Uma rodada completa de sincronização: envia a fila (push) e depois traz as
 * novidades (pull).
 *
 * A ordem importa. Enviando primeiro, o que o aparelho baixa em seguida já
 * reflete o que ele mesmo acabou de mandar — inclusive o desfecho de um
 * conflito que o servidor tenha resolvido.
 *
 * É disparada em três momentos: ao abrir o app autenticado, quando a conexão
 * volta e pelo botão manual. Nunca lança: quem chama recebe a situação e
 * decide o que mostrar.
 */
export class SincronizarUseCase {
  private emAndamento = false;

  constructor(
    private readonly conectividade: IConectividadeGateway,
    private readonly autenticacaoRemota: IAutenticacaoRemotaGateway,
    private readonly sessionStorage: ISessionStorage,
    private readonly processarFila: ProcessarFilaSincronizacaoUseCase,
    private readonly baixarAlteracoes: BaixarAlteracoesUseCase,
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly syncMeta: ISyncMetaRepository,
    private readonly acessoOffline: AcessoOfflineService,
    private readonly relogio: IRelogio = relogioSistema,
  ) {}

  public async executar(): Promise<SincronizarOutput> {
    const base = { enviados: 0, recebidos: 0, pendentes: 0 };

    if (this.emAndamento) return { ...base, situacao: 'ocupado' };
    this.emAndamento = true;

    try {
      return await this.rodar();
    } catch (erro) {
      const mensagem = `A sincronização falhou: ${(erro as Error).message}`;
      await this.registrarErro(mensagem);
      return { ...base, situacao: 'parcial', mensagem };
    } finally {
      this.emAndamento = false;
    }
  }

  private async rodar(): Promise<SincronizarOutput> {
    const base = { enviados: 0, recebidos: 0, pendentes: 0 };

    const sessao = await this.sessionStorage.obterSessao();
    if (!sessao) return { ...base, situacao: 'sem_sessao' };

    if (!(await this.conectividade.estaOnline())) {
      return { ...base, situacao: 'offline' };
    }

    // Renova o token de acesso se preciso. Quem está em campo sem sinal nunca
    // chega aqui, então nunca é derrubado por token expirado.
    let acesso = await this.autenticacaoRemota.garantirSessao();
    if (!acesso.ok && acesso.motivo === 'rede') {
      return { ...base, situacao: 'offline' };
    }

    // Entrou sem rede (ADR 10.18): a nuvem ainda não tem sessão, mas a senha
    // digitada está em memória. Agora que há conexão, entra com ela.
    const pendente = this.acessoOffline.pendenteDe(sessao.email);
    if (pendente && !SincronizarUseCase.sessaoDe(acesso, sessao.usuarioId)) {
      const entrada = await this.autenticacaoRemota.entrar(pendente.email, pendente.senha);
      if (!entrada.ok && entrada.motivo === 'rede') {
        return { ...base, situacao: 'offline' };
      }
      this.acessoOffline.concluirReautenticacao();

      if (!entrada.ok) {
        // A senha que valia no aparelho não vale mais na nuvem: foi trocada
        // em outro lugar. A verificação guardada deixa de servir.
        await this.acessoOffline.esquecer(pendente.email);
        const mensagem =
          'A senha desta conta mudou. Saia e entre de novo, com internet e a senha nova, para enviar os dados pendentes — eles continuam guardados neste aparelho';
        await this.registrarErro(mensagem);
        return { ...base, situacao: 'reautenticar', mensagem };
      }
      acesso = entrada;
    }

    if (!SincronizarUseCase.sessaoDe(acesso, sessao.usuarioId)) {
      const mensagem =
        'Sua sessão na nuvem expirou. Saia e entre de novo, com internet, para enviar os dados pendentes — eles continuam guardados neste aparelho';
      await this.registrarErro(mensagem);
      return { ...base, situacao: 'reautenticar', mensagem };
    }

    const envio = await this.processarFila.executar({ usuarioId: sessao.usuarioId });
    if (envio.interrompidoPor === 'rede') {
      return { ...base, situacao: 'offline', enviados: envio.enviados, pendentes: envio.restantes };
    }

    const pull = await this.baixarAlteracoes.executar({ usuarioId: sessao.usuarioId });

    const revogado = await this.refletirPerfilNaSessao(sessao.usuarioId);
    if (revogado) {
      return {
        ...base,
        situacao: 'acesso_revogado',
        mensagem: 'Seu acesso foi desativado por um administrador',
      };
    }

    const parcial = !pull.sucesso || envio.restantes > 0 || envio.interrompidoPor !== undefined;
    const mensagem = SincronizarUseCase.mensagemDe(envio.restantes, envio.isolados, pull.erro);

    if (parcial) {
      await this.registrarErro(mensagem ?? null);
    } else {
      await this.syncMeta.definir(CHAVE_ULTIMO_ERRO, null);
    }
    if (pull.sucesso) {
      await this.syncMeta.definir(CHAVE_ULTIMA_SYNC, this.relogio.agora().toISOString());
    }

    return {
      situacao: parcial ? 'parcial' : 'concluida',
      enviados: envio.enviados,
      recebidos: pull.recebidos,
      pendentes: envio.restantes,
      deOutrosUsuarios: envio.deOutrosUsuarios,
      mensagem,
    };
  }

  /**
   * O perfil pode ter mudado na nuvem (nome, nível, ou o acesso foi cortado).
   * A sessão guardada acompanha; se o usuário deixou de estar ativo, ela é
   * encerrada. Devolve true quando o acesso foi revogado.
   */
  private async refletirPerfilNaSessao(usuarioId: string): Promise<boolean> {
    const eu = await this.usuarioRepo.buscarPorId(new UUIDv4(usuarioId));
    if (!eu) return false;

    if (!eu.isAtivo()) {
      await this.acessoOffline.esquecer(eu.email);
      this.acessoOffline.concluirReautenticacao();
      await this.autenticacaoRemota.sair();
      await this.sessionStorage.limparSessao();
      return true;
    }

    await this.sessionStorage.salvarSessao({
      usuarioId,
      empresaId: eu.empresaId?.value ?? null,
      nome: eu.nome,
      usuario: eu.usuario,
      email: eu.email,
      perfil: eu.perfil,
    });
    return false;
  }

  /** A nuvem tem sessão aberta, e é deste usuário. */
  private static sessaoDe(
    acesso: ResultadoRemoto<IdentidadeRemota | null>,
    usuarioId: string,
  ): boolean {
    return acesso.ok && !!acesso.valor && acesso.valor.usuarioId === usuarioId;
  }

  private static mensagemDe(
    restantes: number,
    isolados: number,
    erroDoPull?: string,
  ): string | undefined {
    if (isolados > 0) {
      const itens = isolados === 1 ? '1 item não pôde' : `${isolados} itens não puderam`;
      return `${itens} ser enviado e continua salvo só neste aparelho. Toque em "Tentar de novo" mais tarde ou procure um administrador`;
    }
    if (restantes > 0) {
      const itens = restantes === 1 ? '1 item ainda aguarda' : `${restantes} itens ainda aguardam`;
      return `${itens} envio. O app tenta de novo sozinho`;
    }
    if (erroDoPull) {
      return 'Seus dados foram enviados, mas não foi possível baixar as novidades agora';
    }
    return undefined;
  }

  private async registrarErro(mensagem: string | null): Promise<void> {
    try {
      await this.syncMeta.definir(CHAVE_ULTIMO_ERRO, mensagem);
    } catch {
      // Registrar o erro é cortesia; não pode virar outro erro.
    }
  }
}
