import { useNovaLeituraController } from '@/presentation/hooks/useNovaLeituraController';
import { LeituraRepositoryMemory } from '@/infrastructure/fakes/LeituraRepositoryMemory';
import { UsinaRepositoryMemory } from '@/infrastructure/fakes/UsinaRepositoryMemory';
import { ActionQueueRepositoryMemory } from '@/infrastructure/fakes/ActionQueueRepositoryMemory';
import { CameraGatewayFake } from '@/infrastructure/fakes/CameraGatewayFake';
import { LocationGatewayFake } from '@/infrastructure/fakes/LocationGatewayFake';
import { Usina } from '@/domain/entities/Usina';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';

describe('useNovaLeituraController Logic & Integration', () => {
  let leituraRepo: LeituraRepositoryMemory;
  let usinaRepo: UsinaRepositoryMemory;
  let queueRepo: ActionQueueRepositoryMemory;
  let cameraFake: CameraGatewayFake;
  let locationFake: LocationGatewayFake;
  let usina: Usina;

  beforeEach(async () => {
    leituraRepo = new LeituraRepositoryMemory();
    usinaRepo = new UsinaRepositoryMemory();
    queueRepo = new ActionQueueRepositoryMemory();
    cameraFake = new CameraGatewayFake();
    locationFake = new LocationGatewayFake();

    usina = new Usina({
      id: UUIDv4.gerar(),
      empresaId: UUIDv4.gerar(),
      nome: 'Usina Teste Controller',
      codigoUC: 'UC-9900',
      capacidadeNominal: 500,
      status: StatusUsinaEnum.ATIVA,
      coordenadas: new CoordenadasGPS(-19.9167, -43.9345),
    });
    await usinaRepo.salvar(usina);
  });

  it('deve simular captura de foto comprimida através do CameraGatewayFake', async () => {
    const fotoRes = await cameraFake.capturarEComprimirFoto();

    expect(fotoRes).not.toBeNull();
    expect(fotoRes?.uri).toContain('.jpg');
    expect(fotoRes?.sizeBytes).toBeLessThanOrEqual(307200);
  });

  it('deve simular obtenção de coordenadas GPS através do LocationGatewayFake', async () => {
    const coords = await locationFake.obterCoordenadas();

    expect(coords).not.toBeNull();
    expect(coords?.latitude).toBeDefined();
    expect(coords?.longitude).toBeDefined();
  });

  it('deve retornar permissaoNegada quando a câmera não for autorizada', async () => {
    cameraFake.permissaoConcedida = false;
    const res = await cameraFake.capturarEComprimirFoto();

    expect(res).toBeNull();
  });
});
