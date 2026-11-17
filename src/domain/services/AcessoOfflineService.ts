import { ICredencialOfflineGateway } from '../gateways/ICredencialOfflineGateway';
import { IHashSenhaGateway } from '../gateways/IHashSenhaGateway';
import { CredencialEmMemoria, IReautenticacaoPendente } from '../gateways/IReautenticacaoPendente';
import { SessaoUsuarioData } from '../gateways/ISessionStorage';
import { SenhaHash } from '../value-objects/SenhaHash';

export type ResultadoEntradaOffline =
  | { tipo: 'liberado'; sessao: SessaoUsuarioData }
  /** Esta conta nunca entrou com senha neste aparelho. */
  | { tipo: 'sem_credencial' }
  | { tipo: 'senha_incorreta' };

const normalizar = (email: string): string => email.trim().toLowerCase();

/**
 * Entrar sem rede depois de já ter entrado uma vez com internet (ADR 10.18).
 *
 * - No login com internet, o aparelho guarda uma verificação derivada da
 *   senha (PBKDF2, na infraestrutura) junto com a sessão.
 * - Sem rede, a senha digitada é conferida contra essa verificação.
 * - A senha que liberou o acesso offline fica só em memória, para o app
 *   entrar na nuvem sozinho quando a conexão voltar.
 *
 * A verificação é esquecida quando deixa de ser confiável: senha trocada pelo
 * app, senha recusada pela nuvem, acesso desativado.
 */
export class AcessoOfflineService {
  constructor(
    private readonly credenciais: ICredencialOfflineGateway,
    private readonly hashSenha: IHashSenhaGateway,
    private readonly pendente: IReautenticacaoPendente,
  ) {}

  /** Depois de um login com internet: guarda a verificação para a próxima vez. */
  public async lembrar(email: string, senha: string, sessao: SessaoUsuarioData): Promise<void> {
    const verificador = await this.hashSenha.gerar(senha);
    await this.credenciais.guardar(normalizar(email), {
      sessao,
      verificador: verificador.serializar(),
    });
    this.pendente.limpar();
  }

  public async entrarSemRede(email: string, senha: string): Promise<ResultadoEntradaOffline> {
    const credencial = await this.credenciais.buscar(normalizar(email));
    if (!credencial) return { tipo: 'sem_credencial' };

    if (!(await this.confere(senha, credencial.verificador))) {
      return { tipo: 'senha_incorreta' };
    }

    this.pendente.guardar({ email: normalizar(email), senha });
    return { tipo: 'liberado', sessao: credencial.sessao };
  }

  /**
   * A nuvem recusou a senha. Se é a mesma que o aparelho conhece, ela foi
   * trocada em outro lugar e a verificação guardada ficou velha. Se não é,
   * foi só erro de digitação — e a verificação continua valendo.
   */
  public async esquecerSeForAMesma(email: string, senha: string): Promise<void> {
    const credencial = await this.credenciais.buscar(normalizar(email));
    if (credencial && (await this.confere(senha, credencial.verificador))) {
      await this.credenciais.esquecer(normalizar(email));
    }
  }

  public async esquecer(email: string): Promise<void> {
    await this.credenciais.esquecer(normalizar(email));
  }

  /** A senha em memória, se for desta conta. */
  public pendenteDe(email: string): CredencialEmMemoria | null {
    const pendente = this.pendente.obter();
    return pendente && pendente.email === normalizar(email) ? pendente : null;
  }

  public concluirReautenticacao(): void {
    this.pendente.limpar();
  }

  private async confere(senha: string, verificador: string): Promise<boolean> {
    try {
      return await this.hashSenha.verificar(senha, SenhaHash.deSerializado(verificador));
    } catch {
      return false;
    }
  }
}
