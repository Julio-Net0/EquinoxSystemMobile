# Diagramas Dinâmicos e Arquiteturais — Equinox Mobile

## 1. Mapeamento BCE (Boundary-Control-Entity)

```mermaid
flowchart LR
    Tecnico((Técnico))
    B1[NovaLeituraScreen «boundary»]
    B2[CameraModule «boundary»]
    C[RegistrarLeituraUseCase «control»]
    E1[Leitura «entity»]
    E2[CoordenadasGPS «entity»]

    Tecnico --> B1
    B1 --> B2
    B1 --> C
    C --> E1
    C --> E2
```

## 2. Diagrama de Sequência (Fluxo Offline de Nova Leitura)

```mermaid
sequenceDiagram
    actor Técnico
    participant Screen as NovaLeituraScreen «boundary»
    participant Camera as CameraService «infra»
    participant GPS as GPSService «infra»
    participant UseCase as RegistrarLeituraUseCase «control»
    participant Domain as Leitura «entity»
    participant LocalRepo as LeituraSQLiteRepository «infra»
    participant Queue as ActionQueueSQLiteRepository «infra»

    Técnico ->> Screen: Preenche valor em kWh e clica "Tirar Foto"
    Screen ->> Camera: capturarFoto()
    Camera -->> Screen: fotoRawPath
    Screen ->> Camera: comprimirImagem(fotoRawPath)
    Camera -->> Screen: fotoCompressedPath (~300KB)
    Screen ->> GPS: capturarCoordenadas()
    GPS -->> Screen: latitude, longitude
    Screen ->> UseCase: executar(dadosLeitura)
    UseCase ->> Domain: criar(UUIDv4, usinaId, valorKwh, fotoCompressedPath, GPS)
    Domain -->> UseCase: instancialeitura
    UseCase ->> LocalRepo: salvar(leitura)
    LocalRepo -->> UseCase: ok
    UseCase ->> Queue: enfileirar(INSERT_LEITURA, payloadJSON)
    Queue -->> UseCase: ok
    UseCase -->> Screen: Sucesso (Salvo Offline)
    Screen -->> Técnico: Exibe alerta "Leitura salva localmente!"
```

## 3. Diagrama de Atividades (Engine de Sincronização)

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

## 4. Diagrama de Componentes (Clean Architecture)

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
