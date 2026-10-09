import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

export interface AutorizarUsuarioInputDTO {
  usuarioId: string;
  perfil: PerfilEnum;
  usinasIds: string[];
  acao: 'autorizar' | 'recusar';
}

export interface AutorizarUsuarioOutputDTO {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  status: string;
  isAtivo: boolean;
  usinasVinculadas: string[];
}

export class AutorizarUsuarioUseCase {
  constructor(private usuarioRepository: IUsuarioRepository) {}

  async execute(input: AutorizarUsuarioInputDTO): Promise<AutorizarUsuarioOutputDTO> {
    const usuarioUuid = new UUIDv4(input.usuarioId);
    const usuario = await this.usuarioRepository.buscarPorId(usuarioUuid);

    if (!usuario) {
      throw new Error('Usuário não encontrado');
    }

    if (input.acao === 'recusar') {
      usuario.recusar();
    } else {
      usuario.atualizarPerfil(input.perfil);
      const usinasUuids = input.usinasIds.map((id) => new UUIDv4(id));
      usuario.vincularUsinas(usinasUuids);
      usuario.ativar();
    }

    await this.usuarioRepository.salvar(usuario);

    return {
      id: usuario.id.value,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      status: usuario.status,
      isAtivo: usuario.isAtivo(),
      usinasVinculadas: usuario.usinasVinculadas.map((u) => u.value),
    };
  }
}
