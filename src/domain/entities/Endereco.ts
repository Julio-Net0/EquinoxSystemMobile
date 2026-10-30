import { UUIDv4 } from '../value-objects/UUIDv4';
import { CoordenadasGPS } from '../value-objects/CoordenadasGPS';

export interface EnderecoProps {
  id: UUIDv4;
  empresaId: UUIDv4;
  apelido: string;
  uc: string;
  ehUsina?: boolean;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  coordenadas?: CoordenadasGPS | null;
  criadoEm?: Date;
}

/**
 * Local de medição. Substitui a antiga entidade Usina: "usina" aqui é a flag
 * ehUsina, que é o que decide se a leitura precisa também do campo de injeção.
 *
 * As coordenadas são opcionais de propósito — um endereço sem coordenada
 * simplesmente não tem geocerca, e a leitura nele não é conferida por distância.
 */
export class Endereco {
  public readonly id: UUIDv4;
  public readonly empresaId: UUIDv4;
  public readonly apelido: string;
  public readonly uc: string;
  public readonly ehUsina: boolean;
  public readonly rua: string | null;
  public readonly numero: string | null;
  public readonly bairro: string | null;
  public readonly cidade: string | null;
  public readonly criadoEm: Date;
  private _coordenadas: CoordenadasGPS | null;

  constructor(props: EnderecoProps) {
    if (!props.apelido || props.apelido.trim() === '') {
      throw new Error('Apelido do endereço é obrigatório');
    }
    if (!props.uc || props.uc.trim() === '') {
      throw new Error('UC do endereço é obrigatória');
    }

    this.id = props.id;
    this.empresaId = props.empresaId;
    this.apelido = props.apelido.trim();
    this.uc = props.uc.trim();
    this.ehUsina = props.ehUsina ?? false;
    this.rua = Endereco.opcional(props.rua);
    this.numero = Endereco.opcional(props.numero);
    this.bairro = Endereco.opcional(props.bairro);
    this.cidade = Endereco.opcional(props.cidade);
    this._coordenadas = props.coordenadas ?? null;
    this.criadoEm = props.criadoEm ?? new Date();
  }

  private static opcional(valor?: string | null): string | null {
    const limpo = valor?.trim();
    return limpo ? limpo : null;
  }

  public get coordenadas(): CoordenadasGPS | null {
    return this._coordenadas;
  }

  /** Só endereço de usina registra a leitura de injeção (campo 103). */
  public aceitaInjecao(): boolean {
    return this.ehUsina;
  }

  public temGeocerca(): boolean {
    return this._coordenadas !== null;
  }

  /**
   * Adota uma coordenada depois da criação. Serve para o caso em que o endereço
   * foi cadastrado sem GPS e a primeira leitura no local passa a valer como
   * referência da geocerca.
   */
  public definirCoordenadas(coordenadas: CoordenadasGPS): void {
    this._coordenadas = coordenadas;
  }

  /** Logradouro legível, omitindo os campos não preenchidos. */
  public logradouro(): string {
    const ruaComNumero = [this.rua, this.numero].filter(Boolean).join(', ');
    return [ruaComNumero, this.bairro, this.cidade].filter(Boolean).join(' · ');
  }
}
