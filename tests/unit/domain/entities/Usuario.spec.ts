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

  it('deve permitir recusar, alterar perfil e vincular usinas', () => {
    const usuarioId = UUIDv4.gerar();
    const empresaId = UUIDv4.gerar();
    const usinaId1 = UUIDv4.gerar();
    const usinaId2 = UUIDv4.gerar();

    const usuario = new Usuario({
      id: usuarioId,
      empresaId,
      nome: 'Carlos Eduardo',
      usuario: 'carlosedu',
      email: 'carlos@empresa.com',
      perfil: PerfilEnum.TECNICO,
      status: 'Pendente',
      usinasVinculadas: [usinaId1],
    });

    expect(usuario.usuario).toBe('carlosedu');
    expect(usuario.status).toBe('Pendente');
    expect(usuario.usinasVinculadas.length).toBe(1);

    usuario.recusar();
    expect(usuario.status).toBe('Recusado');
    expect(usuario.isAtivo()).toBe(false);

    usuario.atualizarPerfil(PerfilEnum.ADMIN);
    expect(usuario.perfil).toBe(PerfilEnum.ADMIN);

    usuario.vincularUsinas([usinaId1, usinaId2]);
    expect(usuario.usinasVinculadas.length).toBe(2);

    usuario.ativar();
    expect(usuario.status).toBe('Ativo');
    expect(usuario.isAtivo()).toBe(true);
  });
});
