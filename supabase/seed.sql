-- =============================================================================
-- Equinox Mobile — dados de demonstração (seed remoto)
--
-- Mesmos UUIDs do seed local (src/infrastructure/database/sqlite/migrations/
-- 002_seed_demo.ts), de propósito: o aparelho já nasce com estes registros, e
-- com identificadores iguais o primeiro pull atualiza em vez de duplicar.
--
-- Rode DEPOIS de supabase/migrations/20261116120000_schema_equinox.sql, no SQL
-- Editor do painel (passo a passo em docs/supabase-setup.md). Pode rodar mais
-- de uma vez: tudo é ON CONFLICT DO NOTHING.
--
-- ATENÇÃO: a senha abaixo é a de demonstração, a mesma de
-- docs/credenciais-demo.md. Ela passa a ser uma credencial de verdade no seu
-- projeto Supabase. Se o repositório for público, troque `v_senha` antes de
-- rodar e não faça commit do valor novo.
-- =============================================================================

-- --------------------------------------------------------------------- empresas
insert into public.empresas (id, nome, cnpj) values
  ('1a000000-0000-4000-8000-000000000001', 'Equinox Energia Solar', '19131243000197'),
  ('1a000000-0000-4000-8000-000000000002', 'Condomínio Solar do Vale', '11222333000181')
on conflict (id) do nothing;

-- -------------------------------------------------------------------- endereços
insert into public.enderecos
  (id, empresa_id, apelido, uc, rua, numero, bairro, cidade, eh_usina, latitude, longitude)
values
  ('2b000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001',
   'Sede administrativa', '3001234567', 'Avenida Afonso Pena', '1500', 'Centro',
   'Belo Horizonte', false, -19.9191, -43.9386),
  ('2b000000-0000-4000-8000-000000000002', '1a000000-0000-4000-8000-000000000001',
   'Galpão Savassi', '3002345678', 'Rua Pernambuco', '1200', 'Savassi',
   'Belo Horizonte', false, -19.9385, -43.9355),
  ('2b000000-0000-4000-8000-000000000003', '1a000000-0000-4000-8000-000000000001',
   'Usina Pampulha', '3003456789', 'Avenida Otacílio Negrão de Lima', null, 'Pampulha',
   'Belo Horizonte', true, -19.8519, -43.9794),
  -- Sem coordenada de propósito: exercita o caminho "endereço sem geocerca".
  ('2b000000-0000-4000-8000-000000000004', '1a000000-0000-4000-8000-000000000001',
   'Depósito Contagem', '3004567890', null, null, 'Eldorado', 'Contagem', false, null, null),
  ('2b000000-0000-4000-8000-000000000005', '1a000000-0000-4000-8000-000000000002',
   'Bloco A', '3005678901', 'Rua das Palmeiras', '45', null, 'Nova Lima',
   false, -19.9856, -43.8469),
  ('2b000000-0000-4000-8000-000000000006', '1a000000-0000-4000-8000-000000000002',
   'Usina do condomínio', '3006789012', 'Rua das Palmeiras', '45', null, 'Nova Lima',
   true, -19.9861, -43.8475)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------- padrões
insert into public.padroes_cemig (id, endereco_id, numero) values
  ('3c000000-0000-4000-8000-000000000001', '2b000000-0000-4000-8000-000000000001', '778811'),
  ('3c000000-0000-4000-8000-000000000002', '2b000000-0000-4000-8000-000000000001', '778812'),
  ('3c000000-0000-4000-8000-000000000003', '2b000000-0000-4000-8000-000000000002', '881122'),
  ('3c000000-0000-4000-8000-000000000004', '2b000000-0000-4000-8000-000000000003', '993344'),
  ('3c000000-0000-4000-8000-000000000005', '2b000000-0000-4000-8000-000000000004', '114455'),
  ('3c000000-0000-4000-8000-000000000006', '2b000000-0000-4000-8000-000000000005', '225566'),
  ('3c000000-0000-4000-8000-000000000007', '2b000000-0000-4000-8000-000000000006', '336677')
on conflict (id) do nothing;

