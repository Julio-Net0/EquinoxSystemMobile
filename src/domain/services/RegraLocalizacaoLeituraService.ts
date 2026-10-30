import { CoordenadasGPS } from '../value-objects/CoordenadasGPS';
import { ValidadorDistanciaGpsService } from './ValidadorDistanciaGpsService';

export type SituacaoLocalizacao =
  | 'dentro_do_raio'
  | 'fora_do_raio'
  | 'endereco_sem_geocerca'
  | 'sem_gps';

export interface AvaliacaoLocalizacao {
  situacao: SituacaoLocalizacao;
  distanciaMetros: number | null;
  /** Sempre falso: localização é prova de apoio, não condição da leitura. */
  impedeRegistro: false;
}

/**
 * Confere se a leitura foi feita perto do endereço.
 *
 * Nenhuma situação impede o registro, de propósito. O GPS falha de verdade em
 * casa de medidor, garagem e subsolo, e um endereço pode ter sido cadastrado
 * sem coordenada. Travar a leitura por isso deixaria o técnico sem saída no
 * local — a divergência vira aviso para o administrador.
 */
export class RegraLocalizacaoLeituraService {
  public static readonly RAIO_PADRAO_METROS = 500;

  public static avaliar(
    coordenadasDoTecnico: CoordenadasGPS | null,
    coordenadasDoEndereco: CoordenadasGPS | null,
    raioMetros: number = RegraLocalizacaoLeituraService.RAIO_PADRAO_METROS,
  ): AvaliacaoLocalizacao {
    if (!coordenadasDoTecnico) {
      return { situacao: 'sem_gps', distanciaMetros: null, impedeRegistro: false };
    }
    if (!coordenadasDoEndereco) {
      return { situacao: 'endereco_sem_geocerca', distanciaMetros: null, impedeRegistro: false };
    }

    const distanciaMetros = ValidadorDistanciaGpsService.calcularDistanciaMetros(
      coordenadasDoTecnico,
      coordenadasDoEndereco,
    );

    return {
      situacao: distanciaMetros <= raioMetros ? 'dentro_do_raio' : 'fora_do_raio',
      distanciaMetros,
      impedeRegistro: false,
    };
  }
}
