import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const DOMINIO = join(RAIZ, 'src', 'domain');

/**
 * AGENTS.md seção 4: o domínio não importa React, React Native, Expo, SQLite,
 * Supabase nem qualquer biblioteca de terceiros.
 *
 * A regra existe para o domínio poder rodar e ser testado sem plataforma. Como
 * é fácil de violar sem perceber — um import de conveniência resolve o problema
 * do momento e amarra a camada para sempre — ela vira teste.
 */
const PROIBIDOS = [
  'react',
  'react-native',
  'react-dom',
  'expo',
  'expo-sqlite',
  'expo-crypto',
  'expo-camera',
  'expo-location',
  'expo-file-system',
  'expo-secure-store',
  'expo-image-manipulator',
  'expo-router',
  '@supabase/supabase-js',
  '@react-native-community/netinfo',
  'react-hook-form',
  'zod',
];

function arquivosTs(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosTs(caminho);
    return nome.endsWith('.ts') || nome.endsWith('.tsx') ? [caminho] : [];
  });
}

/** Captura o especificador de `import ... from 'x'` e de `require('x')`. */
function especificadores(conteudo: string): string[] {
  const achados: string[] = [];
  const padroes = [/from\s+['"]([^'"]+)['"]/g, /require\(\s*['"]([^'"]+)['"]\s*\)/g];

  for (const padrao of padroes) {
    let encontro = padrao.exec(conteudo);
    while (encontro !== null) {
      achados.push(encontro[1]);
      encontro = padrao.exec(conteudo);
    }
  }

  return achados;
}

describe('camada de domínio', () => {
  const arquivos = arquivosTs(DOMINIO);

  it('tem arquivos para verificar', () => {
    expect(arquivos.length).toBeGreaterThan(20);
  });

  it.each(arquivos.map((a) => [relative(RAIZ, a), a]))(
    '%s não importa biblioteca de terceiros',
    (_rotulo, caminho) => {
      const importados = especificadores(readFileSync(caminho, 'utf8'));
      const violacoes = importados.filter((imp) =>
        PROIBIDOS.some((proibido) => imp === proibido || imp.startsWith(`${proibido}/`)),
      );

      expect(violacoes).toEqual([]);
    },
  );

  it.each(arquivos.map((a) => [relative(RAIZ, a), a]))(
    '%s só importa de dentro do próprio domínio',
    (_rotulo, caminho) => {
      const importados = especificadores(readFileSync(caminho, 'utf8'));
      const forasteiros = importados.filter((imp) => {
        if (imp.startsWith('.')) return false;
        // Permitido: referência absoluta a outro arquivo do próprio domínio.
        return !imp.startsWith('@/domain/');
      });

      expect(forasteiros).toEqual([]);
    },
  );
});