-- --------------------------------------------------------------------- usuários
-- Criados direto em auth.users para terem os UUIDs fixos do seed local — pelo
-- painel o id é aleatório. O gatilho de cadastro não cria perfil para eles
-- (não há metadados do app), então os perfis são inseridos logo abaixo.
do $$
declare
  v_senha text := 'Equinox@2026';
  v_usuario record;
begin
  for v_usuario in
    select * from (values
      ('4d000000-0000-4000-8000-000000000001'::uuid, 'super@equinox.dev'),
      ('4d000000-0000-4000-8000-000000000002'::uuid, 'admin@equinox.dev'),
      ('4d000000-0000-4000-8000-000000000003'::uuid, 'tecnico@equinox.dev'),
      ('4d000000-0000-4000-8000-000000000004'::uuid, 'maria@equinox.dev'),
      -- Administradora da SEGUNDA empresa: é com ela que se demonstra o
      -- isolamento (não vê leitura nem foto da Equinox).
      ('4d000000-0000-4000-8000-000000000005'::uuid, 'sindica@solardovale.dev')
    ) as u(id, email)
  loop
    if exists (select 1 from auth.users where id = v_usuario.id) then
      continue;
    end if;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_usuario.id, 'authenticated', 'authenticated',
      v_usuario.email, crypt(v_senha, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_usuario.id, v_usuario.id::text, 'email',
      jsonb_build_object(
        'sub', v_usuario.id::text, 'email', v_usuario.email,
        'email_verified', true, 'phone_verified', false
      ),
      now(), now(), now()
    );
  end loop;
end;
$$;

insert into public.perfis
  (id, empresa_id, nome, usuario, email, nivel_acesso, status, criado_em, autorizado_em)
values
  -- Super admin não pertence a empresa: o escopo dele é global.
  ('4d000000-0000-4000-8000-000000000001', null,
   'Ana Superintendente', 'super', 'super@equinox.dev', 3, 'Ativo', now(), now()),
  ('4d000000-0000-4000-8000-000000000002', '1a000000-0000-4000-8000-000000000001',
   'Carlos Administrador', 'admin', 'admin@equinox.dev', 2, 'Ativo', now(), now()),
  ('4d000000-0000-4000-8000-000000000003', '1a000000-0000-4000-8000-000000000001',
   'João da Silva', 'tecnico', 'tecnico@equinox.dev', 1, 'Ativo', now(), now()),
  -- Pendente, para a tela de autorizações abrir com algo para decidir.
  ('4d000000-0000-4000-8000-000000000004', '1a000000-0000-4000-8000-000000000001',
   'Maria Souza', 'maria.souza', 'maria@equinox.dev', 1, 'Pendente',
   now() - interval '2 days', null),
  ('4d000000-0000-4000-8000-000000000005', '1a000000-0000-4000-8000-000000000002',
   'Helena Síndica', 'sindica', 'sindica@solardovale.dev', 2, 'Ativo', now(), now())
on conflict (id) do nothing;

insert into public.usuario_enderecos (usuario_id, endereco_id) values
  ('4d000000-0000-4000-8000-000000000002', '2b000000-0000-4000-8000-000000000001'),
  ('4d000000-0000-4000-8000-000000000002', '2b000000-0000-4000-8000-000000000002'),
  ('4d000000-0000-4000-8000-000000000002', '2b000000-0000-4000-8000-000000000003'),
  ('4d000000-0000-4000-8000-000000000002', '2b000000-0000-4000-8000-000000000004'),
  ('4d000000-0000-4000-8000-000000000003', '2b000000-0000-4000-8000-000000000001'),
  ('4d000000-0000-4000-8000-000000000003', '2b000000-0000-4000-8000-000000000003'),
  ('4d000000-0000-4000-8000-000000000003', '2b000000-0000-4000-8000-000000000004'),
  ('4d000000-0000-4000-8000-000000000005', '2b000000-0000-4000-8000-000000000005'),
  ('4d000000-0000-4000-8000-000000000005', '2b000000-0000-4000-8000-000000000006')
on conflict do nothing;

