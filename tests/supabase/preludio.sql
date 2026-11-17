-- Dublê mínimo da plataforma Supabase para os testes de política rodarem num
-- Postgres embutido (PGlite), sem rede e sem projeto.
--
-- Recria só o que a migração e o seed tocam: os papéis, auth.users/identities,
-- auth.uid() e o esqueleto de storage. NÃO é o Supabase de verdade — o que
-- este arquivo garante é que o SQL do repositório é válido e que as políticas
-- se comportam como o esperado num Postgres real.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create extension if not exists pgcrypto;

create schema auth;

create table auth.users (
  instance_id uuid,
  id uuid primary key,
  aud text,
  role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  confirmation_token text,
  email_change text,
  email_change_token_new text,
  recovery_token text
);

create table auth.identities (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  provider_id text,
  provider text,
  identity_data jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

-- Mesmo contrato do Supabase: o id do usuário vem do claim `sub` do JWT, que o
-- PostgREST publica como configuração da transação.
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;

create schema storage;

create table storage.buckets (
  id text primary key,
  name text,
  public boolean,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text
);

alter table storage.objects enable row level security;

create function storage.foldername(name text) returns text[]
language sql immutable
as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
