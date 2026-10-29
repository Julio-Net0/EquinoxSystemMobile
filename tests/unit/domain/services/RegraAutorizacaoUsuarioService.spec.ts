import { RegraAutorizacaoUsuarioService } from '@/domain/services/RegraAutorizacaoUsuarioService';
import { Endereco } from '@/domain/entities/Endereco';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

const empresaA = UUIDv4.gerar();
const empresaB = UUIDv4.gerar();

const endereco = (empresaId: UUIDv4, apelido: string) =>
  new Endereco({ id: UUIDv4.gerar(), empresaId, apelido, uc: '300123' });

describe('RegraAutorizacaoUsuarioService', () => {
  describe('exigência de endereço vinculado', () => {
    it.each([PerfilEnum.TECNICO, PerfilEnum.ADMIN])('%s sem endereço é recusado', (perfil) => {
      const resultado = RegraAutorizacaoUsuarioService.podeAtivar(perfil, []);
      expect(resultado.ok).toBe(false);
      expect(resultado.motivo).toBe(
        'Selecione ao menos um endereço (perfis Usuário e Administrador)',
      );
    });

    it.each([PerfilEnum.TECNICO, PerfilEnum.ADMIN])('%s com endereço é aprovado', (perfil) => {
      expect(RegraAutorizacaoUsuarioService.podeAtivar(perfil, [UUIDv4.gerar()]).ok).toBe(true);
    });

    it('super admin é isento, porque o escopo dele é global', () => {
      expect(RegraAutorizacaoUsuarioService.podeAtivar(PerfilEnum.SUPER_ADMIN, []).ok).toBe(true);
    });

    it.each([
      [PerfilEnum.TECNICO, true],
      [PerfilEnum.ADMIN, true],
      [PerfilEnum.SUPER_ADMIN, false],
    ])('%s exige endereço: %s', (perfil, esperado) => {
      expect(RegraAutorizacaoUsuarioService.exigeEndereco(perfil)).toBe(esperado);
    });
  });

  describe('endereços oferecidos na autorização', () => {
    const todos = [
      endereco(empresaA, 'Sede A'),
      endereco(empresaA, 'Galpão A'),
      endereco(empresaB, 'Sede B'),
    ];

    it('limita aos endereços da empresa do usuário', () => {
      const permitidos = RegraAutorizacaoUsuarioService.enderecosPermitidos(empresaA, todos);
      expect(permitidos.map((e) => e.apelido)).toEqual(['Sede A', 'Galpão A']);
    });

    it('sem empresa definida, oferece todos: é o caso do super admin', () => {
      expect(RegraAutorizacaoUsuarioService.enderecosPermitidos(null, todos)).toHaveLength(3);
    });
  });

  describe('quem pode gerenciar quem', () => {
    it('super admin gerencia qualquer empresa', () => {
      expect(
        RegraAutorizacaoUsuarioService.podeGerenciar(PerfilEnum.SUPER_ADMIN, null, empresaB).ok,
      ).toBe(true);
    });

    it('admin gerencia a própria empresa', () => {
      expect(
        RegraAutorizacaoUsuarioService.podeGerenciar(PerfilEnum.ADMIN, empresaA, empresaA).ok,
      ).toBe(true);
    });

    it('admin não gerencia outra empresa', () => {
      const resultado = RegraAutorizacaoUsuarioService.podeGerenciar(
        PerfilEnum.ADMIN,
        empresaA,
        empresaB,
      );
      expect(resultado.ok).toBe(false);
      expect(resultado.motivo).toBe('Você só administra usuários da sua própria empresa');
    });

    it('técnico não gerencia ninguém', () => {
      const resultado = RegraAutorizacaoUsuarioService.podeGerenciar(
        PerfilEnum.TECNICO,
        empresaA,
        empresaA,
      );
      expect(resultado.ok).toBe(false);
      expect(resultado.motivo).toBe('Seu perfil não permite administrar usuários');
    });
  });
});
