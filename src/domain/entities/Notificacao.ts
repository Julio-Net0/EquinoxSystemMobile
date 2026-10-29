import { UUIDv4 } from '../value-objects/UUIDv4';
import { TipoNotificacaoEnum } from '../enums/TipoNotificacaoEnum';
import { ResolucaoEnum } from '../enums/ResolucaoEnum';

export interface NotificacaoProps {
  id: UUIDv4;
  empresaId: UUIDv4 | null;
  tipo: TipoNotificacaoEnum;
  titulo: string;
  mensagem: string;
  criadaEm: Date;
  requerAcao?: boolean;
  leituraId?: UUIDv4 | null;
  lida?: boolean;
  resolucao?: ResolucaoEnum | null;
  resolvidaEm?: Date | null;
  resolvidaPorId?: UUIDv4 | null;
}

/**
 * Aviso para o administrador, gerado por regra local (valor menor que o
 * anterior, leitura atrasada, leitura substituída, leitura fora do raio).
 *
 * `empresaId` nulo significa aviso global, visível só ao super admin.
 */
export class Notificacao {
  public readonly id: UUIDv4;
  public readonly empresaId: UUIDv4 | null;
  public readonly tipo: TipoNotificacaoEnum;
  public readonly titulo: string;
  public readonly mensagem: string;
  public readonly criadaEm: Date;
  public readonly requerAcao: boolean;
  public readonly leituraId: UUIDv4 | null;

  private _lida: boolean;
  private _resolucao: ResolucaoEnum | null;
  private _resolvidaEm: Date | null;
  private _resolvidaPorId: UUIDv4 | null;

  constructor(props: NotificacaoProps) {
    if (!props.titulo || props.titulo.trim() === '') {
      throw new Error('Título da notificação é obrigatório');
    }
    if (!props.mensagem || props.mensagem.trim() === '') {
      throw new Error('Mensagem da notificação é obrigatória');
    }

    const requerAcao = props.requerAcao ?? false;
    const leituraId = props.leituraId ?? null;
    if (requerAcao && leituraId === null) {
      throw new Error('Notificação que requer ação precisa apontar para uma leitura');
    }

    this.id = props.id;
    this.empresaId = props.empresaId;
    this.tipo = props.tipo;
    this.titulo = props.titulo.trim();
    this.mensagem = props.mensagem.trim();
    this.criadaEm = props.criadaEm;
    this.requerAcao = requerAcao;
    this.leituraId = leituraId;
    this._lida = props.lida ?? false;
    this._resolucao = props.resolucao ?? null;
    this._resolvidaEm = props.resolvidaEm ?? null;
    this._resolvidaPorId = props.resolvidaPorId ?? null;
  }

  public get lida(): boolean {
    return this._lida;
  }

  public get resolucao(): ResolucaoEnum | null {
    return this._resolucao;
  }

  public get resolvidaEm(): Date | null {
    return this._resolvidaEm;
  }

  public get resolvidaPorId(): UUIDv4 | null {
    return this._resolvidaPorId;
  }

  /** Pede decisão e ninguém decidiu ainda: é o que mostra os botões no card. */
  public get aguardandoDecisao(): boolean {
    return this.requerAcao && this._resolucao === null;
  }

  public marcarLida(): void {
    this._lida = true;
  }

  /**
   * `autorId` é nulo apenas na resolução automática (ex.: a leitura foi
   * substituída por outra antes de alguém decidir).
   */
  public resolver(resolucao: ResolucaoEnum, autorId: UUIDv4 | null, quando: Date): void {
    if (!this.requerAcao) {
      throw new Error('Esta notificação não requer decisão');
    }
    if (this._resolucao !== null) {
      throw new Error('Esta notificação já foi resolvida');
    }

    this._resolucao = resolucao;
    this._resolvidaPorId = autorId;
    this._resolvidaEm = quando;
    this._lida = true;
  }
}
