import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');

/**
 * Nenhuma tela ou rota instancia repositório, gateway ou caso de uso.
 *
 * A versão anterior do app fazia exatamente isso: cada tela criava os próprios
 * repositórios em memória no escopo do módulo, e por isso cada uma tinha um
 * armazenamento isolado — um usuário cadastrado em /cadastro nunca aparecia em
 * /admin/autorizacoes. A fiação agora é única, no container, e esta regra
 * impede a regressão.
 */
const PASTAS_DE_UI = [
  join(RAIZ, 'src', 'app'),
  join(RAIZ, 'src', 'presentation', 'screens'),
  join(RAIZ, 'src', 'presentation', 'components'),
  join(RAIZ, 'src', 'presentation', 'hooks'),
];

const PADROES_PROIBIDOS = [
  { regex: /new\s+\w*Repository(SQLite|Memory)\s*\(/, motivo: 'instancia repositório' },
  { regex: /new\s+\w+UseCase\s*\(/, motivo: 'instancia caso de uso' },
  { regex: /new\s+\w*Gateway(Expo|Fake)\s*\(/, motivo: 'instancia gateway' },
  { regex: /criarContainer(SQLite|Fake)\s*\(/, motivo: 'monta o container' },
];

function arquivosTs(pasta: string): string[] {
  if (!existsSync(pasta)) return [];

  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosTs(caminho);
    return nome.endsWith('.ts') || nome.endsWith('.tsx') ? [caminho] : [];
  });
}

/**
 * O ContainerProviderSQLite é a exceção legítima: é a raiz de composição, o
 * único ponto onde o grafo é montado.
 */
const EXCECOES = ['ContainerProviderSQLite.tsx'];

describe('camada de apresentação', () => {
  const arquivos = arquivosTs(PASTAS_DE_UI[0])
    .concat(...PASTAS_DE_UI.slice(1).map(arquivosTs))
    .filter((caminho) => !EXCECOES.some((excecao) => caminho.endsWith(excecao)));

  it('tem arquivos para verificar', () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  it.each(arquivos.map((a) => [relative(RAIZ, a), a]))(
    '%s não monta dependências por conta própria',
    (_rotulo, caminho) => {
      const conteudo = readFileSync(caminho, 'utf8');
      const violacoes = PADROES_PROIBIDOS.filter((p) => p.regex.test(conteudo)).map(
        (p) => p.motivo,
      );

      expect(violacoes).toEqual([]);
    },
  );
});
