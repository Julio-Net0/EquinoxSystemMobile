-- ====================================================================
-- SCHEMA DDL SUPABASE POSTGRESQL (BANCO DE DADOS REMOTO NUVEM)
-- Banco: PostgreSQL (Supabase)
-- Segurança: Row Level Security (RLS) Ativo por Empresa/Tenant
-- Regra: UUIDv4 como Primary Key em todas as tabelas
-- ====================================================================

-- Habilitar extensão para geração de UUID no PostgreSQL se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA: empresas
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA: profiles (Estende auth.users do Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE RESTRICT,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    perfil VARCHAR(20) NOT NULL CHECK (perfil IN ('SuperAdmin', 'Admin', 'Tecnico')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('Ativo', 'Pendente')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABELA: usinas
CREATE TABLE IF NOT EXISTS public.usinas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
    nome VARCHAR(255) NOT NULL,
    codigo_uc VARCHAR(100) NOT NULL,
    capacidade_nominal NUMERIC(10, 2) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('Ativa', 'Em Comissionamento', 'Inativa')),
    data_ultima_visita TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABELA: leituras
CREATE TABLE IF NOT EXISTS public.leituras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usina_id UUID NOT NULL REFERENCES public.usinas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    valor_kwh NUMERIC(12, 2) NOT NULL CHECK (valor_kwh >= 0),
    data_hora TIMESTAMPTZ NOT NULL,
    url_imagem_remota TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status_sincronizacao VARCHAR(20) NOT NULL CHECK (status_sincronizacao IN ('Pendente', 'Sincronizada', 'Conflito', 'Rejeitada')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- REGRAS DE SEGURANÇA: ROW LEVEL SECURITY (RLS) MULTI-TENANT
-- ====================================================================

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leituras ENABLE ROW LEVEL SECURITY;

-- Politica SuperAdmin: Acesso Total
CREATE POLICY "SuperAdmin acesso total empresas" ON public.empresas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.perfil = 'SuperAdmin'
        )
    );

-- Politica Admin / Tecnico: Ler apenas a própria empresa
CREATE POLICY "Leitura de usinas por empresa" ON public.usinas
    FOR SELECT USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE profiles.id = auth.uid()
        )
    );

-- Politica Tecnico/Admin: Inserir leituras na usina da própria empresa
CREATE POLICY "Inserção de leituras por empresa" ON public.leituras
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.usinas
            WHERE usinas.id = usina_id AND usinas.empresa_id IN (
                SELECT empresa_id FROM public.profiles WHERE profiles.id = auth.uid()
            )
        )
    );
