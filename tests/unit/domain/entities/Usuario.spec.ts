import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';

describe('Usuario Entity', () => {
  it('deve instanciar um Usuario válido', () => {
    const id = UUIDv4.gerar();
    const empresaId = UUIDv4.gerar();
    const usuario = new Usuario({
      id,
      empresaId,
      nome: 'João da Silva',
      email: 'joao@solartech.com',
      perfil: PerfilEnum.TECNICO,
      status: 'Ativo',
    });

    expect(usuario.id.equals(id)).toBe(true);
    expect(usuario.empresaId.equals(empresaId)).toBe(true);
    expect(usuario.nome).toBe('João da Silva');
    expect(usuario.email).toBe('joao@solartech.com');
    expect(usuario.perfil).toBe(PerfilEnum.TECNICO);
    expect(usuario.isAtivo()).toBe(true);
  });

  it('deve lançar erro para email inválido', () => {
    const id = UUIDv4.gerar();
    const empresaId = UUIDv4.gerar();

    expect(
      () =>
        new Usuario({
          id,
          empresaId,
          nome: 'João',
          email: 'email-invalido',
          perfil: PerfilEnum.TECNICO,
          status: 'Ativo',
        })
    ).toThrow('Email inválido');
  });

  it('deve permitir inativar e ativar um usuário', () => {
    const usuario = new Usuario({
      id: UUIDv4.gerar(),
      empresaId: UUIDv4.gerar(),
      nome: 'Maria',
      email: 'maria@solartech.com',
      perfil: PerfilEnum.ADMIN,
      status: 'Pendente',
    });

    expect(usuario.isAtivo()).toBe(false);
    usuario.ativar();
    expect(usuario.isAtivo()).toBe(true);
    usuario.inativar();
    expect(usuario.isAtivo()).toBe(false);
  });
});
