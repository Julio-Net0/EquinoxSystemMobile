import { UUIDv4 } from '../value-objects/UUIDv4';

export type TipoOperacaoActionQueue =
  | 'INSERT_LEITURA'
  | 'INSERT_USINA'
  | 'INSERT_EMPRESA'
  | 'UPDATE_USINA'
  | 'DELETE_USINA';

export interface ActionQueueItemProps {
  id: UUIDv4;
  tipoOperacao: TipoOperacaoActionQueue;
  payloadJSON: string;
  timestamp?: Date;
  tentativas?: number;
}

export class ActionQueueItem {
  public readonly id: UUIDv4;
  public readonly tipoOperacao: TipoOperacaoActionQueue;
  public readonly payloadJSON: string;
  public readonly timestamp: Date;
  private _tentativas: number;

  constructor(props: ActionQueueItemProps) {
    if (!props.payloadJSON || props.payloadJSON.trim() === '') {
      throw new Error('Payload JSON é obrigatório para item da ActionQueue');
    }

    this.id = props.id;
    this.tipoOperacao = props.tipoOperacao;
    this.payloadJSON = props.payloadJSON;
    this.timestamp = props.timestamp ?? new Date();
    this._tentativas = props.tentativas ?? 0;
  }

  public get tentativas(): number {
    return this._tentativas;
  }

  public incrementarTentativa(): void {
    this._tentativas += 1;
  }
}
