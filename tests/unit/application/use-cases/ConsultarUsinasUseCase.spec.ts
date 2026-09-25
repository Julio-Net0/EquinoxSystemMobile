import { ConsultarUsinasUseCase } from '@/application/use-cases/ConsultarUsinasUseCase';
import { UsinaRepositoryMemory } from '@/infrastructure/fakes/UsinaRepositoryMemory';
import { Usina } from '@/domain/entities/Usina';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';

describe('ConsultarUsinasUseCase', () => {
  let usinaRepo: UsinaRepositoryMemory;
  let useCase: ConsultarUsinasUseCase;
  const empresaId = UUIDv4.gerar();

  beforeEach(async () => {
    usinaRepo = new UsinaRepositoryMemory();
    useCase = new ConsultarUsinasUseCase(usinaRepo);

    const coords = new CoordenadasGPS(-23.55, -46.63);

    await usinaRepo.salvar(
      new Usina({
        id: UUIDv4.gerar(),
        empresaId,
        nome: 'Fazenda Solar Alfa',
        codigoUC: 'UC-001',
        capacidadeNominal: 100,
        coordenadas: coords,
        status: StatusUsinaEnum.ATIVA,
      })
    );

    await usinaRepo.salvar(
      new Usina({
        id: UUIDv4.gerar(),
        empresaId,
        nome: 'Usina Solar Beta',
        codigoUC: 'UC-002',
        capacidadeNominal: 200,
        coordenadas: coords,
        status: StatusUsinaEnum.EM_COMISSIONAMENTO,
      })
    );
  });

  it('deve listar todas as usinas da empresa', async () => {
    const usinas = await useCase.executar({ empresaId: empresaId.value });
    expect(usinas.length).toBe(2);
  });

  it('deve filtrar usinas por texto de busca', async () => {
    const usinas = await useCase.executar({
      empresaId: empresaId.value,
      buscaTexto: 'Alfa',
    });

    expect(usinas.length).toBe(1);
    expect(usinas[0].nome).toBe('Fazenda Solar Alfa');
  });

  it('deve filtrar usinas por status', async () => {
    const usinas = await useCase.executar({
      empresaId: empresaId.value,
      status: StatusUsinaEnum.EM_COMISSIONAMENTO,
    });

    expect(usinas.length).toBe(1);
    expect(usinas[0].codigoUC).toBe('UC-002');
  });
});
