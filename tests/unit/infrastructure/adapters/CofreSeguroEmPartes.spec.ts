import * as SecureStore from 'expo-secure-store';
import {
  CofreBruto,
  CofreSeguroEmPartes,
  TAMANHO_DA_PARTE,
} from '@/infrastructure/adapters/CofreSeguroEmPartes';

/** Limite a partir do qual o Keychain de algumas versões do iOS recusa o valor. */
const LIMITE_DO_COFRE = 2048;

const bytes = (texto: string): number => Buffer.byteLength(texto, 'utf8');

/** Cofre que, como o de verdade pode fazer, recusa valor grande demais. */
function cofreComLimite() {
  const itens = new Map<string, string>();
  const cofre: CofreBruto = {
    ler: async (chave) => itens.get(chave) ?? null,
    gravar: async (chave, valor) => {
      if (bytes(valor) > LIMITE_DO_COFRE) throw new Error('valor grande demais para o cofre');
      if (!/^[A-Za-z0-9._-]+$/.test(chave)) throw new Error(`chave inválida: ${chave}`);
      itens.set(chave, valor);
    },
    apagar: async (chave) => void itens.delete(chave),
  };
  return { itens, cofre, armazenamento: new CofreSeguroEmPartes(cofre) };
}

/** Sessão do Supabase serializada: bem maior que o limite de um item. */
const sessaoGrande = (marca = 'a'): string =>
  JSON.stringify({
    access_token: `eyJ${marca.repeat(3000)}`,
    refresh_token: marca.repeat(40),
    user: { id: 'u1', email: 'tecnico@equinox.dev', user_metadata: { nome: 'João da Conceição' } },
  });

const CHAVE = 'equinox.auth';

describe('CofreSeguroEmPartes', () => {
  it('guarda e devolve uma sessão maior que o limite de um item do cofre', async () => {
    const { armazenamento } = cofreComLimite();
    const sessao = sessaoGrande();
    expect(bytes(sessao)).toBeGreaterThan(LIMITE_DO_COFRE);

    await armazenamento.setItem(CHAVE, sessao);

    expect(await armazenamento.getItem(CHAVE)).toBe(sessao);
  });

  it('nenhuma parte gravada passa do limite, nem com acentos e emoji', async () => {
    const { armazenamento, itens } = cofreComLimite();
    const pesado = 'ção€😀'.repeat(900);

    await armazenamento.setItem(CHAVE, pesado);

    expect(TAMANHO_DA_PARTE * 3).toBeLessThan(LIMITE_DO_COFRE);
    for (const valor of itens.values()) expect(bytes(valor)).toBeLessThanOrEqual(LIMITE_DO_COFRE);
    expect(await armazenamento.getItem(CHAVE)).toBe(pesado);
  });

  it('nunca parte um emoji ao meio: cada parte é UTF-8 válido sozinha', async () => {
    const { armazenamento, itens } = cofreComLimite();
    // Desalinha de propósito, para o corte de 600 cair no meio de um par.
    const comEmoji = `x${'😀'.repeat(1000)}`;

    await armazenamento.setItem(CHAVE, comEmoji);

    for (const [chave, parte] of itens) {
      if (chave.endsWith('.ponteiro')) continue;
      // Ida e volta por UTF-8, como o cofre nativo faz: meio par não sobrevive.
      expect(Buffer.from(parte, 'utf8').toString('utf8')).toBe(parte);
    }
    expect(await armazenamento.getItem(CHAVE)).toBe(comEmoji);
  });

  it('devolve nulo quando não há nada guardado', async () => {
    const { armazenamento } = cofreComLimite();
    expect(await armazenamento.getItem(CHAVE)).toBeNull();
  });

  it('sobrescrever não deixa partes da sessão antiga para trás', async () => {
    const { armazenamento, itens } = cofreComLimite();
    await armazenamento.setItem(CHAVE, sessaoGrande('a'));
    const curta = '{"access_token":"curto"}';

    await armazenamento.setItem(CHAVE, curta);

    expect(await armazenamento.getItem(CHAVE)).toBe(curta);
    // Ponteiro + uma parte.
    expect(itens.size).toBe(2);
    expect(Array.from(itens.values()).join('')).not.toContain('aaaa');
  });

  it('removeItem apaga o ponteiro e todas as partes: nenhum token fica no aparelho', async () => {
    const { armazenamento, itens } = cofreComLimite();
    await armazenamento.setItem(CHAVE, sessaoGrande());

    await armazenamento.removeItem(CHAVE);

    expect(itens.size).toBe(0);
    expect(await armazenamento.getItem(CHAVE)).toBeNull();
  });

  it('remover o que não existe não falha', async () => {
    const { armazenamento } = cofreComLimite();
    await expect(armazenamento.removeItem(CHAVE)).resolves.toBeUndefined();
  });

  it('se o app morre no meio da gravação, a sessão anterior continua inteira', async () => {
    const { armazenamento, cofre } = cofreComLimite();
    const antiga = sessaoGrande('a');
    await armazenamento.setItem(CHAVE, antiga);

    // A gravação da nova sessão é interrompida depois de duas partes.
    let gravacoes = 0;
    const gravar = cofre.gravar;
    cofre.gravar = async (chave, valor) => {
      gravacoes += 1;
      if (gravacoes > 2) throw new Error('app encerrado');
      return gravar(chave, valor);
    };
    await expect(armazenamento.setItem(CHAVE, sessaoGrande('b'))).rejects.toThrow('app encerrado');

    expect(await armazenamento.getItem(CHAVE)).toBe(antiga);
  });

  it('parte faltando é sessão corrompida: devolve nulo em vez de meio token', async () => {
    const { armazenamento, itens } = cofreComLimite();
    await armazenamento.setItem(CHAVE, sessaoGrande());
    itens.delete(`${CHAVE}.a.1`);

    expect(await armazenamento.getItem(CHAVE)).toBeNull();
  });

  it('ponteiro ilegível é tratado como ausência de sessão', async () => {
    const { armazenamento, itens } = cofreComLimite();
    itens.set(`${CHAVE}.ponteiro`, 'lixo');

    expect(await armazenamento.getItem(CHAVE)).toBeNull();
  });

  it('limpa caracteres que o cofre não aceita na chave', async () => {
    const { armazenamento } = cofreComLimite();

    await armazenamento.setItem('sb-projeto/auth token', 'valor');

    expect(await armazenamento.getItem('sb-projeto/auth token')).toBe('valor');
  });

  it('por padrão grava no expo-secure-store, acessível após o primeiro desbloqueio', async () => {
    const armazenamento = new CofreSeguroEmPartes();

    await armazenamento.setItem(CHAVE, 'token-de-teste');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      `${CHAVE}.a.0`,
      'token-de-teste',
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK },
    );
    expect(await armazenamento.getItem(CHAVE)).toBe('token-de-teste');

    await armazenamento.removeItem(CHAVE);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(await armazenamento.getItem(CHAVE)).toBeNull();
  });
});
