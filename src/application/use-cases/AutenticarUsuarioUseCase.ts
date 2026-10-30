import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { ISessionStorage, SessaoUsuarioData } from '@/domain/gateways/ISessionStorage';
import { IHashSenhaGateway } from '@/domain/gateways/IHashSenhaGateway';
import { Usuario } from '@/domain/entities/Usuario';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';

export interface AutenticarUsuarioInput {
  /** E-mail ou nome de login — o app antigo aceita os dois. */
  login: string;
  senha: string;
}

export interface AutenticarUsuarioOutput {
  sucesso: boolean;
  usuario?: SessaoUsuarioData;
  erro?: string;
}

const CREDENCIAL_INVALIDA = 'E-mail, usuário ou senha incorretos';

/**
 * Login local, contra a tabela de usuários do SQLite. Não há rede nem token.
 *
 * Credencial errada e usuário inexistente devolvem a mesma mensagem, de
 * propósito: distinguir as duas diria a quem tentasse adivinhar quais contas
 * existem no aparelho.
 */
export class AutenticarUsuarioUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly sessionStorage: ISessionStorage,
    private readonly hashSenha: IHashSenhaGateway,
  ) {}

  public async executar(entrada: AutenticarUsuarioInput): Promise<AutenticarUsuarioOutput> {
    const login = entrada.login?.trim() ?? '';
    if (login === '') {
      return { sucesso: false, erro: 'Informe o e-mail ou usuário' };
    }
    if (!entrada.senha) {
      return { sucesso: false, erro: 'Informe a senha' };
    }

    const usuario = await this.usuarioRepo.buscarPorLogin(login);
    if (!usuario) {
      return { sucesso: false, erro: CREDENCIAL_INVALIDA };
    }

    const senhaConfere = await this.hashSenha.verificar(entrada.senha, usuario.senha);
    if (!senhaConfere) {
      return { sucesso: false, erro: CREDENCIAL_INVALIDA };
    }

    const impedimento = AutenticarUsuarioUseCase.impedimentoDeStatus(usuario);
    if (impedimento) {
      return { sucesso: false, erro: impedimento };
    }

    const sessao: SessaoUsuarioData = {
      usuarioId: usuario.id.value,
      empresaId: usuario.empresaId?.value ?? null,
      nome: usuario.nome,
      usuario: usuario.usuario,
      email: usuario.email,
      perfil: usuario.perfil,
    };
    await this.sessionStorage.salvarSessao(sessao);

    return { sucesso: true, usuario: sessao };
  }

  /**
   * A senha já conferiu aqui, então dizer o motivo exato não vaza nada e evita
   * que quem acabou de se cadastrar fique sem entender por que não entra.
   */
  private static impedimentoDeStatus(usuario: Usuario): string | null {
    switch (usuario.status) {
      case StatusUsuarioEnum.PENDENTE:
        return 'Seu cadastro ainda aguarda autorização de um administrador';
      case StatusUsuarioEnum.RECUSADO:
        return 'Seu cadastro não foi autorizado';
      case StatusUsuarioEnum.INATIVO:
        return 'Seu acesso está inativo. Procure um administrador';
      default:
        return null;
    }
  }
}
