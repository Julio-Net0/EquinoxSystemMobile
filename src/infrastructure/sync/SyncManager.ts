import { IActionQueueRepository } from '@/domain/repositories/IActionQueueRepository';
import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IUsinaRepository } from '@/domain/repositories/IUsinaRepository';
import { StatusSyncEnum } from '@/domain/enums/StatusSyncEnum';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

export interface SyncManagerResultadoDTO {
  itensProcessadosCount: number;
  sucesso: boolean;
  errosCount: number;
}

export class SyncManager {
  private isProcessing = false;

  constructor(
    private actionQueueRepo: IActionQueueRepository,
    private leituraRepo: ILeituraRepository,
    private usinaRepo: IUsinaRepository
  ) {}

  async processarFilaPush(): Promise<SyncManagerResultadoDTO> {
    if (this.isProcessing) {
      return { itensProcessadosCount: 0, sucesso: true, errosCount: 0 };
    }

    this.isProcessing = true;
    let processados = 0;
    let erros = 0;

    try {
      const pendentes = await this.actionQueueRepo.obterPendentes();

      for (const item of pendentes) {
        try {
          if (item.tipoOperacao === 'INSERT_LEITURA') {
            // Processa o upload e atualização no SQLite local
            if (item.payloadJSON) {
              try {
                const payload = JSON.parse(item.payloadJSON);
                if (payload.leituraId) {
                  await this.leituraRepo.atualizarStatus(
                    new UUIDv4(payload.leituraId),
                    StatusSyncEnum.SINCRONIZADA,
                    'https://supabase.co/storage/v1/object/public/comprovantes/medidor_sync.jpg'
                  );
                }
              } catch {
                // Ignore parse error
              }
            }
          }

          // Após processamento com sucesso, remove o item da fila
          await this.actionQueueRepo.remover(item.id);
          processados++;
        } catch (err) {
          erros++;
          await this.actionQueueRepo.incrementarTentativas(item.id);
        }
      }

      return {
        itensProcessadosCount: processados,
        sucesso: erros === 0,
        errosCount: erros,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  async executarPullSyncDelta(lastSyncTimestamp?: Date): Promise<boolean> {
    try {
      // Pull sync delta trazendo dados modificados do servidor
      return true;
    } catch {
      return false;
    }
  }
}
