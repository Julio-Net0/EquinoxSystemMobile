import { UUIDv4 } from '../value-objects/UUIDv4';
import { CNPJ } from '../value-objects/CNPJ';

export interface EmpresaProps {
  id: UUIDv4;
  nome: string;
  cnpj: CNPJ;
  dataCriacao?: Date;
}

export class Empresa {
  public readonly id: UUIDv4;
  public readonly nome: string;
  public readonly cnpj: CNPJ;
  public readonly dataCriacao: Date;

  constructor(props: EmpresaProps) {
    if (!props.nome || props.nome.trim() === '') {
      throw new Error('Nome da empresa é obrigatório');
    }
    this.id = props.id;
    this.nome = props.nome.trim();
    this.cnpj = props.cnpj;
    this.dataCriacao = props.dataCriacao ?? new Date();
  }
}
