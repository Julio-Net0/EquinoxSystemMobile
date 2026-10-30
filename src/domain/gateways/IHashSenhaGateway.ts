import { SenhaHash } from '../value-objects/SenhaHash';

/**
 * Cálculo e verificação de hash de senha. Fica fora do domínio porque depende
 * de primitivas de cripto da plataforma (expo-crypto).
 */
export interface IHashSenhaGateway {
  gerar(senhaPlana: string): Promise<SenhaHash>;
  verificar(senhaPlana: string, hash: SenhaHash): Promise<boolean>;
}
