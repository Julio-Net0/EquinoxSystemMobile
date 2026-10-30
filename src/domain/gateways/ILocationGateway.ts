import { CoordenadasGPS } from '../value-objects/CoordenadasGPS';

/**
 * Posição do técnico no momento da leitura.
 *
 * `obterCoordenadas` devolve null quando a permissão foi negada ou o GPS não
 * respondeu no prazo. Isso não impede a leitura: ela é gravada sem localização
 * e gera um aviso para o administrador.
 */
export interface ILocationGateway {
  temPermissao(): Promise<boolean>;
  solicitarPermissao(): Promise<boolean>;
  obterCoordenadas(opcoes?: { timeoutMs?: number }): Promise<CoordenadasGPS | null>;
}
