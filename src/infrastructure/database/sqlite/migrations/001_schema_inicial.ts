import type { SQLiteDatabase } from 'expo-sqlite';
import { Migracao } from './Migracao';

/**
 * Schema do modelo local, espelhando o app antigo (Empresa -> Endereco ->
 * PadraoCemig -> Leitura) com os campos de foto e GPS deste app.
 *
 * Sem `IF NOT EXISTS` de propósito: quem decide se esta migração roda é o
 * `PRAGMA user_version`. Com `IF NOT EXISTS`, um schema desatualizado passaria
 * calado e o erro só apareceria numa consulta, muito depois.
 */
export const DDL_SCHEMA_INICIAL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE empresas (
  id         TEXT PRIMARY KEY NOT NULL,
  nome       TEXT NOT NULL,
  cnpj       TEXT NOT NULL UNIQUE,
  criado_em  TEXT NOT NULL
);

CREATE TABLE enderecos (
  id         TEXT PRIMARY KEY NOT NULL,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  apelido    TEXT NOT NULL,
  uc         TEXT NOT NULL,
  rua        TEXT,
  numero     TEXT,
  bairro     TEXT,
  cidade     TEXT,
  eh_usina   INTEGER NOT NULL DEFAULT 0 CHECK (eh_usina IN (0, 1)),
  latitude   REAL,
  longitude  REAL,
  criado_em  TEXT NOT NULL
);

CREATE INDEX idx_enderecos_empresa ON enderecos(empresa_id);

CREATE TABLE padroes_cemig (
  id          TEXT PRIMARY KEY NOT NULL,
  endereco_id TEXT NOT NULL REFERENCES enderecos(id) ON DELETE CASCADE,
  numero      TEXT NOT NULL,
  criado_em   TEXT NOT NULL
);

CREATE INDEX idx_padroes_endereco ON padroes_cemig(endereco_id);
CREATE UNIQUE INDEX idx_padroes_numero ON padroes_cemig(endereco_id, numero);

CREATE TABLE usuarios (
  id               TEXT PRIMARY KEY NOT NULL,
  empresa_id       TEXT REFERENCES empresas(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  usuario          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash       TEXT NOT NULL,
  nivel_acesso     INTEGER NOT NULL DEFAULT 1 CHECK (nivel_acesso IN (1, 2, 3)),
  nivel_anterior   INTEGER CHECK (nivel_anterior IS NULL OR nivel_anterior IN (1, 2, 3)),
  status           TEXT NOT NULL DEFAULT 'Pendente'
                     CHECK (status IN ('Pendente', 'Ativo', 'Recusado', 'Inativo')),
  criado_em        TEXT NOT NULL,
  autorizado_em    TEXT,
  autorizado_por   TEXT REFERENCES usuarios(id)
);

CREATE INDEX idx_usuarios_status ON usuarios(status);
CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);

CREATE TABLE usuario_enderecos (
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endereco_id TEXT NOT NULL REFERENCES enderecos(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, endereco_id)
);

CREATE INDEX idx_usuario_enderecos_endereco ON usuario_enderecos(endereco_id);

CREATE TABLE leituras (
  id                  TEXT PRIMARY KEY NOT NULL,
  padrao_id           TEXT NOT NULL REFERENCES padroes_cemig(id) ON DELETE CASCADE,
  usuario_id          TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  valor_consumo       REAL NOT NULL CHECK (valor_consumo >= 0),
  valor_injecao       REAL CHECK (valor_injecao IS NULL OR valor_injecao >= 0),
  foto_local_uri      TEXT NOT NULL,
  latitude            REAL,
  longitude           REAL,
  precisao_metros     REAL,
  medido_em           TEXT NOT NULL,
  data_local          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'registrada'
                        CHECK (status IN ('registrada', 'aprovada', 'substituida', 'descartada')),
  substituida_em      TEXT,
  substituida_por_id  TEXT,
  decidida_em         TEXT,
  decidida_por_id     TEXT REFERENCES usuarios(id)
);

CREATE INDEX idx_leituras_padrao_dia ON leituras(padrao_id, data_local);
CREATE INDEX idx_leituras_status ON leituras(status);
CREATE INDEX idx_leituras_usuario ON leituras(usuario_id);

-- Invariante central, herdada do app antigo: no máximo uma leitura vigente por
-- padrão por dia local. A substituída e a descartada saem do índice e ficam
-- como histórico.
CREATE UNIQUE INDEX idx_leituras_vigente_dia
  ON leituras (padrao_id, data_local)
  WHERE status IN ('registrada', 'aprovada');

CREATE TABLE notificacoes (
  id             TEXT PRIMARY KEY NOT NULL,
  empresa_id     TEXT REFERENCES empresas(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL,
  titulo         TEXT NOT NULL,
  mensagem       TEXT NOT NULL,
  requer_acao    INTEGER NOT NULL DEFAULT 0 CHECK (requer_acao IN (0, 1)),
  leitura_id     TEXT REFERENCES leituras(id) ON DELETE CASCADE,
  criada_em      TEXT NOT NULL,
  lida           INTEGER NOT NULL DEFAULT 0 CHECK (lida IN (0, 1)),
  resolucao      TEXT CHECK (resolucao IS NULL
                   OR resolucao IN ('aprovada', 'descartada', 'automatica')),
  resolvida_em   TEXT,
  resolvida_por  TEXT REFERENCES usuarios(id)
);

CREATE INDEX idx_notificacoes_caixa ON notificacoes(empresa_id, lida, criada_em DESC);
CREATE INDEX idx_notificacoes_leitura ON notificacoes(leitura_id);

-- Reservada pelo AGENTS.md secao 6. Sem nuvem ela nao tem consumidor hoje;
-- fica para quando houver backend, e esta registrada em docs/decisions.md.
CREATE TABLE action_queue (
  id         TEXT PRIMARY KEY NOT NULL,
  tipo_acao  TEXT NOT NULL,
  payload    TEXT NOT NULL,
  tentativas INTEGER NOT NULL DEFAULT 0,
  criado_em  TEXT NOT NULL
);

CREATE INDEX idx_action_queue_criado_em ON action_queue(criado_em);
`;

export const migracaoSchemaInicial: Migracao = {
  versao: 1,
  nome: '001_schema_inicial',
  async aplicar(db: SQLiteDatabase): Promise<void> {
    await db.execAsync(DDL_SCHEMA_INICIAL);
  },
};
