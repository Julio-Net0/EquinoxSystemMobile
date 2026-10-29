import { AutorizarUsuarioUseCase } from '@/application/use-cases/AutorizarUsuarioUseCase';
import { Usuario } from '@/domain/entities/Usuario';
import { Endereco } from '@/domain/entities/Endereco';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { EnderecoRepositoryMemory } from '@/infrastructure/fakes/EnderecoRepositoryMemory';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';
import { relogioFixo } from '@/domain/services/Relogio';

const AGORA = new Date(Date.UTC(2026, 2, 10, 15));

async function cenario() {
  const usuarioRepo = new UsuarioRepositoryMemory();
  const enderecoRepo = new EnderecoRepositoryMemory();
  const hash = new HashSenhaFake();
  const caso = new AutorizarUsuarioUseCase(usuarioRepo, enderecoRepo, relogioFixo(AGORA));

  const empresaId = UUIDv4.gerar();
  const outraEmpresaId = UUIDv4.gerar();

  const seuEndereco = new Endereco({
    id: UUIDv4.gerar(), empresaId, apelido: 'Sede', uc: '300111',
  });
  const enderecoAlheio = new Endereco({
    id: UUIDv4.gerar(), empresaId: outraEmpresaId, apelido: 'Sede alheia', uc: '300222',
  });
  await enderecoRepo.salvar(seuEndereco);
  await enderecoRepo.salvar(enderecoAlheio);

  const pendente = new Usuario({
    id: UUIDv4.gerar(), empresaId, nome: 'Maria Souza', usuario: 'maria',
    email: 'maria@equinox.dev', senha: await hash.gerar('Equinox@2026'),
    perfil: PerfilEnum.TECNICO, status: StatusUsuarioEnum.PENDENTE, enderecosVinculados: [],
  });
  await usuarioRepo.salvar(pendente);

  const admin = new Usuario({
    id: UUIDv4.gerar(), empresaId, nome: 'Admin', usuario: 'admin',
    email: 'admin@equinox.dev', senha: await hash.gerar('Equinox@2026'),
    perfil: PerfilEnum.ADMIN, status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: [seuEndereco.id],
  });
  await usuarioRepo.salvar(admin);

  return { caso, usuarioRepo, pendente, admin, seuEndereco, enderecoAlheio, outraEmpresaId };
}

describe('AutorizarUsuarioUseCase', () => {
  it('autoriza definindo perfil e endereços, e registra quem autorizou', async () => {
    const { caso, usuarioRepo, pendente, admin, seuEndereco } = await cenario();

    const saida = await caso.executar({
      atorId: admin.id.value,
      usuarioId: pendente.id.value,
      acao: 'autorizar',
      perfil: PerfilEnum.ADMIN,
      enderecoIds: [seuEndereco.id.value],
    });

    expect(saida.sucesso).toBe(true);
    const salvo = await usuarioRepo.buscarPorId(pendente.id);
    expect(salvo?.status).toBe(StatusUsuarioEnum.ATIVO);
    expect(salvo?.perfil).toBe(PerfilEnum.ADMIN);
    expect(salvo?.enderecosVinculados).toHaveLength(1);
    expect(salvo?.autorizadoPorId?.equals(admin.id)).toBe(true);
    expect(salvo?.autorizadoEm).toEqual(AGORA);
  });

  it('recusa o cadastro e guarda o perfil para a reaprovação rápida', async () => {
    const { caso, usuarioRepo, pendente, admin } = await cenario();

    await caso.executar({ atorId: admin.id.value, usuarioId: pendente.id.value, acao: 'recusar' });

    const salvo = await usuarioRepo.buscarPorId(pendente.id);
    expect(salvo?.status).toBe(StatusUsuarioEnum.RECUSADO);
    expect(salvo?.perfilAnterior).toBe(PerfilEnum.TECNICO);
  });

  it('exige ao menos um endereço para Técnico e Administrador', async () => {
    const { caso, usuarioRepo, pendente, admin } = await cenario();

    const saida = await caso.executar({
      atorId: admin.id.value, usuarioId: pendente.id.value, acao: 'autorizar',
      perfil: PerfilEnum.TECNICO, enderecoIds: [],
    });

    expect(saida.sucesso).toBe(false);
    expect(saida.erro).toBe('Selecione ao menos um endereço (perfis Usuário e Administrador)');
    expect((await usuarioRepo.buscarPorId(pendente.id))?.status).toBe(StatusUsuarioEnum.PENDENTE);
  });

  it('autoriza super admin sem endereço', async () => {
    const { caso, usuarioRepo, pendente, admin } = await cenario();

    const saida = await caso.executar({
      atorId: admin.id.value, usuarioId: pendente.id.value, acao: 'autorizar',
      perfil: PerfilEnum.SUPER_ADMIN, enderecoIds: [],
    });

    expect(saida.sucesso).toBe(true);
    expect((await usuarioRepo.buscarPorId(pendente.id))?.status).toBe(StatusUsuarioEnum.ATIVO);
  });

  it('recusa vincular endereço de outra empresa', async () => {
    const { caso, pendente, admin, enderecoAlheio } = await cenario();

    const saida = await caso.executar({
      atorId: admin.id.value, usuarioId: pendente.id.value, acao: 'autorizar',
      perfil: PerfilEnum.TECNICO, enderecoIds: [enderecoAlheio.id.value],
    });

    expect(saida.sucesso).toBe(false);
    expect(saida.erro).toBe('Há endereços que não pertencem à empresa do usuário');
  });

  it('um administrador não autoriza usuário de outra empresa', async () => {
    const { caso, usuarioRepo, admin, seuEndereco, outraEmpresaId } = await cenario();
    const hash = new HashSenhaFake();
    const forasteiro = new Usuario({
      id: UUIDv4.gerar(), empresaId: outraEmpresaId, nome: 'Forasteiro', usuario: 'fora',
      email: 'fora@equinox.dev', senha: await hash.gerar('Equinox@2026'),
      perfil: PerfilEnum.TECNICO, status: StatusUsuarioEnum.PENDENTE, enderecosVinculados: [],
    });
    await usuarioRepo.salvar(forasteiro);

    const saida = await caso.executar({
      atorId: admin.id.value, usuarioId: forasteiro.id.value, acao: 'autorizar',
      perfil: PerfilEnum.TECNICO, enderecoIds: [seuEndereco.id.value],
    });

    expect(saida.erro).toBe('Você só administra usuários da sua própria empresa');
  });

  it('recusa quando o usuário não existe', async () => {
    const { caso, admin } = await cenario();
    const saida = await caso.executar({
      atorId: admin.id.value, usuarioId: UUIDv4.gerar().value, acao: 'recusar',
    });
    expect(saida.erro).toBe('Usuário não encontrado');
  });

  it('recusa quando quem autoriza não existe', async () => {
    const { caso, pendente } = await cenario();
    const saida = await caso.executar({
      atorId: UUIDv4.gerar().value, usuarioId: pendente.id.value, acao: 'recusar',
    });
    expect(saida.erro).toBe('Sessão inválida. Entre de novo');
  });
});
