import {
  DDL_SCHEMA_INICIAL,
  migracaoSchemaInicial,
} from '@/infrastructure/database/sqlite/migrations/001_schema_inicial';

/**
 * Confere o texto do DDL em vez de abrir um banco: expo-sqlite não carrega sob
 * o Jest (é módulo nativo), e são justamente estas invariantes que, se
 * quebradas, só apareceriam no aparelho.
 */
describe('migrações SQLite', () => {
  describe('migração de schema', () => {
    it('é a versão 1', () => {
      expect(migracaoSchemaInicial.versao).toBe(1);
    });

    it('tem nome e função de aplicar', () => {
      expect(migracaoSchemaInicial.nome).toBe('001_schema_inicial');
      expect(typeof migracaoSchemaInicial.aplicar).toBe('function');
    });
  });

  describe('schema inicial', () => {
    it('cria todas as tabelas do modelo', () => {
      for (const tabela of [
        'empresas',
        'enderecos',
        'padroes_cemig',
        'usuarios',
        'usuario_enderecos',
        'leituras',
        'notificacoes',
        'action_queue',
      ]) {
        expect(DDL_SCHEMA_INICIAL).toContain(`CREATE TABLE ${tabela}`);
      }
    });

    it('não cria tabela de usinas: o conceito virou a flag eh_usina', () => {
      expect(DDL_SCHEMA_INICIAL).not.toContain('CREATE TABLE usinas');
    });

    it('não usa IF NOT EXISTS: quem decide o que rodar é o user_version', () => {
      expect(DDL_SCHEMA_INICIAL).not.toContain('IF NOT EXISTS');
    });

    it('todas as chaves primárias são TEXT, para caber o UUIDv4', () => {
      const pks = DDL_SCHEMA_INICIAL.match(/^\s*id\s+\w+\s+PRIMARY KEY/gm) ?? [];
      expect(pks.length).toBeGreaterThan(0);
      for (const pk of pks) expect(pk).toContain('TEXT');
    });

    it('liga as chaves estrangeiras', () => {
      expect(DDL_SCHEMA_INICIAL).toContain('PRAGMA foreign_keys = ON');
    });

    it('usa journal WAL', () => {
      expect(DDL_SCHEMA_INICIAL).toContain('PRAGMA journal_mode = WAL');
    });
  });

  describe('invariante de uma leitura vigente por padrão por dia', () => {
    it('cria o índice parcial único', () => {
      expect(DDL_SCHEMA_INICIAL).toContain('CREATE UNIQUE INDEX idx_leituras_vigente_dia');
    });

    it('o índice cobre padrao_id e data_local', () => {
      const trecho = DDL_SCHEMA_INICIAL.slice(
        DDL_SCHEMA_INICIAL.indexOf('idx_leituras_vigente_dia'),
      );
      expect(trecho).toMatch(/ON leituras\s*\(\s*padrao_id\s*,\s*data_local\s*\)/);
    });

    it('o índice vale só para os status vigentes', () => {
      const trecho = DDL_SCHEMA_INICIAL.slice(
        DDL_SCHEMA_INICIAL.indexOf('idx_leituras_vigente_dia'),
      );
      expect(trecho).toMatch(/WHERE status IN \('registrada',\s*'aprovada'\)/);
    });
  });

  describe('colunas que sustentam as regras', () => {
    it('a leitura guarda consumo e injeção separados', () => {
      expect(DDL_SCHEMA_INICIAL).toMatch(/valor_consumo\s+REAL NOT NULL/);
      expect(DDL_SCHEMA_INICIAL).toMatch(/valor_injecao\s+REAL(?!\s+NOT NULL)/);
    });

    it('a foto é obrigatória e as coordenadas não', () => {
      expect(DDL_SCHEMA_INICIAL).toMatch(/foto_local_uri\s+TEXT NOT NULL/);
      expect(DDL_SCHEMA_INICIAL).toMatch(/latitude\s+REAL(?!\s+NOT NULL)/);
    });

    it('a leitura guarda o dia local, que é a chave da vaga diária', () => {
      expect(DDL_SCHEMA_INICIAL).toMatch(/data_local\s+TEXT NOT NULL/);
    });

    it('o usuário guarda o hash da senha', () => {
      expect(DDL_SCHEMA_INICIAL).toMatch(/senha_hash\s+TEXT NOT NULL/);
    });

    it('o login e o e-mail são únicos ignorando a caixa', () => {
      expect(DDL_SCHEMA_INICIAL).toMatch(/usuario\s+TEXT NOT NULL UNIQUE COLLATE NOCASE/);
      expect(DDL_SCHEMA_INICIAL).toMatch(/email\s+TEXT NOT NULL UNIQUE COLLATE NOCASE/);
    });

    it('a empresa do usuário aceita nulo, para o super admin global', () => {
      const tabela = DDL_SCHEMA_INICIAL.slice(
        DDL_SCHEMA_INICIAL.indexOf('CREATE TABLE usuarios'),
        DDL_SCHEMA_INICIAL.indexOf('CREATE TABLE usuario_enderecos'),
      );
      expect(tabela).toMatch(/empresa_id\s+TEXT REFERENCES empresas/);
      expect(tabela).not.toMatch(/empresa_id\s+TEXT NOT NULL/);
    });

    it('o endereço aceita ficar sem coordenada, o que desliga a geocerca', () => {
      const tabela = DDL_SCHEMA_INICIAL.slice(
        DDL_SCHEMA_INICIAL.indexOf('CREATE TABLE enderecos'),
        DDL_SCHEMA_INICIAL.indexOf('CREATE TABLE padroes_cemig'),
      );
      expect(tabela).toMatch(/latitude\s+REAL,/);
      expect(tabela).not.toMatch(/latitude\s+REAL NOT NULL/);
    });

    it('o vínculo usuário-endereço é N:N com chave composta', () => {
      const tabela = DDL_SCHEMA_INICIAL.slice(
        DDL_SCHEMA_INICIAL.indexOf('CREATE TABLE usuario_enderecos'),
      );
      expect(tabela).toContain('PRIMARY KEY (usuario_id, endereco_id)');
    });

    it('o número do padrão é único dentro do endereço', () => {
      expect(DDL_SCHEMA_INICIAL).toMatch(
        /CREATE UNIQUE INDEX \w+ ON padroes_cemig\s*\(\s*endereco_id\s*,\s*numero\s*\)/,
      );
    });

    it('apagar empresa ou endereço leva os filhos', () => {
      expect(DDL_SCHEMA_INICIAL.match(/ON DELETE CASCADE/g)?.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('restrições de valor', () => {
    it('o status da leitura é restrito aos quatro conhecidos', () => {
      expect(DDL_SCHEMA_INICIAL).toMatch(
        /CHECK \(status IN \('registrada',\s*'aprovada',\s*'substituida',\s*'descartada'\)\)/,
      );
    });

    it('o status do usuário é restrito aos quatro conhecidos', () => {
      expect(DDL_SCHEMA_INICIAL).toContain(
        "CHECK (status IN ('Pendente', 'Ativo', 'Recusado', 'Inativo'))",
      );
    });

    it('o nível de acesso vai de 1 a 3', () => {
      expect(DDL_SCHEMA_INICIAL).toContain('CHECK (nivel_acesso IN (1, 2, 3))');
    });

    it('os valores de kWh não podem ser negativos', () => {
      expect(DDL_SCHEMA_INICIAL).toContain('CHECK (valor_consumo >= 0)');
    });
  });
});
