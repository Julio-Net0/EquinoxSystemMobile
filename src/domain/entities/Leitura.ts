import { UUIDv4 } from '../value-objects/UUIDv4';
import { ValorKwh } from '../value-objects/ValorKwh';
import { CoordenadasGPS } from '../value-objects/CoordenadasGPS';
import { StatusSyncEnum } from '../enums/StatusSyncEnum';

export interface LeituraProps {
  id: UUIDv4;
  usinaId: UUIDv4;
  usuarioId: UUIDv4;
  valorKwh: ValorKwh;
  caminhoImagemLocal: string;
  coordenadas: CoordenadasGPS;
  urlImagemRemota?: string | null;
  statusSync?: StatusSyncEnum;
  dataHora?: Date;
}

export class Leitura {
  public readonly id: UUIDv4;
  public readonly usinaId: UUIDv4;
  public readonly usuarioId: UUIDv4;
  public readonly valorKwh: ValorKwh;
  public readonly caminhoImagemLocal: string;
  public readonly coordenadas: CoordenadasGPS;
  public readonly dataHora: Date;
  private _urlImagemRemota: string | null;
  private _statusSync: StatusSyncEnum;

  constructor(props: LeituraProps) {
    if (!props.caminhoImagemLocal || props.caminhoImagemLocal.trim() === '') {
      throw new Error('Foto comprobatória do medidor é obrigatória');
    }

    this.id = props.id;
    this.usinaId = props.usinaId;
    this.usuarioId = props.usuarioId;
    this.valorKwh = props.valorKwh;
    this.caminhoImagemLocal = props.caminhoImagemLocal.trim();
    this.coordenadas = props.coordenadas;
    this.dataHora = props.dataHora ?? new Date();
    this._urlImagemRemota = props.urlImagemRemota ?? null;
    this._statusSync = props.statusSync ?? StatusSyncEnum.PENDENTE;
  }

  public get urlImagemRemota(): string | null {
    return this._urlImagemRemota;
  }

  public get statusSync(): StatusSyncEnum {
    return this._statusSync;
  }

  public marcarComoSincronizada(urlRemota: string): void {
    if (!urlRemota || urlRemota.trim() === '') {
      throw new Error('URL remota da imagem é obrigatória para marcar como sincronizada');
    }
    this._urlImagemRemota = urlRemota.trim();
    this._statusSync = StatusSyncEnum.SINCRONIZADA;
  }

  public marcarComoConflito(): void {
    this._statusSync = StatusSyncEnum.CONFLITO;
  }

  public marcarComoRejeitada(): void {
    this._statusSync = StatusSyncEnum.REJEITADA;
  }
}
