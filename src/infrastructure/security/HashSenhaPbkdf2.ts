import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as Crypto from 'expo-crypto';
import { IHashSenhaGateway } from '@/domain/gateways/IHashSenhaGateway';
import { SenhaHash } from '@/domain/value-objects/SenhaHash';

const ALGORITMO = 'pbkdf2-sha256';
const BYTES_DO_SAL = 16;
const BYTES_DO_HASH = 32;

/**
 * Verificação de senha para o acesso offline: PBKDF2-HMAC-SHA256, com sal
 * aleatório por cálculo (ADR 10.18).
 *
 * `@noble/hashes` porque é JavaScript puro e roda no Expo Go — o
 * `expo-crypto` não tem PBKDF2. A versão assíncrona cede a vez ao laço de
 * eventos durante o cálculo, para a tela de login não congelar.
 *
 * O custo (iterações) é um equilíbrio: o Hermes não tem JIT e é bem mais
 * lento que o Node. O hash fica dentro do Keychain/Keystore, que já é a
 * primeira barreira; as iterações são a segunda. Cada hash grava as próprias
 * iterações, então dá para mudar o custo sem invalidar os já guardados.
 */
export class HashSenhaPbkdf2 implements IHashSenhaGateway {
  public static readonly ITERACOES = 30_000;

  constructor(
    private readonly bytesAleatorios: (n: number) => Uint8Array = (n) => Crypto.getRandomBytes(n),
  ) {}

  async gerar(senhaPlana: string): Promise<SenhaHash> {
    const sal = this.bytesAleatorios(BYTES_DO_SAL);
    const derivado = await HashSenhaPbkdf2.derivar(senhaPlana, sal, HashSenhaPbkdf2.ITERACOES);
    return new SenhaHash(ALGORITMO, HashSenhaPbkdf2.ITERACOES, bytesToHex(sal), derivado);
  }

  async verificar(senhaPlana: string, hash: SenhaHash): Promise<boolean> {
    if (hash.algoritmo !== ALGORITMO) return false;

    const derivado = await HashSenhaPbkdf2.derivar(
      senhaPlana,
      hexToBytes(hash.salt),
      hash.iteracoes,
    );
    // Comparação em tempo constante, pelo próprio value object.
    return hash.equals(new SenhaHash(ALGORITMO, hash.iteracoes, hash.salt, derivado));
  }

  private static async derivar(senha: string, sal: Uint8Array, iteracoes: number): Promise<string> {
    const bytes = await pbkdf2Async(sha256, senha, sal, { c: iteracoes, dkLen: BYTES_DO_HASH });
    return bytesToHex(bytes);
  }
}
