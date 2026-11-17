export interface ConfiguracaoSupabase {
  url: string;
  chaveAnonima: string;
}

export interface VariaveisDeAmbiente {
  url?: string;
  chaveAnonima?: string;
}

/**
 * A configuração da nuvem está ausente ou é inaceitável. O app mostra a
 * mensagem na tela e não segue — ver `src/app/_layout.tsx`.
 */
export class ConfiguracaoAusenteError extends Error {
  constructor(public readonly problemas: string[]) {
    super(
      [
        'O app não está configurado para falar com a nuvem.',
        ...problemas.map((p) => `• ${p}`),
        'Copie .env.example para .env.local, preencha com os dados do projeto Supabase e reinicie o Expo (npx expo start -c). Passo a passo em docs/supabase-setup.md.',
      ].join('\n'),
    );
    this.name = 'ConfiguracaoAusenteError';
  }
}

/** Valores que alguém deixou do exemplo, sem preencher. */
const MARCADORES_DE_EXEMPLO = ['seu-projeto', 'sua-chave', 'example', 'placeholder', 'xxxx'];

const ehExemplo = (valor: string): boolean =>
  MARCADORES_DE_EXEMPLO.some((marcador) => valor.toLowerCase().includes(marcador));

/**
 * Papel declarado dentro de uma chave no formato JWT, ou nulo se a chave não
 * for um JWT legível. Só olha o conteúdo; não confere assinatura.
 */
function papelDaChave(chave: string): string | null {
  const partes = chave.split('.');
  if (partes.length !== 3) return null;

  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const completo = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const { role } = JSON.parse(globalThis.atob(completo)) as { role?: unknown };
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

/**
 * Lê e valida a configuração do Supabase.
 *
 * Falha alto e explicado quando algo falta, em vez de devolver um cliente
 * apontando para uma URL de mentira: foi esse tipo de fallback silencioso que
 * escondeu, numa fase anterior, que nada estava sendo sincronizado (ADRs 9.2 e
 * 9.9).
 *
 * Também recusa a chave `service_role`. Ela ignora todas as políticas de
 * segurança do banco e, embutida num app, estaria ao alcance de qualquer
 * pessoa com o APK — no aparelho só entra a chave anônima/publicável.
 */
export function lerConfiguracaoSupabase(
  // Acesso estático de propósito: o Expo só embute no bundle as variáveis
  // EXPO_PUBLIC_ escritas por extenso, não as lidas por nome dinâmico.
  ambiente: VariaveisDeAmbiente = {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    chaveAnonima: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
): ConfiguracaoSupabase {
  const url = ambiente.url?.trim() ?? '';
  const chaveAnonima = ambiente.chaveAnonima?.trim() ?? '';
  const problemas: string[] = [];

  if (url === '') {
    problemas.push('Falta a variável EXPO_PUBLIC_SUPABASE_URL.');
  } else if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(url) || ehExemplo(url)) {
    problemas.push('EXPO_PUBLIC_SUPABASE_URL não parece a URL de um projeto (https://….supabase.co).');
  }

  if (chaveAnonima === '') {
    problemas.push('Falta a variável EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  } else if (ehExemplo(chaveAnonima)) {
    problemas.push('EXPO_PUBLIC_SUPABASE_ANON_KEY ainda está com o valor de exemplo.');
  } else if (chaveAnonima.startsWith('sb_secret_') || papelDaChave(chaveAnonima) === 'service_role') {
    problemas.push(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY contém uma chave secreta (service_role). Ela nunca pode ir para o app: use a chave anônima/publicável e troque a secreta no painel, porque ela já foi exposta.',
    );
  }

  if (problemas.length > 0) {
    throw new ConfiguracaoAusenteError(problemas);
  }

  return { url: url.replace(/\/+$/, ''), chaveAnonima };
}
