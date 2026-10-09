import { DataPurgeService } from '@/infrastructure/sync/DataPurgeService';
import { LeituraRepositoryMemory } from '@/infrastructure/fakes/LeituraRepositoryMemory';
import { Leitura } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusSyncEnum } from '@/domain/enums/StatusSyncEnum';

describe('DataPurgeService (RNF07 Expurgo de 30 dias)', () => {
  let leituraRepo: LeituraRepositoryMemory;
  let service: DataPurgeService;

  beforeEach(() => {
    leituraRepo = new LeituraRepositoryMemory();
    service = new DataPurgeService(leituraRepo);
  });

  it('deve executar o expurgo de 30 dias com sucesso', async () => {
    const hoje = new Date('2026-10-09T12:00:00Z');
    const resultado = await service.executarExpurgo30Dias(hoje);

    expect(resultado.sucesso).toBe(true);
    expect(resultado.leiturasPurgedCount).toBeDefined();
  });
});
