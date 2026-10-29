import { INotificacaoRepository } from '@/domain/repositories/INotificacaoRepository';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { ResolucaoEnum } from '@/domain/enums/ResolucaoEnum';
import { IRelogio, relogioSistema } from '@/domain/services/Relogio';

export interface DecidirLeituraInput {
  atorId: string;
  notificacaoId: string;
  /**
   * No app antigo isto era "enviar para a planilha". Offline não há planilha:
   * aprovar confirma a leitura, descartar a invalida e libera a vaga do dia.
   */
  decisao: 'aprovar' | 'descartar';
}

export interface DecidirLeituraOutput {
  sucesso: boolean;
  erro?: string;
}

/**
 * Decisão do administrador sobre uma leitura que caiu em exceção (hoje, só a
 * atrasada).
 *
 * Não existe o conflito entre administradores do app antigo (o HTTP 409): com
 * um banco por aparelho não há outro administrador decidindo em paralelo. O que
 * a entidade protege é o duplo toque.
 */
export class DecidirLeituraUseCase {
  constructor(
    private readonly notificacaoRepo: INotificacaoRepository,
    private readonly leituraRepo: ILeituraRepository,
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly relogio: IRelogio = relogioSistema,
  ) {}

  public async executar(entrada: DecidirLeituraInput): Promise<DecidirLeituraOutput> {
    const ator = await this.usuarioRepo.buscarPorId(new UUIDv4(entrada.atorId));
    if (!ator) {
      return { sucesso: false, erro: 'Sessão inválida. Entre de novo' };
    }
    if (ator.perfil === PerfilEnum.TECNICO) {
      return { sucesso: false, erro: 'Seu perfil não permite decidir sobre leituras' };
    }

    const notificacao = await this.notificacaoRepo.buscarPorId(new UUIDv4(entrada.notificacaoId));
    if (!notificacao) {
      return { sucesso: false, erro: 'Notificação não encontrada' };
    }
    if (!notificacao.requerAcao) {
      return { sucesso: false, erro: 'Esta notificação não requer decisão' };
    }

    const foraDoEscopo =
      ator.perfil === PerfilEnum.ADMIN &&
      !(notificacao.empresaId?.equals(ator.empresaId as UUIDv4) ?? false);
    if (foraDoEscopo) {
      return { sucesso: false, erro: 'Esta notificação é de outra empresa' };
    }

    const leitura = await this.leituraRepo.buscarPorId(notificacao.leituraId as UUIDv4);
    if (!leitura) {
      return { sucesso: false, erro: 'Leitura não encontrada' };
    }

    const agora = this.relogio.agora();

    try {
      if (entrada.decisao === 'aprovar') {
        leitura.aprovar(ator.id, agora);
      } else {
        leitura.descartar(ator.id, agora);
      }
      notificacao.resolver(
        entrada.decisao === 'aprovar' ? ResolucaoEnum.APROVADA : ResolucaoEnum.DESCARTADA,
        ator.id,
        agora,
      );
    } catch (erro) {
      return { sucesso: false, erro: (erro as Error).message };
    }

    await this.leituraRepo.atualizar(leitura);
    await this.notificacaoRepo.atualizar(notificacao);

    return { sucesso: true };
  }
}
