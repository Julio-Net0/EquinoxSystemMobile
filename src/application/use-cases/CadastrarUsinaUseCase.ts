import { IUsinaRepository } from '@/domain/repositories/IUsinaRepository';
import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { Usina } from '@/domain/entities/Usina';
import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { StatusUsinaEnum } from '@/domain/enums/StatusUsinaEnum';

export interface CadastrarUsinaInputDTO {
  empresaId: string;
  nome: string;
  codigoUC: string;
  capacidadeNominal: number;
  latitude: number;
  longitude: number;
}

export interface CadastrarUsinaOutputDTO {
  sucesso: boolean;
  usinaId?: string;
  erro?: string;
}

export class CadastrarUsinaUseCase {
  constructor(
    private readonly usinaRepo: IUsinaRepository,
    private readonly queueRepo: IActionQueueRepository
  ) {}

  async executar(input: CadastrarUsinaInputDTO): Promise<CadastrarUsinaOutputDTO> {
    try {
      const usinaId = UUIDv4.gerar();
      const empresaId = new UUIDv4(input.empresaId);
      const coordenadas = new CoordenadasGPS(input.latitude, input.longitude);

      const usina = new Usina({
        id: usinaId,
        empresaId,
        nome: input.nome,
        codigoUC: input.codigoUC,
        capacidadeNominal: input.capacidadeNominal,
        coordenadas,
        status: StatusUsinaEnum.EM_COMISSIONAMENTO,
      });

      await this.usinaRepo.salvar(usina);

      const queueItem = new ActionQueueItem({
        id: UUIDv4.gerar(),
        tipoOperacao: 'INSERT_USINA',
        payloadJSON: JSON.stringify({
          id: usinaId.value,
          empresaId: empresaId.value,
          nome: input.nome,
          codigoUC: input.codigoUC,
          capacidadeNominal: input.capacidadeNominal,
          latitude: input.latitude,
          longitude: input.longitude,
          status: StatusUsinaEnum.EM_COMISSIONAMENTO,
        }),
      });

      await this.queueRepo.enfileirar(queueItem);

      return {
        sucesso: true,
        usinaId: usinaId.value,
      };
    } catch (err: any) {
      return {
        sucesso: false,
        erro: err.message || 'Erro ao cadastrar usina',
      };
    }
  }
}
