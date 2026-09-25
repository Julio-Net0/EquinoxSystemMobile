import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IUsinaRepository } from '@/domain/repositories/IUsinaRepository';
import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { Leitura } from '@/domain/entities/Leitura';
import { ActionQueueItem } from '@/domain/entities/ActionQueueItem';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';

export interface RegistrarLeituraInputDTO {
  usinaId: string;
  usuarioId: string;
  valorKwh: number;
  fotoLocalUri: string;
  latitude: number;
  longitude: number;
}

export interface RegistrarLeituraOutputDTO {
  sucesso: boolean;
  leituraId?: string;
  erro?: string;
}

export class RegistrarLeituraUseCase {
  constructor(
    private readonly leituraRepo: ILeituraRepository,
    private readonly usinaRepo: IUsinaRepository,
    private readonly queueRepo: IActionQueueRepository
  ) {}

  async executar(input: RegistrarLeituraInputDTO): Promise<RegistrarLeituraOutputDTO> {
    try {
      const usinaId = new UUIDv4(input.usinaId);
      const usina = await this.usinaRepo.buscarPorId(usinaId);

      if (!usina) {
        return {
          sucesso: false,
          erro: 'Usina não encontrada no catálogo local',
        };
      }

      const leituraId = UUIDv4.gerar();
      const usuarioId = new UUIDv4(input.usuarioId);
      const valorKwh = new ValorKwh(input.valorKwh);
      const coordenadas = new CoordenadasGPS(input.latitude, input.longitude);

      const leitura = new Leitura({
        id: leituraId,
        usinaId,
        usuarioId,
        valorKwh,
        caminhoImagemLocal: input.fotoLocalUri,
        coordenadas,
      });

      // 1. Salvar no repositório em memória/local
      await this.leituraRepo.salvar(leitura);

      // 2. Enfileirar a ação na ActionQueue para sincronização offline posterior
      const queueItem = new ActionQueueItem({
        id: UUIDv4.gerar(),
        tipoOperacao: 'INSERT_LEITURA',
        payloadJSON: JSON.stringify({
          id: leituraId.value,
          usinaId: usinaId.value,
          usuarioId: usuarioId.value,
          valorKwh: valorKwh.valor,
          caminhoImagemLocal: input.fotoLocalUri,
          latitude: input.latitude,
          longitude: input.longitude,
          dataHora: leitura.dataHora.toISOString(),
        }),
      });

      await this.queueRepo.enfileirar(queueItem);

      return {
        sucesso: true,
        leituraId: leituraId.value,
      };
    } catch (err: any) {
      return {
        sucesso: false,
        erro: err.message || 'Erro ao registrar leitura',
      };
    }
  }
}
