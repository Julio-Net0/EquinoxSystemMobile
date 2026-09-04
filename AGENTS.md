# Diretrizes Gerais para Agentes & Assistentes de Código (Equinox Mobile)

## 1. Stack Tecnológica Oficial
- **Plataforma/Framework:** React Native + Expo SDK 57 (v57.0.0) com Expo Router (file-based routing).
- **Linguagem:** TypeScript v5+ (`strict: true`).
- **Testes (TDD):** Jest + `jest-expo` + `@testing-library/react-native` + `@testing-library/jest-native/extend-expect`.
- **Persistência Local (Offline-First):** `expo-sqlite` (SQLite local com UUIDv4 em todas as PKs).
- **Backend / Nuvem:** Supabase Client (`@supabase/supabase-js`), Supabase Auth, Storage (bucket `comprovantes`) e RLS.
- **Segurança & Sessão:** `expo-secure-store`.
- **Conectividade:** `@react-native-community/netinfo`.
- **Sensores & Mídia:** `expo-camera` + `expo-image-manipulator` (compressão JPEG 1080p ~300KB) + `expo-location`.
- **Gerenciamento de Estado UI:** React Context API + Custom Hooks.
- **Estilização UI:** React Native `StyleSheet` nativo com `theme.ts` centralizado e `NativeWind` / `styled-components`.
- **Formulários & Validação:** React Hook Form + Zod.

## 2. Expo & Documentação Oficial
- **Versão:** Expo SDK 57 (v57.0.0).
- **Documentação:** Sempre consulte a documentação oficial da versão exata em https://docs.expo.dev/versions/v57.0.0/ antes de sugerir ou escrever qualquer código de infraestrutura Expo.

## 3. Execução de Comandos Shell & NPM
- **Ambiente Node/NPM:** Antes de executar qualquer comando `npm` pela primeira vez na sessão, tente executar o comando:
  `source nvm_autocomplete.sh`
- **Fallback:** Caso o `source nvm_autocomplete.sh` falhe, prossiga normalmente com o `npm`. Caso o próprio `npm` falhe ou encontre erros de execução de ambiente, **PARE imediatamente e me avise**.

## 4. Arquitetura e Design de Código (Clean Architecture & DDD)
- **Desacoplamento Total:** O projeto DEVE seguir rigorosamente Clean Architecture e DDD.
- **Camada de Domínio (`src/domain`):**
  - Contém Entidades, Objetos de Valor (*Value Objects*), Eventos e Interfaces de Repositório.
  - **PROIBIDO:** Nenhuma importação de React, React Native, Expo, SQLite, Supabase ou qualquer biblioteca de terceiros na camada de Domínio.
- **Identificadores (UUIDv4):** Todas as entidades (`Empresa`, `Usuario`, `Usina`, `Leitura`) DEVEM usar obrigatoriamente UUIDv4 gerados no Domínio como Chave Primária.
- **Camada de Aplicação (`src/application`):**
  - Contém os Casos de Uso (1 classe por caso de uso) e DTOs. Depende apenas da camada de Domínio.
- **Camada de Infraestrutura (`src/infrastructure`):**
  - Implementa Repositórios SQLite, Cliente Supabase, Serviços de Hardware (GPS, Câmera), NetInfo e `expo-secure-store`.
- **Camada de Apresentação (`src/presentation`):**
  - Telas Expo Router, ViewModels/Controllers e Componentes de UI.

## 5. Test-Driven Development (TDD)
- **Ciclo Red -> Green -> Refactor:** NENHUMA linha de código de produção deve ser criada sem que exista previamente um teste unitário automatizado correspondente que falhe primeiro.
- **Pirâmide de Testes:**
  - Testes unitários extensivos para Regras de Domínio e Casos de Uso (usando Repositórios em memória / fakes).
  - Testes de integração pontuais para Mapeamento SQLite e Supabase Client.

## 6. Offline-First & Mídia
- **Ações Offline:** Inserções e modificações em estado desconectado DEVEM gerar logs na `action_queue` local para sincronização assíncrona posterior.
- **Compressão de Mídia:** Fotos de relógios medidores DEVEM ser compactadas na infraestrutura (máx. 1080p, qualidade JPEG ~70-80%, ~300KB) antes de serem salvas localmente no SQLite/FileSystem.

## 7. Manutenção de Documentação Contínua
- **Documentação Viva:** Todos os arquivos de documentação (`.md`), em especial os localizados em `docs/`, devem ser mantidos estritamente atualizados à medida que o projeto evolui.
- **Rastreabilidade de Decisões:** Sempre que uma nova decisão arquitetural, técnica ou de produto for tomada e consolidada, o arquivo `docs/decisions.md` (ADR) DEVE ser obrigatoriamente atualizado refletindo o novo contexto, as opções avaliadas, a decisão final e sua justificativa.
- **Sincronia Código-Documento:** Alterações no código-fonte que afetem diagramas (Mermaid), fluxos de caso de uso, schemas de banco de dados (SQL/DER) ou a stack tecnológica exigem atualização imediata e proativa dos respectivos arquivos `.md` correspondentes.
