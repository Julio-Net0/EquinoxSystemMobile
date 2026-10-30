import { AvaliarLeiturasAtrasadasUseCase } from '@/application/use-cases/AvaliarLeiturasAtrasadasUseCase';
import { Leitura } from '@/domain/entities/Leitura';
import { Endereco } from '@/domain/entities/Endereco';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { Usuario } from '@/domain/entities/Usuario';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';
import { TipoNotificacaoEnum } from '@/domain/enums/TipoNotificacaoEnum';
import { LeituraRepositoryMemory } from '@/infrastructure/fakes/LeituraRepositoryMemory';
import { PadraoRepositoryMemory } from '@/infrastructure/fakes/PadraoRepositoryMemory';
import { EnderecoRepositoryMemory } from '@/infrastructure/fakes/EnderecoRepositoryMemory';
import { NotificacaoRepositoryMemory } from '@/infrastructure/fakes/NotificacaoRepositoryMemory';
import { UsuarioRepositoryMemory } from '@/infrastructure/fakes/UsuarioRepositoryMemory';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';
import { relogioFixo } from '@/domain/services/Relogio';

/** 10/03/2026 em Brasília. */
const AGORA = new Date(Date.UTC(2026, 2, 10, 15));
const empresaId = UUIDv4.gerar();

async function cenario() {
  const leituraRepo = new LeituraRepositoryMemory();
  const padraoRepo = new PadraoRepositoryMemory();
  const enderecoRepo = new EnderecoRepositoryMemory();
  const notificacaoRepo = new NotificacaoRepositoryMemory();
  const usuarioRepo = new UsuarioRepositoryMemory();

  const caso = new AvaliarLeiturasAtrasadasUseCase(
    leituraRepo, padraoRepo, enderecoRepo, notificacaoRepo, usuarioRepo, relogioFixo(AGORA),
  );

  const endereco = new Endereco({
    id: UUIDv4.gerar(), empresaId, apelido: 'Sede administrativa', uc: '3001234567',
  });
  await enderecoRepo.salvar(endereco);

  const padrao = new PadraoCemig({ id: UUIDv4.gerar(), enderecoId: endereco.id, numero: '778811' });
  await padraoRepo.salvar(padrao);

  const tecnico = new Usuario({
    id: UUIDv4.gerar(), empresaId, nome: 'João da Silva', usuario: 'joao',
    email: 'joao@equinox.dev', senha: await new HashSenhaFake().gerar('Equinox@2026'),
    perfil: PerfilEnum.TECNICO, status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: [endereco.id],
  });
  await usuarioRepo.salvar(tecnico);

  async function leitura(dataLocalIso: string, decidida = false) {
    const [ano, mes, dia] = dataLocalIso.split('-').map(Number);
    const medidoEm = new Date(Date.UTC(ano, mes - 1, dia, 15));
    const l = new Leitura({
      id: UUIDv4.gerar(), padraoId: padrao.id, usuarioId: tecnico.id,
      valorConsumo: new ValorKwh(1800),
      fotoLocalUri: 'file:///documents/leituras/foto.jpg',
      medidoEm, dataLocal: DataLocal.de(medidoEm),
    });
    if (decidida) l.aprovar(tecnico.id, AGORA);
    await leituraRepo.salvar(l);
    return l;
  }

  return { caso, notificacaoRepo, leituraRepo, padraoRepo, leitura, padrao, tecnico };
}

describe('AvaliarLeiturasAtrasadasUseCase', () => {
  it('cria aviso para leitura em aberto com mais de 7 dias', async () => {
    const { caso, notificacaoRepo, leitura } = await cenario();
    const antiga = await leitura('2026-03-01');

    const saida = await caso.executar();

    expect(saida.criadas).toBe(1);
    const criada = [...notificacaoRepo.items.values()][0];
    expect(criada.tipo).toBe(TipoNotificacaoEnum.LEITURA_ATRASADA);
    expect(criada.aguardandoDecisao).toBe(true);
    expect(criada.leituraId?.equals(antiga.id)).toBe(true);
    expect(criada.mensagem).toContain('9 dias');
  });

  it('não avisa de leitura dentro do limite de 7 dias', async () => {
    const { caso, notificacaoRepo, leitura } = await cenario();
    await leitura('2026-03-05');

    expect((await caso.executar()).criadas).toBe(0);
    expect(notificacaoRepo.items.size).toBe(0);
  });

  it('não avisa de leitura já decidida', async () => {
    const { caso, leitura } = await cenario();
    await leitura('2026-01-10', true);
    expect((await caso.executar()).criadas).toBe(0);
  });

  it('não duplica o aviso quando roda de novo', async () => {
    const { caso, notificacaoRepo, leitura } = await cenario();
    await leitura('2026-03-01');

    await caso.executar();
    const segunda = await caso.executar();

    expect(segunda.criadas).toBe(0);
    expect(notificacaoRepo.items.size).toBe(1);
  });

  it('o aviso carrega a empresa do endereço, para o escopo do administrador', async () => {
    const { caso, notificacaoRepo, leitura } = await cenario();
    await leitura('2026-03-01');

    await caso.executar();

    expect([...notificacaoRepo.items.values()][0].empresaId?.equals(empresaId)).toBe(true);
  });

  it('não falha quando não há leitura alguma', async () => {
    const { caso } = await cenario();
    expect((await caso.executar()).criadas).toBe(0);
  });
});

describe('AvaliarLeiturasAtrasadasUseCase: dados órfãos', () => {
  /** Leitura atrasada apontando para um padrão que o teste controla. */
  async function leituraAtrasadaDoPadrao(padraoId: UUIDv4, usuarioId: UUIDv4) {
    const medidoEm = new Date(Date.UTC(2026, 1, 1, 15));
    return new Leitura({
      id: UUIDv4.gerar(), padraoId, usuarioId,
      valorConsumo: new ValorKwh(1800),
      fotoLocalUri: 'file:///documents/leituras/foto.jpg',
      medidoEm, dataLocal: DataLocal.de(medidoEm),
    });
  }

  it('pula a leitura cujo padrão já não existe, sem quebrar as outras', async () => {
    const { caso, notificacaoRepo, leituraRepo, leitura, tecnico } = await cenario();
    await leituraRepo.salvar(await leituraAtrasadaDoPadrao(UUIDv4.gerar(), tecnico.id));
    await leitura('2026-02-20');

    const saida = await caso.executar();

    // Uma linha órfã não pode impedir o aviso das leituras íntegras.
    expect(saida.criadas).toBe(1);
    expect(await notificacaoRepo.contarNaoLidas(null)).toBe(1);
  });

  it('pula a leitura cujo endereço já não existe', async () => {
    const { caso, leituraRepo, padraoRepo, tecnico } = await cenario();
    const orfao = new PadraoCemig({
      id: UUIDv4.gerar(), enderecoId: UUIDv4.gerar(), numero: '000000',
    });
    await padraoRepo.salvar(orfao);
    await leituraRepo.salvar(await leituraAtrasadaDoPadrao(orfao.id, tecnico.id));

    const saida = await caso.executar();

    expect(saida.criadas).toBe(0);
  });
});
