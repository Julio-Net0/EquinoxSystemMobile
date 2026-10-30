import { IEmpresaRepository } from '@/domain/repositories/IEmpresaRepository';
import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { Empresa } from '@/domain/entities/Empresa';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

export interface CriarEmpresaInput {
  atorId: string;
  nome: string;
  cnpj: string;
}

export interface EmpresaOutputDTO {
  id: string;
  nome: string;
  cnpj: string;
  dataCriacao: Date;
}

export interface CriarEmpresaOutput {
  sucesso: boolean;
  empresa?: EmpresaOutputDTO;
  erro?: string;
}

const paraDTO = (empresa: Empresa): EmpresaOutputDTO => ({
  id: empresa.id.value,
  nome: empresa.nome,
  cnpj: empresa.cnpj.formatado,
  dataCriacao: empresa.dataCriacao,
});

export class GerenciarEmpresasUseCase {
  constructor(
    private readonly empresaRepository: IEmpresaRepository,
    private readonly usuarioRepository: IUsuarioRepository,
  ) {}

  /** Cadastrar empresa é privilégio do super admin, como no app antigo. */
  public async criar(entrada: CriarEmpresaInput): Promise<CriarEmpresaOutput> {
    const ator = await this.usuarioRepository.buscarPorId(new UUIDv4(entrada.atorId));
    if (!ator) {
      return { sucesso: false, erro: 'Sessão inválida. Entre de novo' };
    }
    if (ator.perfil !== PerfilEnum.SUPER_ADMIN) {
      return { sucesso: false, erro: 'Apenas o super admin cadastra empresas' };
    }

    const nome = entrada.nome?.trim() ?? '';
    if (!nome) {
      return { sucesso: false, erro: 'Informe o nome da empresa' };
    }

    // O VO valida os dígitos verificadores e lança; aqui a mensagem é
    // transformada em algo que a tela possa mostrar.
    let cnpj: CNPJ;
    try {
      cnpj = new CNPJ(entrada.cnpj);
    } catch (falha) {
      return { sucesso: false, erro: (falha as Error).message };
    }

    // Checa antes de gravar: a coluna é UNIQUE e o erro do SQLite não é
    // legível para o usuário.
    const existentes = await this.empresaRepository.listarTodas();
    if (existentes.some((e) => e.cnpj.equals(cnpj))) {
      return { sucesso: false, erro: 'Já existe empresa com este CNPJ' };
    }

    const empresa = new Empresa({ id: UUIDv4.gerar(), nome, cnpj });
    await this.empresaRepository.salvar(empresa);

    return { sucesso: true, empresa: paraDTO(empresa) };
  }

  /**
   * Sem verificação de ator: a tela pública de cadastro precisa das empresas
   * para o usuário escolher a sua antes de ter sessão.
   */
  public async listar(): Promise<EmpresaOutputDTO[]> {
    return (await this.empresaRepository.listarTodas()).map(paraDTO);
  }
}
