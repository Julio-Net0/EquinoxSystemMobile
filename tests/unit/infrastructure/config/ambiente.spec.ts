import {
  ConfiguracaoAusenteError,
  lerConfiguracaoSupabase,
} from '@/infrastructure/config/ambiente';

const URL = 'https://abcdefgh.supabase.co';

/** Monta um JWT de mentira com o papel dado (a assinatura não é conferida). */
function jwtCom(role: string): string {
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role })}.assinatura`;
}

function problemasDe(ambiente: { url?: string; chaveAnonima?: string }): string[] {
  try {
    lerConfiguracaoSupabase(ambiente);
  } catch (erro) {
    return (erro as ConfiguracaoAusenteError).problemas;
  }
  return [];
}

describe('lerConfiguracaoSupabase', () => {
  it('aceita URL de projeto e chave anônima em formato JWT', () => {
    const chave = jwtCom('anon');
    expect(lerConfiguracaoSupabase({ url: URL, chaveAnonima: chave })).toEqual({
      url: URL,
      chaveAnonima: chave,
    });
  });

  it('aceita a chave publicável do formato novo', () => {
    const config = lerConfiguracaoSupabase({ url: URL, chaveAnonima: 'sb_publishable_abc123' });
    expect(config.chaveAnonima).toBe('sb_publishable_abc123');
  });

  it('apara espaços e a barra final da URL', () => {
    const config = lerConfiguracaoSupabase({ url: ` ${URL}/ `, chaveAnonima: ' chave-anon ' });
    expect(config).toEqual({ url: URL, chaveAnonima: 'chave-anon' });
  });

  it('falha alto quando as duas variáveis faltam, nomeando cada uma', () => {
    expect(problemasDe({})).toEqual([
      'Falta a variável EXPO_PUBLIC_SUPABASE_URL.',
      'Falta a variável EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    ]);
  });

  it('a mensagem do erro diz o que fazer', () => {
    expect(() => lerConfiguracaoSupabase({})).toThrow(ConfiguracaoAusenteError);
    expect(() => lerConfiguracaoSupabase({})).toThrow(/\.env\.example/);
    expect(() => lerConfiguracaoSupabase({})).toThrow(/docs\/supabase-setup\.md/);
  });

  it('não cai num cliente de mentira: nunca devolve configuração incompleta', () => {
    expect(() => lerConfiguracaoSupabase({ url: URL })).toThrow(ConfiguracaoAusenteError);
    expect(() => lerConfiguracaoSupabase({ chaveAnonima: 'chave' })).toThrow(ConfiguracaoAusenteError);
  });

  it.each([
    'http://abcdefgh.supabase.co',
    'abcdefgh.supabase.co',
    'https://seu-projeto.supabase.co',
    'https://localhost',
  ])('recusa a URL %s', (url) => {
    expect(problemasDe({ url, chaveAnonima: 'chave-anon' })[0]).toContain('não parece a URL');
  });

  it('recusa a chave que ficou com o valor do exemplo', () => {
    expect(problemasDe({ url: URL, chaveAnonima: 'sua-chave-anon-aqui' })[0]).toContain(
      'valor de exemplo',
    );
  });

  it('recusa a chave service_role em formato JWT', () => {
    const [problema] = problemasDe({ url: URL, chaveAnonima: jwtCom('service_role') });
    expect(problema).toContain('service_role');
    expect(problema).toContain('nunca pode ir para o app');
  });

  it('recusa a chave secreta do formato novo', () => {
    expect(problemasDe({ url: URL, chaveAnonima: 'sb_secret_abc123' })[0]).toContain('chave secreta');
  });

  it('chave que parece JWT mas não decodifica é tratada como opaca', () => {
    const config = lerConfiguracaoSupabase({ url: URL, chaveAnonima: 'aaa.@@@.ccc' });
    expect(config.chaveAnonima).toBe('aaa.@@@.ccc');
  });

  it('por padrão lê as variáveis EXPO_PUBLIC_ do ambiente', () => {
    const antes = { ...process.env };
    process.env.EXPO_PUBLIC_SUPABASE_URL = URL;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'chave-do-ambiente';
    try {
      expect(lerConfiguracaoSupabase()).toEqual({ url: URL, chaveAnonima: 'chave-do-ambiente' });
    } finally {
      process.env = antes;
    }
  });
});
