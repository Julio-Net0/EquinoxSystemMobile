import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { IEmpresaRepository } from '@/domain/repositories/IEmpresaRepository';
import { IHashSenhaGateway } from '@/domain/gateways/IHashSenhaGateway';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MINIMO_SENHA = 6;

/**
 * Autocadastro público. O usuário nasce Técnico e Pendente, sem endereço: quem
 * define perfil e vínculos é o administrador, na tela de autorizações.
 */
export class CadastrarUsuarioPendenteUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly empresaRepo: IEmpresaRepository,
    private readonly hashSenha: IHashSenhaGateway,
  ) {}

  public async executar(
    entrada: CadastrarUsuarioPendenteInput,
  ): Promise<CadastrarUsuarioPendenteOutput> {
    const nome = entrada.nome?.trim() ?? '';
    const login = entrada.usuario?.trim() ?? '';
    const email = entrada.email?.trim() ?? '';

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

    const empresa = await this.empresaRepo.buscarPorId(new UUIDv4(entrada.empresaId));
    if (!empresa) {
      return { sucesso: false, erro: 'Empresa não encontrada' };
    }

    if (await this.usuarioRepo.buscarPorEmail(email)) {
      return { sucesso: false, erro: 'Este e-mail já está cadastrado' };
    }
    // buscarPorLogin cobre e-mail e login; aqui só o login ainda não foi checado.
    const jaUsaOLogin = await this.usuarioRepo.buscarPorLogin(login);
    if (jaUsaOLogin) {
      return { sucesso: false, erro: 'Este usuário já está em uso' };
    }

    const novo = new Usuario({
      id: UUIDv4.gerar(),
      empresaId: empresa.id,
      nome,
      usuario: login,
      email,
      senha: await this.hashSenha.gerar(entrada.senha),
      perfil: PerfilEnum.TECNICO,
      status: StatusUsuarioEnum.PENDENTE,
      enderecosVinculados: [],
    });

    await this.usuarioRepo.salvar(novo);

    return { sucesso: true, usuarioId: novo.id.value };
  }
}
