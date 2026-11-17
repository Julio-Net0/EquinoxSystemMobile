-- =============================================================================
-- Equinox Mobile — correção: editar o próprio perfil pelo app
--
-- O Postgres guarda horários com microssegundos; o app (JavaScript) só com
-- milissegundos. O `autorizado_em` que o app recebeu da nuvem volta truncado,
-- e `sincronizar_perfil` o regravava assim. O gatilho `proteger_perfil` via
-- nisso uma mudança na autorização e recusava — o técnico, e também o
-- administrador editando o próprio perfil, não conseguiam trocar nem o nome.
--
-- Agora, se o horário que chegou é o mesmo da nuvem até o milissegundo, o da
-- nuvem fica. Qualquer diferença real continua passando pelo gatilho, que
-- segue recusando quem não pode mexer na autorização.
--
-- Aplicar no SQL Editor depois de 20261116120000_schema_equinox.sql.
-- Pode ser rodada de novo sem efeito colateral. ADR 10.16.
-- =============================================================================

create or replace function public.sincronizar_perfil(p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p->>'id')::uuid;
  v_autorizado_em timestamptz := (p->>'autorizado_em')::timestamptz;
  v_afetadas integer;
begin
  update public.perfis pf
     set nome = btrim(p->>'nome'),
         usuario = lower(btrim(p->>'usuario')),
         nivel_acesso = (p->>'nivel_acesso')::smallint,
         nivel_anterior = (p->>'nivel_anterior')::smallint,
         status = p->>'status',
         autorizado_em = case
           when date_trunc('milliseconds', pf.autorizado_em) is not distinct from v_autorizado_em
             then pf.autorizado_em
           else v_autorizado_em
         end,
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
