# Respostas para a banca — Equinox Mobile

Um ponto por pergunta da apresentação, cada resposta apontando para o código
que a sustenta. Onde algo depende do dono do projeto ou não pôde ser afirmado
com segurança, está marcado com **⚠ Confirmar**.

Requisitos da disciplina, em uma linha cada:

| Requisito | Onde está |
|---|---|
| Acesso a WebServices | Supabase por HTTPS (PostgREST, Auth, Storage): [`src/infrastructure/supabase/`](../../src/infrastructure/supabase/) |
| Autenticação | Supabase Auth por e-mail e senha: [`AutenticacaoSupabase.ts`](../../src/infrastructure/supabase/AutenticacaoSupabase.ts), [`AutenticarUsuarioUseCase.ts`](../../src/application/use-cases/AutenticarUsuarioUseCase.ts) |
| Context API | `AuthProvider`, `ConectividadeProvider`, `SincronizacaoProvider`, `ContainerProvider`, `CameraExpoContext`: [`src/presentation/context/`](../../src/presentation/context/) |
| `expo-secure-store` | Sessão: [`SessionStorageSecureStore.ts`](../../src/infrastructure/adapters/SessionStorageSecureStore.ts); tokens: [`CofreSeguroEmPartes.ts`](../../src/infrastructure/adapters/CofreSeguroEmPartes.ts) |

---

## 1. O que é o app

Aplicativo móvel (React Native + Expo SDK 58) para **registrar a leitura dos
medidores de energia** (padrões Cemig) de endereços e usinas solares, com foto
do visor e localização como comprovantes. Funciona sem internet: grava no
aparelho e sincroniza com a nuvem (Supabase) quando há conexão.

- Modelo: Empresa → Endereço (que pode ser usina) → Padrão → Leitura
  ([`src/domain/entities/`](../../src/domain/entities/), ADR 9.1).
- Uma leitura vigente por padrão por dia, garantida por índice parcial único no
  SQLite **e** no Postgres
  ([`001_schema_inicial.ts`](../../src/infrastructure/database/sqlite/migrations/001_schema_inicial.ts),
  [migração remota](../../supabase/migrations/20261116120000_schema_equinox.sql)).

## 2. Cliente principal

**⚠ Confirmar com o dono do projeto.** O que os documentos permitem afirmar:

- [`docs/Descricao.md`](../Descricao.md) descreve o app como "elo confiável
  entre o técnico em campo, administradores e o **ecossistema corporativo
  Equinox**", e o perfil SuperAdmin como "**(Equinox)**", responsável por
  cadastrar as empresas-clientes.
- O app é uma reconstrução de um app **já em produção**
  (`example/Equinox.MOBILE`, ADR 9 e 9.3), cujas decisões iam para uma planilha
  da operação.
- O seed traz "Equinox Energia Solar" e "Condomínio Solar do Vale" como
  empresas.

Leitura provável: **o cliente principal é a Equinox (empresa de energia solar),
que opera a plataforma e atende empresas e condomínios donos de usinas e
unidades consumidoras**. Não há documento que diga isso com todas as letras —
nem se a Equinox é cliente real, parceira do curso ou fictícia. Responda você.

## 3. Problema que resolve

A leitura de medidor é feita em casa de medidor, garagem, subsolo e área rural,
onde a internet falha. Um app que depende de rede trava o técnico no local; um
caderno não tem comprovante nem chega ao escritório.

O Equinox resolve com três coisas:

1. **Registrar sem rede** — tudo vai para o SQLite e para uma fila
   ([`repositoriosComFila.ts`](../../src/infrastructure/sync/repositoriosComFila.ts)).
2. **Comprovar** — foto obrigatória do visor e GPS consultivo
   ([`Leitura.ts`](../../src/domain/entities/Leitura.ts), ADR 9.4).
3. **Consolidar** — a leitura sobe sozinha quando a rede volta, e o
   administrador decide os casos fora do padrão (atraso, valor menor, fora do
   raio).

## 4. Público-alvo

Equipes de campo e de escritório de empresas que precisam ler medidores
periodicamente em vários endereços — usinas solares (consumo **e** injeção) e
unidades consumidoras comuns. **⚠ Confirmar** se há um segmento-alvo mais
preciso (cooperativas, condomínios, integradoras solares).

## 5. Perfis de usuário

| Nível | Perfil | Pode | Onde é garantido |
|---|---|---|---|
| 1 | Técnico | Ler endereços vinculados e registrar leituras neles, em nome próprio | RLS `leituras_insert` + `sincronizar_leitura`; app: guardas e casos de uso |
| 2 | Administrador | Tudo da própria empresa: estrutura, autorizações, usuários (até nível 2), decisões, avisos | RLS por `minha_empresa()`; gatilho `proteger_perfil` |
| 3 | Super Admin | Todas as empresas; cria empresas e outros super admins | `meu_nivel() = 3` nas políticas |

