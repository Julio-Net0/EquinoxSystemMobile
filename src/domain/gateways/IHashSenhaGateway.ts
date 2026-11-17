import { SenhaHash } from '../value-objects/SenhaHash';

/**
 * Deriva e confere a verificação de uma senha.
 *
 * Usada pelo acesso offline (`AcessoOfflineService`, ADR 10.18): o aparelho
 * guarda essa verificação, nunca a senha. A implementação real é PBKDF2
 * (`HashSenhaPbkdf2`). A migração de seed 002, que não pode ser editada,
 * também recebe esta porta; lá quem a atende é o inerte `HashSenhaAposentado`.
 */
export interface IHashSenhaGateway {
  gerar(senhaPlana: string): Promise<SenhaHash>;
  verificar(senhaPlana: string, hash: SenhaHash): Promise<boolean>;
}
