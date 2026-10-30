import { GerenciarNotificacoesUseCase } from '@/application/use-cases/GerenciarNotificacoesUseCase';
import { Notificacao } from '@/domain/entities/Notificacao';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { NotificacaoRepositoryMemory } from '@/infrastructure/fakes/NotificacaoRepositoryMemory';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';

const empresaA = UUIDv4.gerar();
const empresaB = UUIDv4.gerar();

async function ator(perfil: PerfilEnum, empresaId: UUIDv4 | null) {
  return new Usuario({
    id: UUIDv4.gerar(), empresaId, nome: 'Pessoa', usuario: `u${Math.random()}`,
    email: `u${Date.now()}${Math.random()}@equinox.dev`,
    senha: await new HashSenhaFake().gerar('Equinox@2026'),
    perfil, status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: perfil === PerfilEnum.SUPER_ADMIN ? [] : [UUIDv4.gerar()],
  });
}

function notificacao(empresaId: UUIDv4 | null, minutos: number, lida = false) {
  return new Notificacao({
    id: UUIDv4.gerar(), empresaId,
    tipo: TipoNotificacaoEnum.LEITURA_VALOR_MENOR,
    titulo: `Aviso ${minutos}`, mensagem: 'Conteúdo do aviso.',
    criadaEm: new Date(Date.UTC(2026, 2, 10, 12, minutos)), lida,
  });
}

async function cenario() {
  const notificacaoRepo = new NotificacaoRepositoryMemory();
  const usuarioRepo = new UsuarioRepositoryMemory();
  const caso = new GerenciarNotificacoesUseCase(notificacaoRepo, usuarioRepo);

  const admin = await ator(PerfilEnum.ADMIN, empresaA);
  const superAdmin = await ator(PerfilEnum.SUPER_ADMIN, null);
  const tecnico = await ator(PerfilEnum.TECNICO, empresaA);
  for (const u of [admin, superAdmin, tecnico]) await usuarioRepo.salvar(u);

  return { caso, notificacaoRepo, admin, superAdmin, tecnico };
}

