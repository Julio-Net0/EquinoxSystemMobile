# Diretrizes Gerais para Agentes & Assistentes de Código (Equinox Mobile)

## 1. Stack Tecnológica Oficial
- **Plataforma/Framework:** React Native + Expo SDK 57 (v57.0.0) com Expo Router (file-based routing).
- **Linguagem:** TypeScript v5+ (`strict: true`) com imports absolutos via `@/*` (`./src/*`).
- **Testes (TDD):** Jest em quatro projetos (`jest.config.js`), **todos com o preset `jest-expo`**: `dominio` (domínio, aplicação e arquitetura, em `testEnvironment: 'node'`), `infra`, `integracao` e `ui`. Um transform só, de propósito: com dois, um arquivo carregado por dois projetos gerava mapas de cobertura incompatíveis e o merge do istanbul somava errado (ver `docs/decisions.md` seção 9.11). `@testing-library/react-native` para render — nele `render` e `fireEvent` são **assíncronos**, e sem `await` as consultas não existem. **Atenção:** nenhum projeto checa tipos (Babel) — `npx tsc --noEmit` é obrigatório no gate.
- **Persistência Local (Offline-First):** `expo-sqlite` (SQLite local com UUIDv4 em todas as PKs).
- **Backend / Nuvem:** **nenhum nesta fase.** O app roda 100% local (ver `docs/decisions.md` seção 9.2). Supabase, `SyncManager` e `NetworkMonitor` foram removidos; `supabase/migrations/` fica como referência para quando houver backend.
- **Segurança & Sessão:** `expo-secure-store` encapsulado por `SessionStorageSecureStore`. Senha local hasheada por `HashSenhaExpoCrypto` (SHA-256 encadeado; **não é um KDF** — ver `docs/decisions.md` seção 9.5).
- **Conectividade:** não se aplica — não há rede. `@react-native-community/netinfo` não está instalado.
- **Sensores & Mídia:** `expo-camera` + `expo-image-manipulator` (compressão JPEG 1080p ~300KB) + `expo-location`.
- **Gerenciamento de Estado UI:** React Context API + Custom Hooks Controllers (ViewModels).
- **Estilização UI:** React Native `StyleSheet` nativo com `theme.ts` centralizado.
- **Formulários & Validação:** React Hook Form + Zod estão instalados mas **ainda não são usados**: as telas portadas validam com estado local e as mensagens exatas do app antigo. Adotar os dois é refatoração prevista, não dívida silenciosa.

## 2. Expo & Documentação Oficial
- **Versão:** Expo SDK 57 (v57.0.0).
- **Documentação:** Sempre consulte a documentação oficial da versão exata em https://docs.expo.dev/versions/v57.0.0/ antes de sugerir ou escrever qualquer código de infraestrutura Expo.

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
    - `fakes/`: Implementações de repositórios e gateways em memória (`Map<string, T>`) para testes e desenvolvimento desacoplado (`LeituraRepositoryMemory`, `CameraGatewayFake`, `SessionStorageMemory`).
    - `adapters/`: Adaptadores concretos (`SessionStorageSecureStore`).
    - `database/`, `hardware/`, `sync/`: Implementações reais (SQLite, Supabase, Expo Hardware).
  - `src/presentation/`: `context/`, `hooks/`, `screens/`, `components/`.
  - `src/app/`: Rotas visuais do Expo Router (`_layout.tsx`, `index.tsx`, `login.tsx`, `(tabs)/`, `leitura/nova.tsx`).
  - `tests/`: `unit/domain/`, `unit/application/`, `component/`.
- **Identificadores (UUIDv4):** Todas as entidades (`Empresa`, `Endereco`, `PadraoCemig`, `Usuario`, `Leitura`, `Notificacao`) DEVEM usar obrigatoriamente UUIDv4 como Chave Primária. A entidade `Usina` foi aposentada: "usina" é a flag `ehUsina` do `Endereco` (ver `docs/decisions.md` seção 9.1). A fonte de aleatoriedade do VO é injetada pela infraestrutura.

## 5. Test-Driven Development (TDD) & Fakes
- **Ciclo Red -> Green -> Refactor:** NENHUMA linha de código de produção deve ser criada sem que exista previamente um teste unitário automatizado correspondente que falhe primeiro.
- **Isolamento de Testes:** Domínio e aplicação usam estritamente os repositórios em memória e gateways fakes de `src/infrastructure/fakes/`, para testes ultrarrápidos e isolados de banco e hardware. Esses fakes são dublês de teste e ficam **fora** da medição de cobertura.
- **Integração (`tests/integration/`):** o que fala SQL é testado contra SQLite de verdade, via `node:sqlite` e o adaptador de `tests/helpers/bancoDeTeste.ts` — `expo-sqlite` não roda em Node. É o que verifica o schema publicado, o índice parcial, as chaves estrangeiras e o seed (ver `docs/decisions.md` seção 9.12).
- **Meta de Cobertura:** Manter a cobertura da suíte em pelo menos **80%** (medida via `npm run test:coverage`). Estado atual: **98,7% de linhas** — domínio 96,6%, aplicação 99,2%, infraestrutura 97,0%.

## 6. Offline-First & Mídia
- **Ações Offline:** TODA escrita é local e definitiva — não existe estado "desconectado", porque não há nuvem. A `action_queue` permanece no schema e com repositório implementado, mas está **reservada**: nada enfileira hoje, por não haver destino remoto.
- **Compressão de Mídia:** Fotos de relógios medidores DEVEM ser compactadas na infraestrutura (máx. 1080p, qualidade JPEG ~70-80%, ~300KB) antes de serem salvas localmente no SQLite/FileSystem.

## 7. Manutenção de Documentação Contínua
- **Documentação Viva:** Todos os arquivos de documentação (`.md`), em especial os localizados em `docs/` e `docs/presentation/`, devem ser mantidos estritamente atualizados à medida que o projeto evolui.
- **Rastreabilidade de Decisões:** Sempre que uma nova decisão arquitetural, técnica ou de produto for tomada e consolidada, o arquivo `docs/decisions.md` (ADR) DEVE ser obrigatoriamente atualizado refletindo o novo contexto, as opções avaliadas, a decisão final e sua justificativa.
- **Sincronia Código-Documento:** Alterações no código-fonte que afetem diagramas (Mermaid), fluxos de caso de uso, schemas de banco de dados (SQL/DER) ou a stack tecnológica exigem atualização imediata e proativa dos respectivos arquivos `.md` correspondentes.
