import { migrar } from '@/infrastructure/database/sqlite/migrar';
import { criarMigracoes } from '@/infrastructure/database/sqlite/migrations';
import { migracaoSchemaInicial } from '@/infrastructure/database/sqlite/migrations/001_schema_inicial';
import { criarMigracaoSeedDemo } from '@/infrastructure/database/sqlite/migrations/002_seed_demo';
import {
  UnidadeDeTrabalhoSQLite,
  criarRepositoriosCrus,
} from '@/infrastructure/database/sqlite/UnidadeDeTrabalhoSQLite';
import { repositoriosComFila } from '@/infrastructure/sync/repositoriosComFila';
import { HashSenhaAposentado } from '@/infrastructure/security/HashSenhaAposentado';
import { SincronizacaoRemotaFake, pacoteVazio } from '@/infrastructure/fakes/SincronizacaoRemotaFake';
import { ArquivoFotoGatewayFake } from '@/infrastructure/fakes/ArquivoFotoGatewayFake';
import { BaixarAlteracoesUseCase } from '@/application/use-cases/BaixarAlteracoesUseCase';
import { ProcessarFilaSincronizacaoUseCase } from '@/application/use-cases/ProcessarFilaSincronizacaoUseCase';
import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import { CHAVE_CURSORES } from '@/domain/repositories/ISyncMetaRepository';
import { EstadoSyncEnum } from '@/domain/enums/EstadoSyncEnum';
import { StatusLeituraEnum } from '@/domain/enums/StatusLeituraEnum';
import { relogioFixo } from '@/domain/services/Relogio';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { abrirBancoDeTeste, BancoDeTeste } from '../../helpers/bancoDeTeste';
import { novaLeitura, novoEndereco, novoPadrao } from '../../helpers/cenarioSync';

/** 10/03/2026, 12:00 em Brasília. */
const HOJE = new Date(Date.UTC(2026, 2, 10, 15));
const relogio = relogioFixo(HOJE);

/** Identificadores do seed de demonstração (002_seed_demo). */
const SEED = {
  empresa: new UUIDv4('1a000000-0000-4000-8000-000000000001'),
  endereco: new UUIDv4('2b000000-0000-4000-8000-000000000001'),
  padrao: new UUIDv4('3c000000-0000-4000-8000-000000000001'),
  tecnico: new UUIDv4('4d000000-0000-4000-8000-000000000003'),
};

const nova = (n: number, sobrescrita: Parameters<typeof novaLeitura>[0] = {}) =>
  novaLeitura({
    id: new UUIDv4(`9a000000-0000-4000-8000-${String(n).padStart(12, '0')}`),
    padraoId: SEED.padrao,
    usuarioId: SEED.tecnico,
    fotoLocalUri: `file:///documents/leituras/${n}.jpg`,
    medidoEm: HOJE,
    ...sobrescrita,
  });