Cadastro novo nasce **Técnico e Pendente** — quem fixa isso é um gatilho no
banco, não o app
([`criar_perfil_do_cadastro`](../../supabase/migrations/20261116120000_schema_equinox.sql)).
Guardas de rota: [`(app)/_layout.tsx`](../../src/app/(app)/_layout.tsx) e
[`(app)/admin/_layout.tsx`](../../src/app/(app)/admin/_layout.tsx).

## 6. Principais recursos

- Leitura com foto, GPS, aviso de valor menor e substituição no mesmo dia —
  [`RegistrarLeituraUseCase.ts`](../../src/application/use-cases/RegistrarLeituraUseCase.ts)
- Catálogo do técnico com o estado de envio de cada leitura —
  [`CatalogoLeiturasScreen.tsx`](../../src/presentation/screens/CatalogoLeiturasScreen.tsx)
- Central de avisos e decisão (aprovar/descartar) —
  [`DecidirLeituraUseCase.ts`](../../src/application/use-cases/DecidirLeituraUseCase.ts)
- Autorização de cadastros, gestão de usuários e de estrutura (endereços e
  padrões)
- Leituras diárias de cada endereço (usina ou não), com o comprovante aberto
  por URL assinada —
  [`leituras-usina.tsx`](../../src/app/(app)/admin/leituras-usina.tsx)
- Painel de sincronização e diagnóstico do banco local —
  [`PainelSincronizacao.tsx`](../../src/presentation/components/PainelSincronizacao.tsx),
  [`DiagnosticoScreen.tsx`](../../src/presentation/screens/DiagnosticoScreen.tsx)

## 7. Como a câmera e a geolocalização foram usadas

**Câmera** — `expo-camera` com fallback de permissão negada
([`CameraGatewayExpo.ts`](../../src/infrastructure/hardware/camera/CameraGatewayExpo.ts)).
A foto é comprimida para 1080p e ~300 KB e movida do cache para o armazenamento
permanente do app
([`ArquivoFotoGatewayExpo.ts`](../../src/infrastructure/hardware/midia/ArquivoFotoGatewayExpo.ts)).
É **obrigatória**: sem ela a entidade `Leitura` não existe. Na sincronização,
sobe **antes** da leitura para o bucket privado.

**GPS** — `expo-location`, com 10 s de limite
([`LocationGatewayExpo.ts`](../../src/infrastructure/hardware/location/LocationGatewayExpo.ts)).
É **consultivo**: nunca impede o registro. Fora do raio de 500 m do endereço
gera o aviso `LEITURA_FORA_DE_RAIO`; sem GPS, `LEITURA_SEM_GPS`
([`RegraLocalizacaoLeituraService.ts`](../../src/domain/services/RegraLocalizacaoLeituraService.ts),
ADR 9.4).

## 8. O que é online e o que é offline

| Exige internet | Funciona offline e sincroniza depois |
|---|---|
| Primeiro login **de cada conta** no aparelho | Abrir o app já autenticado (sessão no secure store) |
| | Entrar de novo depois de sair — senha conferida contra verificação PBKDF2 no cofre (ADR 10.18) |
| Cadastro de usuário | Registrar leitura com foto e GPS |
| Lista de empresas no cadastro | Decidir leitura, marcar avisos |
| Troca de senha | Estrutura, autorizações, gestão de usuários |
| Ver foto feita **em outro** aparelho | Todas as consultas (sempre o SQLite) |

Fonte: ADR 10.4. Prova no app: modo avião → fechar → reabrir → registrar
leitura → painel "Offline · 1 item pendente" → tirar do modo avião → "Tudo
sincronizado" sem tocar em nada.

## 9. Metodologia de sincronização

**Push (aparelho → nuvem), pela fila transacional (outbox).**
Cada escrita grava o dado e um item na `action_queue` na mesma transação
([`UnidadeDeTrabalhoSQLite.ts`](../../src/infrastructure/database/sqlite/UnidadeDeTrabalhoSQLite.ts)).
O [`ProcessarFilaSincronizacaoUseCase`](../../src/application/use-cases/ProcessarFilaSincronizacaoUseCase.ts)
envia em ordem de criação, **foto antes da linha**, de forma idempotente
(upsert pelo UUID). Falta de rede não conta tentativa; 5 recusas do servidor
isolam o item sem travar a fila.

