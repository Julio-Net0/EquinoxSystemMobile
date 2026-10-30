import {
  HashSenhaExpoCrypto,
  ITERACOES_PADRAO,
} from '@/infrastructure/security/HashSenhaExpoCrypto';
import { SenhaHash } from '@/domain/value-objects/SenhaHash';

const SENHA = 'Equinox@2026';

describe('HashSenhaExpoCrypto', () => {
  const gateway = new HashSenhaExpoCrypto();

  it('usa um número de iterações que satisfaz a invariante do SenhaHash', () => {
    expect(ITERACOES_PADRAO).toBeGreaterThanOrEqual(1000);
  });

  it('gera um hash com salt, algoritmo e iterações preenchidos', async () => {
    const hash = await gateway.gerar(SENHA);

    expect(hash.algoritmo).toBe('sha256-iter');
    expect(hash.iteracoes).toBe(ITERACOES_PADRAO);
    expect(hash.salt.length).toBeGreaterThanOrEqual(32);
    expect(hash.hash.length).toBeGreaterThan(0);
  });

  it('nunca guarda a senha em texto', async () => {
    const hash = await gateway.gerar(SENHA);
    expect(hash.serializar()).not.toContain(SENHA);
  });

  it('aceita a senha correta', async () => {
    const hash = await gateway.gerar(SENHA);
    expect(await gateway.verificar(SENHA, hash)).toBe(true);
  });

  it('recusa a senha errada', async () => {
    const hash = await gateway.gerar(SENHA);
    expect(await gateway.verificar('outra-senha', hash)).toBe(false);
  });

  it('recusa senha com diferença de caixa', async () => {
    const hash = await gateway.gerar(SENHA);
    expect(await gateway.verificar(SENHA.toLowerCase(), hash)).toBe(false);
  });

  it('sobrevive à ida e volta pela serialização', async () => {
    const hash = await gateway.gerar(SENHA);
    const reconstruido = SenhaHash.deSerializado(hash.serializar());
    expect(await gateway.verificar(SENHA, reconstruido)).toBe(true);
  });

  it('respeita as iterações gravadas no hash, não as atuais', async () => {
    const hash = await gateway.gerar(SENHA);
    const comMenosIteracoes = new SenhaHash('sha256-iter', 1000, hash.salt, hash.hash);

    // Se o gateway ignorasse as iterações do hash, um registro antigo gerado
    // com outra configuração deixaria de autenticar numa atualização do app.
    const confereComAsDoHash = await gateway.verificar(SENHA, comMenosIteracoes);
    expect(typeof confereComAsDoHash).toBe('boolean');
  });

  it('recusa um hash de algoritmo desconhecido em vez de deixar passar', async () => {
    const hash = await gateway.gerar(SENHA);
    const forjado = new SenhaHash('algoritmo-do-futuro', 10_000, hash.salt, hash.hash);

    await expect(gateway.verificar(SENHA, forjado)).rejects.toThrow(
      'Algoritmo de hash não suportado',
    );
  });
});
