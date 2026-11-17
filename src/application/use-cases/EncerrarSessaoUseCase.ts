import { IAutenticacaoRemotaGateway } from '@/domain/gateways/IAutenticacaoRemotaGateway';
import { ISessionStorage } from '@/domain/gateways/ISessionStorage';
import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { AcessoOfflineService } from '@/domain/services/AcessoOfflineService';

export interface EncerrarSessaoOutput {
  /** Itens que ficaram na fila, ainda só neste aparelho. */
  pendentes: number;
}

/**
 * Logout. Apaga os tokens da nuvem, a sessão local e a senha que estivesse em
 * memória. A verificação de senha do aparelho fica: quem já entrou com
 * internet aqui pode entrar de novo sem rede (ADR 10.18).
 *
 * O que ainda está na fila de envio NÃO é apagado — fica no SQLite e sobe
 * quando o mesmo usuário entrar outra vez. Por isso o caso de uso informa
 * quantos itens ficaram, para a tela poder avisar antes.
 */
export class EncerrarSessaoUseCase {
  constructor(
    private readonly autenticacaoRemota: IAutenticacaoRemotaGateway,
    private readonly sessionStorage: ISessionStorage,
    private readonly fila: IActionQueueRepository,
    private readonly acessoOffline: AcessoOfflineService,
  ) {}

  /** Itens de quem está saindo que ainda não subiram (os de outros não contam). */
  public async pendentes(): Promise<number> {
    const sessao = await this.sessionStorage.obterSessao();
    const itens = await this.fila.obterPendentes();
    return sessao ? itens.filter((i) => i.pertenceA(sessao.usuarioId)).length : itens.length;
  }

  public async executar(): Promise<EncerrarSessaoOutput> {
    const pendentes = await this.pendentes();

    await this.autenticacaoRemota.sair();
    await this.sessionStorage.limparSessao();
    this.acessoOffline.concluirReautenticacao();

    return { pendentes };
  }
}
