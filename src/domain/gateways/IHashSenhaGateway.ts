import { SenhaHash } from '../value-objects/SenhaHash';

/**
 * Legado. A senha local deixou de existir quando a autenticação foi para a
 * nuvem; esta porta sobrevive só porque a migração de seed 002, que não pode
 * ser editada, a recebe. Nenhum caso de uso depende dela.
 */
export interface IHashSenhaGateway {
  gerar(senhaPlana: string): Promise<SenhaHash>;
  verificar(senhaPlana: string, hash: SenhaHash): Promise<boolean>;
}
