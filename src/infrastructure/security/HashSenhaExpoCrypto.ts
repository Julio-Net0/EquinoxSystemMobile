import * as Crypto from 'expo-crypto';
import { IHashSenhaGateway } from '@/domain/gateways/IHashSenhaGateway';
import { SenhaHash } from '@/domain/value-objects/SenhaHash';

const ALGORITMO = 'sha256-iter';

/**
 * SHA-256 encadeado.
 *
 * NÃO é um KDF de verdade. expo-crypto não oferece PBKDF2, scrypt nem Argon2,
 * e cada `digestStringAsync` é uma chamada à camada nativa — encadear as
 * centenas de milhares de iterações que um KDF exigiria travaria o login por
 * vários segundos. O número abaixo é o que mantém o login abaixo de ~1s.
 *
 * Consequência: se o arquivo do banco for extraído do aparelho, estas senhas
 * resistem muito menos a força bruta offline do que resistiriam com bcrypt ou
 * Argon2id. É aceitável para um app de demonstração com dados locais; a troca
 * por um KDF nativo está registrada em docs/decisions.md como pendência para
 * quando houver backend.
 */
export const ITERACOES_PADRAO = 1000;

const BYTES_SALT = 16;

const paraHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export class HashSenhaExpoCrypto implements IHashSenhaGateway {
  constructor(private readonly iteracoes: number = ITERACOES_PADRAO) {}

  async gerar(senhaPlana: string): Promise<SenhaHash> {
    const salt = paraHex(await Crypto.getRandomBytesAsync(BYTES_SALT));
    const hash = await HashSenhaExpoCrypto.derivar(senhaPlana, salt, this.iteracoes);

    return new SenhaHash(ALGORITMO, this.iteracoes, salt, hash);
  }

  /**
   * Refaz a derivação com o salt e as iterações **gravados no hash**, não com
   * os atuais: assim um usuário criado numa versão anterior do app continua
   * autenticando depois de a configuração mudar.
   */
  async verificar(senhaPlana: string, hash: SenhaHash): Promise<boolean> {
    if (hash.algoritmo !== ALGORITMO) {
      throw new Error(`Algoritmo de hash não suportado: ${hash.algoritmo}`);
    }

    const derivado = await HashSenhaExpoCrypto.derivar(senhaPlana, hash.salt, hash.iteracoes);
    const candidato = new SenhaHash(hash.algoritmo, hash.iteracoes, hash.salt, derivado);

    // A comparação em tempo ~constante mora no value object.
    return candidato.equals(hash);
  }

  private static async derivar(
    senhaPlana: string,
    salt: string,
    iteracoes: number,
  ): Promise<string> {
    let atual = `${salt}:${senhaPlana}`;

    for (let i = 0; i < iteracoes; i += 1) {
      atual = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, atual);
    }

    return atual;
  }
}
