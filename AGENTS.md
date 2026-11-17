# Diretrizes Gerais para Agentes & Assistentes de Código (Equinox Mobile)

## 1. Stack Tecnológica Oficial
- **Plataforma/Framework:** React Native + Expo SDK 58 (v58.0.0) com Expo Router (file-based routing).
- **Linguagem:** TypeScript v5+ (`strict: true`) com imports absolutos via `@/*` (`./src/*`).
- **Testes (TDD):** Jest em quatro projetos (`jest.config.js`), **todos com o preset `jest-expo`**: `dominio` (domínio, aplicação e arquitetura, em `testEnvironment: 'node'`), `infra`, `integracao` e `ui`. Um transform só, de propósito: com dois, um arquivo carregado por dois projetos gerava mapas de cobertura incompatíveis e o merge do istanbul somava errado (ver `docs/decisions.md` seção 9.11). `@testing-library/react-native` para render — nele `render` e `fireEvent` são **assíncronos**, e sem `await` as consultas não existem. **Atenção:** nenhum projeto checa tipos (Babel) — `npx tsc --noEmit` é obrigatório no gate.
- **Persistência Local (Offline-First):** `expo-sqlite` (SQLite local com UUIDv4 em todas as PKs).
- **Backend / Nuvem:** **Supabase** (Postgres + Auth + Storage), offline-first (ver `docs/decisions.md` seção 10, que revoga a 9.2). Cliente `@supabase/supabase-js` só em `src/infrastructure/supabase/`, atrás das portas `IAutenticacaoRemotaGateway` e `ISincronizacaoRemotaGateway`. Configuração por `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` (`.env.local`, modelo em `.env.example`); **sem elas o app para numa tela de erro explicada** — nunca há cliente de mentira. Schema, RLS e Storage: fonte única em `supabase/migrations/`; dados de demonstração em `supabase/seed.sql` (mesmos UUIDs do seed local). Passo a passo do dono do projeto em `docs/supabase-setup.md`. **Só a chave anônima entra no app**; a `service_role` nunca vai para o repositório nem para o bundle.
- **Outros serviços de nuvem:** EAS Build (`eas.json`, perfil `preview` gera APK; guia em `docs/eas-build.md`). Sentry e EAS Update fora desta fase.
- **Segurança & Sessão:** `expo-secure-store` em dois papéis: `SessionStorageSecureStore` guarda quem está logado (libera o uso offline) e `CofreSeguroEmPartes` guarda os tokens do Supabase, repartidos para caber no limite do cofre. **Nenhum token em AsyncStorage, nenhuma senha no aparelho** — a autenticação é do Supabase Auth, por e-mail. `HashSenhaExpoCrypto` foi removido; a migração 002 recebe o inerte `HashSenhaAposentado` (seção 10.2).
- **Conectividade:** `@react-native-community/netinfo` (incluso no Expo Go) em `ConectividadeNetInfo`, atrás da porta `IConectividadeGateway`, exposto à interface pelo `ConectividadeContext`.
- **Sensores & Mídia:** `expo-camera` + `expo-image-manipulator` (compressão JPEG 1080p ~300KB) + `expo-location`.
- **Gerenciamento de Estado UI:** React Context API + Custom Hooks Controllers (ViewModels). Contextos: `ContainerProvider`, `AuthProvider`, `ConectividadeProvider`, `SincronizacaoProvider` e `CameraExpoContext`.
- **Estilização UI:** React Native `StyleSheet` nativo com `theme.ts` centralizado.
- **Formulários & Validação:** React Hook Form + Zod estão instalados mas **ainda não são usados**: as telas portadas validam com estado local e as mensagens exatas do app antigo. Adotar os dois é refatoração prevista, não dívida silenciosa.

## 2. Expo & Documentação Oficial
- **Versão:** Expo SDK 58 (v58.0.0).
- **Documentação:** Sempre consulte a documentação oficial da versão exata em https://docs.expo.dev/versions/v58.0.0/ antes de sugerir ou escrever qualquer código de infraestrutura Expo.

## 3. Execução de Comandos Shell & NPM
- **Ambiente Node/NPM:** Antes de executar qualquer comando `npm` pela primeira vez na sessão, tente incluir o caminho do Node ou executar:
  `export PATH="/opt/alunos/.nvm/versions/node/v22.19.0/bin:$PATH"; source nvm_autocomplete.sh || true`
- **Fallback:** Caso o `source nvm_autocomplete.sh` falhe, prossiga normalmente com o `npm`. Caso o próprio `npm` falhe ou encontre erros de execução de ambiente, **PARE imediatamente e me avise**.

