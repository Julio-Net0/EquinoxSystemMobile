import { migrar, PRAGMAS_DE_ABERTURA } from '@/infrastructure/database/sqlite/migrar';
import { criarMigracoes, SENHA_DEMO } from '@/infrastructure/database/sqlite/migrations';
import { migracaoSchemaInicial } from '@/infrastructure/database/sqlite/migrations/001_schema_inicial';
import { HashSenhaFake } from '@/infrastructure/fakes/HashSenhaFake';
import { relogioFixo } from '@/domain/services/Relogio';
import { abrirBancoDeTeste, BancoDeTeste } from '../../helpers/bancoDeTeste';

const HOJE = new Date('2026-10-30T12:00:00.000Z');

describe('schema SQLite (banco de verdade)', () => {
  let banco: BancoDeTeste;

  beforeEach(() => {
    banco = abrirBancoDeTeste();
  });

  afterEach(() => {
    banco.fechar();
  });

  const migrarTudo = () => migrar(banco.db, criarMigracoes(new HashSenhaFake(), relogioFixo(HOJE)));
  const somenteSchema = () => migrar(banco.db, [migracaoSchemaInicial]);

  describe('migrações', () => {
    it('leva o banco novo até a última versão', async () => {
      expect(banco.versao()).toBe(0);

      expect(await migrarTudo()).toBe(2);
      expect(banco.versao()).toBe(2);
    });

    it('cria todas as tabelas do modelo', async () => {
      await somenteSchema();

      const nomes = banco
        .consultar<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
        .map((l) => l.name)
        .filter((n) => !n.startsWith('sqlite_'));

      expect(nomes.sort()).toEqual([
        'action_queue', 'empresas', 'enderecos', 'leituras',
        'notificacoes', 'padroes_cemig', 'usuario_enderecos', 'usuarios',
      ]);
    });

    it('não repete o que já rodou', async () => {
      await migrarTudo();
      const antes = banco.consultar<{ n: number }>('SELECT COUNT(*) AS n FROM usuarios')[0].n;

      // Segunda abertura do app: o user_version já está em 2.
      expect(await migrarTudo()).toBe(2);

      expect(banco.consultar<{ n: number }>('SELECT COUNT(*) AS n FROM usuarios')[0].n).toBe(antes);
    });

    it('não avança a versão quando a migração falha, e desfaz o que ela fez', async () => {
      const quebrada = {
        versao: 2,
        nome: 'quebrada',
        async aplicar(db: { runAsync: (s: string, p?: unknown[]) => Promise<unknown> }) {
          await db.runAsync(
            'INSERT INTO empresas (id, nome, cnpj, criado_em) VALUES (?, ?, ?, ?)',
            ['e1', 'Meia Gravada', '11111111111111', HOJE.toISOString()],
          );
          throw new Error('falha no meio da migração');
        },
      };

      await expect(migrar(banco.db, [migracaoSchemaInicial, quebrada] as never)).rejects.toThrow(
        'falha no meio da migração',
      );

      // O banco fica íntegro na versão anterior: a próxima abertura tenta de novo.
      expect(banco.versao()).toBe(1);
      expect(banco.consultar<{ n: number }>('SELECT COUNT(*) AS n FROM empresas')[0].n).toBe(0);
    });

    it('liga as chaves estrangeiras na abertura', async () => {
      await somenteSchema();

      expect(PRAGMAS_DE_ABERTURA).toContain('foreign_keys = ON');
      expect(
        banco.consultar<{ foreign_keys: number }>('PRAGMA foreign_keys')[0].foreign_keys,
      ).toBe(1);
    });
  });

  describe('invariante de uma leitura vigente por padrão por dia', () => {
    const inserirLeitura = (id: string, status: string, dia = '2026-10-30') =>
      banco.consultar(
        `INSERT INTO leituras
           (id, padrao_id, usuario_id, valor_consumo, foto_local_uri, medido_em, data_local, status)
         VALUES (?, 'p1', 'u1', 100, 'file:///f.jpg', ?, ?, ?)`,
        id,
        dia + 'T12:00:00.000Z',
        dia,
        status,
      );

    beforeEach(async () => {
      await somenteSchema();
      banco.consultar(
        "INSERT INTO empresas (id, nome, cnpj, criado_em) VALUES ('emp1', 'E', '1', ?)",
        HOJE.toISOString(),
      );
      banco.consultar(
        `INSERT INTO enderecos (id, empresa_id, apelido, uc, criado_em)
         VALUES ('end1', 'emp1', 'Sede', '300', ?)`,
        HOJE.toISOString(),
      );
      banco.consultar(
        `INSERT INTO padroes_cemig (id, endereco_id, numero, criado_em)
         VALUES ('p1', 'end1', '77', ?)`,
        HOJE.toISOString(),
      );
      banco.consultar(
        `INSERT INTO usuarios (id, nome, usuario, email, senha_hash, criado_em)
         VALUES ('u1', 'J', 'j', 'j@x.dev', 'h', ?)`,
        HOJE.toISOString(),
      );
    });

    it('recusa duas leituras vigentes no mesmo padrão e dia', () => {
      inserirLeitura('l1', 'registrada');

      // É o banco impedindo, não um if na tela: nenhuma camada pode furar.
      expect(() => inserirLeitura('l2', 'registrada')).toThrow(/UNIQUE/i);
    });

    it('conta a aprovada como vigente também', () => {
      inserirLeitura('l1', 'aprovada');
      expect(() => inserirLeitura('l2', 'registrada')).toThrow(/UNIQUE/i);
    });

    it('deixa a substituída como histórico, fora do índice', () => {
      inserirLeitura('l1', 'substituida');
      inserirLeitura('l2', 'descartada');

      expect(() => inserirLeitura('l3', 'registrada')).not.toThrow();
      expect(banco.consultar<{ n: number }>('SELECT COUNT(*) AS n FROM leituras')[0].n).toBe(3);
    });

    it('permite uma vigente por dia em dias diferentes', () => {
      inserirLeitura('l1', 'registrada', '2026-10-29');
      expect(() => inserirLeitura('l2', 'registrada', '2026-10-30')).not.toThrow();
    });

    it('recusa leitura de padrão que não existe', () => {
      expect(() =>
        banco.consultar(
          `INSERT INTO leituras
             (id, padrao_id, usuario_id, valor_consumo, foto_local_uri, medido_em, data_local)
           VALUES ('lx', 'fantasma', 'u1', 100, 'file:///f.jpg', ?, '2026-10-30')`,
          HOJE.toISOString(),
        ),
      ).toThrow(/FOREIGN KEY/i);
    });

    it('recusa consumo negativo e status fora do vocabulário', () => {
      expect(() => inserirLeitura('l1', 'inventado')).toThrow(/CHECK/i);
      expect(() =>
        banco.consultar(
          `INSERT INTO leituras
             (id, padrao_id, usuario_id, valor_consumo, foto_local_uri, medido_em, data_local)
           VALUES ('l9', 'p1', 'u1', -5, 'file:///f.jpg', ?, '2026-10-30')`,
          HOJE.toISOString(),
        ),
      ).toThrow(/CHECK/i);
    });

    it('apaga as leituras junto com o padrão', () => {
      inserirLeitura('l1', 'registrada');

      banco.consultar("DELETE FROM enderecos WHERE id = 'end1'");

      // Cascata em dois níveis: endereço -> padrão -> leitura.
      expect(banco.consultar<{ n: number }>('SELECT COUNT(*) AS n FROM leituras')[0].n).toBe(0);
      expect(banco.consultar<{ n: number }>('SELECT COUNT(*) AS n FROM padroes_cemig')[0].n).toBe(0);
    });
  });

  describe('seed de demonstração', () => {
    beforeEach(async () => {
      await migrarTudo();
    });

    it('popula as tabelas com o que a documentação promete', () => {
      const contar = (tabela: string) =>
        banco.consultar<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabela}`)[0].n;

      expect({
        empresas: contar('empresas'),
        enderecos: contar('enderecos'),
        padroes: contar('padroes_cemig'),
        usuarios: contar('usuarios'),
        vinculos: contar('usuario_enderecos'),
        leituras: contar('leituras'),
        notificacoes: contar('notificacoes'),
      }).toEqual({
        empresas: 2, enderecos: 6, padroes: 7, usuarios: 4,
        vinculos: 7, leituras: 12, notificacoes: 3,
      });
    });

    it('nunca grava a senha em claro', () => {
      const hashes = banco
        .consultar<{ senha_hash: string }>('SELECT senha_hash FROM usuarios')
        .map((l) => l.senha_hash);

      expect(hashes).toHaveLength(4);
      for (const h of hashes) {
        expect(h).not.toContain(SENHA_DEMO);
        expect(h.length).toBeGreaterThan(40);
      }
    });

    it('cria um usuário por perfil, mais um pendente para a tela de autorização', () => {
      const usuarios = banco.consultar<{ usuario: string; nivel_acesso: number; status: string }>(
        'SELECT usuario, nivel_acesso, status FROM usuarios ORDER BY nivel_acesso DESC, usuario',
      );

      expect(usuarios.map((u) => u.usuario + ':' + u.nivel_acesso + ':' + u.status)).toEqual([
        'super:3:Ativo', 'admin:2:Ativo', 'maria.souza:1:Pendente', 'tecnico:1:Ativo',
      ]);
    });

    it('deixa uma única leitura vigente por padrão e dia, como o índice exige', () => {
      const duplicadas = banco.consultar<{ n: number }>(
        `SELECT COUNT(*) AS n FROM (
           SELECT padrao_id, data_local FROM leituras
           WHERE status IN ('registrada', 'aprovada')
           GROUP BY padrao_id, data_local HAVING COUNT(*) > 1
         )`,
      )[0].n;

      expect(duplicadas).toBe(0);
    });

    it('dá referência histórica para a regra de valor menor', () => {
      // Sem leitura de dia anterior, a regra não tem o que comparar e a tela
      // nunca mostraria o aviso durante a demonstração.
      const comHistorico = banco.consultar<{ n: number }>(
        "SELECT COUNT(DISTINCT padrao_id) AS n FROM leituras WHERE data_local < '2026-10-30'",
      )[0].n;

      expect(comHistorico).toBeGreaterThan(0);
    });
  });
});
