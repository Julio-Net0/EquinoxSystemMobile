import { UUIDv4 } from '../value-objects/UUIDv4';
import { ValorKwh } from '../value-objects/ValorKwh';
import { CoordenadasGPS } from '../value-objects/CoordenadasGPS';
import { DataLocal } from '../value-objects/DataLocal';
import { StatusLeituraEnum, STATUS_VIGENTES } from '../enums/StatusLeituraEnum';

export interface LeituraProps {
  id: UUIDv4;
  padraoId: UUIDv4;
  usuarioId: UUIDv4;
  valorConsumo: ValorKwh;
  valorInjecao?: ValorKwh | null;
  fotoLocalUri: string;
  coordenadas?: CoordenadasGPS | null;
  medidoEm: Date;
  dataLocal: DataLocal;
  status?: StatusLeituraEnum;
}

/**
 * Leitura do medidor — a raiz de agregação do app.
 *
 * Duas invariantes valem a pena notar:
 *
 * 1. A foto é obrigatória e o GPS não. A foto é o comprovante do valor; já o
 *    GPS falha de verdade em casa de medidor, garagem e subsolo, e bloquear
 *    por isso inutilizaria o app em campo.
 * 2. `dataLocal` tem de ser o dia de Brasília de `medidoEm`. É por `dataLocal`
 *    que vale a vaga única de leitura vigente por padrão, então deixar os dois
 *    divergirem abriria caminho para duas leituras vigentes no mesmo dia real.
 */
export class Leitura {
  public readonly id: UUIDv4;
  public readonly padraoId: UUIDv4;
  public readonly usuarioId: UUIDv4;
  public readonly valorConsumo: ValorKwh;
  public readonly valorInjecao: ValorKwh | null;
  public readonly fotoLocalUri: string;
  public readonly coordenadas: CoordenadasGPS | null;
  public readonly medidoEm: Date;
  public readonly dataLocal: DataLocal;

  private _status: StatusLeituraEnum;
  private _substituidaEm: Date | null = null;
  private _substituidaPorId: UUIDv4 | null = null;
  private _decididaEm: Date | null = null;
  private _decididaPorId: UUIDv4 | null = null;

  constructor(props: LeituraProps) {
    if (!props.fotoLocalUri || props.fotoLocalUri.trim() === '') {
      throw new Error('Foto comprobatória do medidor é obrigatória');
    }
    if (!props.dataLocal.equals(DataLocal.de(props.medidoEm))) {
      throw new Error('Dia local da leitura não corresponde ao instante medido');
    }

    this.id = props.id;
    this.padraoId = props.padraoId;
    this.usuarioId = props.usuarioId;
    this.valorConsumo = props.valorConsumo;
    this.valorInjecao = props.valorInjecao ?? null;
    this.fotoLocalUri = props.fotoLocalUri.trim();
    this.coordenadas = props.coordenadas ?? null;
    this.medidoEm = props.medidoEm;
    this.dataLocal = props.dataLocal;
    this._status = props.status ?? StatusLeituraEnum.REGISTRADA;
  }

  public get status(): StatusLeituraEnum {
    return this._status;
  }

  public get substituidaEm(): Date | null {
    return this._substituidaEm;
  }

  public get substituidaPorId(): UUIDv4 | null {
    return this._substituidaPorId;
  }

  public get decididaEm(): Date | null {
    return this._decididaEm;
  }

  public get decididaPorId(): UUIDv4 | null {
    return this._decididaPorId;
  }

  /** Ocupa a vaga única de (padrão, dia local). */
  public estaVigente(): boolean {
    return STATUS_VIGENTES.includes(this._status);
  }

  public temLocalizacao(): boolean {
    return this.coordenadas !== null;
  }

  public ehDeUsina(): boolean {
    return this.valorInjecao !== null;
  }

  public substituirPor(nova: Leitura, quando: Date): void {
    if (nova.id.equals(this.id)) {
      throw new Error('Uma leitura não pode substituir a si mesma');
    }
    if (!this.estaVigente()) {
      throw new Error('Só uma leitura vigente pode ser substituída');
    }

    this._status = StatusLeituraEnum.SUBSTITUIDA;
    this._substituidaPorId = nova.id;
    this._substituidaEm = quando;
  }

  /** Decisão do administrador: confirma a leitura, que segue vigente. */
  public aprovar(administradorId: UUIDv4, quando: Date): void {
    this.registrarDecisao(StatusLeituraEnum.APROVADA, administradorId, quando);
  }

  /** Decisão do administrador: a leitura não vale e libera a vaga do dia. */
  public descartar(administradorId: UUIDv4, quando: Date): void {
    this.registrarDecisao(StatusLeituraEnum.DESCARTADA, administradorId, quando);
  }

  private registrarDecisao(status: StatusLeituraEnum, administradorId: UUIDv4, quando: Date): void {
    if (this._status !== StatusLeituraEnum.REGISTRADA) {
      throw new Error('Esta leitura já foi decidida');
    }

    this._status = status;
    this._decididaPorId = administradorId;
    this._decididaEm = quando;
  }
}
