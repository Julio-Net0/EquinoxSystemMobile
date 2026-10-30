import * as Crypto from 'expo-crypto';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';

/**
 * Liga o UUIDv4 do domínio ao gerador de bytes da plataforma.
 *
 * O domínio não pode importar expo-crypto, então ele traz um fallback com
 * Math.random — previsível e inadequado para identidade. Esta função é chamada
 * uma vez na raiz de composição para trocar a fonte por bytes de verdade.
 */
export function configurarFonteDeUuid(): void {
  UUIDv4.configurarFonte(() => Crypto.getRandomBytes(16));
}
