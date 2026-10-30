import { UUIDv4 } from '../value-objects/UUIDv4';

export interface PadraoCemigProps {
  id: UUIDv4;
  enderecoId: UUIDv4;
  numero: string;
  criadoEm?: Date;
}

/**
 * Padrão de medição da concessionária. É a unidade real de leitura: um endereço
 * pode ter vários, e a regra de uma leitura vigente por dia vale por padrão,
 * não por endereço.
 *
 * A unicidade do número dentro do endereço é garantida no schema, não aqui — a
 * entidade não tem como consultar os irmãos.
 */
export class PadraoCemig {
  public readonly id: UUIDv4;
  public readonly enderecoId: UUIDv4;
  public readonly numero: string;
  public readonly criadoEm: Date;

  constructor(props: PadraoCemigProps) {
    if (!props.numero || props.numero.trim() === '') {
      throw new Error('Número do padrão é obrigatório');
    }

    this.id = props.id;
    this.enderecoId = props.enderecoId;
    this.numero = props.numero.trim();
    this.criadoEm = props.criadoEm ?? new Date();
  }
}
