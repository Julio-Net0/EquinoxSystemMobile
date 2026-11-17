import { IAutenticacaoRemotaGateway } from '@/domain/gateways/IAutenticacaoRemotaGateway';
import { ISessionStorage, SessaoUsuarioData } from '@/domain/gateways/ISessionStorage';
import { Usuario } from '@/domain/entities/Usuario';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { AcessoOfflineService } from '@/domain/services/AcessoOfflineService';
import { TrocaDeUsuarioService } from '@/domain/services/TrocaDeUsuarioService';

export interface AutenticarUsuarioInput {
  /** E-mail. O login por nome de usuário foi aposentado com a ida para a nuvem. */
  login: string;
  senha: string;
}

export interface AutenticarUsuarioOutput {
  sucesso: boolean;
  usuario?: SessaoUsuarioData;
  erro?: string;
  /** Entrou sem rede, conferindo a senha no aparelho (ADR 10.18). */
  offline?: boolean;
}

const CREDENCIAL_INVALIDA = 'E-mail ou senha incorretos';
const SEM_REDE =
  'Sem conexão. O primeiro acesso desta conta neste aparelho precisa de internet; depois dele dá para entrar também sem rede';

/**
 * Login na nuvem (Supabase Auth).
 *
 * Com rede, a nuvem confere a senha; o aparelho guarda a sessão e uma
 * verificação derivada da senha. Sem rede, quem já entrou com internet neste
 * aparelho entra conferindo a senha contra essa verificação, e o app volta a
 * entrar na nuvem sozinho quando a conexão voltar (ADR 10.18). Só o primeiro
 * acesso de cada conta no aparelho exige rede.
 *
 * Credencial errada e conta inexistente devolvem a mesma mensagem, de
 * propósito: distinguir as duas diria a quem tentasse adivinhar quais contas
 * existem.
 */
export class AutenticarUsuarioUseCase {
  constructor(
    private readonly autenticacaoRemota: IAutenticacaoRemotaGateway,
    private readonly sessionStorage: ISessionStorage,
    private readonly acessoOffline: AcessoOfflineService,
    private readonly trocaDeUsuario: TrocaDeUsuarioService,
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
      if (acesso.motivo === 'rede') return this.entrarSemRede(email, entrada.senha);

      await this.acessoOffline.esquecerSeForAMesma(email, entrada.senha);
      return { sucesso: false, erro: CREDENCIAL_INVALIDA };
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
      await this.acessoOffline.esquecer(email);
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
    await this.trocaDeUsuario.prepararPara(sessao.usuarioId, { comRede: true });
    await this.sessionStorage.salvarSessao(sessao);
    await this.acessoOffline.lembrar(email, entrada.senha, sessao);

    return { sucesso: true, usuario: sessao };
  }

  private async entrarSemRede(email: string, senha: string): Promise<AutenticarUsuarioOutput> {
    const resultado = await this.acessoOffline.entrarSemRede(email, senha);

    if (resultado.tipo === 'sem_credencial') return { sucesso: false, erro: SEM_REDE };
    if (resultado.tipo === 'senha_incorreta') return { sucesso: false, erro: CREDENCIAL_INVALIDA };

    await this.trocaDeUsuario.prepararPara(resultado.sessao.usuarioId, { comRede: false });
    await this.sessionStorage.salvarSessao(resultado.sessao);
    return { sucesso: true, usuario: resultado.sessao, offline: true };
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
