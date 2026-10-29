import { Endereco } from '../entities/Endereco';
import { UUIDv4 } from '../value-objects/UUIDv4';
import { PerfilEnum } from '../enums/PerfilEnum';
import { ResultadoRegra, regraAprovada, regraRecusada } from './ResultadoRegra';

/**
 * Quem pode ser ativado e quem pode administrar quem.
 *
 * Duas regras do app antigo moram aqui: perfis Usuário e Administrador só
 * funcionam com endereço vinculado (senão entram e não têm o que ler), e um
 * administrador só alcança a própria empresa.
 */
export class RegraAutorizacaoUsuarioService {
  public static exigeEndereco(perfil: PerfilEnum): boolean {
    return perfil !== PerfilEnum.SUPER_ADMIN;
  }

  public static podeAtivar(perfil: PerfilEnum, enderecosVinculados: UUIDv4[]): ResultadoRegra {
    if (RegraAutorizacaoUsuarioService.exigeEndereco(perfil) && enderecosVinculados.length === 0) {
      return regraRecusada('Selecione ao menos um endereço (perfis Usuário e Administrador)');
    }
    return regraAprovada();
  }

  /** Um usuário só pode ser vinculado a endereços da própria empresa. */
  public static enderecosPermitidos(
    empresaDoUsuario: UUIDv4 | null,
    enderecos: Endereco[],
  ): Endereco[] {
    if (empresaDoUsuario === null) return enderecos;
    return enderecos.filter((e) => e.empresaId.equals(empresaDoUsuario));
  }

  public static podeGerenciar(
    perfilDoAtor: PerfilEnum,
    empresaDoAtor: UUIDv4 | null,
    empresaAlvo: UUIDv4 | null,
  ): ResultadoRegra {
    if (perfilDoAtor === PerfilEnum.SUPER_ADMIN) return regraAprovada();

    if (perfilDoAtor !== PerfilEnum.ADMIN) {
      return regraRecusada('Seu perfil não permite administrar usuários');
    }

    const mesmaEmpresa = empresaDoAtor !== null && (empresaAlvo?.equals(empresaDoAtor) ?? false);
    return mesmaEmpresa
      ? regraAprovada()
      : regraRecusada('Você só administra usuários da sua própria empresa');
  }
}
