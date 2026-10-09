import { SyncManager } from '@/infrastructure/sync/SyncManager';
import { NetworkMonitor } from '@/infrastructure/sync/NetworkMonitor';
import { ActionQueueRepositoryMemory } from '@/infrastructure/fakes/ActionQueueRepositoryMemory';
import { LeituraRepositoryMemory } from '@/infrastructure/fakes/LeituraRepositoryMemory';
import { UsinaRepositoryMemory } from '@/infrastructure/fakes/UsinaRepositoryMemory';
import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusSyncEnum } from '@/domain/enums/StatusSyncEnum';

describe('SyncManager & NetworkMonitor (Offline-First Engine)', () => {
  let queueRepo: ActionQueueRepositoryMemory;
  let leituraRepo: LeituraRepositoryMemory;
  let usinaRepo: UsinaRepositoryMemory;
  let syncManager: SyncManager;
  let networkMonitor: NetworkMonitor;

  beforeEach(() => {
    queueRepo = new ActionQueueRepositoryMemory();
    leituraRepo = new LeituraRepositoryMemory();
    usinaRepo = new UsinaRepositoryMemory();
    syncManager = new SyncManager(queueRepo, leituraRepo, usinaRepo);
    networkMonitor = new NetworkMonitor(syncManager);
  });

  it('deve processar itens da action_queue e atualizar status no repositório de leitura', async () => {
    const leituraId = UUIDv4.gerar();
    const leitura = new Leitura({
      id: leituraId,
      usinaId: UUIDv4.gerar(),
      usuarioId: UUIDv4.gerar(),
      valorKwh: new ValorKwh(500),
      caminhoImagemLocal: 'file:///medidor.jpg',
      coordenadas: new CoordenadasGPS(-19.9, -43.9),
      statusSync: StatusSyncEnum.PENDENTE,
    });
    await leituraRepo.salvar(leitura);

    const actionItem = new ActionQueueItem({
      id: UUIDv4.gerar(),
      tipoOperacao: 'INSERT_LEITURA',
      payloadJSON: JSON.stringify({ leituraId: leituraId.value }),
    });
    await queueRepo.enfileirar(actionItem);

    const resultado = await syncManager.processarFilaPush();

    expect(resultado.sucesso).toBe(true);
    expect(resultado.itensProcessadosCount).toBe(1);

    const leituraAtualizada = await leituraRepo.buscarPorId(leituraId);
    expect(leituraAtualizada?.statusSync).toBe(StatusSyncEnum.SINCRONIZADA);
  });

  it('deve disparar o SyncManager automaticamente quando a rede voltar de Offline para Online', async () => {
    const actionItem = new ActionQueueItem({
      id: UUIDv4.gerar(),
      tipoOperacao: 'INSERT_USINA',
      payloadJSON: JSON.stringify({ nome: 'Usina Nova' }),
    });
    await queueRepo.enfileirar(actionItem);

    await networkMonitor.simularMudancaRede(false);
    expect(networkMonitor.getConectividadeAtual()).toBe(false);

    await networkMonitor.simularMudancaRede(true);
    expect(networkMonitor.getConectividadeAtual()).toBe(true);

    const pendentes = await queueRepo.obterPendentes();
    expect(pendentes.length).toBe(0);
  });
});
