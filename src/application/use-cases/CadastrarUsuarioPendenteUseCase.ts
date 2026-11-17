import {
  EmpresaParaCadastro,
  IAutenticacaoRemotaGateway,
} from '@/domain/gateways/IAutenticacaoRemotaGateway';

export interface CadastrarUsuarioPendenteInput {
  empresaId: string;
  nome: string;
  usuario: string;
  email: string;
  senha: string;
  confirmacaoSenha: string;
}

export interface CadastrarUsuarioPendenteOutput {
  sucesso: boolean;
  usuarioId?: string;
  erro?: string;
}

export interface BuscarEmpresasOutput {
  empresas: EmpresaParaCadastro[];
  erro?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MINIMO_SENHA = 6;
const SEM_REDE = 'Sem conexão. O cadastro precisa de internet';

/**
 * Autocadastro público, feito na nuvem — é uma das operações que exigem rede.
 *
 * O usuário nasce Técnico e Pendente, sem endereço: quem define perfil e
 * vínculos é o administrador, na tela de autorizações. Nível e status não são
 * enviados daqui; quem os fixa é o servidor, para que um cliente adulterado
 * não consiga se cadastrar já como administrador.
 */
export class CadastrarUsuarioPendenteUseCase {
  constructor(private readonly autenticacaoRemota: IAutenticacaoRemotaGateway) {}

  /** Busca de empresa antes do login: o servidor só devolve id e nome. */
  public async buscarEmpresas(termo: string): Promise<BuscarEmpresasOutput> {
    const resultado = await this.autenticacaoRemota.buscarEmpresasParaCadastro(termo ?? '');
    if (!resultado.ok) {
      return {
        empresas: [],
        erro:
          resultado.motivo === 'rede'
            ? 'Sem conexão. A lista de empresas precisa de internet'
            : 'Não foi possível buscar as empresas',
      };
    }
    return { empresas: resultado.valor };
  }

  public async executar(
    entrada: CadastrarUsuarioPendenteInput,
  ): Promise<CadastrarUsuarioPendenteOutput> {
    const nome = entrada.nome?.trim() ?? '';
    const login = entrada.usuario?.trim().toLowerCase() ?? '';
    const email = entrada.email?.trim().toLowerCase() ?? '';

    if (!nome || !login || !email || !entrada.senha || !entrada.empresaId) {
      return { sucesso: false, erro: 'Preencha todos os campos' };
    }
    if (!EMAIL_REGEX.test(email)) {
      return { sucesso: false, erro: 'O e-mail informado não parece válido' };
    }
    if (entrada.senha.length < MINIMO_SENHA) {
      return { sucesso: false, erro: `A senha deve ter ao menos ${MINIMO_SENHA} caracteres` };
    }
    if (entrada.senha !== entrada.confirmacaoSenha) {
      return { sucesso: false, erro: 'As senhas não coincidem' };
    }

    const resultado = await this.autenticacaoRemota.cadastrar({
      empresaId: entrada.empresaId,
      nome,
      usuario: login,
      email,
      senha: entrada.senha,
    });

    if (!resultado.ok) {
      return {
        sucesso: false,
        erro: resultado.motivo === 'rede' ? SEM_REDE : resultado.mensagem,
      };
    }

    return { sucesso: true, usuarioId: resultado.valor.usuarioId };
  }
}
