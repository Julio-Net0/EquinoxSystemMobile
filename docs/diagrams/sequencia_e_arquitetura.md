# Diagramas Dinâmicos e Arquiteturais — Equinox Mobile

Correspondem ao código da fase 7 (offline-first com Supabase, ADR seção 10).

## 1. Mapeamento BCE (Boundary-Control-Entity)

```mermaid
flowchart LR
    Tecnico((Técnico))
    B1[NovaLeituraScreen «boundary»]
    B2[CapturaMedidorCamera «boundary»]
    C[RegistrarLeituraUseCase «control»]
    E1[Leitura «entity»]
    E2[CoordenadasGPS «value object»]
    E3[Notificacao «entity»]

    Tecnico --> B1
    B1 --> B2
    B1 --> C
    C --> E1
    C --> E2
    C --> E3
```

## 2. Sequência — leitura registrada offline

A escrita da leitura e o item da fila de envio vão na **mesma transação**. O
caso de uso não sabe da fila: recebe um repositório que salva e enfileira
(`repositoriosComFila`).

```mermaid
sequenceDiagram
    actor Técnico
    participant Tela as NovaLeituraScreen
    participant Hook as useNovaLeitura
    participant UC as RegistrarLeituraUseCase
    participant Foto as ArquivoFotoGatewayExpo
    participant Repo as LeituraRepo (com fila)
    participant UoW as UnidadeDeTrabalhoSQLite
    participant DB as SQLite

    Técnico ->> Tela: foto, GPS, valor
    Tela ->> Hook: registrar()
    Hook ->> UC: executar(entrada)
    UC ->> Foto: comprimirEPersistir(uri)
    Foto -->> UC: JPEG 1080p ~300 KB em Paths.document
    UC ->> Repo: salvar(leitura) — estado "pendente"
    Repo ->> UoW: executar(transação)
    UoW ->> DB: INSERT leituras
    UoW ->> DB: INSERT action_queue (UPSERT_LEITURA, {id})
    UoW -->> Repo: commit
    Repo -->> UC: ok
    UC ->> Repo: notificações (mesmo caminho)
    UC -->> Hook: sucesso
    Hook -->> Tela: "Leitura registrada"
    Note over Repo: observarFila → SincronizacaoProvider<br/>atualiza "1 item pendente" e agenda envio
```

## 3. Atividades — uma rodada de sincronização

```mermaid
flowchart TD
    Gatilho((Abrir autenticado · rede voltou · botão · escrita local)) --> S0{Sessão local?}
    S0 -- Não --> Fim((Fim))
    S0 -- Sim --> S1{NetInfo: online?}
    S1 -- Não --> Off[Situação: offline<br/>nada é tentado]
    S1 -- Sim --> S2[garantirSessao: renova o token se preciso]
    S2 --> S3{Resultado}
    S3 -- falha de rede --> Off
    S3 -- token recusado --> Reaut[Situação: reautenticar<br/>pendentes ficam guardados]
    S3 -- ok --> P1[Push: próximo item da fila, em ordem]
    P1 --> P2{Item isolado?}
    P2 -- Sim --> P1
    P2 -- Não --> P3{Leitura sem foto remota?}
    P3 -- Sim --> P4[Envia a foto ao bucket privado<br/>empresa/endereco/leitura.jpg]
    P4 --> P5
    P3 -- Não --> P5[Envia o registro<br/>upsert pelo UUID]
    P5 --> P6{Resposta}
    P6 -- ok --> P7[Remove da fila<br/>leitura = sincronizada]
    P7 --> P8{Mais itens?}
    P6 -- rede/sessão --> Off
    P6 -- recusa --> P9[tentativas + 1, guarda o motivo<br/>5ª recusa: isola, leitura = falhou]
    P9 --> P8
    P8 -- Sim --> P1
    P8 -- Não --> L1[Pull: pede o que mudou desde<br/>os cursores do servidor]
    L1 --> L2[Aplica pacote + cursores<br/>numa transação]
    L2 --> L3{Escopo do usuário mudou?}
    L3 -- Sim --> L4[Zera cursores e baixa tudo] --> L2
    L3 -- Não --> L5[Atualiza sessão com o perfil novo]
    L5 --> L6{Usuário ainda ativo?}
    L6 -- Não --> Rev[Encerra a sessão]
    L6 -- Sim --> Ok[Situação: concluída ou parcial]
```

## 4. Estados de sincronização de uma leitura

```mermaid
stateDiagram-v2
    [*] --> pendente : gravada no aparelho
    pendente --> sincronizada : nuvem confirmou (foto + linha)
    pendente --> falhou : 5 recusas do servidor
    falhou --> pendente : "Tentar de novo"
    sincronizada --> pendente : mudou no aparelho (decisão, substituição)
    sincronizada --> [*] : expurgo após 30 dias (só se decidida)
```

## 5. Componentes (Clean Architecture)

```mermaid
flowchart TB
    subgraph Apresentacao["Apresentação"]
        Telas[Telas e rotas Expo Router]
        Ctx[Contextos: Auth · Conectividade · Sincronização · Container]
    end

    subgraph Aplicacao["Aplicação"]
        UCNeg[Casos de uso de negócio]
        UCSync[ProcessarFila · BaixarAlteracoes · Sincronizar]
    end

    subgraph Dominio["Domínio (sem bibliotecas)"]
        Ent[Entidades e regras]
        Portas[[Portas: repositórios, IUnidadeDeTrabalho,<br/>IAutenticacaoRemota, ISincronizacaoRemota, IConectividade]]
    end

    subgraph Infra["Infraestrutura"]
        SQLite[Repositórios SQLite + UnidadeDeTrabalho]
        Fila[repositoriosComFila]
        Supa[AutenticacaoSupabase · SincronizacaoSupabase]
        Net[ConectividadeNetInfo]
        Cofre[SessionStorageSecureStore · CofreSeguroEmPartes]
        HW[Câmera · GPS · Arquivos]
    end

    Telas --> Ctx --> UCNeg
    Ctx --> UCSync
    UCNeg --> Portas
    UCSync --> Portas
    Ent --- Portas
    SQLite -.implementa.-> Portas
    Fila -.implementa.-> Portas
    Supa -.implementa.-> Portas
    Net -.implementa.-> Portas
    Cofre -.implementa.-> Portas
    HW -.implementa.-> Portas
    Supa --> Nuvem[(Supabase: Auth · Postgres+RLS · Storage)]
```
