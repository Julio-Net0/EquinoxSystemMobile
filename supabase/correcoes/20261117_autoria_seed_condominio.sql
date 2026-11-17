-- =============================================================================
-- Correção da autoria das leituras do Condomínio Solar do Vale no seed remoto
-- (ADR 10.19).
--
-- As leituras 10 e 11 do seed pertencem ao Condomínio (empresa 1a…002), mas a
-- primeira versão de supabase/seed.sql atribuiu a autoria ao técnico da
-- Equinox (4d…003) e a decisão ao administrador da Equinox (4d…002). Este
-- script passa as duas, e o texto do aviso 6f…003, para Helena Síndica
-- (4d…005).
--
-- Pode rodar mais de uma vez no SQL Editor do Supabase.
-- =============================================================================

alter table public.leituras disable trigger trg_leituras_protecao;

update public.leituras
   set usuario_id = '4d000000-0000-4000-8000-000000000005',
       decidida_por_id = case
         when decidida_por_id is null then null
         else '4d000000-0000-4000-8000-000000000005'::uuid
       end
 where id in (
   '5e000000-0000-4000-8000-000000000010',
   '5e000000-0000-4000-8000-000000000011'
 )
   and exists (
     select 1 from public.perfis where id = '4d000000-0000-4000-8000-000000000005'
   );

alter table public.leituras enable trigger trg_leituras_protecao;

update public.notificacoes
   set mensagem = replace(
     mensagem,
     'Registrada por João da Silva.',
     'Registrada por Helena Síndica.'
   )
 where id = '6f000000-0000-4000-8000-000000000003';

