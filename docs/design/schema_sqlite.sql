-- ====================================================================
-- SCHEMA DDL SQLITE (BANCO DE DADOS LOCAL DO DISPOSITIVO MÓVEL)
-- Banco: equinox_local.db
-- Tecnologia: expo-sqlite
-- Regra: Todas as Chaves Primárias (PK) são UUIDv4 gerados no Domínio
-- ====================================================================

-- Ativar suporte a Foreign Keys no SQLite
PRAGMA foreign_keys = ON;

-- 1. TABELA: empresas
CREATE TABLE IF NOT EXISTS empresas (
    id TEXT PRIMARY KEY NOT NULL,          -- UUIDv4
    nome TEXT NOT NULL,
    cnpj TEXT NOT NULL UNIQUE,
    data_criacao TEXT NOT NULL
);

-- 2. TABELA: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY NOT NULL,          -- UUIDv4
    empresa_id TEXT NOT NULL,              -- FK -> empresas(id)
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    perfil TEXT NOT NULL CHECK (perfil IN ('SuperAdmin', 'Admin', 'Tecnico')),
    status TEXT NOT NULL CHECK (status IN ('Ativo', 'Pendente')),
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT
);

-- 3. TABELA: usinas
CREATE TABLE IF NOT EXISTS usinas (
    id TEXT PRIMARY KEY NOT NULL,          -- UUIDv4
    empresa_id TEXT NOT NULL,              -- FK -> empresas(id)
    nome TEXT NOT NULL,
    codigo_uc TEXT NOT NULL,
    capacidade_nominal REAL NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Ativa', 'Em Comissionamento', 'Inativa')),
    data_ultima_visita TEXT,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT
);

-- 4. TABELA: leituras
CREATE TABLE IF NOT EXISTS leituras (
    id TEXT PRIMARY KEY NOT NULL,          -- UUIDv4
    usina_id TEXT NOT NULL,                -- FK -> usinas(id)
    usuario_id TEXT NOT NULL,              -- FK -> usuarios(id)
    valor_kwh REAL NOT NULL CHECK (valor_kwh >= 0),
    data_hora TEXT NOT NULL,
    caminho_imagem_local TEXT NOT NULL,
    url_imagem_remota TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    status_sincronizacao TEXT NOT NULL CHECK (status_sincronizacao IN ('Pendente', 'Sincronizada', 'Conflito', 'Rejeitada')),
    FOREIGN KEY (usina_id) REFERENCES usinas(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
);

-- 5. TABELA: action_queue (Fila Transacional Offline)
CREATE TABLE IF NOT EXISTS action_queue (
    id TEXT PRIMARY KEY NOT NULL,          -- UUIDv4
    tipo_operacao TEXT NOT NULL CHECK (tipo_operacao IN ('INSERT_LEITURA', 'INSERT_USINA', 'INSERT_EMPRESA')),
    payload_json TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    tentativas INTEGER NOT NULL DEFAULT 0
);

-- INDICES DE PERFORMANCE PARA CONSULTAS OFFLINE RAPIDAS
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usinas_empresa ON usinas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_leituras_usina ON leituras(usina_id);
CREATE INDEX IF NOT EXISTS idx_leituras_status ON leituras(status_sincronizacao);
