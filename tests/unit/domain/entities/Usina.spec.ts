import { Usina } from '@/domain/entities/Usina';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';

describe('Usina Aggregate Root', () => {
  it('deve criar uma Usina válida', () => {
    const id = UUIDv4.gerar();
    const empresaId = UUIDv4.gerar();
    const coords = new CoordenadasGPS(-23.55, -46.63);

    const usina = new Usina({
      id,
      empresaId,
      nome: 'Usina Sol do Sertão',
      codigoUC: 'UC-123456',
      capacidadeNominal: 500,
      coordenadas: coords,
      status: StatusUsinaEnum.ATIVA,
    });

    expect(usina.id.equals(id)).toBe(true);
    expect(usina.nome).toBe('Usina Sol do Sertão');
    expect(usina.codigoUC).toBe('UC-123456');
    expect(usina.capacidadeNominal).toBe(500);
    expect(usina.coordenadas.equals(coords)).toBe(true);
    expect(usina.status).toBe(StatusUsinaEnum.ATIVA);
  });

  it('deve lançar erro se a capacidade nominal for menor ou igual a zero', () => {
    const id = UUIDv4.gerar();
    const empresaId = UUIDv4.gerar();
    const coords = new CoordenadasGPS(-23.55, -46.63);

    expect(
      () =>
        new Usina({
          id,
          empresaId,
          nome: 'Usina Teste',
          codigoUC: 'UC-000',
          capacidadeNominal: 0,
          coordenadas: coords,
          status: StatusUsinaEnum.EM_COMISSIONAMENTO,
        })
    ).toThrow('Capacidade nominal deve ser maior que zero');
  });

  it('deve aprovar o comissionamento de uma usina em comissionamento', () => {
    const usina = new Usina({
      id: UUIDv4.gerar(),
      empresaId: UUIDv4.gerar(),
      nome: 'Usina Nova',
      codigoUC: 'UC-777',
      capacidadeNominal: 100,
      coordenadas: new CoordenadasGPS(-23.55, -46.63),
      status: StatusUsinaEnum.EM_COMISSIONAMENTO,
    });

    expect(usina.status).toBe(StatusUsinaEnum.EM_COMISSIONAMENTO);
    usina.aprovarComissionamento();
    expect(usina.status).toBe(StatusUsinaEnum.ATIVA);
  });

  it('deve inativar e atualizar data da última visita', () => {
    const usina = new Usina({
      id: UUIDv4.gerar(),
      empresaId: UUIDv4.gerar(),
      nome: 'Usina Antiga',
      codigoUC: 'UC-888',
      capacidadeNominal: 200,
      coordenadas: new CoordenadasGPS(-23.55, -46.63),
      status: StatusUsinaEnum.ATIVA,
    });

    const dataVisita = new Date();
    usina.registrarVisita(dataVisita);
    expect(usina.dataUltimaVisita).toEqual(dataVisita);

    usina.inativar();
    expect(usina.status).toBe(StatusUsinaEnum.INATIVA);
  });
});
