import { IHashSenhaGateway } from '@/domain/gateways/IHashSenhaGateway';
import { SenhaHash } from '@/domain/value-objects/SenhaHash';

/**
 * Hash de teste: determinístico e instantâneo. Não serve para nada além de
 * teste — a implementação real itera milhares de vezes de propósito.
 */
export class HashSenhaFake implements IHashSenhaGateway {
  private static readonly ALGORITMO = 'fake-sha';
  private static readonly ITERACOES = 1000;
  private static readonly SALT = 'f'.repeat(32);

  async gerar(senhaPlana: string): Promise<SenhaHash> {
    return new SenhaHash(
      HashSenhaFake.ALGORITMO,
      HashSenhaFake.ITERACOES,
      HashSenhaFake.SALT,
      HashSenhaFake.digerir(senhaPlana),
    );
  }

  async verificar(senhaPlana: string, hash: SenhaHash): Promise<boolean> {
    return hash.hash === HashSenhaFake.digerir(senhaPlana);
  }

  private static digerir(senhaPlana: string): string {
    let acumulado = 0;
    for (let i = 0; i < senhaPlana.length; i += 1) {
      acumulado = (acumulado * 31 + senhaPlana.charCodeAt(i)) >>> 0;
    }
    return acumulado.toString(16).padStart(64, '0');
  }
}