describe('GerenciarNotificacoesUseCase', () => {
  describe('listar', () => {
    it('devolve as mais recentes primeiro', async () => {
      const { caso, notificacaoRepo, admin } = await cenario();
      await notificacaoRepo.salvar(notificacao(empresaA, 10));
      await notificacaoRepo.salvar(notificacao(empresaA, 30));

      const saida = await caso.listar({ atorId: admin.id.value });

      expect(saida.notificacoes.map((n) => n.titulo)).toEqual(['Aviso 30', 'Aviso 10']);
    });

    it('o administrador só vê as da própria empresa', async () => {
      const { caso, notificacaoRepo, admin } = await cenario();
      await notificacaoRepo.salvar(notificacao(empresaA, 10));
      await notificacaoRepo.salvar(notificacao(empresaB, 20));

      const saida = await caso.listar({ atorId: admin.id.value });

      expect(saida.notificacoes).toHaveLength(1);
    });

    it('o super admin vê as de todas as empresas', async () => {
      const { caso, notificacaoRepo, superAdmin } = await cenario();
      await notificacaoRepo.salvar(notificacao(empresaA, 10));
      await notificacaoRepo.salvar(notificacao(empresaB, 20));

      expect((await caso.listar({ atorId: superAdmin.id.value })).notificacoes).toHaveLength(2);
    });

    it('pagina de 30 em 30, como no app antigo', async () => {
      const { caso, notificacaoRepo, admin } = await cenario();
      for (let i = 0; i < 31; i += 1) await notificacaoRepo.salvar(notificacao(empresaA, i));

      const primeira = await caso.listar({ atorId: admin.id.value, pagina: 1 });
      expect(primeira.notificacoes).toHaveLength(30);
      expect(primeira.temMais).toBe(true);

      const segunda = await caso.listar({ atorId: admin.id.value, pagina: 2 });
      expect(segunda.notificacoes).toHaveLength(1);
      expect(segunda.temMais).toBe(false);
    });

    it('o técnico não acessa a central de notificações', async () => {
      const { caso, tecnico } = await cenario();
      const saida = await caso.listar({ atorId: tecnico.id.value });
      expect(saida.erro).toBe('Seu perfil não permite ver as notificações');
      expect(saida.notificacoes).toEqual([]);
    });
  });

  it('conta as não lidas do escopo', async () => {
    const { caso, notificacaoRepo, admin } = await cenario();
    await notificacaoRepo.salvar(notificacao(empresaA, 10));
    await notificacaoRepo.salvar(notificacao(empresaA, 20, true));
    await notificacaoRepo.salvar(notificacao(empresaB, 30));

    expect((await caso.contarNaoLidas({ atorId: admin.id.value })).total).toBe(1);
  });

  it('marca uma como lida', async () => {
    const { caso, notificacaoRepo, admin } = await cenario();
    const alvo = notificacao(empresaA, 10);
    await notificacaoRepo.salvar(alvo);

    await caso.marcarLida({ atorId: admin.id.value, notificacaoId: alvo.id.value });

    expect((await notificacaoRepo.buscarPorId(alvo.id))?.lida).toBe(true);
  });

  it('marca todas do escopo como lidas, sem tocar nas de outra empresa', async () => {
    const { caso, notificacaoRepo, admin } = await cenario();
    const daEmpresaA = notificacao(empresaA, 10);
    const daEmpresaB = notificacao(empresaB, 20);
    await notificacaoRepo.salvar(daEmpresaA);
    await notificacaoRepo.salvar(daEmpresaB);

    await caso.marcarTodasLidas({ atorId: admin.id.value });

    expect((await notificacaoRepo.buscarPorId(daEmpresaA.id))?.lida).toBe(true);
    expect((await notificacaoRepo.buscarPorId(daEmpresaB.id))?.lida).toBe(false);
  });

  it('o resumo diz quais aguardam decisão, para a tela mostrar os botões', async () => {
    const { caso, notificacaoRepo, admin } = await cenario();
    const comAcao = new Notificacao({
      id: UUIDv4.gerar(), empresaId: empresaA,
      tipo: TipoNotificacaoEnum.LEITURA_ATRASADA,
      titulo: 'Atrasada', mensagem: 'Confirme ou descarte.',
      criadaEm: new Date(Date.UTC(2026, 2, 10, 12)),
      requerAcao: true, leituraId: UUIDv4.gerar(),
    });
    await notificacaoRepo.salvar(comAcao);

    const saida = await caso.listar({ atorId: admin.id.value });

    expect(saida.notificacoes[0].aguardandoDecisao).toBe(true);
    expect(saida.notificacoes[0].leituraId).toBe(comAcao.leituraId?.value);
  });
});

describe('GerenciarNotificacoesUseCase: recusas', () => {
  const ninguem = UUIDv4.gerar().value;
  const SESSAO_INVALIDA = 'Sessão inválida. Entre de novo';

  it('contar não lidas devolve zero e o motivo sem sessão válida', async () => {
    const { caso } = await cenario();

    expect(await caso.contarNaoLidas({ atorId: ninguem })).toEqual({
      total: 0, erro: SESSAO_INVALIDA,
    });
  });

  it('marcar lida e marcar todas recusam sessão inválida', async () => {
    const { caso, notificacaoRepo } = await cenario();
    const aviso = notificacao(empresaA, 10);
    await notificacaoRepo.salvar(aviso);

    expect(await caso.marcarLida({ atorId: ninguem, notificacaoId: aviso.id.value })).toEqual({
      sucesso: false, erro: SESSAO_INVALIDA,
    });
    expect(await caso.marcarTodasLidas({ atorId: ninguem })).toEqual({
      sucesso: false, erro: SESSAO_INVALIDA,
    });
  });

  it('recusa notificação que não existe', async () => {
    const { caso, admin } = await cenario();

    const saida = await caso.marcarLida({
      atorId: admin.id.value, notificacaoId: ninguem,
    });

    expect(saida).toEqual({ sucesso: false, erro: 'Notificação não encontrada' });
  });

  it('listar recusa sessão inválida', async () => {
    const { caso } = await cenario();

    const saida = await caso.listar({ atorId: ninguem, pagina: 0 });

    expect(saida.erro).toBe(SESSAO_INVALIDA);
    expect(saida.notificacoes).toEqual([]);
  });
});
