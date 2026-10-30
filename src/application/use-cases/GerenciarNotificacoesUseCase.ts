import { INotificacaoRepository } from '@/domain/repositories/INotificacaoRepository';
import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { Notificacao } from '@/domain/entities/Notificacao';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { ResolucaoEnum } from '@/domain/enums/ResolucaoEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';

/** Tamanho de página do app antigo. */
export const TAMANHO_PAGINA_NOTIFICACOES = 30;

export interface NotificacaoDTO {
  notificacaoId: string;
  tipo: TipoNotificacaoEnum;
  titulo: string;
  mensagem: string;
  criadaEm: string;
  lida: boolean;
  requerAcao: boolean;
  aguardandoDecisao: boolean;
  leituraId: string | null;
  resolucao: ResolucaoEnum | null;
  resolvidaEm: string | null;
}

export interface ListarNotificacoesInput {
  atorId: string;
  pagina?: number;
}

export interface ListarNotificacoesOutput {
  notificacoes: NotificacaoDTO[];
  temMais: boolean;
  erro?: string;
}

export interface AcaoNotificacaoInput {
  atorId: string;
  notificacaoId: string;
}

export interface ResultadoAcao {
  sucesso: boolean;
  erro?: string;
}

/**
 * Central de notificações do administrador. O escopo vem do perfil: o
 * administrador vê a própria empresa, o super admin vê todas.
 */
export class GerenciarNotificacoesUseCase {
  constructor(
    private readonly notificacaoRepo: INotificacaoRepository,
    private readonly usuarioRepo: IUsuarioRepository,
  ) {}

  public async listar(entrada: ListarNotificacoesInput): Promise<ListarNotificacoesOutput> {
    const escopo = await this.escopoDe(entrada.atorId);
    if ('erro' in escopo) {
      return { notificacoes: [], temMais: false, erro: escopo.erro };
    }

    const pagina = Math.max(1, entrada.pagina ?? 1);
    // Pede um a mais que a página para saber se existe próxima, sem contar tudo.
    const encontradas = await this.notificacaoRepo.listar({
      empresaId: escopo.empresaId,
      offset: (pagina - 1) * TAMANHO_PAGINA_NOTIFICACOES,
      limite: TAMANHO_PAGINA_NOTIFICACOES + 1,
    });

    const temMais = encontradas.length > TAMANHO_PAGINA_NOTIFICACOES;

    return {
      notificacoes: encontradas
        .slice(0, TAMANHO_PAGINA_NOTIFICACOES)
        .map(GerenciarNotificacoesUseCase.paraDTO),
      temMais,
    };
  }

  public async contarNaoLidas(entrada: { atorId: string }): Promise<{ total: number; erro?: string }> {
    const escopo = await this.escopoDe(entrada.atorId);
    if ('erro' in escopo) return { total: 0, erro: escopo.erro };

    return { total: await this.notificacaoRepo.contarNaoLidas(escopo.empresaId) };
  }

  public async marcarLida(entrada: AcaoNotificacaoInput): Promise<ResultadoAcao> {
    const escopo = await this.escopoDe(entrada.atorId);
    if ('erro' in escopo) return { sucesso: false, erro: escopo.erro };

    const notificacao = await this.notificacaoRepo.buscarPorId(new UUIDv4(entrada.notificacaoId));
    if (!notificacao) return { sucesso: false, erro: 'Notificação não encontrada' };

    notificacao.marcarLida();
    await this.notificacaoRepo.atualizar(notificacao);
    return { sucesso: true };
  }

  public async marcarTodasLidas(entrada: { atorId: string }): Promise<ResultadoAcao> {
    const escopo = await this.escopoDe(entrada.atorId);
    if ('erro' in escopo) return { sucesso: false, erro: escopo.erro };

    await this.notificacaoRepo.marcarTodasLidas(escopo.empresaId);
    return { sucesso: true };
  }

  /** Empresa nula significa escopo global (super admin). */
  private async escopoDe(
    atorId: string,
  ): Promise<{ ator: Usuario; empresaId: UUIDv4 | null } | { erro: string }> {
    const ator = await this.usuarioRepo.buscarPorId(new UUIDv4(atorId));
    if (!ator) return { erro: 'Sessão inválida. Entre de novo' };

    if (ator.perfil === PerfilEnum.TECNICO) {
      return { erro: 'Seu perfil não permite ver as notificações' };
    }

    return { ator, empresaId: ator.ehGlobal() ? null : ator.empresaId };
  }

  private static paraDTO(notificacao: Notificacao): NotificacaoDTO {
    return {
      notificacaoId: notificacao.id.value,
      tipo: notificacao.tipo,
      titulo: notificacao.titulo,
      mensagem: notificacao.mensagem,
      criadaEm: notificacao.criadaEm.toISOString(),
      lida: notificacao.lida,
      requerAcao: notificacao.requerAcao,
      aguardandoDecisao: notificacao.aguardandoDecisao,
      leituraId: notificacao.leituraId?.value ?? null,
      resolucao: notificacao.resolucao,
      resolvidaEm: notificacao.resolvidaEm?.toISOString() ?? null,
    };
  }
}
