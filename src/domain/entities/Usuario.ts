import { UUIDv4 } from '../value-objects/UUIDv4';
import { PerfilEnum } from '../enums/PerfilEnum';

export type StatusUsuarioType = 'Ativo' | 'Pendente' | 'Recusado' | 'Inativo';

export interface UsuarioProps {
  id: UUIDv4;
  empresaId: UUIDv4;
  nome: string;
  email: string;
  usuario?: string;
  perfil: PerfilEnum;
  status: StatusUsuarioType;
  usinasVinculadas?: UUIDv4[];
}

export class Usuario {
  public readonly id: UUIDv4;
  public readonly empresaId: UUIDv4;
  public readonly nome: string;
  public readonly email: string;
  public readonly usuario?: string;
  private _perfil: PerfilEnum;
  private _status: StatusUsuarioType;
  private _usinasVinculadas: UUIDv4[];

  constructor(props: UsuarioProps) {
    if (!props.nome || props.nome.trim() === '') {
      throw new Error('Nome do usuário é obrigatório');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!props.email || !emailRegex.test(props.email)) {
      throw new Error(`Email inválido: ${props.email}`);
    }

    this.id = props.id;
    this.empresaId = props.empresaId;
    this.nome = props.nome.trim();
    this.email = props.email.toLowerCase().trim();
    this.usuario = props.usuario?.trim();
    this._perfil = props.perfil;
    this._status = props.status;
    this._usinasVinculadas = props.usinasVinculadas ?? [];
  }

  public get perfil(): PerfilEnum {
    return this._perfil;
  }

  public get status(): StatusUsuarioType {
    return this._status;
  }

  public get usinasVinculadas(): UUIDv4[] {
    return [...this._usinasVinculadas];
  }

  public isAtivo(): boolean {
    return this._status === 'Ativo';
  }

  public ativar(): void {
    this._status = 'Ativo';
  }

  public inativar(): void {
    this._status = 'Inativo';
  }

  public recusar(): void {
    this._status = 'Recusado';
  }

  public atualizarPerfil(novoPerfil: PerfilEnum): void {
    this._perfil = novoPerfil;
  }

  public vincularUsinas(usinas: UUIDv4[]): void {
    this._usinasVinculadas = [...usinas];
  }
}

