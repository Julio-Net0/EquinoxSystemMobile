import { IHashSenhaGateway } from '@/domain/gateways/IHashSenhaGateway';
import { SenhaHash } from '@/domain/value-objects/SenhaHash';

/**
 * O que sobrou do hash de senha local depois que a autenticação foi para o
 * Supabase Auth (docs/decisions.md, seção 10.2).
 *
 * A migração de seed 002 foi publicada pedindo um `IHashSenhaGateway` e não
 * pode ser editada. Este adaptador a atende sem calcular hash nenhum: devolve
 * um valor fixo e inerte, que a migração 003 apaga logo em seguida. Nenhuma
 * senha é derivada, gravada ou conferida no aparelho.
 */
export class HashSenhaAposentado implements IHashSenhaGateway {
  private static readonly INERTE = new SenhaHash('aposentado', 1000, '0'.repeat(32), '0');

  async gerar(): Promise<SenhaHash> {
    return HashSenhaAposentado.INERTE;
  }

  /** Nunca confere: não há mais senha local para comparar. */
  async verificar(): Promise<boolean> {
    return false;
  }
}
