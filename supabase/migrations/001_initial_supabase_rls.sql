-- =============================================================================
-- Equinox System Mobile - Migração Inicial Supabase & RLS (Phase 4)
-- Arch: Multi-Tenant Row Level Security (RLS)
-- =============================================================================

-- 1. Criação das Tabelas PostgreSQL Remotas

CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_fantasia VARCHAR(255) NOT NULL,
    razao_social VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil VARCHAR(50) NOT NULL CHECK (perfil IN ('SuperAdmin', 'Admin', 'Leitor')),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.usinas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    capacidade_kwp NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    status VARCHAR(50) NOT NULL DEFAULT 'Ativa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leituras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usina_id UUID NOT NULL REFERENCES public.usinas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    leitura_kwh NUMERIC(12, 2) NOT NULL,
    data_hora TIMESTAMPTZ NOT NULL,
    caminho_imagem_local TEXT,
    url_imagem_remota TEXT,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    status_sync VARCHAR(50) NOT NULL DEFAULT 'Sincronizado',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices para performance em queries multi-tenant
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa_id ON public.usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usinas_empresa_id ON public.usinas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_leituras_usina_id ON public.leituras(usina_id);
CREATE INDEX IF NOT EXISTS idx_leituras_usuario_id ON public.leituras(usuario_id);

-- =============================================================================
-- 2. Ativação do Row Level Security (RLS)
-- =============================================================================

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leituras ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. Políticas RLS (Multi-Tenant & Role Based)
-- =============================================================================

-- 3.1 POLÍTICAS PARA EMPRESAS
CREATE POLICY empresas_superadmin_policy ON public.empresas
    FOR ALL TO authenticated
    USING (COALESCE(auth.jwt() ->> 'perfil', '') = 'SuperAdmin');

CREATE POLICY empresas_tenant_select_policy ON public.empresas
    FOR SELECT TO authenticated
    USING (id = (auth.jwt() ->> 'empresa_id')::uuid);

-- 3.2 POLÍTICAS PARA USUÁRIOS
CREATE POLICY usuarios_superadmin_policy ON public.usuarios
    FOR ALL TO authenticated
    USING (COALESCE(auth.jwt() ->> 'perfil', '') = 'SuperAdmin');

CREATE POLICY usuarios_tenant_policy ON public.usuarios
    FOR ALL TO authenticated
    USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- 3.3 POLÍTICAS PARA USINAS
CREATE POLICY usinas_superadmin_policy ON public.usinas
    FOR ALL TO authenticated
    USING (COALESCE(auth.jwt() ->> 'perfil', '') = 'SuperAdmin');

CREATE POLICY usinas_tenant_policy ON public.usinas
    FOR ALL TO authenticated
    USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- 3.4 POLÍTICAS PARA LEITURAS
CREATE POLICY leituras_superadmin_policy ON public.leituras
    FOR ALL TO authenticated
    USING (COALESCE(auth.jwt() ->> 'perfil', '') = 'SuperAdmin');

CREATE POLICY leituras_tech_insert_policy ON public.leituras
    FOR INSERT TO authenticated
    WITH CHECK (usuario_id = auth.uid());

CREATE POLICY leituras_tenant_select_policy ON public.leituras
    FOR SELECT TO authenticated
    USING (
        usina_id IN (
            SELECT id FROM public.usinas WHERE empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
        )
    );

-- =============================================================================
-- 4. Bucket Supabase Storage & Políticas RLS de Arquivo
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_comprovantes_insert_policy ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'comprovantes');

CREATE POLICY storage_comprovantes_select_policy ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'comprovantes');
