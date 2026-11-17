import { IAutenticacaoRemotaGateway } from '@/domain/gateways/IAutenticacaoRemotaGateway';
import { ISessionStorage, SessaoUsuarioData } from '@/domain/gateways/ISessionStorage';
import {
  CHAVE_CURSORES,
  CHAVE_USUARIO_DO_CURSOR,
  ISyncMetaRepository,
} from '@/domain/repositories/ISyncMetaRepository';
import { Usuario } from '@/domain/entities/Usuario';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';

export interface AutenticarUsuarioInput {
  /** E-mail. O login por nome de usuário foi aposentado com a ida para a nuvem. */
  login: string;
  senha: string;
}

export interface AutenticarUsuarioOutput {
  sucesso: boolean;
  usuario?: SessaoUsuarioData;
  erro?: string;
}

const CREDENCIAL_INVALIDA = 'E-mail ou senha incorretos';
const SEM_REDE =
  'Sem conexão. O primeiro acesso neste aparelho precisa de internet; depois dele o app funciona offline';

/**
 * Login na nuvem (Supabase Auth). É a única operação de entrada que exige
 * rede: depois dela a sessão fica no armazenamento seguro e o app reabre
 * autenticado mesmo sem sinal.
 *
 * Credencial errada e conta inexistente devolvem a mesma mensagem, de
 * propósito: distinguir as duas diria a quem tentasse adivinhar quais contas
 * existem.
 */
export class AutenticarUsuarioUseCase {
  constructor(
    private readonly autenticacaoRemota: IAutenticacaoRemotaGateway,
    private readonly sessionStorage: ISessionStorage,
    private readonly syncMeta: ISyncMetaRepository,
  ) {}

  public async executar(entrada: AutenticarUsuarioInput): Promise<AutenticarUsuarioOutput> {
    const email = entrada.login?.trim().toLowerCase() ?? '';
    if (email === '') {
      return { sucesso: false, erro: 'Informe o e-mail' };
    }
    if (!email.includes('@')) {
      return {
        sucesso: false,
        erro: 'Entre com o seu e-mail — o acesso por nome de usuário foi desativado',
      };
    }
    if (!entrada.senha) {
      return { sucesso: false, erro: 'Informe a senha' };
    }

    const acesso = await this.autenticacaoRemota.entrar(email, entrada.senha);
    if (!acesso.ok) {
      return { sucesso: false, erro: acesso.motivo === 'rede' ? SEM_REDE : CREDENCIAL_INVALIDA };
    }

    const perfil = await this.autenticacaoRemota.obterMeuPerfil();
    if (!perfil.ok) {
      return this.recusar(perfil.motivo === 'rede' ? SEM_REDE : 'Não foi possível ler o seu perfil');
    }
    if (!perfil.valor) {
      return this.recusar('Sua conta não tem perfil neste app. Procure um administrador');
    }

    const impedimento = AutenticarUsuarioUseCase.impedimentoDeStatus(perfil.valor);
    if (impedimento) {
      return this.recusar(impedimento);
    }

    const usuario = perfil.valor;
    const sessao: SessaoUsuarioData = {
      usuarioId: usuario.id.value,
      empresaId: usuario.empresaId?.value ?? null,
      nome: usuario.nome,
      usuario: usuario.usuario,
      email: usuario.email,
      perfil: usuario.perfil,
    };
    await this.sessionStorage.salvarSessao(sessao);

    // Os cursores do pull valem para o que UM usuário pode ver. Trocou de
    // usuário neste aparelho, o próximo pull recomeça do zero.
    if ((await this.syncMeta.obter(CHAVE_USUARIO_DO_CURSOR)) !== sessao.usuarioId) {
      await this.syncMeta.definir(CHAVE_CURSORES, null);
      await this.syncMeta.definir(CHAVE_USUARIO_DO_CURSOR, sessao.usuarioId);
    }

    return { sucesso: true, usuario: sessao };
  }

  /** Quem não pode entrar não deve ficar com token guardado no aparelho. */
  private async recusar(erro: string): Promise<AutenticarUsuarioOutput> {
    await this.autenticacaoRemota.sair();
    return { sucesso: false, erro };
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
