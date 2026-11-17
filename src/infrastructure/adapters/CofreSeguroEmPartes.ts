import * as SecureStore from 'expo-secure-store';

/** Mesmo formato que o supabase-js espera do armazenamento de sessão. */
export interface ArmazenamentoDeSessao {
  getItem(chave: string): Promise<string | null>;
  setItem(chave: string, valor: string): Promise<void>;
  removeItem(chave: string): Promise<void>;
}

/**
 * Operações mínimas de um cofre. Existe para o teste poder trocar o
 * `expo-secure-store` por um dublê que imita o limite de tamanho.
 */
export interface CofreBruto {
  ler(chave: string): Promise<string | null>;
  gravar(chave: string, valor: string): Promise<void>;
  apagar(chave: string): Promise<void>;
}

const OPCOES: SecureStore.SecureStoreOptions = {
  // Mesmo critério da sessão: o técnico abre o app em campo logo após ligar o
  // aparelho, antes de o Keychain "desbloqueado" estar disponível.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const cofreDoAparelho: CofreBruto = {
  ler: (chave) => SecureStore.getItemAsync(chave, OPCOES),
  gravar: (chave, valor) => SecureStore.setItemAsync(chave, valor, OPCOES),
  apagar: (chave) => SecureStore.deleteItemAsync(chave, OPCOES),
};

/**
 * Tamanho de cada parte, em unidades UTF-16. Um caractere ocupa até 3 bytes em
 * UTF-8, então 600 unidades nunca passam de 1800 bytes — abaixo dos ~2048 que
 * a documentação do expo-secure-store (SDK 58) aponta como o ponto em que
 * algumas versões do iOS passam a recusar o valor.
 */
export const TAMANHO_DA_PARTE = 600;

/**
 * Guarda os tokens da sessão do Supabase **somente** no armazenamento seguro
 * (Keychain no iOS, Keystore no Android), repartindo o valor em vários itens.
 *
 * Por que repartir: a sessão serializada (token de acesso, token de renovação
 * e dados do usuário) passa fácil de 2 KB, e o cofre pode recusar um valor
 * desse tamanho. A saída que a documentação do Supabase descreve para o Expo
 * é cifrar a sessão com AES, deixar o texto cifrado no AsyncStorage e só a
 * chave no cofre. Aqui a escolha foi outra — manter tudo no cofre, em partes —
 * porque dispensa três dependências (AsyncStorage, aes-js e o gerador de
 * aleatórios) e não deixa nem o texto cifrado fora do Keychain/Keystore.
 *
 * A gravação é em duas gerações ("a" e "b"): as partes novas são escritas na
 * geração que não está em uso e só então o ponteiro muda. Se o app morrer no
 * meio, o ponteiro ainda aponta para a sessão antiga, inteira.
 */
export class CofreSeguroEmPartes implements ArmazenamentoDeSessao {
  constructor(private readonly cofre: CofreBruto = cofreDoAparelho) {}

  async getItem(chave: string): Promise<string | null> {
    const ponteiro = await this.lerPonteiro(chave);
    if (!ponteiro) return null;

    const partes: string[] = [];
    for (let i = 0; i < ponteiro.partes; i += 1) {
      const parte = await this.cofre.ler(CofreSeguroEmPartes.chaveDaParte(chave, ponteiro.geracao, i));
      // Parte faltando é sessão corrompida: melhor não ter sessão do que
      // entregar meio token.
      if (parte === null) return null;
      partes.push(parte);
    }

    return partes.join('');
  }

  async setItem(chave: string, valor: string): Promise<void> {
    const atual = await this.lerPonteiro(chave);
    const geracao = atual?.geracao === 'a' ? 'b' : 'a';

    const partes = CofreSeguroEmPartes.repartir(valor);

    for (let i = 0; i < partes.length; i += 1) {
      await this.cofre.gravar(CofreSeguroEmPartes.chaveDaParte(chave, geracao, i), partes[i]);
    }
    await this.cofre.gravar(CofreSeguroEmPartes.chaveDoPonteiro(chave), `${geracao}:${partes.length}`);

    if (atual) await this.apagarGeracao(chave, atual.geracao, atual.partes);
  }

  async removeItem(chave: string): Promise<void> {
    const ponteiro = await this.lerPonteiro(chave);
    await this.cofre.apagar(CofreSeguroEmPartes.chaveDoPonteiro(chave));
    if (ponteiro) await this.apagarGeracao(chave, ponteiro.geracao, ponteiro.partes);
  }

  private async apagarGeracao(chave: string, geracao: string, partes: number): Promise<void> {
    for (let i = 0; i < partes; i += 1) {
      await this.cofre.apagar(CofreSeguroEmPartes.chaveDaParte(chave, geracao, i));
    }
  }

  private async lerPonteiro(chave: string): Promise<{ geracao: string; partes: number } | null> {
    const bruto = await this.cofre.ler(CofreSeguroEmPartes.chaveDoPonteiro(chave));
    const encontro = /^([ab]):(\d+)$/.exec(bruto ?? '');
    return encontro ? { geracao: encontro[1], partes: Number(encontro[2]) } : null;
  }

  /**
   * Corta o valor em pedaços de até `TAMANHO_DA_PARTE` unidades, sem nunca
   * separar um par substituto (emoji e outros caracteres fora do plano básico
   * ocupam duas unidades). Meio par viraria um caractere inválido ao ser
   * gravado em UTF-8, e a sessão voltaria corrompida.
   */
  private static repartir(valor: string): string[] {
    const partes: string[] = [];
    let inicio = 0;

    while (inicio < valor.length) {
      let fim = Math.min(inicio + TAMANHO_DA_PARTE, valor.length);
      const ultima = valor.charCodeAt(fim - 1);
      const ehMetadeDePar = ultima >= 0xd800 && ultima <= 0xdbff;
      if (ehMetadeDePar && fim < valor.length) fim -= 1;

      partes.push(valor.slice(inicio, fim));
      inicio = fim;
    }

    return partes;
  }

  /** O cofre só aceita letras, números, ponto, hífen e sublinhado na chave. */
  private static limpar(chave: string): string {
    return chave.replace(/[^A-Za-z0-9._-]/g, '_');
  }

  private static chaveDoPonteiro(chave: string): string {
    return `${CofreSeguroEmPartes.limpar(chave)}.ponteiro`;
  }

  private static chaveDaParte(chave: string, geracao: string, indice: number): string {
    return `${CofreSeguroEmPartes.limpar(chave)}.${geracao}.${indice}`;
  }
}
