import { Leitura } from '../entities/Leitura';
import { Notificacao } from '../entities/Notificacao';
import { UUIDv4 } from '../value-objects/UUIDv4';
import { DataLocal } from '../value-objects/DataLocal';
import { TipoNotificacaoEnum } from '../enums/TipoNotificacaoEnum';
import { ReferenciaLeitura } from './ReferenciaLeituraService';
import { AvaliacaoLocalizacao } from './RegraLocalizacaoLeituraService';
import { AvisoValorMenorService } from './AvisoValorMenorService';
import { RegraLeituraAtrasadaService } from './RegraLeituraAtrasadaService';
import { formatarDistancia, formatarKwh } from './FormatadorKwh';

export interface ContextoLeituraRegistrada {
  leitura: Leitura;
  referencia: ReferenciaLeitura | null;
  /** Leitura que perdeu a vaga do dia para esta, se houve. */
  substituida: Leitura | null;
  localizacao: AvaliacaoLocalizacao;
  empresaId: UUIDv4 | null;
  padraoNumero: string;
  enderecoApelido: string;
  autorNome: string;
  hoje: DataLocal;
  agora: Date;
}

/**
 * Traduz o que as regras acharam de uma leitura recém-registrada em avisos para
 * o administrador. Fonte única dos textos que aparecem na central de
 * notificações, para a tela não inventar redação própria.
 *
 * Só a leitura atrasada pede decisão; as outras são informativas.
 */
export class GeradorNotificacoesService {
  public static paraLeituraRegistrada(contexto: ContextoLeituraRegistrada): Notificacao[] {
    return [
      GeradorNotificacoesService.valorMenor(contexto),
      GeradorNotificacoesService.substituicao(contexto),
      GeradorNotificacoesService.atraso(contexto),
      GeradorNotificacoesService.localizacao(contexto),
    ].filter((n): n is Notificacao => n !== null);
  }

  private static valorMenor(contexto: ContextoLeituraRegistrada): Notificacao | null {
    const { leitura, referencia } = contexto;
    const aviso = AvisoValorMenorService.mensagem(
      leitura.valorConsumo.valor,
      leitura.valorInjecao?.valor ?? null,
      referencia,
    );
    if (!aviso) return null;

    return GeradorNotificacoesService.montar(contexto, {
      tipo: TipoNotificacaoEnum.LEITURA_VALOR_MENOR,
      titulo: `Valor menor no padrão ${contexto.padraoNumero}`,
      mensagem: `${contexto.enderecoApelido}: ${aviso} Registrada por ${contexto.autorNome}.`,
    });
  }

  private static substituicao(contexto: ContextoLeituraRegistrada): Notificacao | null {
    const { substituida, leitura } = contexto;
    if (!substituida) return null;

    return GeradorNotificacoesService.montar(contexto, {
      tipo: TipoNotificacaoEnum.LEITURA_SUBSTITUIDA,
      titulo: `Leitura substituída no padrão ${contexto.padraoNumero}`,
      mensagem:
        `${contexto.enderecoApelido}: a leitura de ${formatarKwh(substituida.valorConsumo.valor)} `
        + `do dia ${substituida.dataLocal.paraBr()} foi substituída por `
        + `${formatarKwh(leitura.valorConsumo.valor)}, registrada por ${contexto.autorNome}.`,
    });
  }

  /**
   * Aviso de atraso para uma leitura que envelheceu sem novo registro.
   *
   * Offline uma leitura pode cruzar o limite de 7 dias sem ninguém mexer nela,
   * então o varredor de boot precisa gerar o aviso fora do fluxo de registro.
   */
  public static paraAtrasoDetectado(contexto: ContextoLeituraRegistrada): Notificacao | null {
    return GeradorNotificacoesService.atraso(contexto);
  }

  private static atraso(contexto: ContextoLeituraRegistrada): Notificacao | null {
    const { leitura, hoje } = contexto;
    if (!RegraLeituraAtrasadaService.estaAtrasada(leitura.dataLocal, hoje)) return null;

    const dias = RegraLeituraAtrasadaService.diasDeAtraso(leitura.dataLocal, hoje);

    return GeradorNotificacoesService.montar(contexto, {
      tipo: TipoNotificacaoEnum.LEITURA_ATRASADA,
      titulo: `Leitura atrasada no padrão ${contexto.padraoNumero}`,
      mensagem:
        `${contexto.enderecoApelido}: leitura do dia ${leitura.dataLocal.paraBr()} registrada com `
        + `${dias} dias de atraso por ${contexto.autorNome}. Confirme ou descarte.`,
      requerAcao: true,
    });
  }

  private static localizacao(contexto: ContextoLeituraRegistrada): Notificacao | null {
    const { localizacao } = contexto;

    if (localizacao.situacao === 'fora_do_raio') {
      return GeradorNotificacoesService.montar(contexto, {
        tipo: TipoNotificacaoEnum.LEITURA_FORA_DE_RAIO,
        titulo: `Leitura fora do local no padrão ${contexto.padraoNumero}`,
        mensagem:
          `${contexto.enderecoApelido}: ${contexto.autorNome} registrou a leitura a `
          + `${formatarDistancia(localizacao.distanciaMetros as number)} do endereço cadastrado.`,
      });
    }

    if (localizacao.situacao === 'sem_gps') {
      return GeradorNotificacoesService.montar(contexto, {
        tipo: TipoNotificacaoEnum.LEITURA_SEM_GPS,
        titulo: `Leitura sem GPS no padrão ${contexto.padraoNumero}`,
        mensagem:
          `${contexto.enderecoApelido}: ${contexto.autorNome} registrou a leitura sem localização. `
          + 'A foto do medidor segue como comprovante.',
      });
    }

    // endereco_sem_geocerca não é divergência: não há com o que comparar.
    return null;
  }

  private static montar(
    contexto: ContextoLeituraRegistrada,
    dados: { tipo: TipoNotificacaoEnum; titulo: string; mensagem: string; requerAcao?: boolean },
  ): Notificacao {
    const requerAcao = dados.requerAcao ?? false;

    return new Notificacao({
      id: UUIDv4.gerar(),
      empresaId: contexto.empresaId,
      tipo: dados.tipo,
      titulo: dados.titulo,
      mensagem: dados.mensagem,
      criadaEm: contexto.agora,
      requerAcao,
      // Só a notificação que pede decisão precisa apontar para a leitura.
      leituraId: requerAcao ? contexto.leitura.id : null,
    });
  }
}
