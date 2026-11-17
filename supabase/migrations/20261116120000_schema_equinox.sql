-- =============================================================================
-- Equinox Mobile — schema remoto, RLS e Storage (fonte única)
--
-- Espelha o modelo local do SQLite (src/infrastructure/database/sqlite/migrations):
--   Empresa -> Endereco (eh_usina) -> PadraoCemig -> Leitura, mais perfis,
--   vínculos usuário-endereço e notificações.
--
-- Decisões que este arquivo implementa (docs/decisions.md, seção 10):
--   * RLS ligado em TODAS as tabelas; o papel `anon` não tem acesso a tabela
--     nenhuma, só a uma função que devolve id e nome de empresa.
--   * O isolamento consulta o perfil por auth.uid() através de funções
--     SECURITY DEFINER no schema `private`, que a Data API não expõe. Nada
--     depende de claim gravado no JWT.
--   * Comprovantes em bucket privado, caminho {empresa}/{endereco}/{leitura}.jpg.
--
-- Como aplicar: docs/supabase-setup.md.
-- Testes das políticas: tests/supabase/politicas.test.mjs (npm run test:rls).
-- =============================================================================

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

create table public.empresas (
  id            uuid primary key,
  nome          text not null,
  cnpj          text not null unique,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.enderecos (
  id            uuid primary key,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  apelido       text not null,
  uc            text not null,
  rua           text,
  numero        text,
  bairro        text,
  cidade        text,
  eh_usina      boolean not null default false,
  latitude      double precision,
  longitude     double precision,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_enderecos_empresa on public.enderecos(empresa_id);
create index idx_enderecos_atualizado on public.enderecos(atualizado_em);

create table public.padroes_cemig (
  id            uuid primary key,
  endereco_id   uuid not null references public.enderecos(id) on delete cascade,
  numero        text not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (endereco_id, numero)
);

create index idx_padroes_endereco on public.padroes_cemig(endereco_id);
create index idx_padroes_atualizado on public.padroes_cemig(atualizado_em);

-- Perfil do usuário. A identidade (e-mail e senha) mora em auth.users; aqui
-- fica só o que é do negócio. A senha nunca passa por esta tabela.
create table public.perfis (
  id             uuid primary key references auth.users(id) on delete cascade,
  empresa_id     uuid references public.empresas(id) on delete cascade,
  nome           text not null check (btrim(nome) <> ''),
  usuario        text not null check (btrim(usuario) <> ''),
  email          text not null,
  nivel_acesso   smallint not null default 1 check (nivel_acesso in (1, 2, 3)),
  nivel_anterior smallint check (nivel_anterior is null or nivel_anterior in (1, 2, 3)),
  status         text not null default 'Pendente'
                   check (status in ('Pendente', 'Ativo', 'Recusado', 'Inativo')),
  criado_em      timestamptz not null default now(),
  autorizado_em  timestamptz,
  autorizado_por uuid references public.perfis(id) on delete set null,
  atualizado_em  timestamptz not null default now(),
  -- Só o super admin (nível 3) tem escopo global e pode ficar sem empresa.
  constraint perfis_empresa_obrigatoria check (empresa_id is not null or nivel_acesso = 3)
);

create unique index idx_perfis_usuario on public.perfis (lower(usuario));
create unique index idx_perfis_email on public.perfis (lower(email));
create index idx_perfis_empresa on public.perfis(empresa_id);
create index idx_perfis_atualizado on public.perfis(atualizado_em);

create table public.usuario_enderecos (
  usuario_id  uuid not null references public.perfis(id) on delete cascade,
  endereco_id uuid not null references public.enderecos(id) on delete cascade,
  primary key (usuario_id, endereco_id)
);

create index idx_usuario_enderecos_endereco on public.usuario_enderecos(endereco_id);

create table public.leituras (
  id                 uuid primary key,
  padrao_id          uuid not null references public.padroes_cemig(id) on delete cascade,
  -- endereco_id e empresa_id são derivados do padrão por gatilho, nunca aceitos
  -- do cliente. Existem para as políticas não precisarem de join por linha.
  endereco_id        uuid not null references public.enderecos(id) on delete cascade,
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  usuario_id         uuid not null references public.perfis(id) on delete cascade,
  valor_consumo      double precision not null check (valor_consumo >= 0),
  valor_injecao      double precision check (valor_injecao is null or valor_injecao >= 0),
  -- Caminho do comprovante no bucket privado `comprovantes`.
  foto_path          text not null check (btrim(foto_path) <> ''),
  latitude           double precision,
  longitude          double precision,
  precisao_metros    double precision,
  medido_em          timestamptz not null,
  data_local         date not null,
  status             text not null default 'registrada'
                       check (status in ('registrada', 'aprovada', 'substituida', 'descartada')),
  substituida_em     timestamptz,
  substituida_por_id uuid,
  decidida_em        timestamptz,
  decidida_por_id    uuid references public.perfis(id) on delete set null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  -- Mesma invariante da entidade Leitura: data_local é o dia de Brasília
  -- (UTC-3 fixo, como o value object DataLocal) de medido_em.
  constraint leituras_dia_local_confere
    check (data_local = ((medido_em at time zone 'UTC') - interval '3 hours')::date)
);

create index idx_leituras_padrao_dia on public.leituras(padrao_id, data_local);
create index idx_leituras_empresa on public.leituras(empresa_id);
create index idx_leituras_endereco on public.leituras(endereco_id);
create index idx_leituras_usuario on public.leituras(usuario_id);
create index idx_leituras_atualizado on public.leituras(atualizado_em);

-- Invariante central, igual ao índice parcial do SQLite: no máximo uma leitura
-- vigente por padrão por dia local.
create unique index idx_leituras_vigente_dia
  on public.leituras (padrao_id, data_local)
  where status in ('registrada', 'aprovada');

create table public.notificacoes (
  id            uuid primary key,
  -- Nulo = aviso global, visível só ao super admin.
  empresa_id    uuid references public.empresas(id) on delete cascade,
  tipo          text not null,
  titulo        text not null check (btrim(titulo) <> ''),
  mensagem      text not null check (btrim(mensagem) <> ''),
  requer_acao   boolean not null default false,
  leitura_id    uuid references public.leituras(id) on delete cascade,
  criada_em     timestamptz not null,
  lida          boolean not null default false,
  resolucao     text check (resolucao is null
                  or resolucao in ('aprovada', 'descartada', 'automatica')),
  resolvida_em  timestamptz,
  resolvida_por uuid references public.perfis(id) on delete set null,
  atualizado_em timestamptz not null default now(),
  constraint notificacoes_acao_aponta_leitura check (not requer_acao or leitura_id is not null)
);

create index idx_notificacoes_caixa on public.notificacoes(empresa_id, lida, criada_em desc);
create index idx_notificacoes_leitura on public.notificacoes(leitura_id);
create index idx_notificacoes_atualizado on public.notificacoes(atualizado_em);

-- Lápides: o pull incremental só enxerga o que mudou, e linha apagada não
-- muda — some. Cada exclusão deixa um registro aqui para os outros aparelhos
-- apagarem a cópia local.
create table public.exclusoes (
  id          bigint generated always as identity primary key,
  tabela      text not null check (tabela in ('enderecos', 'padroes_cemig', 'perfis')),
  registro_id uuid not null,
  empresa_id  uuid,
  excluido_em timestamptz not null default clock_timestamp()
);

create index idx_exclusoes_empresa on public.exclusoes(empresa_id, excluido_em);

-- -----------------------------------------------------------------------------
-- Funções auxiliares das políticas
--
-- SECURITY DEFINER + search_path vazio, no schema `private`: leem `perfis` sem
-- passar pelo RLS da própria tabela (o que evita recursão infinita nas
-- políticas de `perfis`) e não ficam chamáveis pela Data API.
--
-- Todas tratam "sem perfil" e "perfil não Ativo" como nível 0: um cadastro
-- Pendente, Recusado ou Inativo tem JWT válido e mesmo assim não lê nada.
-- -----------------------------------------------------------------------------

create function private.meu_nivel()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.nivel_acesso
       from public.perfis p
      where p.id = (select auth.uid()) and p.status = 'Ativo'),
    0
  )::smallint;
