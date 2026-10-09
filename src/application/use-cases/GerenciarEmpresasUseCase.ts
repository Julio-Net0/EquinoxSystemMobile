import { IEmpresaRepository } from '@/domain/repositories/IEmpresaRepository';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';

export interface CriarEmpresaInputDTO {
  nome: string;
  cnpj: string;
}

export interface EmpresaOutputDTO {
  id: string;
  nome: string;
  cnpj: string;
  dataCriacao: Date;
}

export class GerenciarEmpresasUseCase {
  constructor(private empresaRepository: IEmpresaRepository) {}

  async criar(input: CriarEmpresaInputDTO): Promise<EmpresaOutputDTO> {
    const novaoCNPJ = new CNPJ(input.cnpj);

    const empresa = new Empresa({
      id: UUIDv4.gerar(),
      nome: input.nome,
      cnpj: novaoCNPJ,
    });

    await this.empresaRepository.salvar(empresa);

    return {
      id: empresa.id.value,
      nome: empresa.nome,
      cnpj: empresa.cnpj.formatado,
      dataCriacao: empresa.dataCriacao,
    };
  }

  async listar(): Promise<EmpresaOutputDTO[]> {
    const empresas = await this.empresaRepository.listarTodas();

    return empresas.map((e) => ({
      id: e.id.value,
      nome: e.nome,
      cnpj: e.cnpj.formatado,
      dataCriacao: e.dataCriacao,
    }));
  }
}
