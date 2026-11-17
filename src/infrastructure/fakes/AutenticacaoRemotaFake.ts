import {
  DadosDeCadastroRemoto,
  EmpresaParaCadastro,
  IAutenticacaoRemotaGateway,
  IdentidadeRemota,
} from '@/domain/gateways/IAutenticacaoRemotaGateway';
import { ResultadoRemoto, remotoFalhou, remotoOk } from '@/domain/gateways/ResultadoRemoto';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';

interface Conta {
  senha: string;
  perfil: Usuario | null;
  id: string;
  email: string;
}

const SEM_REDE = 'Sem conexão com a internet';

/**
 * Serviço de autenticação de mentira, em memória. Guarda contas (e-mail,
 * senha, perfil) e uma sessão corrente; `online = false` simula o aparelho sem
 * sinal.
 */
export class AutenticacaoRemotaFake implements IAutenticacaoRemotaGateway {
  public online = true;
  public empresas: EmpresaParaCadastro[] = [];
  public cadastros: DadosDeCadastroRemoto[] = [];
  public saidas = 0;
  /** Simula o token de renovação revogado no servidor. */
  public sessaoRevogada = false;

  private contas = new Map<string, Conta>();
  private sessao: IdentidadeRemota | null = null;

  /** Registra uma conta que já existe na nuvem. */
  public registrarConta(perfil: Usuario, senha: string): void {
    this.contas.set(perfil.email, { id: perfil.id.value, email: perfil.email, senha, perfil });
  }

  /** Conta que autentica mas não tem perfil no app (criada à mão no painel). */
  public registrarContaSemPerfil(email: string, senha: string): string {
    const id = UUIDv4.gerar().value;
    this.contas.set(email, { id, email, senha, perfil: null });
    return id;
  }

  public get sessaoAtual(): IdentidadeRemota | null {
    return this.sessao;
  }

  async entrar(email: string, senha: string): Promise<ResultadoRemoto<IdentidadeRemota>> {
    if (!this.online) return remotoFalhou('rede', SEM_REDE);

    const conta = this.contas.get(email.trim().toLowerCase());
    if (!conta || conta.senha !== senha) {
      return remotoFalhou('rejeitado', 'Invalid login credentials');
    }

    this.sessao = { usuarioId: conta.id, email: conta.email };
    this.sessaoRevogada = false;
    return remotoOk(this.sessao);
  }

  async cadastrar(dados: DadosDeCadastroRemoto): Promise<ResultadoRemoto<IdentidadeRemota>> {
    if (!this.online) return remotoFalhou('rede', SEM_REDE);

    const email = dados.email.trim().toLowerCase();
    if (this.contas.has(email)) {
      return remotoFalhou('rejeitado', 'Este e-mail já está cadastrado');
    }
    const loginEmUso = Array.from(this.contas.values()).some(
      (c) => c.perfil?.usuario === dados.usuario.trim().toLowerCase(),
    );
    if (loginEmUso) {
      return remotoFalhou('rejeitado', 'Este usuário já está em uso');
    }

    const id = UUIDv4.gerar();
    this.cadastros.push(dados);
    this.contas.set(email, {
      id: id.value,
      email,
      senha: dados.senha,
      // O servidor decide nível e status: técnico e pendente, sempre.
      perfil: new Usuario({
        id,
        empresaId: new UUIDv4(dados.empresaId),
        nome: dados.nome,
        usuario: dados.usuario,
        email,
        perfil: PerfilEnum.TECNICO,
        status: StatusUsuarioEnum.PENDENTE,
      }),
    });

    return remotoOk({ usuarioId: id.value, email });
  }

  async buscarEmpresasParaCadastro(
    termo: string,
  ): Promise<ResultadoRemoto<EmpresaParaCadastro[]>> {
    if (!this.online) return remotoFalhou('rede', SEM_REDE);

    const procurado = termo.trim().toLowerCase();
    return remotoOk(this.empresas.filter((e) => e.nome.toLowerCase().includes(procurado)));
  }

  async obterMeuPerfil(): Promise<ResultadoRemoto<Usuario | null>> {
    if (!this.online) return remotoFalhou('rede', SEM_REDE);
    if (!this.sessao) return remotoFalhou('nao_autenticado', 'Sem sessão');

    return remotoOk(this.contas.get(this.sessao.email)?.perfil ?? null);
  }

  async alterarSenha(senhaAtual: string, novaSenha: string): Promise<ResultadoRemoto> {
    if (!this.online) return remotoFalhou('rede', SEM_REDE);
    if (!this.sessao) return remotoFalhou('nao_autenticado', 'Sem sessão');

    const conta = this.contas.get(this.sessao.email);
    if (!conta || conta.senha !== senhaAtual) {
      return remotoFalhou('rejeitado', 'Invalid login credentials');
    }

    conta.senha = novaSenha;
    return remotoOk();
  }

  async garantirSessao(): Promise<ResultadoRemoto<IdentidadeRemota | null>> {
    if (!this.sessao) return remotoOk(null);
    if (!this.online) return remotoFalhou('rede', SEM_REDE);
    if (this.sessaoRevogada) {
      this.sessao = null;
      return remotoFalhou('nao_autenticado', 'Sessão expirada');
    }
    return remotoOk(this.sessao);
  }

  async sair(): Promise<void> {
    this.saidas += 1;
    this.sessao = null;
  }
}
