import {
  INotificacaoRepository,
  ListarNotificacoesFiltro,
} from '@/domain/repositories/INotificacaoRepository';
import { Notificacao } from '@/domain/entities/Notificacao';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

export class NotificacaoRepositoryMemory implements INotificacaoRepository {
  public items: Map<string, Notificacao> = new Map();

  async salvar(notificacao: Notificacao): Promise<void> {
    this.items.set(notificacao.id.value, notificacao);
  }

  async salvarVarias(notificacoes: Notificacao[]): Promise<void> {
    notificacoes.forEach((n) => this.items.set(n.id.value, n));
  }

  async atualizar(notificacao: Notificacao): Promise<void> {
    this.items.set(notificacao.id.value, notificacao);
  }

  async buscarPorId(id: UUIDv4): Promise<Notificacao | null> {
    return this.items.get(id.value) ?? null;
  }

  async listar(filtro: ListarNotificacoesFiltro): Promise<Notificacao[]> {
    const visiveis = Array.from(this.items.values())
      .filter((n) => this.noEscopo(n, filtro.empresaId))
      .sort((a, b) => b.criadaEm.getTime() - a.criadaEm.getTime());

    const inicio = (filtro.pagina - 1) * filtro.tamanho;
    return visiveis.slice(inicio, inicio + filtro.tamanho);
  }

  async contarNaoLidas(empresaId: UUIDv4 | null): Promise<number> {
    return Array.from(this.items.values()).filter((n) => !n.lida && this.noEscopo(n, empresaId))
      .length;
  }

  async marcarTodasLidas(empresaId: UUIDv4 | null): Promise<void> {
    Array.from(this.items.values())
      .filter((n) => this.noEscopo(n, empresaId))
      .forEach((n) => n.marcarLida());
  }

  async buscarPorLeitura(leituraId: UUIDv4): Promise<Notificacao[]> {
    return Array.from(this.items.values()).filter((n) => n.leituraId?.equals(leituraId) ?? false);
  }

  async excluir(id: UUIDv4): Promise<void> {
    this.items.delete(id.value);
  }

  /** Escopo nulo é o do super admin: vê tudo, inclusive as globais. */
  private noEscopo(notificacao: Notificacao, empresaId: UUIDv4 | null): boolean {
    if (empresaId === null) return true;
    return notificacao.empresaId?.equals(empresaId) ?? false;
  }
}
