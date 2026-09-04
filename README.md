# Equinox Mobile ☀️

**Sistema de Gestão e Monitoramento de Usinas Fotovoltaicas**

O Equinox Mobile é um aplicativo **100% Mobile, Multi-Tenant e Offline-First**, desenvolvido para permitir que técnicos em campo realizem vistorias e registrem leituras de geração de energia em usinas solares, mesmo em locais remotos e sem conectividade com a internet.

---

## 🚀 Principais Funcionalidades

- **Sincronização Offline-First:** O aplicativo funciona de forma contínua sem internet. Todos os dados são salvos localmente e enviados para a nuvem automaticamente assim que a conexão é restabelecida.
- **Gerenciamento de Multi-Tenancy:** Estrutura escalável para atender diversas Empresas (Tenants), Usinas e Usuários com rígido controle de acesso baseado em RLS (Row Level Security).
- **Prova de Presença (Proof of Presence):** Validação de localização via GPS para garantir que a leitura foi feita fisicamente na usina correta.
- **Otimização de Mídia:** Compressão automática local de fotos de relógios medidores (máx 1080p, ~300KB) para garantir uploads bem-sucedidos em redes 3G rurais.

---

## 🛠️ Stack Tecnológica

O sistema foi desenhado seguindo a filosofia de **Clean Architecture**, **Domain-Driven Design (DDD)** e **Test-Driven Development (TDD)**, utilizando as seguintes tecnologias:

- **Plataforma/Framework:** React Native + Expo SDK 57 (Expo Router)
- **Linguagem:** TypeScript v5+ (`strict: true`)
- **Backend / Nuvem:** Supabase (Auth, Storage, PostgreSQL)
- **Persistência Local:** SQLite (Fonte Única de Verdade em modo offline)
- **Testes:** Jest + `@testing-library/react-native`
- **Validação de Formulários:** Zod + React Hook Form

---

## 🏗️ Arquitetura do Sistema

O projeto adota a Arquitetura Limpa (Clean Architecture), isolando completamente a lógica de negócios da infraestrutura e interface do usuário.

```mermaid
flowchart TB
    subgraph Presentation["Camada de Apresentação (UI)"]
        UI_Screens[Expo Router Screens]
        UI_Components[React Native Components]
        UI_Context[Auth & Connection Context]
    end

    subgraph Application["Camada de Aplicação (Use Cases)"]
        UC_Leitura[RegistrarLeituraUseCase]
        UC_Usina[CadastrarUsinaUseCase]
        UC_Sync[ProcessarFilaSincronizacaoUseCase]
    end

    subgraph Domain["Camada de Domínio (Pure Business Logic)"]
        Dom_Entities[Entidades: Usina, Leitura, Empresa, Usuario]
        Dom_VO[Value Objects: CoordenadasGPS, UUID]
        Dom_Ports[[Interfaces: ILeituraRepository, ISyncGateway, IGPSProvider]]
    end

    subgraph Infrastructure["Camada de Infraestrutura (Drivers & Adapters)"]
        Infra_SQLite[SQLite Database - expo-sqlite]
        Infra_Supabase[Supabase Client - @supabase/supabase-js]
        Infra_Hardware[Expo Camera / Location / SecureStore]
        Infra_NetInfo[NetInfo Network Monitor]
    end

    UI_Screens --> UI_Context
    UI_Screens --> UC_Leitura
    UI_Screens --> UC_Usina
    UC_Leitura --> Dom_Entities
    UC_Leitura --> Dom_Ports
    UC_Sync --> Dom_Ports
    Infra_SQLite -.implementa.-> Dom_Ports
    Infra_Supabase -.implementa.-> Dom_Ports
    Infra_Hardware -.implementa.-> Dom_Ports
```

---

## 🔄 Motor de Sincronização (Offline-First)

A arquitetura garante que nenhuma informação seja perdida. Se o app estiver offline, as ações são enfileiradas. Quando a rede volta, o **SyncManager** orquestra o envio dos arquivos de mídia e JSONs.

```mermaid
flowchart TD
    Start((NetInfo: Online)) --> A1[SyncManager acionado]
    A1 --> A2[Consultar itens pendentes na action_queue]
    A2 --> D1{Existe item pendente?}
    D1 -- Não --> A3[Executar Pull Sync Delta]
    D1 -- Sim --> A4[Ler primeiro item da fila]
    A4 --> D2{Tipo da Ação?}
    D2 -- INSERT_LEITURA --> A5[Upload foto comprimida para Supabase Storage]
    A5 --> A6[Enviar payload da leitura via Supabase Client API]
    D2 -- INSERT_USINA --> A7[Enviar payload da usina via Supabase API]
    A6 --> D3{Resposta Supabase?}
    A7 --> D3
    D3 -- Sucesso (200/201) --> A8[Remover item da action_queue]
    A8 --> A9[Atualizar status no SQLite local para Sincronizada]
    A9 --> A2
    D3 -- Conflito (409) --> A10[Marcar status no SQLite para Conflito]
    A10 --> A8
    D3 -- Erro de Conexão --> End((Fim / Aguardar próxima janela))
    A3 --> End
```

---

## 📚 Documentação Técnica Completa

Para um aprofundamento na arquitetura, modelos de dados e diretrizes do sistema, consulte os arquivos abaixo:

- [📝 Regras de Arquitetura e Agentes (AGENTS.md)](./AGENTS.md)
- [📖 Documentação de Software Completa](./docs/documento-software.md)
- [⚖️ Registro de Decisões de Arquitetura (ADRs)](./docs/decisions.md)
- [📊 Matriz de Rastreabilidade (TDD)](./docs/design/matriz_rastreabilidade_tdd.md)
- [🗄️ Schemas de Banco de Dados (SQLite e Supabase)](./docs/design/)
- [🗺️ Diagramas UML Detalhados](./docs/diagrams/)
