export enum PerfilEnum {
  SUPER_ADMIN = 'SuperAdmin',
  ADMIN = 'Admin',
  TECNICO = 'Tecnico',
}

/** Nível de acesso como o app antigo persiste (nivel_acesso 1..3). */
export type NivelAcesso = 1 | 2 | 3;

const NIVEL_POR_PERFIL: Record<PerfilEnum, NivelAcesso> = {
  [PerfilEnum.TECNICO]: 1,
  [PerfilEnum.ADMIN]: 2,
  [PerfilEnum.SUPER_ADMIN]: 3,
};

const PERFIL_POR_NIVEL: Record<NivelAcesso, PerfilEnum> = {
  1: PerfilEnum.TECNICO,
  2: PerfilEnum.ADMIN,
  3: PerfilEnum.SUPER_ADMIN,
};

export function nivelDe(perfil: PerfilEnum): NivelAcesso {
  return NIVEL_POR_PERFIL[perfil];
}

export function perfilDeNivel(nivel: NivelAcesso): PerfilEnum {
  const perfil = PERFIL_POR_NIVEL[nivel];
  if (!perfil) {
    throw new Error(`Nível de acesso inválido: ${nivel}`);
  }
  return perfil;
}

/** Rótulo mostrado ao usuário, igual ao do app antigo. */
export function rotuloDoPerfil(perfil: PerfilEnum): string {
  switch (perfil) {
    case PerfilEnum.SUPER_ADMIN:
      return 'Super Admin';
    case PerfilEnum.ADMIN:
      return 'Administrador';
    default:
      return 'Usuário';
  }
}
