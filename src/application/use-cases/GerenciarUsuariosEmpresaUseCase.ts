import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

export interface ListarUsuariosInputDTO {
  empresaId?: string;
  status?: string;
  perfil?: PerfilEnum;
  termoBusca?: string;
}

export interface UsuarioOutputDTO {
  id: string;
  empresaId: string;
  nome: string;
  usuario?: string;
  email: string;
  perfil: string;
  status: string;
  isAtivo: boolean;
  usinasVinculadas: string[];
}

export class GerenciarUsuariosEmpresaUseCase {
  constructor(private usuarioRepository: IUsuarioRepository) {}

  async listar(input: ListarUsuariosInputDTO): Promise<UsuarioOutputDTO[]> {
    const filtros = {
      empresaId: input.empresaId ? new UUIDv4(input.empresaId) : undefined,
      status: input.status,
      perfil: input.perfil,
      termoBusca: input.termoBusca,
    };

    const usuarios = await this.usuarioRepository.listarComFiltros(filtros);

    return usuarios.map((u) => ({
      id: u.id.value,
      empresaId: u.empresaId.value,
      nome: u.nome,
      usuario: u.usuario,
      email: u.email,
      perfil: u.perfil,
      status: u.status,
      isAtivo: u.isAtivo(),
      usinasVinculadas: u.usinasVinculadas.map((usina) => usina.value),
    }));
  }

  async alternarStatus(input: { usuarioId: string }): Promise<UsuarioOutputDTO> {
    const uuid = new UUIDv4(input.usuarioId);
    const usuario = await this.usuarioRepository.buscarPorId(uuid);

    if (!usuario) {
      throw new Error('Usuário não encontrado');
    }

    if (usuario.isAtivo()) {
      usuario.inativar();
    } else {
      usuario.ativar();
    }

    await this.usuarioRepository.salvar(usuario);

    return {
      id: usuario.id.value,
      empresaId: usuario.empresaId.value,
      nome: usuario.nome,
      usuario: usuario.usuario,
      email: usuario.email,
      perfil: usuario.perfil,
      status: usuario.status,
      isAtivo: usuario.isAtivo(),
      usinasVinculadas: usuario.usinasVinculadas.map((usina) => usina.value),
    };
  }

  async excluir(input: { usuarioId: string }): Promise<void> {
    const uuid = new UUIDv4(input.usuarioId);
    const usuario = await this.usuarioRepository.buscarPorId(uuid);

    if (!usuario) {
      throw new Error('Usuário não encontrado');
    }

    await this.usuarioRepository.excluir(uuid);
  }
}
