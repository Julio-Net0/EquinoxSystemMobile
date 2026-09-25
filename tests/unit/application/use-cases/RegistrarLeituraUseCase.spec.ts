import { RegistrarLeituraUseCase } from '@/application/use-cases/RegistrarLeituraUseCase';
import { LeituraRepositoryMemory } from '@/infrastructure/fakes/LeituraRepositoryMemory';
import { UsinaRepositoryMemory } from '@/infrastructure/fakes/UsinaRepositoryMemory';
import { ActionQueueRepositoryMemory } from '@/infrastructure/fakes/ActionQueueRepositoryMemory';
import { Usina } from '@/domain/entities/Usina';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';
import { StatusSyncEnum } from '@/domain/enums/StatusSyncEnum';

describe('RegistrarLeituraUseCase', () => {
  let leituraRepo: LeituraRepositoryMemory;
  let usinaRepo: UsinaRepositoryMemory;
  let queueRepo: ActionQueueRepositoryMemory;
  let useCase: RegistrarLeituraUseCase;

  beforeEach(() => {
    leituraRepo = new LeituraRepositoryMemory();
    usinaRepo = new UsinaRepositoryMemory();
    queueRepo = new ActionQueueRepositoryMemory();
    useCase = new RegistrarLeituraUseCase(leituraRepo, usinaRepo, queueRepo);
  });

  it('deve registrar leitura com sucesso, salvar no banco local e enfileirar na ActionQueue', async () => {
    const usinaId = UUIDv4.gerar();
    const usuarioId = UUIDv4.gerar();
    const empresaId = UUIDv4.gerar();
    const coords = new CoordenadasGPS(-23.55, -46.63);

    // Cadastra a usina prévia no banco fake
    await usinaRepo.salvar(
      new Usina({
        id: usinaId,
        empresaId,
        nome: 'Usina Sol',
        codigoUC: 'UC-100',
        capacidadeNominal: 200,
        coordenadas: coords,
        status: StatusUsinaEnum.ATIVA,
      })
    );

    const resultado = await useCase.executar({
      usinaId: usinaId.value,
      usuarioId: usuarioId.value,
      valorKwh: 350.5,
      fotoLocalUri: 'file:///cache/foto_medidor.jpg',
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    expect(resultado.sucesso).toBe(true);
    expect(resultado.leituraId).toBeDefined();

    // Valida persistência no repositório local
    const leituraSalva = await leituraRepo.buscarPorId(new UUIDv4(resultado.leituraId!));
    expect(leituraSalva).not.toBeNull();
    expect(leituraSalva?.valorKwh.valor).toBe(350.5);
    expect(leituraSalva?.statusSync).toBe(StatusSyncEnum.PENDENTE);

    // Valida enfileiramento na ActionQueue
    const pendentes = await queueRepo.obterPendentes();
    expect(pendentes.length).toBe(1);
    expect(pendentes[0].tipoOperacao).toBe('INSERT_LEITURA');
  });

  it('deve falhar se a usina não for encontrada no repositório local', async () => {
    const resultado = await useCase.executar({
      usinaId: UUIDv4.gerar().value,
      usuarioId: UUIDv4.gerar().value,
      valorKwh: 100,
      fotoLocalUri: 'file:///cache/foto.jpg',
      latitude: -23.55,
      longitude: -46.63,
    });

    expect(resultado.sucesso).toBe(false);
    expect(resultado.erro).toBe('Usina não encontrada no catálogo local');
  });
});
