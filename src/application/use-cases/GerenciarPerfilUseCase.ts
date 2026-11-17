import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { ISessionStorage } from '@/domain/gateways/ISessionStorage';
import { IAutenticacaoRemotaGateway } from '@/domain/gateways/IAutenticacaoRemotaGateway';
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

/**
 * O próprio usuário editando seus dados e sua senha.
 *
 * Nome e apelido mudam no aparelho e sobem pela fila, como qualquer escrita.
 * Já o e-mail e a senha são a identidade no serviço de autenticação da nuvem:
 * a senha só troca com rede, e o e-mail não troca por aqui.
 */
export class GerenciarPerfilUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly sessionStorage: ISessionStorage,
    private readonly autenticacaoRemota: IAutenticacaoRemotaGateway,
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

    if (email !== eu.email) {
      return {
        sucesso: false,
        erro: 'O e-mail é a sua identidade de acesso e não pode ser alterado por aqui. Procure um administrador',
      };
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

    // A senha vive só no serviço de autenticação da nuvem: é lá que a atual
    // é conferida e a nova é gravada. O aparelho não guarda nenhuma das duas.
    const troca = await this.autenticacaoRemota.alterarSenha(entrada.senhaAtual, entrada.novaSenha);
    if (!troca.ok) {
      if (troca.motivo === 'rede') {
        return { sucesso: false, erro: 'Sem conexão. A troca de senha precisa de internet' };
      }
      if (troca.motivo === 'nao_autenticado') {
        return { sucesso: false, erro: 'Sua sessão na nuvem expirou. Entre de novo para trocar a senha' };
      }
      return { sucesso: false, erro: 'A senha atual está incorreta' };
    }

    // Força entrar de novo com a senha nova, como o app antigo faz.
    await this.autenticacaoRemota.sair();
    await this.sessionStorage.limparSessao();

    return { sucesso: true };
  }
}
