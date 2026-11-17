import { UUIDv4 } from '../value-objects/UUIDv4';

/**
 * Operações que o aparelho deve repetir na nuvem. Uma por tipo de escrita
 * local; o modelo é o atual (Empresa -> Endereco -> PadraoCemig -> Leitura),
 * não o de usinas que a versão anterior desta fila descrevia.
 */
export const TIPOS_DE_OPERACAO = [
  'UPSERT_EMPRESA',
  'UPSERT_ENDERECO',
  'EXCLUIR_ENDERECO',
  'UPSERT_PADRAO',
  'EXCLUIR_PADRAO',
  'UPSERT_USUARIO',
  'EXCLUIR_USUARIO',
  'UPSERT_LEITURA',
  'UPSERT_NOTIFICACAO',
  'MARCAR_NOTIFICACOES_LIDAS',
] as const;

export type TipoOperacaoActionQueue = (typeof TIPOS_DE_OPERACAO)[number];

export interface ActionQueueItemProps {
  id: UUIDv4;
  tipoOperacao: TipoOperacaoActionQueue;
  payloadJSON: string;
  timestamp?: Date;
  tentativas?: number;
  ultimoErro?: string | null;
  /**
   * Quem fez a escrita. Só a sessão dessa pessoa envia o item (ADR 10.19).
   * Nulo nos itens anteriores à migração 005 sem dono deduzível: qualquer
   * sessão os envia.
   */
  donoId?: UUIDv4 | null;
}

/**
 * Um item da fila de envio (outbox).
 *
 * O payload guarda só o identificador do registro, não uma cópia dele: na hora
 * do envio o processador lê o estado atual do SQLite. Assim uma leitura que
 * foi substituída ou decidida depois de enfileirada sobe já no estado final, e
 * repetir o envio é sempre seguro.
 */
export class ActionQueueItem {
  /**
   * Depois deste número de recusas o item fica isolado: sai do caminho dos
   * outros e espera uma nova tentativa manual. Queda de rede não conta.
   */
  public static readonly MAX_TENTATIVAS = 5;

  public readonly id: UUIDv4;
  public readonly tipoOperacao: TipoOperacaoActionQueue;
  public readonly payloadJSON: string;
  public readonly timestamp: Date;
  public readonly donoId: UUIDv4 | null;
  private _tentativas: number;
  private _ultimoErro: string | null;

  constructor(props: ActionQueueItemProps) {
    if (!props.payloadJSON || props.payloadJSON.trim() === '') {
      throw new Error('Payload JSON é obrigatório para item da ActionQueue');
    }
    if (!TIPOS_DE_OPERACAO.includes(props.tipoOperacao)) {
      throw new Error(`Tipo de operação desconhecido: ${props.tipoOperacao}`);
    }

    this.id = props.id;
    this.tipoOperacao = props.tipoOperacao;
    this.payloadJSON = props.payloadJSON;
    this.timestamp = props.timestamp ?? new Date();
    this._tentativas = props.tentativas ?? 0;
    this._ultimoErro = props.ultimoErro ?? null;
    this.donoId = props.donoId ?? null;
  }

  /**
   * Item para o registro informado. `registroId` nulo só faz sentido em
   * operação de escopo global (marcar todas as notificações como lidas, para
   * o super admin).
   */
  public static para(
    tipoOperacao: TipoOperacaoActionQueue,
    registroId: UUIDv4 | null,
    quando: Date,
    donoId: UUIDv4 | null = null,
  ): ActionQueueItem {
    return new ActionQueueItem({
      id: UUIDv4.gerar(),
      tipoOperacao,
      payloadJSON: JSON.stringify({ id: registroId?.value ?? null }),
      timestamp: quando,
      donoId,
    });
  }

  /** A sessão deste usuário pode enviar o item? */
  public pertenceA(usuarioId: string): boolean {
    return this.donoId === null || this.donoId.value === usuarioId;
  }

  public get tentativas(): number {
    return this._tentativas;
  }

  public get ultimoErro(): string | null {
    return this._ultimoErro;
  }

  /** Identificador do registro a que o item se refere, se houver. */
  public get registroId(): UUIDv4 | null {
    try {
      const { id } = JSON.parse(this.payloadJSON) as { id?: unknown };
      return typeof id === 'string' ? new UUIDv4(id) : null;
    } catch {
      return null;
    }
  }

  public estaIsolado(): boolean {
    return this._tentativas >= ActionQueueItem.MAX_TENTATIVAS;
  }

  /**
   * Conta uma recusa. A **definitiva** (o problema está no aparelho e repetir
   * não muda nada, como a foto que sumiu) isola o item de uma vez, em vez de
   * gastar as tentativas.
   */
  public registrarFalha(mensagem: string, definitiva = false): void {
    this._tentativas = definitiva ? ActionQueueItem.MAX_TENTATIVAS : this._tentativas + 1;
    this._ultimoErro = mensagem;
  }

  /** Nova chance manual: zera as tentativas, mantendo a posição na fila. */
  public reativar(): void {
    this._tentativas = 0;
    this._ultimoErro = null;
  }
}