$$;

create function private.minha_empresa()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.empresa_id
    from public.perfis p
   where p.id = (select auth.uid()) and p.status = 'Ativo';
$$;

create function private.meus_enderecos()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ue.endereco_id
    from public.usuario_enderecos ue
    join public.perfis p on p.id = ue.usuario_id
   where ue.usuario_id = (select auth.uid()) and p.status = 'Ativo';
$$;

-- O caminho do comprovante é {empresa_id}/{endereco_id}/{leitura_id}.jpg.
-- Técnico só alcança pasta de endereço vinculado; administrador, a da empresa.
create function private.pode_acessar_comprovante(p_nome text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_partes text[] := string_to_array(p_nome, '/');
  v_nivel  smallint := private.meu_nivel();
begin
  if v_nivel = 0 or array_length(v_partes, 1) <> 3 then
    return false;
  end if;
  if v_nivel = 3 then
    return true;
  end if;
  if v_partes[1] is distinct from private.minha_empresa()::text then
    return false;
  end if;
  if v_nivel = 2 then
    return true;
  end if;
  return exists (
    select 1 from private.meus_enderecos() as e(id) where e.id::text = v_partes[2]
  );
end;
$$;

revoke all on function private.meu_nivel() from public;
revoke all on function private.minha_empresa() from public;
revoke all on function private.meus_enderecos() from public;
revoke all on function private.pode_acessar_comprovante(text) from public;
grant execute on function private.meu_nivel() to authenticated;
grant execute on function private.minha_empresa() to authenticated;
grant execute on function private.meus_enderecos() to authenticated;
grant execute on function private.pode_acessar_comprovante(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Gatilhos
-- -----------------------------------------------------------------------------

-- Carimbo de atualização, sempre do relógio do servidor: é por ele que o pull
-- incremental pergunta "o que mudou desde X", e relógio de aparelho não serve
-- de cursor. clock_timestamp() e não now(): now() é o início da transação.
create function private.carimbar_atualizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := clock_timestamp();
  return new;
end;
$$;

create trigger trg_empresas_carimbo before insert or update on public.empresas
  for each row execute function private.carimbar_atualizacao();
create trigger trg_enderecos_carimbo before insert or update on public.enderecos
  for each row execute function private.carimbar_atualizacao();
create trigger trg_padroes_carimbo before insert or update on public.padroes_cemig
  for each row execute function private.carimbar_atualizacao();
create trigger trg_perfis_carimbo before insert or update on public.perfis
  for each row execute function private.carimbar_atualizacao();
create trigger trg_leituras_carimbo before insert or update on public.leituras
  for each row execute function private.carimbar_atualizacao();
create trigger trg_notificacoes_carimbo before insert or update on public.notificacoes
  for each row execute function private.carimbar_atualizacao();

-- Mudança de vínculo é mudança do perfil para efeito de pull.
create function private.tocar_perfil_do_vinculo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid;
begin
  -- `old` não existe em INSERT e `new` não existe em DELETE.
  if tg_op = 'DELETE' then
    v_usuario := old.usuario_id;
  else
    v_usuario := new.usuario_id;
  end if;

  update public.perfis set atualizado_em = clock_timestamp() where id = v_usuario;
  return null;
end;
$$;

create trigger trg_vinculos_tocam_perfil
  after insert or delete on public.usuario_enderecos
  for each row execute function private.tocar_perfil_do_vinculo();

-- Leitura: endereço e empresa vêm do padrão, não do cliente.
create function private.derivar_escopo_da_leitura()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select e.id, e.empresa_id
    into new.endereco_id, new.empresa_id
    from public.padroes_cemig pc
    join public.enderecos e on e.id = pc.endereco_id
   where pc.id = new.padrao_id;

  if not found then
    raise exception 'Padrão % não existe', new.padrao_id using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger trg_leituras_escopo before insert on public.leituras
  for each row execute function private.derivar_escopo_da_leitura();

-- Leitura: a medição é imutável. Depois de gravada só mudam o status e os
-- rastros de substituição e decisão — nem o administrador reescreve o valor.
create function private.proteger_leitura()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.id, new.padrao_id, new.endereco_id, new.empresa_id, new.usuario_id,
      new.valor_consumo, new.valor_injecao, new.foto_path, new.latitude,
      new.longitude, new.precisao_metros, new.medido_em, new.data_local, new.criado_em)
     is distinct from
     (old.id, old.padrao_id, old.endereco_id, old.empresa_id, old.usuario_id,
      old.valor_consumo, old.valor_injecao, old.foto_path, old.latitude,
      old.longitude, old.precisao_metros, old.medido_em, old.data_local, old.criado_em)
  then
    raise exception 'A medição de uma leitura registrada não pode ser alterada'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_leituras_protecao before update on public.leituras
  for each row execute function private.proteger_leitura();

-- Perfil: o RLS decide QUEM atualiza a linha; este gatilho decide O QUE cada um
-- pode mudar, porque política não enxerga coluna. Sem ele, um técnico com
-- permissão de editar o próprio nome poderia se promover a administrador.
create function private.proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_nivel   smallint;
  v_empresa uuid;
begin
  -- Sem usuário na requisição é o painel/SQL do dono do projeto.
  if v_uid is null then
    return new;
  end if;

  if (new.id, new.email, new.criado_em) is distinct from (old.id, old.email, old.criado_em) then
    raise exception 'Identidade do perfil não pode ser alterada' using errcode = '42501';
  end if;

  if (new.nivel_acesso, new.nivel_anterior, new.status, new.autorizado_em,
      new.autorizado_por, new.empresa_id)
     is not distinct from
     (old.nivel_acesso, old.nivel_anterior, old.status, old.autorizado_em,
      old.autorizado_por, old.empresa_id)
  then
    return new;
  end if;

  v_nivel := private.meu_nivel();
  v_empresa := private.minha_empresa();

  if v_nivel = 3 then
    return new;
  end if;

  if v_nivel = 2
     and old.id <> v_uid
     and old.empresa_id = v_empresa
     and new.empresa_id = old.empresa_id
     and old.nivel_acesso <= 2
     and new.nivel_acesso <= 2
  then
    return new;
  end if;

  raise exception 'Seu perfil não permite alterar nível, status ou empresa deste usuário'
    using errcode = '42501';
end;
$$;

create trigger trg_perfis_protecao before update on public.perfis
  for each row execute function private.proteger_perfil();

-- Cadastro: o perfil nasce do gatilho, nunca de INSERT do cliente. Nível e
-- status são fixos aqui — os metadados do cadastro são escritos pelo próprio
-- usuário e não podem decidir permissão.
create function private.criar_perfil_do_cadastro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  -- Usuário criado pelo painel ou pelo seed, sem os metadados do app: o
  -- perfil é criado à parte por quem o criou.
  if not (v_meta ? 'usuario' and v_meta ? 'empresa_id') then
    return new;
  end if;

  insert into public.perfis (id, empresa_id, nome, usuario, email, nivel_acesso, status)
  values (
    new.id,
    (v_meta->>'empresa_id')::uuid,
    btrim(v_meta->>'nome'),
    lower(btrim(v_meta->>'usuario')),
    lower(new.email),
    1,
    'Pendente'
  );

  return new;
end;
$$;

create trigger trg_auth_cria_perfil
  after insert on auth.users
  for each row execute function private.criar_perfil_do_cadastro();

-- Lápides das exclusões.
create function private.registrar_exclusao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  if tg_table_name = 'enderecos' then
    v_empresa := old.empresa_id;
  elsif tg_table_name = 'perfis' then
    v_empresa := old.empresa_id;
  else
    select e.empresa_id into v_empresa from public.enderecos e where e.id = old.endereco_id;
    -- Padrão apagado em cascata junto com o endereço: a lápide do endereço
    -- basta, e o aparelho apaga os padrões pela mesma cascata local.
    if not found then
      return null;
    end if;
  end if;

  insert into public.exclusoes (tabela, registro_id, empresa_id)
  values (tg_table_name, old.id, v_empresa);
  return null;
end;
$$;

create trigger trg_enderecos_lapide after delete on public.enderecos
  for each row execute function private.registrar_exclusao();
create trigger trg_padroes_lapide after delete on public.padroes_cemig
  for each row execute function private.registrar_exclusao();
create trigger trg_perfis_lapide after delete on public.perfis
  for each row execute function private.registrar_exclusao();

-- -----------------------------------------------------------------------------
-- Privilégios: `anon` não toca em tabela nenhuma.
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select, insert, update on public.empresas to authenticated;
grant select, insert, update, delete on public.enderecos to authenticated;
grant select, insert, update, delete on public.padroes_cemig to authenticated;
grant select, update, delete on public.perfis to authenticated;
grant select, insert, delete on public.usuario_enderecos to authenticated;
grant select, insert, update on public.leituras to authenticated;
grant select, insert, update on public.notificacoes to authenticated;
grant select on public.exclusoes to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.empresas enable row level security;
alter table public.enderecos enable row level security;
alter table public.padroes_cemig enable row level security;
alter table public.perfis enable row level security;
alter table public.usuario_enderecos enable row level security;
alter table public.leituras enable row level security;
alter table public.notificacoes enable row level security;
alter table public.exclusoes enable row level security;

-- empresas: cada um vê a sua; só o super admin cria e edita.
create policy empresas_select on public.empresas for select to authenticated
  using ((select private.meu_nivel()) = 3 or id = (select private.minha_empresa()));
create policy empresas_insert on public.empresas for insert to authenticated
  with check ((select private.meu_nivel()) = 3);
create policy empresas_update on public.empresas for update to authenticated
  using ((select private.meu_nivel()) = 3)
  with check ((select private.meu_nivel()) = 3);

-- enderecos: técnico vê os vinculados; administrador, os da empresa.
create policy enderecos_select on public.enderecos for select to authenticated
  using (
    (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
    or ((select private.meu_nivel()) = 1 and id in (select private.meus_enderecos()))
  );
create policy enderecos_insert on public.enderecos for insert to authenticated
  with check (
    (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
  );
create policy enderecos_update on public.enderecos for update to authenticated
  using (
    (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
  )
  with check (
    (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
  );
create policy enderecos_delete on public.enderecos for delete to authenticated
  using (
    (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
  );

-- padroes_cemig: seguem o endereço. O EXISTS é avaliado sob o RLS de
-- `enderecos`, então "vejo o padrão" = "vejo o endereço dele".
create policy padroes_select on public.padroes_cemig for select to authenticated
  using (exists (select 1 from public.enderecos e where e.id = endereco_id));
create policy padroes_insert on public.padroes_cemig for insert to authenticated
  with check (
    (select private.meu_nivel()) >= 2
    and exists (select 1 from public.enderecos e where e.id = endereco_id)
  );
create policy padroes_update on public.padroes_cemig for update to authenticated
  using (
    (select private.meu_nivel()) >= 2
    and exists (select 1 from public.enderecos e where e.id = endereco_id)
  )
  with check (
    (select private.meu_nivel()) >= 2
    and exists (select 1 from public.enderecos e where e.id = endereco_id)
  );
create policy padroes_delete on public.padroes_cemig for delete to authenticated
  using (
    (select private.meu_nivel()) >= 2
    and exists (select 1 from public.enderecos e where e.id = endereco_id)
  );

-- perfis: cada um lê o próprio (mesmo Pendente — é assim que o login explica
-- por que não entra). Membro ativo lê os colegas da própria empresa: o
-- aparelho precisa do autor de cada leitura que baixa (é chave estrangeira no
-- SQLite, e o nome aparece na tela). Alterar continua sendo do administrador.
create policy perfis_select on public.perfis for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) >= 1 and empresa_id = (select private.minha_empresa()))
  );
-- Sem política de INSERT: o perfil nasce do gatilho em auth.users.
create policy perfis_update on public.perfis for update to authenticated
  using (
    (id = (select auth.uid()) and (select private.meu_nivel()) > 0)
    or (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
  )
  with check (
    (id = (select auth.uid()) and (select private.meu_nivel()) > 0)
    or (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
  );
create policy perfis_delete on public.perfis for delete to authenticated
  using (
    id <> (select auth.uid())
    and (
      (select private.meu_nivel()) = 3
      or ((select private.meu_nivel()) = 2
          and empresa_id = (select private.minha_empresa())
          and nivel_acesso <= 2)
    )
  );

-- usuario_enderecos: quem vê o perfil vê os vínculos dele; quem administra
-- vincula, e só a endereço que enxerga (os da própria empresa).
create policy vinculos_select on public.usuario_enderecos for select to authenticated
  using (exists (select 1 from public.perfis p where p.id = usuario_id));
create policy vinculos_insert on public.usuario_enderecos for insert to authenticated
  with check (
    (select private.meu_nivel()) >= 2
    and exists (select 1 from public.perfis p where p.id = usuario_id)
    and exists (select 1 from public.enderecos e where e.id = endereco_id)
  );
create policy vinculos_delete on public.usuario_enderecos for delete to authenticated
  using (
    (select private.meu_nivel()) >= 2
    and exists (select 1 from public.perfis p where p.id = usuario_id)
  );

-- leituras: técnico lê e insere só em endereço vinculado e só em nome próprio.
create policy leituras_select on public.leituras for select to authenticated
  using (
    (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
    or ((select private.meu_nivel()) = 1 and endereco_id in (select private.meus_enderecos()))
  );
create policy leituras_insert on public.leituras for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and (
      (select private.meu_nivel()) = 3
      or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
      or ((select private.meu_nivel()) = 1 and endereco_id in (select private.meus_enderecos()))
    )
  );
-- Decisão (aprovar/descartar) é do administrador. A substituição feita pelo
-- técnico passa pela função sincronizar_leitura, mais abaixo.
create policy leituras_update on public.leituras for update to authenticated
  using (
    (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
  )
  with check (
    (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
  );

-- notificacoes: quem gera é qualquer membro ativo (o técnico, ao registrar a
-- leitura); quem lê e resolve é o administrador.
create policy notificacoes_select on public.notificacoes for select to authenticated
  using (
    (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
  );
create policy notificacoes_insert on public.notificacoes for insert to authenticated
  with check (
    (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) >= 1 and empresa_id = (select private.minha_empresa()))
  );
create policy notificacoes_update on public.notificacoes for update to authenticated
  using (
    (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
  )
  with check (
    (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) = 2 and empresa_id = (select private.minha_empresa()))
  );

create policy exclusoes_select on public.exclusoes for select to authenticated
  using (
    (select private.meu_nivel()) = 3
    or ((select private.meu_nivel()) >= 1 and empresa_id = (select private.minha_empresa()))
  );

-- -----------------------------------------------------------------------------
-- Funções expostas (RPC)
-- -----------------------------------------------------------------------------

-- Busca de empresa no cadastro, ANTES do login. É o único caminho aberto ao
-- papel `anon`, e devolve só id e nome — nunca CNPJ nem outra coluna.
create function public.buscar_empresas_cadastro(p_termo text default '')
returns table (id uuid, nome text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.nome
    from public.empresas e
   where btrim(coalesce(p_termo, '')) = ''
      or position(lower(btrim(p_termo)) in lower(e.nome)) > 0
   order by e.nome
   limit 50;
$$;

revoke all on function public.buscar_empresas_cadastro(text) from public;
grant execute on function public.buscar_empresas_cadastro(text) to anon, authenticated;

-- Envio de uma leitura pela fila do aparelho. Idempotente: repetir o mesmo
-- envio depois de uma queda de rede não duplica nem falha.
--
-- É SECURITY DEFINER porque resolver o conflito de vaga exige marcar como
-- substituída uma leitura que pode ser de OUTRO técnico — o que o RLS, com
-- razão, não deixa o técnico fazer direto. Por isso toda a autorização é
-- conferida aqui dentro, explicitamente.
--
-- Conflito (dois aparelhos, mesmo padrão, mesmo dia): last-write-wins pela
-- medição, empate fica com a que chegou agora — a mesma regra de
-- RegraSubstituicaoLeituraService no aparelho.
create function public.sincronizar_leitura(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_nivel      smallint := private.meu_nivel();
  v_empresa    uuid := private.minha_empresa();
  v_id         uuid := (p->>'id')::uuid;
  v_padrao     uuid := (p->>'padrao_id')::uuid;
  v_status     text := coalesce(p->>'status', 'registrada');
  v_medido     timestamptz := (p->>'medido_em')::timestamptz;
  v_data       date := (p->>'data_local')::date;
  v_subst_em   timestamptz := (p->>'substituida_em')::timestamptz;
  v_subst_por  uuid := (p->>'substituida_por_id')::uuid;
  v_endereco   uuid;
  v_empresa_alvo uuid;
  v_padrao_numero text;
  v_endereco_apelido text;
  v_existente  public.leituras%rowtype;
  v_vigente    public.leituras%rowtype;
  v_houve_conflito boolean := false;
begin
  if v_uid is null or v_nivel = 0 then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  select e.id, e.empresa_id, pc.numero, e.apelido
    into v_endereco, v_empresa_alvo, v_padrao_numero, v_endereco_apelido
    from public.padroes_cemig pc
    join public.enderecos e on e.id = pc.endereco_id
   where pc.id = v_padrao;

  if not found then
    raise exception 'Padrão % não existe', v_padrao using errcode = '23503';
  end if;

  if not (
    v_nivel = 3
    or (v_nivel = 2 and v_empresa_alvo = v_empresa)
    or (v_nivel = 1 and v_endereco in (select private.meus_enderecos()))
  ) then
    raise exception 'Você não está vinculado ao endereço deste padrão' using errcode = '42501';
  end if;

  select * into v_existente from public.leituras l where l.id = v_id for update;

  if found then
    -- Reenvio. A medição é imutável (gatilho); aqui só anda o estado.
    if v_existente.status = v_status then
      return jsonb_build_object('resultado', 'inalterada', 'status', v_existente.status);
    end if;

    if v_nivel >= 2 then
      update public.leituras l
         set status = v_status,
             substituida_em = v_subst_em,
             substituida_por_id = v_subst_por,
             decidida_em = (p->>'decidida_em')::timestamptz,
             decidida_por_id = (p->>'decidida_por_id')::uuid
       where l.id = v_id;
    elsif v_existente.usuario_id = v_uid and v_status = 'substituida' then
      update public.leituras l
         set status = 'substituida',
             substituida_em = coalesce(v_subst_em, now()),
             substituida_por_id = v_subst_por
       where l.id = v_id;
    elsif v_status = 'substituida' then
      -- Técnico substituiu, no aparelho, a leitura de um colega. Ele não a
      -- altera direto: quando a leitura nova dele chegar, o conflito de vaga
      -- é resolvido mais abaixo, pela regra do servidor.
      return jsonb_build_object('resultado', 'ignorada', 'status', v_existente.status);
    else
      raise exception 'Só um administrador decide sobre uma leitura' using errcode = '42501';
    end if;

    return jsonb_build_object('resultado', 'atualizada', 'status', v_status);
  end if;

  if (p->>'usuario_id')::uuid is distinct from v_uid then
    raise exception 'Uma leitura só pode ser registrada em nome próprio' using errcode = '42501';
  end if;

  if v_status in ('aprovada', 'descartada') and v_nivel < 2 then
    raise exception 'Só um administrador decide sobre uma leitura' using errcode = '42501';
  end if;

  if v_status in ('registrada', 'aprovada') then
    select * into v_vigente
      from public.leituras l
     where l.padrao_id = v_padrao
       and l.data_local = v_data
       and l.status in ('registrada', 'aprovada')
       for update;

    if found then
      if v_medido >= v_vigente.medido_em then
        update public.leituras l
           set status = 'substituida', substituida_em = now(), substituida_por_id = v_id
         where l.id = v_vigente.id;
      else
        v_status := 'substituida';
        v_subst_em := now();
        v_subst_por := v_vigente.id;
      end if;

      v_houve_conflito := true;
    end if;
  end if;

  insert into public.leituras (
    id, padrao_id, endereco_id, empresa_id, usuario_id, valor_consumo, valor_injecao,
    foto_path, latitude, longitude, precisao_metros, medido_em, data_local, status,
    substituida_em, substituida_por_id, decidida_em, decidida_por_id
  ) values (
    v_id, v_padrao, v_endereco, v_empresa_alvo, v_uid,
    (p->>'valor_consumo')::double precision,
    (p->>'valor_injecao')::double precision,
    p->>'foto_path',
    (p->>'latitude')::double precision,
    (p->>'longitude')::double precision,
    (p->>'precisao_metros')::double precision,
    v_medido, v_data, v_status,
    v_subst_em, v_subst_por,
    (p->>'decidida_em')::timestamptz,
    (p->>'decidida_por_id')::uuid
  );

  if v_houve_conflito then
    -- O conflito foi resolvido aqui, longe dos dois aparelhos: o aviso ao
    -- administrador também nasce aqui.
    insert into public.notificacoes (id, empresa_id, tipo, titulo, mensagem, criada_em, leitura_id)
    values (
      gen_random_uuid(),
      v_empresa_alvo,
      'LEITURA_SUBSTITUIDA',
      'Leitura substituída no padrão ' || v_padrao_numero,
      v_endereco_apelido || ': duas leituras do dia '
        || to_char(v_data, 'DD/MM/YYYY')
        || ' chegaram de aparelhos diferentes. Ficou valendo a medida mais tarde.',
      now(),
      v_id
    );
  end if;

  return jsonb_build_object('resultado', 'inserida', 'status', v_status);
end;
$$;

revoke all on function public.sincronizar_leitura(jsonb) from public, anon;
grant execute on function public.sincronizar_leitura(jsonb) to authenticated;

-- Envio de um perfil alterado pelo administrador (nível, status, vínculos).
-- SECURITY INVOKER: roda com as permissões de quem chama, então o RLS e o
-- gatilho proteger_perfil valem. Existe só para o perfil e os vínculos
-- mudarem na mesma transação.
create function public.sincronizar_perfil(p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p->>'id')::uuid;
  v_afetadas integer;
begin
  update public.perfis pf
     set nome = btrim(p->>'nome'),
         usuario = lower(btrim(p->>'usuario')),
         nivel_acesso = (p->>'nivel_acesso')::smallint,
         nivel_anterior = (p->>'nivel_anterior')::smallint,
         status = p->>'status',
         autorizado_em = (p->>'autorizado_em')::timestamptz,
         autorizado_por = (p->>'autorizado_por')::uuid
   where pf.id = v_id;

  get diagnostics v_afetadas = row_count;
  if v_afetadas = 0 then
    raise exception 'Perfil % não existe ou está fora do seu escopo', v_id using errcode = '42501';
  end if;

  -- Só administrador mexe em vínculo; para os demais o RLS bloquearia o
  -- DELETE em silêncio e o INSERT com erro, então nem tenta.
  if (select private.meu_nivel()) >= 2 and p ? 'enderecos' then
    delete from public.usuario_enderecos ue
     where ue.usuario_id = v_id
       and ue.endereco_id not in (
         select (e.valor)::uuid from jsonb_array_elements_text(p->'enderecos') as e(valor)
       );

    insert into public.usuario_enderecos (usuario_id, endereco_id)
    select v_id, (e.valor)::uuid
      from jsonb_array_elements_text(p->'enderecos') as e(valor)
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.sincronizar_perfil(jsonb) from public, anon;
grant execute on function public.sincronizar_perfil(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: comprovantes das leituras
-- -----------------------------------------------------------------------------

-- Bucket PRIVADO, só JPEG, até 1 MB (a foto sai do aparelho com ~300 KB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Sem política de UPDATE nem de DELETE: comprovante não se sobrescreve nem se
-- apaga pelo app. A leitura é feita por URL assinada de vida curta, que só é
-- emitida para quem passa na política de SELECT.
create policy comprovantes_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprovantes'
    and (
      (select private.meu_nivel()) = 3
      or (storage.foldername(name))[1] = (select private.minha_empresa())::text
    )
    and private.pode_acessar_comprovante(name)
  );

create policy comprovantes_select on storage.objects for select to authenticated
  using (
    bucket_id = 'comprovantes'
    and (
      (select private.meu_nivel()) = 3
      or (storage.foldername(name))[1] = (select private.minha_empresa())::text
    )
    and private.pode_acessar_comprovante(name)
  );
