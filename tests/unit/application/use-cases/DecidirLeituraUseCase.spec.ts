import { DecidirLeituraUseCase } from '@/application/use-cases/DecidirLeituraUseCase';
import { Leitura } from '@/domain/entities/Leitura';
import { Notificacao } from '@/domain/entities/Notificacao';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { ResolucaoEnum } from '@/domain/enums/ResolucaoEnum';
import { LeituraRepositoryMemory } from '@/infrastructure/fakes/LeituraRepositoryMemory';
import { NotificacaoRepositoryMemory } from '@/infrastructure/fakes/NotificacaoRepositoryMemory';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';
import { relogioFixo } from '@/domain/services/Relogio';

const AGORA = new Date(Date.UTC(2026, 2, 10, 15));
const empresaId = UUIDv4.gerar();

async function cenario(opcoes: { informativa?: boolean; perfilAtor?: PerfilEnum } = {}) {
  const leituraRepo = new LeituraRepositoryMemory();
  const notificacaoRepo = new NotificacaoRepositoryMemory();
  const usuarioRepo = new UsuarioRepositoryMemory();
  const caso = new DecidirLeituraUseCase(
    notificacaoRepo, leituraRepo, usuarioRepo, relogioFixo(AGORA),
  );

  const medidoEm = new Date(Date.UTC(2026, 2, 1, 15));
  const leitura = new Leitura({
    id: UUIDv4.gerar(), padraoId: UUIDv4.gerar(), usuarioId: UUIDv4.gerar(),
    valorConsumo: new ValorKwh(1800),
    fotoLocalUri: 'file:///documents/leituras/foto.jpg',
    medidoEm, dataLocal: DataLocal.de(medidoEm),
  });
  await leituraRepo.salvar(leitura);

  const requerAcao = !opcoes.informativa;
  const notificacao = new Notificacao({
    id: UUIDv4.gerar(), empresaId,
    tipo: requerAcao ? TipoNotificacaoEnum.LEITURA_ATRASADA : TipoNotificacaoEnum.LEITURA_VALOR_MENOR,
    titulo: 'Leitura atrasada', mensagem: 'Confirme ou descarte.',
    criadaEm: AGORA, requerAcao, leituraId: requerAcao ? leitura.id : null,
  });
  await notificacaoRepo.salvar(notificacao);

  const perfil = opcoes.perfilAtor ?? PerfilEnum.ADMIN;
  const ator = new Usuario({
    id: UUIDv4.gerar(), empresaId: perfil === PerfilEnum.SUPER_ADMIN ? null : empresaId,
    nome: 'Admin', usuario: 'admin', email: 'admin@equinox.dev',
    senha: await new HashSenhaFake().gerar('Equinox@2026'),
    perfil, status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: perfil === PerfilEnum.SUPER_ADMIN ? [] : [UUIDv4.gerar()],
  });
  await usuarioRepo.salvar(ator);

  return { caso, leituraRepo, notificacaoRepo, leitura, notificacao, ator };
}

describe('DecidirLeituraUseCase', () => {
  it('aprovar mantém a leitura vigente e resolve a notificação', async () => {
    const { caso, leituraRepo, notificacaoRepo, leitura, notificacao, ator } = await cenario();

    const saida = await caso.executar({
      atorId: ator.id.value, notificacaoId: notificacao.id.value, decisao: 'aprovar',
    });

    expect(saida.sucesso).toBe(true);
    expect((await leituraRepo.buscarPorId(leitura.id))?.status).toBe(StatusLeituraEnum.APROVADA);
    const resolvida = await notificacaoRepo.buscarPorId(notificacao.id);
    expect(resolvida?.resolucao).toBe(ResolucaoEnum.APROVADA);
    expect(resolvida?.resolvidaPorId?.equals(ator.id)).toBe(true);
    expect(resolvida?.resolvidaEm).toEqual(AGORA);
  });

  it('descartar tira a leitura de vigente e libera a vaga do dia', async () => {
    const { caso, leituraRepo, leitura, notificacao, ator } = await cenario();

    await caso.executar({
      atorId: ator.id.value, notificacaoId: notificacao.id.value, decisao: 'descartar',
    });

    const decidida = await leituraRepo.buscarPorId(leitura.id);
    expect(decidida?.status).toBe(StatusLeituraEnum.DESCARTADA);
    expect(decidida?.estaVigente()).toBe(false);
  });

  it('recusa decidir duas vezes', async () => {
    const { caso, notificacao, ator } = await cenario();
    await caso.executar({
      atorId: ator.id.value, notificacaoId: notificacao.id.value, decisao: 'aprovar',
    });

    const saida = await caso.executar({
      atorId: ator.id.value, notificacaoId: notificacao.id.value, decisao: 'descartar',
    });

    expect(saida.erro).toBe('Esta leitura já foi decidida');
  });

  it('recusa decidir uma notificação informativa', async () => {
    const { caso, notificacao, ator } = await cenario({ informativa: true });
    const saida = await caso.executar({
      atorId: ator.id.value, notificacaoId: notificacao.id.value, decisao: 'aprovar',
    });
    expect(saida.erro).toBe('Esta notificação não requer decisão');
  });

  it('o super admin decide em qualquer empresa', async () => {
    const { caso, notificacao, ator } = await cenario({ perfilAtor: PerfilEnum.SUPER_ADMIN });
    expect(
      (await caso.executar({
        atorId: ator.id.value, notificacaoId: notificacao.id.value, decisao: 'aprovar',
      })).sucesso,
    ).toBe(true);
  });

  it('o técnico não decide', async () => {
    const { caso, notificacao, ator } = await cenario({ perfilAtor: PerfilEnum.TECNICO });
    const saida = await caso.executar({
      atorId: ator.id.value, notificacaoId: notificacao.id.value, decisao: 'aprovar',
    });
    expect(saida.erro).toBe('Seu perfil não permite decidir sobre leituras');
  });

  it('recusa quando a notificação não existe', async () => {
    const { caso, ator } = await cenario();
    const saida = await caso.executar({
      atorId: ator.id.value, notificacaoId: UUIDv4.gerar().value, decisao: 'aprovar',
    });
    expect(saida.erro).toBe('Notificação não encontrada');
  });
});
