import { ILeituraRepository } from '@/domain/repositories/ILeituraRepository';
import { IArquivoFotoGateway } from '@/domain/gateways/IArquivoFotoGateway';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { IRelogio, relogioSistema } from '@/domain/services/Relogio';

export interface PurgarLeiturasAntigasOutput {
  removidas: number;
}

/**
 * Expurgo de retenção, rodado no boot. Sem ele o aparelho acumula fotos de
 * 1080p indefinidamente.
 *
 * Só sai o que já foi decidido: uma leitura ainda em aberto fica, por antiga
 * que seja, porque apagá-la perderia o caso que o administrador não resolveu.
 */
export class PurgarLeiturasAntigasUseCase {
  public static readonly DIAS_RETENCAO = 30;

  constructor(
    private readonly leituraRepo: ILeituraRepository,
    private readonly arquivoFoto: IArquivoFotoGateway,
    private readonly relogio: IRelogio = relogioSistema,
  ) {}

  public async executar(): Promise<PurgarLeiturasAntigasOutput> {
    const agora = this.relogio.agora();
    const corte = DataLocal.de(
      new Date(agora.getTime() - PurgarLeiturasAntigasUseCase.DIAS_RETENCAO * 86_400_000),
    );

    const removidas = await this.leituraRepo.excluirDecididasAntesDe(corte);

    for (const leitura of removidas) {
      try {
        await this.arquivoFoto.remover(leitura.fotoLocalUri);
      } catch {
        // A linha já saiu do banco; um arquivo que não pôde ser apagado agora
        // não deve interromper o expurgo das outras.
      }
    }

    return { removidas: removidas.length };
  }
}
