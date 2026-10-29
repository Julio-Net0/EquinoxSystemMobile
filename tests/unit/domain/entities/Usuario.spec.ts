import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { SenhaHash } from '@/domain/value-objects/SenhaHash';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';

const senhaQualquer = () => new SenhaHash('sha256-iter', 10_000, 'a'.repeat(32), 'b'.repeat(64));

const base = () => ({
  id: UUIDv4.gerar(),
  empresaId: UUIDv4.gerar(),
  nome: 'João da Silva',
  usuario: 'joao.silva',
  email: 'joao@solartech.com',
  senha: senhaQualquer(),
  perfil: PerfilEnum.TECNICO,
  status: StatusUsuarioEnum.ATIVO,
  enderecosVinculados: [UUIDv4.gerar()],
});

describe('Usuario', () => {
  describe('criação', () => {
    it('é criado com identidade, login e perfil', () => {
      const props = base();
      const usuario = new Usuario(props);

      expect(usuario.id.equals(props.id)).toBe(true);
      expect(usuario.empresaId?.equals(props.empresaId)).toBe(true);
      expect(usuario.nome).toBe('João da Silva');
      expect(usuario.usuario).toBe('joao.silva');
      expect(usuario.email).toBe('joao@solartech.com');
      expect(usuario.perfil).toBe(PerfilEnum.TECNICO);
      expect(usuario.isAtivo()).toBe(true);
    });

    it('normaliza o e-mail e o login para minúsculas', () => {
      const usuario = new Usuario({ ...base(), email: '  JOAO@Solartech.COM ', usuario: ' Joao.Silva ' });
      expect(usuario.email).toBe('joao@solartech.com');
      expect(usuario.usuario).toBe('joao.silva');
    });

    it.each(['email-invalido', 'sem@dominio', '@empresa.com', ''])(
      'recusa o e-mail %p',
      (email) => {
        expect(() => new Usuario({ ...base(), email })).toThrow('Email inválido');
      },
    );

    it('recusa nome vazio', () => {
      expect(() => new Usuario({ ...base(), nome: '   ' })).toThrow('Nome do usuário é obrigatório');
    });

    it('recusa login vazio: o app antigo autentica por e-mail ou usuário', () => {
      expect(() => new Usuario({ ...base(), usuario: '  ' })).toThrow(
        'Usuário de login é obrigatório',
      );
    });

    it('aceita super admin sem empresa, porque o escopo dele é global', () => {
      const usuario = new Usuario({
        ...base(),
        empresaId: null,
        perfil: PerfilEnum.SUPER_ADMIN,
        enderecosVinculados: [],
      });
      expect(usuario.empresaId).toBeNull();
      expect(usuario.ehGlobal()).toBe(true);
    });

    it('exige empresa para quem não é super admin', () => {
      expect(() => new Usuario({ ...base(), empresaId: null })).toThrow(
        'Usuário precisa pertencer a uma empresa',
      );
    });
  });

  describe('endereços vinculados', () => {
    it('devolve uma cópia, para a lista interna não ser mutada de fora', () => {
      const usuario = new Usuario(base());
      usuario.enderecosVinculados.push(UUIDv4.gerar());
      expect(usuario.enderecosVinculados).toHaveLength(1);
    });

    it('substitui os vínculos', () => {
      const usuario = new Usuario(base());
      usuario.vincularEnderecos([UUIDv4.gerar(), UUIDv4.gerar()]);
      expect(usuario.enderecosVinculados).toHaveLength(2);
    });
  });

  describe('ciclo de status', () => {
    it('ativa um técnico que tem endereço vinculado', () => {
      const usuario = new Usuario({ ...base(), status: StatusUsuarioEnum.PENDENTE });
      usuario.ativar();
      expect(usuario.status).toBe(StatusUsuarioEnum.ATIVO);
      expect(usuario.isAtivo()).toBe(true);
    });

    it.each([PerfilEnum.TECNICO, PerfilEnum.ADMIN])(
      'recusa ativar %s sem nenhum endereço vinculado',
      (perfil) => {
        const usuario = new Usuario({
          ...base(),
          perfil,
          status: StatusUsuarioEnum.PENDENTE,
          enderecosVinculados: [],
        });
        expect(() => usuario.ativar()).toThrow(
          'Usuário e Administrador precisam de ao menos um endereço vinculado',
        );
      },
    );

    it('ativa super admin sem endereço', () => {
      const usuario = new Usuario({
        ...base(),
        empresaId: null,
        perfil: PerfilEnum.SUPER_ADMIN,
        status: StatusUsuarioEnum.PENDENTE,
        enderecosVinculados: [],
      });
      expect(() => usuario.ativar()).not.toThrow();
      expect(usuario.isAtivo()).toBe(true);
    });

    it('recusa e inativa', () => {
      const usuario = new Usuario(base());
      usuario.recusar();
      expect(usuario.status).toBe(StatusUsuarioEnum.RECUSADO);
      usuario.inativar();
      expect(usuario.status).toBe(StatusUsuarioEnum.INATIVO);
      expect(usuario.isAtivo()).toBe(false);
    });

    it('lembra o perfil anterior ao recusar, para a reaprovação rápida', () => {
      const usuario = new Usuario({ ...base(), perfil: PerfilEnum.ADMIN });
      usuario.recusar();
      expect(usuario.perfilAnterior).toBe(PerfilEnum.ADMIN);
    });
  });

  it('troca o perfil', () => {
    const usuario = new Usuario(base());
    usuario.atualizarPerfil(PerfilEnum.ADMIN);
    expect(usuario.perfil).toBe(PerfilEnum.ADMIN);
  });

  it('troca a senha', () => {
    const usuario = new Usuario(base());
    const nova = new SenhaHash('sha256-iter', 10_000, 'c'.repeat(32), 'd'.repeat(64));
    usuario.trocarSenha(nova);
    expect(usuario.senha.equals(nova)).toBe(true);
  });
});