describe('sincronização sobre o SQLite de verdade', () => {
  let banco: BancoDeTeste;

  beforeEach(() => {
    banco = abrirBancoDeTeste();
  });

  afterEach(() => {
    banco.fechar();
  });

  const migrarTudo = () => migrar(banco.db, criarMigracoes(new HashSenhaAposentado(), relogio));
  const contar = (tabela: string) =>
    banco.consultar<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabela}`)[0].n;

  describe('migração 003', () => {
    it('instalação nova: 001, 002 e 003 rodam em sequência', async () => {
      expect(await migrarTudo()).toBe(3);

      const colunas = banco
        .consultar<{ name: string }>('PRAGMA table_info(leituras)')
        .map((c) => c.name);
      expect(colunas).toEqual(expect.arrayContaining(['foto_remota_path', 'sync_status']));
      expect(banco.consultar('SELECT * FROM sync_meta')).toEqual([]);
    });

    it('as leituras do seed já contam como sincronizadas e nada fica na fila', async () => {
      await migrarTudo();

      const estados = banco.consultar<{ sync_status: string; n: number }>(
        'SELECT sync_status, COUNT(*) AS n FROM leituras GROUP BY sync_status',
      );
      expect(estados).toEqual([{ sync_status: 'sincronizada', n: 12 }]);
      expect(contar('action_queue')).toBe(0);
    });

    it('nenhuma senha fica no aparelho, nem em instalação nova', async () => {
      await migrarTudo();

      const hashes = banco.consultar<{ senha_hash: string }>('SELECT senha_hash FROM usuarios');
      expect(hashes.every((h) => h.senha_hash === '')).toBe(true);
    });

    it('aparelho que já estava na versão 2: as leituras locais vão para a fila, em ordem', async () => {
      // Banco como um aparelho antigo o tem: schema + seed, e nada mais.
      await migrar(banco.db, [
        migracaoSchemaInicial,
        criarMigracaoSeedDemo(new HashSenhaAposentado(), relogio),
      ]);
      expect(banco.versao()).toBe(2);
      const inserir = (id: string, medidoEm: string, dataLocal: string) =>
        banco.db.runAsync(
          `INSERT INTO leituras (id, padrao_id, usuario_id, valor_consumo, foto_local_uri,
                                 medido_em, data_local, status)
           VALUES (?, ?, ?, 12000, 'file:///documents/leituras/x.jpg', ?, ?, 'registrada')`,
          [id, SEED.padrao.value, SEED.tecnico.value, medidoEm, dataLocal],
        );
      // Dias em que o seed não tem leitura para este padrão (ele tem a 12, 5
      // e 1 dia de hoje).
      await inserir('9a000000-0000-4000-8000-000000000002', '2026-03-08T15:00:00.000Z', '2026-03-08');
      await inserir('9a000000-0000-4000-8000-000000000001', '2026-03-07T15:00:00.000Z', '2026-03-07');

      // Atualização do app: só a 003 roda.
      expect(await migrarTudo()).toBe(3);

      const fila = await criarRepositoriosCrus(banco.db).actionQueue.obterPendentes();
      expect(fila.map((i) => i.tipoOperacao)).toEqual(['UPSERT_LEITURA', 'UPSERT_LEITURA']);
      expect(fila.map((i) => i.registroId?.value)).toEqual([
        '9a000000-0000-4000-8000-000000000001',
        '9a000000-0000-4000-8000-000000000002',
      ]);
      // Os ids gerados em SQL são UUIDv4 válidos e distintos.
      expect(new Set(fila.map((i) => i.id.value)).size).toBe(2);

      const pendentes = banco.consultar<{ n: number }>(
        "SELECT COUNT(*) AS n FROM leituras WHERE sync_status = 'pendente'",
      )[0].n;
      expect(pendentes).toBe(2);
    });
  });

  describe('gravar e enfileirar na mesma transação', () => {
    const montar = () => {
      const crus = criarRepositoriosCrus(banco.db);
      const uow = new UnidadeDeTrabalhoSQLite(banco.db);
      return { crus, uow, repos: repositoriosComFila(crus, uow, relogio) };
    };

    beforeEach(async () => {
      await migrarTudo();
    });

    it('salvar a leitura deixa a linha e o item de fila', async () => {
      const { repos, crus } = montar();
      const leitura = nova(1);

      await repos.leitura.salvar(leitura);

      const [item] = await crus.actionQueue.obterPendentes();
      expect(item.tipoOperacao).toBe('UPSERT_LEITURA');
      expect(item.registroId?.equals(leitura.id)).toBe(true);
      expect(item.timestamp).toEqual(HOJE);
      expect((await crus.leitura.buscarPorId(leitura.id))?.estadoSync).toBe(EstadoSyncEnum.PENDENTE);
    });

    it('se o enfileiramento falha, a leitura NÃO fica gravada', async () => {
      const { repos, crus } = montar();
      // Tira a tabela da fila do caminho: o INSERT do item vai falhar depois
      // de a leitura já ter sido inserida na mesma transação.
      await banco.db.execAsync('ALTER TABLE action_queue RENAME TO action_queue_fora');

      await expect(repos.leitura.salvar(nova(1))).rejects.toThrow(/action_queue/);

      expect(await crus.leitura.buscarPorId(nova(1).id)).toBeNull();
    });

    it('se a escrita falha, nenhum item fica na fila', async () => {
      const { repos } = montar();
      await repos.leitura.salvar(nova(1));
      const antes = contar('action_queue');

      // Mesmo id: viola a chave primária.
      await expect(repos.leitura.salvar(nova(1))).rejects.toThrow();

      expect(contar('action_queue')).toBe(antes);
    });

    it('a substituição grava as duas leituras e os dois itens, na ordem certa', async () => {
      const { repos, crus } = montar();
      const antiga = nova(1);
      await repos.leitura.salvar(antiga);
      const recente = nova(2, { medidoEm: new Date(HOJE.getTime() + 60_000) });
      antiga.substituirPor(recente, HOJE);

      await repos.leitura.salvarSubstituindo(recente, antiga);

      const fila = (await crus.actionQueue.obterPendentes()).map((i) => i.registroId?.value);
      expect(fila).toEqual([antiga.id.value, antiga.id.value, recente.id.value]);
      expect((await crus.leitura.buscarPorId(antiga.id))?.status).toBe(StatusLeituraEnum.SUBSTITUIDA);
    });

    it('a unidade de trabalho devolve o resultado e desfaz tudo em caso de erro', async () => {
      const { uow, crus } = montar();

      expect(await uow.executar(async (r) => (await r.empresa.listarTodas()).length)).toBe(2);

      await expect(
        uow.executar(async (r) => {
          await r.endereco.salvar(novoEndereco(new UUIDv4('2b000000-0000-4000-8000-000000000099'), SEED.empresa));
          await r.syncMeta.definir('chave', 'valor');
          throw new Error('no meio');
        }),
      ).rejects.toThrow('no meio');

      expect(await crus.syncMeta.obter('chave')).toBeNull();
      expect(contar('enderecos')).toBe(6);
    });
  });

  describe('estado da sincronização', () => {
    it('guarda, sobrescreve e apaga valores', async () => {
      await migrarTudo();
      const { syncMeta } = criarRepositoriosCrus(banco.db);

      expect(await syncMeta.obter(CHAVE_CURSORES)).toBeNull();
      await syncMeta.definir(CHAVE_CURSORES, '{"leituras":"a"}');
      await syncMeta.definir(CHAVE_CURSORES, '{"leituras":"b"}');
      expect(await syncMeta.obter(CHAVE_CURSORES)).toBe('{"leituras":"b"}');

      await syncMeta.definir(CHAVE_CURSORES, null);
      expect(await syncMeta.obter(CHAVE_CURSORES)).toBeNull();
      expect(contar('sync_meta')).toBe(1);
    });
  });

  describe('push e pull de ponta a ponta contra o banco', () => {
    const montar = () => {
      const crus = criarRepositoriosCrus(banco.db);
      const uow = new UnidadeDeTrabalhoSQLite(banco.db);
      const remoto = new SincronizacaoRemotaFake();
      const arquivoFoto = new ArquivoFotoGatewayFake();
      return {
        crus, remoto, arquivoFoto,
        repos: repositoriosComFila(crus, uow, relogio),
        push: new ProcessarFilaSincronizacaoUseCase(crus.actionQueue, crus, remoto, arquivoFoto),
        pull: new BaixarAlteracoesUseCase(remoto, uow, crus.syncMeta),
      };
    };

    beforeEach(async () => {
      await migrarTudo();
    });

    it('leitura feita offline sobe (foto antes da linha) e fica sincronizada no SQLite', async () => {
      const { repos, crus, remoto, arquivoFoto, push } = montar();
      const leitura = nova(1);
      arquivoFoto.salvos.set(leitura.fotoLocalUri, {
        uri: leitura.fotoLocalUri, bytes: 300_000, largura: 1080, altura: 1440,
      });
      await repos.leitura.salvar(leitura);

      const saida = await push.executar();

      const caminho = `${SEED.empresa.value}/${SEED.endereco.value}/${leitura.id.value}.jpg`;
      expect(saida.enviados).toBe(1);
      expect(remoto.chamadas).toEqual([`enviarFoto:${caminho}`, `enviarLeitura:${leitura.id.value}`]);
      const [linha] = banco.consultar<{ sync_status: string; foto_remota_path: string }>(
        'SELECT sync_status, foto_remota_path FROM leituras WHERE id = ?',
        leitura.id.value,
      );
      expect(linha).toEqual({ sync_status: 'sincronizada', foto_remota_path: caminho });
      expect(contar('action_queue')).toBe(0);
      expect(await crus.actionQueue.contar()).toBe(0);
    });

    it('o limite de tentativas isola o item sem travar a fila', async () => {
      const { repos, crus, remoto, push } = montar();
      await repos.leitura.salvar(nova(1));
      await repos.padrao.salvar(
        novoPadrao(new UUIDv4('3c000000-0000-4000-8000-000000000099'), SEED.endereco, '990001'),
      );
      // Sem a foto no aparelho, a leitura é recusada todas as vezes.
      for (let i = 0; i < ActionQueueItem.MAX_TENTATIVAS; i += 1) await push.executar();

      const [isolado] = await crus.actionQueue.obterPendentes();
      expect(isolado.estaIsolado()).toBe(true);
      expect(remoto.padroes.size).toBe(1);
      expect((await crus.leitura.buscarPorId(nova(1).id))?.estadoSync).toBe(EstadoSyncEnum.FALHOU);
    });

    it('o que foi criado na nuvem aparece no SQLite depois do pull, com o cursor', async () => {
      const { crus, remoto, pull } = montar();
      const padraoNovo = novoPadrao(
        new UUIDv4('3c000000-0000-4000-8000-000000000050'),
        SEED.endereco,
        '990002',
      );
      remoto.pacotes.push({
        ...pacoteVazio({ padroes: '2026-03-10T15:00:00.123456+00:00' }),
        padroes: [padraoNovo],
        leituras: [
          nova(7, {
            fotoLocalUri: '', fotoRemotaPath: 'e/n/7.jpg', estadoSync: EstadoSyncEnum.SINCRONIZADA,
          }),
        ],
      });

      const saida = await pull.executar({ usuarioId: SEED.tecnico.value });

      expect(saida).toEqual({ sucesso: true, recebidos: 2, ignorados: [] });
      expect(await crus.padrao.buscarPorId(padraoNovo.id)).not.toBeNull();
      const baixada = await crus.leitura.buscarPorId(nova(7).id);
      expect(baixada?.estaSincronizada()).toBe(true);
      expect(baixada?.temFotoNoAparelho()).toBe(false);
      expect(JSON.parse((await crus.syncMeta.obter(CHAVE_CURSORES))!)).toEqual({
        padroes: '2026-03-10T15:00:00.123456+00:00',
      });
      // Nada do que veio da nuvem volta para a fila.
      expect(contar('action_queue')).toBe(0);
    });

    it('pull que falha no meio não deixa metade aplicada nem avança o cursor', async () => {
      const { crus, remoto, pull } = montar();
      await crus.syncMeta.definir(CHAVE_CURSORES, '{"padroes":"antigo"}');
      remoto.pacotes.push({
        ...pacoteVazio({ padroes: 'novo' }),
        padroes: [
          novoPadrao(new UUIDv4('3c000000-0000-4000-8000-000000000050'), SEED.endereco, '990003'),
          // Mesmo número no mesmo endereço: o primeiro entra, o segundo viola o
          // índice único — e o primeiro tem de sair junto.
          novoPadrao(new UUIDv4('3c000000-0000-4000-8000-000000000051'), SEED.endereco, '990003'),
        ],
      });

      await expect(pull.executar({ usuarioId: SEED.tecnico.value })).rejects.toThrow();

      expect(contar('padroes_cemig')).toBe(7);
      expect(await crus.syncMeta.obter(CHAVE_CURSORES)).toBe('{"padroes":"antigo"}');
    });

    it('as datas do seed remoto podem diferir das locais: o pull realinha sem violar a vaga do dia', async () => {
      const { crus, remoto, pull } = montar();
      // No aparelho o padrão 1 tem leituras a 12, 5 e 1 dia(s) de HOJE. Na
      // nuvem o seed rodou 4 dias antes: cada uma está 4 dias mais atrás, e a
      // terceira cai no dia que, localmente, ainda é da segunda.
      const locais = await crus.leitura.listarDoPadrao(SEED.padrao);
      expect(locais).toHaveLength(3);
      const deslocadas = locais.map((l) => {
        const medidoEm = new Date(l.medidoEm.getTime() - 4 * 86_400_000);
        return novaLeitura({
          id: l.id, padraoId: l.padraoId, usuarioId: l.usuarioId, valorConsumo: l.valorConsumo,
          fotoLocalUri: '', fotoRemotaPath: 'e/n/seed-demo.jpg', medidoEm,
          status: StatusLeituraEnum.APROVADA, estadoSync: EstadoSyncEnum.SINCRONIZADA,
        });
      });
      remoto.pacotes.push({ ...pacoteVazio(), leituras: deslocadas.reverse() });

      await pull.executar({ usuarioId: SEED.tecnico.value });

      const depois = await crus.leitura.listarVigentesDoPadrao(SEED.padrao);
      expect(depois.map((l) => l.dataLocal.value)).toEqual(['2026-02-22', '2026-03-01', '2026-03-05']);
      expect(depois.every((l) => l.status === StatusLeituraEnum.APROVADA)).toBe(true);
    });
  });
});