## 4. Arquitetura e Design de Código (Clean Architecture & DDD)
- **Desacoplamento Total:** O projeto DEVE seguir rigorosamente Clean Architecture e DDD.
- **Estrutura Oficial de Pastas (`src/` e `tests/`):**
  - `src/domain/`: `entities/`, `value-objects/`, `services/`, `enums/`, `repositories/`, `gateways/` (Pure Business Logic).
    - **PROIBIDO:** Nenhuma importação de React, React Native, Expo, SQLite, Supabase ou qualquer biblioteca de terceiros na camada de Domínio.
  - `src/application/`: `use-cases/`, `dtos/` (Casos de Uso de aplicação).
  - `src/infrastructure/`:
    - `fakes/`: Implementações de repositórios e gateways em memória (`Map<string, T>`) para testes e desenvolvimento desacoplado (`LeituraRepositoryMemory`, `CameraGatewayFake`, `SessionStorageMemory`, `AutenticacaoRemotaFake`, `SincronizacaoRemotaFake`, `ConectividadeFake`, `UnidadeDeTrabalhoMemory`).
    - `adapters/`: Adaptadores concretos (`SessionStorageSecureStore`, `CofreSeguroEmPartes`).
    - `database/`, `hardware/`, `network/`, `supabase/`, `sync/`, `config/`: Implementações reais (SQLite, Expo Hardware, NetInfo, Supabase, fila de envio, leitura do ambiente).
  - `src/presentation/`: `context/`, `hooks/`, `screens/`, `components/`.
  - `src/app/`: Rotas visuais do Expo Router (`_layout.tsx`, `index.tsx`, `login.tsx`, `(tabs)/`, `leitura/nova.tsx`).
  - `tests/`: `unit/domain/`, `unit/application/`, `component/`.
- **Identificadores (UUIDv4):** Todas as entidades (`Empresa`, `Endereco`, `PadraoCemig`, `Usuario`, `Leitura`, `Notificacao`) DEVEM usar obrigatoriamente UUIDv4 como Chave Primária. A entidade `Usina` foi aposentada: "usina" é a flag `ehUsina` do `Endereco` (ver `docs/decisions.md` seção 9.1). A fonte de aleatoriedade do VO é injetada pela infraestrutura.

## 5. Test-Driven Development (TDD) & Fakes
- **Ciclo Red -> Green -> Refactor:** NENHUMA linha de código de produção deve ser criada sem que exista previamente um teste unitário automatizado correspondente que falhe primeiro.
- **Isolamento de Testes:** Domínio e aplicação usam estritamente os repositórios em memória e gateways fakes de `src/infrastructure/fakes/`, para testes ultrarrápidos e isolados de banco e hardware. Esses fakes são dublês de teste e ficam **fora** da medição de cobertura.
- **Integração (`tests/integration/`):** o que fala SQL é testado contra SQLite de verdade, via `node:sqlite` e o adaptador de `tests/helpers/bancoDeTeste.ts` — `expo-sqlite` não roda em Node. É o que verifica o schema publicado, o índice parcial, as chaves estrangeiras e o seed (ver `docs/decisions.md` seção 9.12).
- **Nuvem nos testes:** nenhum teste fala com o Supabase real. Casos de uso usam os dublês remotos; adaptadores usam o cliente falso de `tests/helpers/clienteSupabaseFalso.ts`. As **políticas de RLS e Storage** são testadas contra um Postgres embutido (PGlite) por `npm run test:rls` (`node --test`, fora do Jest) — faz parte do gate quando o SQL de `supabase/` muda.
- **Meta de Cobertura:** Manter a cobertura da suíte em pelo menos **80%** (medida via `npm run test:coverage`). Estado em 17/11/2026: **98,6% de linhas** (67+ suítes).

## 6. Offline-First & Mídia
- **Ações Offline:** TODA escrita é local primeiro e entra na `action_queue` **na mesma transação** (outbox), via o decorador `repositoriosComFila` — casos de uso de negócio recebem os repositórios com fila; os de sincronização recebem os crus. As telas leem sempre o SQLite; nenhuma consulta o Supabase para exibir.
- **Online obrigatório:** primeiro login no aparelho, cadastro, busca de empresas no cadastro e troca de senha. O resto funciona offline; a sessão no secure store libera o app sem rede.
- **Sincronização:** push pela fila em ordem de criação, **foto antes da linha**, operações idempotentes (upsert pelo UUID), 5 recusas isolam o item (falta de rede não conta). Pull incremental por `atualizado_em` do servidor, cursores em `sync_meta` gravados na mesma transação dos dados. Conflito: última medição vence, arbitrado pelo servidor. Disparo: ao abrir autenticado, ao voltar a rede, pelo botão manual e logo após escritas locais. Detalhes: `docs/decisions.md` seção 10.5.
- **Migrações locais:** nunca edite uma migração publicada (001, 002, 003…). Mudança de schema é uma versão nova.
- **Compressão de Mídia:** Fotos de relógios medidores DEVEM ser compactadas na infraestrutura (máx. 1080p, qualidade JPEG ~70-80%, ~300KB) antes de serem salvas localmente no SQLite/FileSystem.
- **Comprovantes na nuvem:** bucket **privado** `comprovantes`, caminho `{empresa}/{endereco}/{leitura}.jpg`; exibição só por URL assinada de vida curta. O expurgo local nunca apaga leitura que ainda não subiu.

## 7. Manutenção de Documentação Contínua
- **Documentação Viva:** Todos os arquivos de documentação (`.md`), em especial os localizados em `docs/` e `docs/presentation/`, devem ser mantidos estritamente atualizados à medida que o projeto evolui.
- **Rastreabilidade de Decisões:** Sempre que uma nova decisão arquitetural, técnica ou de produto for tomada e consolidada, o arquivo `docs/decisions.md` (ADR) DEVE ser obrigatoriamente atualizado refletindo o novo contexto, as opções avaliadas, a decisão final e sua justificativa.
- **Sincronia Código-Documento:** Alterações no código-fonte que afetem diagramas (Mermaid), fluxos de caso de uso, schemas de banco de dados (SQL/DER) ou a stack tecnológica exigem atualização imediata e proativa dos respectivos arquivos `.md` correspondentes.
