import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { IEnderecoRepository } from '@/domain/repositories/IEnderecoRepository';
import { Usuario } from '@/domain/entities/Usuario';
import { Endereco } from '@/domain/entities/Endereco';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { IRelogio, relogioSistema } from '@/domain/services/Relogio';
import { RegraAutorizacaoUsuarioService } from '@/domain/services/RegraAutorizacaoUsuarioService';

export interface EnderecoResumoDTO {
  apelido: string;
  uc: string;
}

/** Nunca carrega o hash da senha: este DTO vai para a tela. */
export interface UsuarioResumoDTO {
  usuarioId: string;
  nome: string;
  usuario: string;
  email: string;
  perfil: PerfilEnum;
  status: StatusUsuarioEnum;
  enderecos: EnderecoResumoDTO[];
}

export interface ListarUsuariosInput {
  atorId: string;
  status?: StatusUsuarioEnum;
  perfil?: PerfilEnum;
  termoBusca?: string;
}

export interface AtualizarUsuarioInput {
  atorId: string;
  usuarioId: string;
  nome: string;
  email: string;
  perfil: PerfilEnum;
  status: StatusUsuarioEnum;
  enderecoIds: string[];
}

export interface AcaoSobreUsuarioInput {
  atorId: string;
  usuarioId: string;
}

export interface ResultadoAcao {
  sucesso: boolean;
  erro?: string;
}

/**
 * Administração de usuários. O escopo do ator limita tudo: administrador vê e
 * mexe só na própria empresa, super admin alcança todas.
 */
export class GerenciarUsuariosEmpresaUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly enderecoRepo: IEnderecoRepository,
    private readonly relogio: IRelogio = relogioSistema,
  ) {}

  public async listar(
    entrada: ListarUsuariosInput,
  ): Promise<{ usuarios: UsuarioResumoDTO[]; erro?: string }> {
    const ator = await this.usuarioRepo.buscarPorId(new UUIDv4(entrada.atorId));
    if (!ator) return { usuarios: [], erro: 'Sessão inválida. Entre de novo' };

    const permissao = RegraAutorizacaoUsuarioService.podeGerenciar(
      ator.perfil,
      ator.empresaId,
      ator.empresaId,
    );
    if (!permissao.ok) return { usuarios: [], erro: permissao.motivo };

    const usuarios = await this.usuarioRepo.listarComFiltros({
      // Super admin não filtra por empresa; administrador fica preso à sua.
      empresaId: ator.ehGlobal() ? undefined : (ator.empresaId ?? undefined),
      status: entrada.status,
      perfil: entrada.perfil,
      termoBusca: entrada.termoBusca,
    });

    const enderecos = await this.enderecoRepo.listarTodos();
    return { usuarios: usuarios.map((u) => this.paraResumo(u, enderecos)) };
  }

  public async atualizar(entrada: AtualizarUsuarioInput): Promise<ResultadoAcao> {
    const contexto = await this.carregarContexto(entrada.atorId, entrada.usuarioId);
    if ('erro' in contexto) return { sucesso: false, erro: contexto.erro };
    const { alvo } = contexto;

    const nome = entrada.nome?.trim() ?? '';
    const email = entrada.email?.trim().toLowerCase() ?? '';
    if (!nome || !email) {
      return { sucesso: false, erro: 'Preencha nome e e-mail' };
    }

    const donoDoEmail = await this.usuarioRepo.buscarPorEmail(email);
    if (donoDoEmail && !donoDoEmail.id.equals(alvo.id)) {
      return { sucesso: false, erro: 'Este e-mail já está em uso por outro usuário' };
    }

    const enderecoIds = entrada.enderecoIds.map((id) => new UUIDv4(id));

    // A exigência de endereço só vale para quem fica ativo: um usuário inativo
    // ou recusado pode legitimamente não ter vínculo nenhum.
    if (entrada.status === StatusUsuarioEnum.ATIVO) {
      const regra = RegraAutorizacaoUsuarioService.podeAtivar(entrada.perfil, enderecoIds);
      if (!regra.ok) return { sucesso: false, erro: regra.motivo };
    }

    const atualizado = new Usuario({
      id: alvo.id,
      empresaId: alvo.empresaId,
      nome,
      usuario: alvo.usuario,
      email,
      senha: alvo.senha,
      perfil: entrada.perfil,
      status: entrada.status,
      enderecosVinculados: enderecoIds,
      perfilAnterior: alvo.perfilAnterior,
      criadoEm: alvo.criadoEm,
      autorizadoEm: alvo.autorizadoEm,
      autorizadoPorId: alvo.autorizadoPorId,
    });

    await this.usuarioRepo.atualizar(atualizado);
    return { sucesso: true };
  }

  public async alternarStatus(entrada: AcaoSobreUsuarioInput): Promise<ResultadoAcao> {
    if (entrada.atorId === entrada.usuarioId) {
      return { sucesso: false, erro: 'Você não pode alterar o seu próprio acesso' };
    }

    const contexto = await this.carregarContexto(entrada.atorId, entrada.usuarioId);
    if ('erro' in contexto) return { sucesso: false, erro: contexto.erro };
    const { ator, alvo } = contexto;

    if (alvo.isAtivo()) {
      alvo.inativar();
    } else {
      const regra = RegraAutorizacaoUsuarioService.podeAtivar(
        alvo.perfil,
        alvo.enderecosVinculados,
      );
      if (!regra.ok) return { sucesso: false, erro: regra.motivo };
      alvo.ativar(ator.id, this.relogio.agora());
    }

    await this.usuarioRepo.atualizar(alvo);
    return { sucesso: true };
  }

  /**
   * Reaprovação em um toque: reusa o perfil e os endereços que o usuário já
   * tinha antes de ser recusado, como o atalho "Aprovar" do app antigo.
   */
  public async aprovarRapido(entrada: AcaoSobreUsuarioInput): Promise<ResultadoAcao> {
    const contexto = await this.carregarContexto(entrada.atorId, entrada.usuarioId);
    if ('erro' in contexto) return { sucesso: false, erro: contexto.erro };
    const { ator, alvo } = contexto;

    const perfil = alvo.perfilAnterior ?? alvo.perfil;
    const regra = RegraAutorizacaoUsuarioService.podeAtivar(perfil, alvo.enderecosVinculados);
    if (!regra.ok) {
      return { sucesso: false, erro: 'Vincule ao menos um endereço pela edição para aprovar' };
    }

    alvo.atualizarPerfil(perfil);
    alvo.ativar(ator.id, this.relogio.agora());
    await this.usuarioRepo.atualizar(alvo);

    return { sucesso: true };
  }

  public async excluir(entrada: AcaoSobreUsuarioInput): Promise<ResultadoAcao> {
    if (entrada.atorId === entrada.usuarioId) {
      return { sucesso: false, erro: 'Você não pode excluir a sua própria conta' };
    }

    const contexto = await this.carregarContexto(entrada.atorId, entrada.usuarioId);
    if ('erro' in contexto) return { sucesso: false, erro: contexto.erro };

    await this.usuarioRepo.excluir(contexto.alvo.id);
    return { sucesso: true };
  }

  private async carregarContexto(
    atorId: string,
    usuarioId: string,
  ): Promise<{ ator: Usuario; alvo: Usuario } | { erro: string }> {
    const ator = await this.usuarioRepo.buscarPorId(new UUIDv4(atorId));
    if (!ator) return { erro: 'Sessão inválida. Entre de novo' };

    const alvo = await this.usuarioRepo.buscarPorId(new UUIDv4(usuarioId));
    if (!alvo) return { erro: 'Usuário não encontrado' };

    const permissao = RegraAutorizacaoUsuarioService.podeGerenciar(
      ator.perfil,
      ator.empresaId,
      alvo.empresaId,
    );
    if (!permissao.ok) return { erro: permissao.motivo as string };

    return { ator, alvo };
  }

  private paraResumo(usuario: Usuario, enderecos: Endereco[]): UsuarioResumoDTO {
    const vinculados = new Set(usuario.enderecosVinculados.map((i) => i.value));

    return {
      usuarioId: usuario.id.value,
      nome: usuario.nome,
      usuario: usuario.usuario,
      email: usuario.email,
      perfil: usuario.perfil,
      status: usuario.status,
      enderecos: enderecos
        .filter((e) => vinculados.has(e.id.value))
        .map((e) => ({ apelido: e.apelido, uc: e.uc })),
    };
  }
}
