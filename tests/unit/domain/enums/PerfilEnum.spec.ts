import { PerfilEnum, nivelDe, perfilDeNivel } from '@/domain/enums/PerfilEnum';

// O app antigo guarda nivel_acesso 1/2/3; o domínio fala em perfis.
describe('mapeamento entre perfil e nível de acesso', () => {
  it.each([
    [PerfilEnum.TECNICO, 1],
    [PerfilEnum.ADMIN, 2],
    [PerfilEnum.SUPER_ADMIN, 3],
  ])('%s corresponde ao nível %i', (perfil, nivel) => {
    expect(nivelDe(perfil)).toBe(nivel);
    expect(perfilDeNivel(nivel as 1 | 2 | 3)).toBe(perfil);
  });

  it('faz a ida e volta sem perda', () => {
    for (const perfil of Object.values(PerfilEnum)) {
      expect(perfilDeNivel(nivelDe(perfil))).toBe(perfil);
    }
  });

  it('rejeita um nível fora de 1..3', () => {
    expect(() => perfilDeNivel(0 as 1)).toThrow('Nível de acesso inválido');
    expect(() => perfilDeNivel(4 as 1)).toThrow('Nível de acesso inválido');
  });
});
