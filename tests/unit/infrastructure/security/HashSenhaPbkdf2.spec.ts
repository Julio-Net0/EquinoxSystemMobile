import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { HashSenhaPbkdf2 } from '@/infrastructure/security/HashSenhaPbkdf2';
import { SenhaHash } from '@/domain/value-objects/SenhaHash';

/** Sal previsível para o teste poder conferir o resultado com o node:crypto. */
const SAL = new Uint8Array(16).map((_, i) => i + 1);
const fonteFixa = (n: number) => SAL.slice(0, n);

describe('HashSenhaPbkdf2', () => {
  it('gera PBKDF2-SHA256 com sal de 16 bytes, no formato do SenhaHash', async () => {
    const hash = await new HashSenhaPbkdf2(fonteFixa).gerar('Equinox@2026');

    expect(hash.algoritmo).toBe('pbkdf2-sha256');
    expect(hash.iteracoes).toBe(HashSenhaPbkdf2.ITERACOES);
    expect(hash.salt).toBe(Buffer.from(SAL).toString('hex'));
    expect(hash.hash).toHaveLength(64);
  });

  it('dá o mesmo resultado que o PBKDF2 do node:crypto', async () => {
    const hash = await new HashSenhaPbkdf2(fonteFixa).gerar('Equinox@2026');

    const esperado = pbkdf2Sync('Equinox@2026', Buffer.from(SAL), HashSenhaPbkdf2.ITERACOES, 32, 'sha256');
    expect(hash.hash).toBe(esperado.toString('hex'));
  });

  it('confere a senha certa e recusa a errada', async () => {
    const gateway = new HashSenhaPbkdf2();
    const hash = await gateway.gerar('Equinox@2026');

    expect(await gateway.verificar('Equinox@2026', hash)).toBe(true);
    expect(await gateway.verificar('equinox@2026', hash)).toBe(false);
  });

  it('a mesma senha gera hashes diferentes, por causa do sal aleatório', async () => {
    // O expo-crypto do jest.setup devolve bytes fixos; aqui vale o aleatório de verdade.
    const gateway = new HashSenhaPbkdf2((n) => new Uint8Array(randomBytes(n)));

    const a = await gateway.gerar('Equinox@2026');
    const b = await gateway.gerar('Equinox@2026');

    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('respeita as iterações gravadas no hash, para aceitar um ajuste futuro do custo', async () => {
    const gateway = new HashSenhaPbkdf2(fonteFixa);
    const antigo = new SenhaHash(
      'pbkdf2-sha256',
      2000,
      Buffer.from(SAL).toString('hex'),
      pbkdf2Sync('abc123', Buffer.from(SAL), 2000, 32, 'sha256').toString('hex'),
    );

    expect(await gateway.verificar('abc123', antigo)).toBe(true);
  });

  it('não confere hash de outro algoritmo', async () => {
    const outro = new SenhaHash('sha256-iter', 2000, 'a'.repeat(32), 'b'.repeat(64));
    expect(await new HashSenhaPbkdf2().verificar('abc123', outro)).toBe(false);
  });
});
