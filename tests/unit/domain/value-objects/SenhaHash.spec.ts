import { SenhaHash } from '@/domain/value-objects/SenhaHash';

const SALT = 'a'.repeat(32);
const HASH = 'b'.repeat(64);

describe('SenhaHash', () => {
  it('guarda algoritmo, iterações, salt e hash', () => {
    const senha = new SenhaHash('sha256-iter', 10_000, SALT, HASH);
    expect(senha.algoritmo).toBe('sha256-iter');
    expect(senha.iteracoes).toBe(10_000);
    expect(senha.salt).toBe(SALT);
    expect(senha.hash).toBe(HASH);
  });

  it('serializa em uma única string para caber numa coluna', () => {
    expect(new SenhaHash('sha256-iter', 10_000, SALT, HASH).serializar())
      .toBe(`sha256-iter$10000$${SALT}$${HASH}`);
  });

  it('volta de uma string serializada', () => {
    const senha = SenhaHash.deSerializado(`sha256-iter$5000$${SALT}$${HASH}`);
    expect(senha.iteracoes).toBe(5000);
    expect(senha.salt).toBe(SALT);
    expect(senha.hash).toBe(HASH);
  });

  it('faz a ida e volta sem perda', () => {
    const original = new SenhaHash('sha256-iter', 12_000, SALT, HASH);
    expect(SenhaHash.deSerializado(original.serializar()).equals(original)).toBe(true);
  });

  it.each([
    ['algoritmo vazio', '', 10_000, SALT, HASH],
    ['poucas iterações', 'sha256-iter', 999, SALT, HASH],
    ['salt curto', 'sha256-iter', 10_000, 'abc', HASH],
    ['salt não hexadecimal', 'sha256-iter', 10_000, 'z'.repeat(32), HASH],
    ['hash vazio', 'sha256-iter', 10_000, SALT, ''],
    ['hash não hexadecimal', 'sha256-iter', 10_000, SALT, 'z'.repeat(64)],
  ])('rejeita %s', (_caso, algoritmo, iteracoes, salt, hash) => {
    expect(() => new SenhaHash(algoritmo as string, iteracoes as number, salt as string, hash as string))
      .toThrow('Hash de senha inválido');
  });

  it.each(['sem-separadores', 'sha256-iter$10000', `sha256-iter$abc$${SALT}$${HASH}`])(
    'rejeita a string serializada %p',
    (entrada) => {
      expect(() => SenhaHash.deSerializado(entrada)).toThrow('Hash de senha inválido');
    },
  );

  it('não considera iguais dois hashes diferentes', () => {
    const a = new SenhaHash('sha256-iter', 10_000, SALT, HASH);
    const b = new SenhaHash('sha256-iter', 10_000, SALT, 'c'.repeat(64));
    expect(a.equals(b)).toBe(false);
  });

  it('não expõe a senha em texto na serialização para log', () => {
    const senha = new SenhaHash('sha256-iter', 10_000, SALT, HASH);
    expect(JSON.stringify(senha)).not.toContain('senhaPlana');
  });
});
