import { UUIDv4 } from '../value-objects/UUIDv4';
import { CoordenadasGPS } from '../value-objects/CoordenadasGPS';
import { StatusUsinaEnum } from '../enums/StatusUsinaEnum';

export interface UsinaProps {
  id: UUIDv4;
  empresaId: UUIDv4;
  nome: string;
  codigoUC: string;
  capacidadeNominal: number; // kWh
  coordenadas: CoordenadasGPS;
  status: StatusUsinaEnum;
  dataUltimaVisita?: Date | null;
}

export class Usina {
  public readonly id: UUIDv4;
  public readonly empresaId: UUIDv4;
  public readonly nome: string;
  public readonly codigoUC: string;
  public readonly capacidadeNominal: number;
  public readonly coordenadas: CoordenadasGPS;
  private _status: StatusUsinaEnum;
  private _dataUltimaVisita: Date | null;

  constructor(props: UsinaProps) {
    if (!props.nome || props.nome.trim() === '') {
      throw new Error('Nome da usina é obrigatório');
    }
    if (!props.codigoUC || props.codigoUC.trim() === '') {
      throw new Error('Código UC é obrigatório');
    }
    if (typeof props.capacidadeNominal !== 'number' || props.capacidadeNominal <= 0) {
      throw new Error('Capacidade nominal deve ser maior que zero');
    }

    this.id = props.id;
    this.empresaId = props.empresaId;
    this.nome = props.nome.trim();
    this.codigoUC = props.codigoUC.trim();
    this.capacidadeNominal = props.capacidadeNominal;
    this.coordenadas = props.coordenadas;
    this._status = props.status;
    this._dataUltimaVisita = props.dataUltimaVisita ?? null;
  }

  public get status(): StatusUsinaEnum {
    return this._status;
  }

  public get dataUltimaVisita(): Date | null {
    return this._dataUltimaVisita;
  }

  public aprovarComissionamento(): void {
    this._status = StatusUsinaEnum.ATIVA;
  }

  public inativar(): void {
    this._status = StatusUsinaEnum.INATIVA;
  }

  public registrarVisita(data?: Date): void {
    this._dataUltimaVisita = data ?? new Date();
  }
}
