import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { ISessionStorage, SessaoUsuarioData } from '@/domain/gateways/ISessionStorage';
import { Usuario } from '@/domain/entities/Usuario';

export interface AutenticarUsuarioInputDTO {
  email: string;
}

export interface AutenticarUsuarioOutputDTO {
  sucesso: boolean;
  usuario?: Usuario;
  erro?: string;
}

export class AutenticarUsuarioUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly sessionStorage: ISessionStorage
  ) {}

  async executar(input: AutenticarUsuarioInputDTO): Promise<AutenticarUsuarioOutputDTO> {
    const usuario = await this.usuarioRepo.buscarPorEmail(input.email);

    if (!usuario) {
      return {
        sucesso: false,
        erro: 'Usuário não encontrado',
      };
    }

    const sessaoData: SessaoUsuarioData = {
      usuarioId: usuario.id.value,
      empresaId: usuario.empresaId.value,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    };

    await this.sessionStorage.salvarSessao(sessaoData);

    return {
      sucesso: true,
      usuario,
    };
  }
}
