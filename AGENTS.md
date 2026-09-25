# Diretrizes Gerais para Agentes & Assistentes de Código (Equinox Mobile)

## 1. Stack Tecnológica Oficial
- **Plataforma/Framework:** React Native + Expo SDK 57 (v57.0.0) com Expo Router (file-based routing).
- **Linguagem:** TypeScript v5+ (`strict: true`) com imports absolutos via `@/*` (`./src/*`).
- **Testes (TDD):** Jest + `ts-jest` + `@testing-library/react-native` (configurado em `jest.config.js` com suporte a `@/*`).
- **Persistência Local (Offline-First):** `expo-sqlite` (SQLite local com UUIDv4 em todas as PKs).
- **Backend / Nuvem:** Supabase Client (`@supabase/supabase-js`), Supabase Auth, Storage (bucket `comprovantes`) e RLS.
- **Segurança & Sessão:** `expo-secure-store` encapsulado por `SessionStorageSecureStore`.
- **Conectividade:** `@react-native-community/netinfo`.
- **Sensores & Mídia:** `expo-camera` + `expo-image-manipulator` (compressão JPEG 1080p ~300KB) + `expo-location`.
- **Gerenciamento de Estado UI:** React Context API + Custom Hooks Controllers (ViewModels).
- **Estilização UI:** React Native `StyleSheet` nativo com `theme.ts` centralizado.
- **Formulários & Validação:** React Hook Form + Zod.

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
- **Identificadores (UUIDv4):** Todas as entidades (`Empresa`, `Usuario`, `Usina`, `Leitura`) DEVEM usar obrigatoriamente UUIDv4 gerados no Domínio como Chave Primária.

## 5. Test-Driven Development (TDD) & Fakes
- **Ciclo Red -> Green -> Refactor:** NENHUMA linha de código de produção deve ser criada sem que exista previamente um teste unitário automatizado correspondente que falhe primeiro.
- **Isolamento de Testes:** Usar estritamente os repositórios em memória e gateways fakes de `src/infrastructure/fakes/` para garantir testes ultrarrápidos e 100% isolados de banco de dados ou hardware.
- **Meta de Cobertura:** Manter a cobertura da suíte em pelo menos **80%** (medida via `npm run test:coverage`).

## 6. Offline-First & Mídia
- **Ações Offline:** Inserções e modificações em estado desconectado DEVEM gerar logs na `action_queue` local (`ActionQueueItem`) para sincronização assíncrona posterior.
- **Compressão de Mídia:** Fotos de relógios medidores DEVEM ser compactadas na infraestrutura (máx. 1080p, qualidade JPEG ~70-80%, ~300KB) antes de serem salvas localmente no SQLite/FileSystem.

## 7. Manutenção de Documentação Contínua
- **Documentação Viva:** Todos os arquivos de documentação (`.md`), em especial os localizados em `docs/` e `docs/presentation/`, devem ser mantidos estritamente atualizados à medida que o projeto evolui.
- **Rastreabilidade de Decisões:** Sempre que uma nova decisão arquitetural, técnica ou de produto for tomada e consolidada, o arquivo `docs/decisions.md` (ADR) DEVE ser obrigatoriamente atualizado refletindo o novo contexto, as opções avaliadas, a decisão final e sua justificativa.
- **Sincronia Código-Documento:** Alterações no código-fonte que afetem diagramas (Mermaid), fluxos de caso de uso, schemas de banco de dados (SQL/DER) ou a stack tecnológica exigem atualização imediata e proativa dos respectivos arquivos `.md` correspondentes.