-- --------------------------------------------------------------------- leituras
-- Histórico já conferido (aprovado), medido às 10h de Brasília de N dias atrás.
-- O medidor é acumulado: dia mais antigo tem valor menor. As fotos do seed não
-- existem no bucket — são leituras criadas sem passar pela câmera.
insert into public.leituras (
  id, padrao_id, endereco_id, empresa_id, usuario_id, valor_consumo, valor_injecao, foto_path,
  latitude, longitude, medido_em, data_local, status, decidida_em, decidida_por_id
)
select
  ('5e000000-0000-4000-8000-' || lpad(h.seq::text, 12, '0'))::uuid,
  pc.id, e.id, e.empresa_id,
  case
    when e.empresa_id = '1a000000-0000-4000-8000-000000000002'
      then '4d000000-0000-4000-8000-000000000005'::uuid
    else '4d000000-0000-4000-8000-000000000003'::uuid
  end,
  h.consumo, h.injecao,
  e.empresa_id || '/' || e.id || '/seed-demo.jpg',
  -19.9191, -43.9386,
  -- 13h UTC = 10h em Brasília, então o dia local é a própria data.
  ((current_date - h.dias) + time '13:00') at time zone 'UTC',
  current_date - h.dias,
  h.status,
  case when h.status = 'aprovada' then now() end,
  case
    when h.status = 'aprovada' and e.empresa_id = '1a000000-0000-4000-8000-000000000002'
      then '4d000000-0000-4000-8000-000000000005'::uuid
    when h.status = 'aprovada'
      then '4d000000-0000-4000-8000-000000000002'::uuid
  end
from (values
  (1,  1, 12, 10240, null,  'aprovada'),
  (2,  1, 5,  10890, null,  'aprovada'),
  (3,  1, 1,  11150, null,  'aprovada'),
  (4,  2, 6,  4310,  null,  'aprovada'),
  (5,  2, 1,  4480,  null,  'aprovada'),
  (6,  3, 3,  22700, null,  'aprovada'),
  (7,  4, 9,  31200, 18400, 'aprovada'),
  (8,  4, 2,  32050, 19120, 'aprovada'),
  (9,  5, 4,  1980,  null,  'aprovada'),
  (10, 6, 2,  7640,  null,  'aprovada'),
  (11, 7, 2,  15300, 9870,  'aprovada'),
  -- Atrasada e sem decisão: a central de notificações abre com um caso real.
  (90, 3, 11, 22410, null,  'registrada')
) as h(seq, padrao, dias, consumo, injecao, status)
join public.padroes_cemig pc
  on pc.id = ('3c000000-0000-4000-8000-' || lpad(h.padrao::text, 12, '0'))::uuid
join public.enderecos e on e.id = pc.endereco_id
on conflict (id) do nothing;

-- ----------------------------------------------------------------- notificações
insert into public.notificacoes
  (id, empresa_id, tipo, titulo, mensagem, requer_acao, leitura_id, criada_em, lida)
values
  ('6f000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001',
   'LEITURA_ATRASADA', 'Leitura atrasada no padrão 881122',
   'Galpão Savassi: leitura registrada com 11 dias de atraso por João da Silva. '
     || 'Confirme ou descarte.',
   true, '5e000000-0000-4000-8000-000000000090', now() - interval '1 day', false),
  ('6f000000-0000-4000-8000-000000000002', '1a000000-0000-4000-8000-000000000001',
   'LEITURA_SEM_GPS', 'Leitura sem GPS no padrão 114455',
   'Depósito Contagem: João da Silva registrou a leitura sem localização. '
     || 'A foto do medidor segue como comprovante.',
   false, null, now() - interval '3 days', false),
  ('6f000000-0000-4000-8000-000000000003', '1a000000-0000-4000-8000-000000000002',
   'LEITURA_VALOR_MENOR', 'Valor menor no padrão 225566',
   'Bloco A: a última leitura deste padrão foi 7.900 kWh. '
     || 'Foi digitado 7.640 kWh. Registrada por Helena Síndica.',
   false, null, now() - interval '2 days', true)
on conflict (id) do nothing;