**Pull (nuvem → aparelho), incremental.**
[`BaixarAlteracoesUseCase`](../../src/application/use-cases/BaixarAlteracoesUseCase.ts)
pede só o que mudou desde o último carimbo do **servidor** de cada tabela e
grava pacote e cursores numa transação só. Quem limita ao que o usuário pode
ver é o RLS.

**Conflito: última medição vence**, arbitrada no servidor pela mesma regra do
aparelho, sem perguntar ao técnico; o administrador recebe um aviso.

**Quando dispara:** ao abrir o app autenticado, quando a rede volta, pelo
botão "Sincronizar agora" e logo após cada escrita
([`SincronizacaoContext.tsx`](../../src/presentation/context/SincronizacaoContext.tsx)).

Detalhes e justificativas: ADR 10.5.

## 10. Como o Supabase é usado

| Recurso | Uso |
|---|---|
| **Auth** | Login e cadastro por e-mail/senha; tokens renovados em segundo plano |
| **Postgres + PostgREST** | Tabelas espelhando o SQLite; leitura e escrita por REST; funções `sincronizar_leitura`, `sincronizar_perfil`, `buscar_empresas_cadastro` |
| **Row Level Security** | Todo o controle de acesso, por empresa e por nível |
| **Storage** | Bucket privado `comprovantes` com as fotos; URL assinada de 60 s |

Schema, políticas e bucket versionados em
[`supabase/migrations/`](../../supabase/migrations/); dados de demonstração em
[`supabase/seed.sql`](../../supabase/seed.sql).

## 11. Outros serviços de nuvem

**EAS Build** (Expo Application Services) compila o APK instalável da
demonstração ([`eas.json`](../../eas.json), [`docs/eas-build.md`](../eas-build.md)).
As variáveis do Supabase ficam cadastradas no ambiente `preview` do EAS, não no
repositório. Sentry e EAS Update ficaram fora desta fase (ADR 10.13).

**⚠ Confirmar** se o build foi de fato executado antes da apresentação — ele
depende da conta Expo do dono do projeto.

## 12. Medidas de segurança na nuvem

1. **RLS em todas as tabelas**, com funções `SECURITY DEFINER` fora da API que
   consultam o perfil por `auth.uid()` — sem confiar em nada que o cliente
   mande.
2. **Técnico** só insere leitura em endereço vinculado e em nome próprio;
   empresa e endereço são derivados no servidor.
3. **Medição imutável** e **ninguém se promove** (gatilhos
   `proteger_leitura` e `proteger_perfil`).
4. **Bucket privado**, caminho `{empresa}/{endereço}/{leitura}.jpg` conferido
   pelas políticas do Storage; foto só por URL assinada de vida curta.
5. **Anônimo não lê tabela nenhuma**; a busca de empresas do cadastro devolve
   só id e nome.
6. **Só a chave anônima no app** — o app recusa a `service_role` ao iniciar
   ([`ambiente.ts`](../../src/infrastructure/config/ambiente.ts)).
7. **Tokens só no Keychain/Keystore**; **nenhuma senha no aparelho** — só uma
   verificação PBKDF2 (sal + 30 000 iterações) para o login offline, também no
   cofre ([`HashSenhaPbkdf2.ts`](../../src/infrastructure/security/HashSenhaPbkdf2.ts), ADR 10.18).
8. **Segredos fora do git** (`.gitignore` cobre `.env` e `.env.*`).

**Prova:** `npm run test:rls` roda 34 testes contra um Postgres de verdade —
anônimo, isolamento entre empresas, técnico em endereço alheio, promoção
indevida, bucket privado, foto de outra empresa
([`politicas.test.mjs`](../../tests/supabase/politicas.test.mjs)). O roteiro
manual no projeto real está em
[`docs/supabase-setup.md`](../supabase-setup.md#roteiro-de-segurança-manual-no-painel).

---

## Material da apresentação que ficou desatualizado

Não foi regenerado (ninguém pediu). Pontos a corrigir à mão:

- **`Apresentacao-SINTEC-2026-Equinox-Mobile.pptx`**, **`slides/*.html`** e os
  roteiros desta pasta (`roteiro_dupla_10min.md`, `plano_apresentacao_fase1.md`,
  `roteiro_apresentacao_camera_gps.md`) descrevem o app como **100% local**, sem
  nuvem, com login por nome de usuário e senha local hasheada. Hoje: Supabase,
  login por e-mail, nenhuma senha no aparelho.
- Onde aparece **"Versão do schema 2"** no Diagnóstico, agora é **6**.
- Onde aparece "a `action_queue` está reservada / nada enfileira", agora toda
  escrita enfileira.
- `RESUMO_SINTEC_EQUINOX_MOBILE.pdf` ainda cita SDK 57 (o `.md` foi corrigido).
