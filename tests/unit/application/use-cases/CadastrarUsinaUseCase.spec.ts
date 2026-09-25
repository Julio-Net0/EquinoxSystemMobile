import { CadastrarUsinaUseCase } from '@/application/use-cases/CadastrarUsinaUseCase';
import { UsinaRepositoryMemory } from '@/infrastructure/fakes/UsinaRepositoryMemory';
import { ActionQueueRepositoryMemory } from '@/infrastructure/fakes/ActionQueueRepositoryMemory';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';

describe('CadastrarUsinaUseCase', () => {
  let usinaRepo: UsinaRepositoryMemory;
  let queueRepo: ActionQueueRepositoryMemory;
  let useCase: CadastrarUsinaUseCase;

  beforeEach(() => {
    usinaRepo = new UsinaRepositoryMemory();
    queueRepo = new ActionQueueRepositoryMemory();
    useCase = new CadastrarUsinaUseCase(usinaRepo, queueRepo);
  });

  it('deve cadastrar usina emergencial com status Em Comissionamento e enfileirar na ActionQueue', async () => {
    const empresaId = UUIDv4.gerar().value;

    const resultado = await useCase.executar({
      empresaId,
      nome: 'Usina Campo Verde',
      codigoUC: 'UC-999',
      capacidadeNominal: 450,
      latitude: -23.55,
      longitude: -46.63,
    });

    expect(resultado.sucesso).toBe(true);
    expect(resultado.usinaId).toBeDefined();

    const usinaSalva = await usinaRepo.buscarPorId(new UUIDv4(resultado.usinaId!));
    expect(usinaSalva).not.toBeNull();
    expect(usinaSalva?.nome).toBe('Usina Campo Verde');
    expect(usinaSalva?.status).toBe(StatusUsinaEnum.EM_COMISSIONAMENTO);

    const pendentes = await queueRepo.obterPendentes();
    expect(pendentes.length).toBe(1);
    expect(pendentes[0].tipoOperacao).toBe('INSERT_USINA');
  });
});
