import { UUIDv4 } from '../value-objects/UUIDv4';
import { PerfilEnum } from '../enums/PerfilEnum';

export interface UsuarioProps {
  id: UUIDv4;
  empresaId: UUIDv4;
  nome: string;
  email: string;
  perfil: PerfilEnum;
  status: 'Ativo' | 'Pendente';
}

export class Usuario {
  public readonly id: UUIDv4;
  public readonly empresaId: UUIDv4;
  public readonly nome: string;
  public readonly email: string;
  public readonly perfil: PerfilEnum;
  private _status: 'Ativo' | 'Pendente';

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
    this.perfil = props.perfil;
    this._status = props.status;
  }

  public get status(): 'Ativo' | 'Pendente' {
    return this._status;
  }

  public isAtivo(): boolean {
    return this._status === 'Ativo';
  }

  public ativar(): void {
    this._status = 'Ativo';
  }

  public inativar(): void {
    this._status = 'Pendente';
  }
}
