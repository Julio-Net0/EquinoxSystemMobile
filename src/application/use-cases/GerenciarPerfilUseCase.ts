import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { ISessionStorage } from '@/domain/gateways/ISessionStorage';
import { IHashSenhaGateway } from '@/domain/gateways/IHashSenhaGateway';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

export interface AlterarDadosInput {
  usuarioId: string;
  nome: string;
  email: string;
  usuario: string;
}

export interface AlterarSenhaInput {
  usuarioId: string;
  senhaAtual: string;
  novaSenha: string;
  confirmacao: string;
}

export interface ResultadoPerfil {
  sucesso: boolean;
  erro?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MINIMO_SENHA = 6;

/** O próprio usuário editando seus dados e sua senha. */
export class GerenciarPerfilUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly sessionStorage: ISessionStorage,
    private readonly hashSenha: IHashSenhaGateway,
  ) {}

  public async alterarDados(entrada: AlterarDadosInput): Promise<ResultadoPerfil> {
    const eu = await this.usuarioRepo.buscarPorId(new UUIDv4(entrada.usuarioId));
    if (!eu) return { sucesso: false, erro: 'Sessão inválida. Entre de novo' };

    const nome = entrada.nome?.trim() ?? '';
    const email = entrada.email?.trim().toLowerCase() ?? '';
    const login = entrada.usuario?.trim().toLowerCase() ?? '';

    if (!nome || !email || !login) {
      return { sucesso: false, erro: 'Nome, e-mail e usuário são obrigatórios' };
    }
    if (!EMAIL_REGEX.test(email)) {
      return { sucesso: false, erro: 'O e-mail informado não parece válido' };
    }

    const donoDoEmail = await this.usuarioRepo.buscarPorEmail(email);
    if (donoDoEmail && !donoDoEmail.id.equals(eu.id)) {
      return { sucesso: false, erro: 'Este e-mail já está em uso' };
    }

    const donoDoLogin = await this.usuarioRepo.buscarPorLogin(login);
    if (donoDoLogin && !donoDoLogin.id.equals(eu.id)) {
      return { sucesso: false, erro: 'Este usuário já está em uso' };
    }

    const atualizado = new Usuario({
      id: eu.id,
      empresaId: eu.empresaId,
      nome,
      usuario: login,
      email,
      senha: eu.senha,
      perfil: eu.perfil,
      status: eu.status,
      enderecosVinculados: eu.enderecosVinculados,
      perfilAnterior: eu.perfilAnterior,
      criadoEm: eu.criadoEm,
      autorizadoEm: eu.autorizadoEm,
      autorizadoPorId: eu.autorizadoPorId,
    });
    await this.usuarioRepo.atualizar(atualizado);

    // A sessão carrega nome, login e e-mail para o cabeçalho; sem isto a tela
    // continuaria mostrando os dados antigos até o próximo login.
    const sessao = await this.sessionStorage.obterSessao();
    if (sessao && sessao.usuarioId === eu.id.value) {
      await this.sessionStorage.salvarSessao({ ...sessao, nome, email, usuario: login });
    }

    return { sucesso: true };
  }

  public async alterarSenha(entrada: AlterarSenhaInput): Promise<ResultadoPerfil> {
    const eu = await this.usuarioRepo.buscarPorId(new UUIDv4(entrada.usuarioId));
    if (!eu) return { sucesso: false, erro: 'Sessão inválida. Entre de novo' };

    if (!entrada.senhaAtual || !entrada.novaSenha || !entrada.confirmacao) {
      return {
        sucesso: false,
        erro: 'Informe a senha atual, a nova senha e a confirmação',
      };
    }
    if (entrada.novaSenha.length < MINIMO_SENHA) {
      return {
        sucesso: false,
        erro: `A nova senha precisa ter pelo menos ${MINIMO_SENHA} caracteres`,
      };
    }
    if (entrada.novaSenha !== entrada.confirmacao) {
      return { sucesso: false, erro: 'A nova senha e a confirmação não conferem' };
    }
    if (entrada.novaSenha === entrada.senhaAtual) {
      return { sucesso: false, erro: 'A nova senha precisa ser diferente da atual' };
    }

    if (!(await this.hashSenha.verificar(entrada.senhaAtual, eu.senha))) {
      return { sucesso: false, erro: 'A senha atual está incorreta' };
    }

    eu.trocarSenha(await this.hashSenha.gerar(entrada.novaSenha));
    await this.usuarioRepo.atualizar(eu);

    // Força entrar de novo com a senha nova, como o app antigo faz.
    await this.sessionStorage.limparSessao();

    return { sucesso: true };
  }
}
