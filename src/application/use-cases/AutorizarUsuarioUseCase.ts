import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { IEnderecoRepository } from '@/domain/repositories/IEnderecoRepository';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { IRelogio, relogioSistema } from '@/domain/services/Relogio';
import { RegraAutorizacaoUsuarioService } from '@/domain/services/RegraAutorizacaoUsuarioService';

export interface AutorizarUsuarioInput {
  /** Quem está autorizando — o escopo dele limita o que pode fazer. */
  atorId: string;
  usuarioId: string;
  acao: 'autorizar' | 'recusar';
  perfil?: PerfilEnum;
  enderecoIds?: string[];
}

export interface AutorizarUsuarioOutput {
  sucesso: boolean;
  erro?: string;
}

/**
 * Aprovação de cadastro: define perfil e endereços e ativa, ou recusa.
 *
 * Nada é gravado se alguma regra reprovar, para o usuário não ficar num estado
 * meio aprovado.
 */
export class AutorizarUsuarioUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly enderecoRepo: IEnderecoRepository,
    private readonly relogio: IRelogio = relogioSistema,
  ) {}

  public async executar(entrada: AutorizarUsuarioInput): Promise<AutorizarUsuarioOutput> {
    const ator = await this.usuarioRepo.buscarPorId(new UUIDv4(entrada.atorId));
    if (!ator) {
      return { sucesso: false, erro: 'Sessão inválida. Entre de novo' };
    }

    const alvo = await this.usuarioRepo.buscarPorId(new UUIDv4(entrada.usuarioId));
    if (!alvo) {
      return { sucesso: false, erro: 'Usuário não encontrado' };
    }

    const permissao = RegraAutorizacaoUsuarioService.podeGerenciar(
      ator.perfil,
      ator.empresaId,
      alvo.empresaId,
    );
    if (!permissao.ok) {
      return { sucesso: false, erro: permissao.motivo };
    }

    if (entrada.acao === 'recusar') {
      alvo.recusar();
      await this.usuarioRepo.atualizar(alvo);
      return { sucesso: true };
    }

    const perfil = entrada.perfil ?? alvo.perfil;
    const enderecoIds = (entrada.enderecoIds ?? []).map((id) => new UUIDv4(id));

    const regra = RegraAutorizacaoUsuarioService.podeAtivar(perfil, enderecoIds);
    if (!regra.ok) {
      return { sucesso: false, erro: regra.motivo };
    }

    const enderecosDoAlvo = await this.enderecoRepo.listarTodos();
    const permitidos = RegraAutorizacaoUsuarioService.enderecosPermitidos(
      alvo.empresaId,
      enderecosDoAlvo,
    );
    const idsPermitidos = new Set(permitidos.map((e) => e.id.value));
    if (enderecoIds.some((id) => !idsPermitidos.has(id.value))) {
      return { sucesso: false, erro: 'Há endereços que não pertencem à empresa do usuário' };
    }

    alvo.atualizarPerfil(perfil);
    alvo.vincularEnderecos(enderecoIds);
    alvo.ativar(ator.id, this.relogio.agora());

    await this.usuarioRepo.atualizar(alvo);

    return { sucesso: true };
  }
}
