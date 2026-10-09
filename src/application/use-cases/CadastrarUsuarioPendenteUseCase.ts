import { IUsuarioRepository } from '@/domain/repositories/IUsuarioRepository';
import { IEmpresaRepository } from '@/domain/repositories/IEmpresaRepository';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

export interface CadastrarUsuarioPendenteInputDTO {
  empresaId: string;
  nome: string;
  usuario?: string;
  email: string;
}

export interface CadastrarUsuarioPendenteOutputDTO {
  id: string;
  empresaId: string;
  nome: string;
  email: string;
  perfil: string;
  status: string;
}

export class CadastrarUsuarioPendenteUseCase {
  constructor(
    private usuarioRepository: IUsuarioRepository,
    private empresaRepository: IEmpresaRepository
  ) {}

  async execute(input: CadastrarUsuarioPendenteInputDTO): Promise<CadastrarUsuarioPendenteOutputDTO> {
    const empresaUuid = new UUIDv4(input.empresaId);
    const empresaExiste = await this.empresaRepository.buscarPorId(empresaUuid);
    if (!empresaExiste) {
      throw new Error('Empresa não encontrada');
    }

    const usuarioExistente = await this.usuarioRepository.buscarPorEmail(input.email);
    if (usuarioExistente) {
      throw new Error('Já existe um usuário cadastrado com este e-mail');
    }

    const novoUsuario = new Usuario({
      id: UUIDv4.gerar(),
      empresaId: empresaUuid,
      nome: input.nome,
      usuario: input.usuario,
      email: input.email,
      perfil: PerfilEnum.TECNICO,
      status: 'Pendente',
    });

    await this.usuarioRepository.salvar(novoUsuario);

    return {
      id: novoUsuario.id.value,
      empresaId: novoUsuario.empresaId.value,
      nome: novoUsuario.nome,
      email: novoUsuario.email,
      perfil: novoUsuario.perfil,
      status: novoUsuario.status,
    };
  }
}
