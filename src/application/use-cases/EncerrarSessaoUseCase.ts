import { IAutenticacaoRemotaGateway } from '@/domain/gateways/IAutenticacaoRemotaGateway';
import { ISessionStorage } from '@/domain/gateways/ISessionStorage';
import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';

export interface EncerrarSessaoOutput {
  /** Itens que ficaram na fila, ainda só neste aparelho. */
  pendentes: number;
}

/**
 * Logout. Apaga os tokens da nuvem e a sessão local: o próximo acesso exige
 * rede de novo.
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
  ) {}

  public async pendentes(): Promise<number> {
    return this.fila.contar();
  }

  public async executar(): Promise<EncerrarSessaoOutput> {
    const pendentes = await this.fila.contar();

    await this.autenticacaoRemota.sair();
    await this.sessionStorage.limparSessao();

    return { pendentes };
  }
}
