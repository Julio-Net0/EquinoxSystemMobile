import { UUIDv4 } from '../value-objects/UUIDv4';
import { SenhaHash } from '../value-objects/SenhaHash';
import { PerfilEnum } from '../enums/PerfilEnum';
import { StatusUsuarioEnum } from '../enums/StatusUsuarioEnum';

export interface UsuarioProps {
  id: UUIDv4;
  empresaId: UUIDv4 | null;
  nome: string;
  usuario: string;
  email: string;
  senha: SenhaHash;
  perfil: PerfilEnum;
  status: StatusUsuarioEnum;
  enderecosVinculados?: UUIDv4[];
  perfilAnterior?: PerfilEnum | null;
  criadoEm?: Date;
  autorizadoEm?: Date | null;
  autorizadoPorId?: UUIDv4 | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Usuário do app. Autentica por e-mail ou pelo login (`usuario`), como no app
 * antigo, por isso os dois são obrigatórios.
 *
 * O super admin tem escopo global e por isso é o único que pode ficar sem
 * empresa e sem endereço vinculado.
 */
export class Usuario {
  public readonly id: UUIDv4;
  public readonly empresaId: UUIDv4 | null;
  public readonly nome: string;
  public readonly usuario: string;
  public readonly email: string;
  public readonly criadoEm: Date;

  private _senha: SenhaHash;
  private _perfil: PerfilEnum;
  private _status: StatusUsuarioEnum;
  private _enderecosVinculados: UUIDv4[];
  private _perfilAnterior: PerfilEnum | null;
  private _autorizadoEm: Date | null;
  private _autorizadoPorId: UUIDv4 | null;

  constructor(props: UsuarioProps) {
    if (!props.nome || props.nome.trim() === '') {
      throw new Error('Nome do usuário é obrigatório');
    }
    if (!props.usuario || props.usuario.trim() === '') {
      throw new Error('Usuário de login é obrigatório');
    }
    if (!props.email || !EMAIL_REGEX.test(props.email.trim())) {
      throw new Error(`Email inválido: ${props.email}`);
    }
    if (props.empresaId === null && props.perfil !== PerfilEnum.SUPER_ADMIN) {
      throw new Error('Usuário precisa pertencer a uma empresa');
    }

    this.id = props.id;
    this.empresaId = props.empresaId;
    this.nome = props.nome.trim();
    this.usuario = props.usuario.trim().toLowerCase();
    this.email = props.email.trim().toLowerCase();
    this.criadoEm = props.criadoEm ?? new Date();

    this._senha = props.senha;
    this._perfil = props.perfil;
    this._status = props.status;
    this._enderecosVinculados = [...(props.enderecosVinculados ?? [])];
    this._perfilAnterior = props.perfilAnterior ?? null;
    this._autorizadoEm = props.autorizadoEm ?? null;
    this._autorizadoPorId = props.autorizadoPorId ?? null;
  }

  public get senha(): SenhaHash {
    return this._senha;
  }

  public get perfil(): PerfilEnum {
    return this._perfil;
  }

  public get status(): StatusUsuarioEnum {
    return this._status;
  }

  public get perfilAnterior(): PerfilEnum | null {
    return this._perfilAnterior;
  }

  public get autorizadoEm(): Date | null {
    return this._autorizadoEm;
  }

  public get autorizadoPorId(): UUIDv4 | null {
    return this._autorizadoPorId;
  }

  public get enderecosVinculados(): UUIDv4[] {
    return [...this._enderecosVinculados];
  }

  public ehGlobal(): boolean {
    return this._perfil === PerfilEnum.SUPER_ADMIN;
  }

  public isAtivo(): boolean {
    return this._status === StatusUsuarioEnum.ATIVO;
  }

  /**
   * Regra do app antigo: níveis 1 e 2 só funcionam com endereço vinculado,
   * senão o técnico entra e não tem nada para ler. Nível 3 é isento.
   */
  public ativar(autorizadoPorId: UUIDv4 | null = null, quando: Date | null = null): void {
    if (!this.ehGlobal() && this._enderecosVinculados.length === 0) {
      throw new Error('Usuário e Administrador precisam de ao menos um endereço vinculado');
    }

    this._status = StatusUsuarioEnum.ATIVO;
    this._autorizadoPorId = autorizadoPorId;
    this._autorizadoEm = quando;
  }

  public inativar(): void {
    this._status = StatusUsuarioEnum.INATIVO;
  }

  /** Guarda o perfil atual para a reaprovação rápida reusar o mesmo nível. */
  public recusar(): void {
    this._perfilAnterior = this._perfil;
    this._status = StatusUsuarioEnum.RECUSADO;
  }

  public atualizarPerfil(novoPerfil: PerfilEnum): void {
    this._perfil = novoPerfil;
  }

  public vincularEnderecos(enderecos: UUIDv4[]): void {
    this._enderecosVinculados = [...enderecos];
  }

  public trocarSenha(nova: SenhaHash): void {
    this._senha = nova;
  }
}
