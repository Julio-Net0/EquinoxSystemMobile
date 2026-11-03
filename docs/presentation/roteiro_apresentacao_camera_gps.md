# 🎤 Roteiro de Apresentação: Câmera, Geolocalização e Persistência de Dados (10 Minutos)

> **Projeto:** [Equinox Mobile](file:///c:/Users/Victor/OneDrive/Documentos/CEFET/6°%20PERÍODO/PROG.%20MOBILE/PROJETO/EquinoxSystemMobile/README.md)  
> **Tema Central:** Câmera, Geolocalização (GPS) e Persistência Local (SQLite) 100% Offline-First  
> **Arquivo de Slides Interativos:** [slides/apresentacao_camera_geolocalizacao_persistencia.html](file:///c:/Users/Victor/OneDrive/Documentos/CEFET/6°%20PERÍODO/PROG.%20MOBILE/PROJETO/EquinoxSystemMobile/slides/apresentacao_camera_geolocalizacao_persistencia.html)  
> **Total de Slides:** 12 Slides (divididos para máxima legibilidade, sem sobreposição)  
> **Tempo Total:** 10 Minutos

---

## ⏱️ Cronograma e Minutagem do Apresentador

| Minutagem | Tópico Avaliativo | Slide | Foco da Fala |
|:---------:|-------------------|:-----:|--------------|
| **00:00 - 01:00** | **1. Abertura: Problema e Solução** | Slide 01 | O Problema em campo (sem sinal/área rural) e a Solução com Foto, GPS e SQLite |
| **01:00 - 01:45** | **1. Estrutura do Fluxo no Projeto** | Slide 02 | Organização limpa das pastas `domain`, `application`, `infrastructure` e `presentation` |
| **01:45 - 02:45** | **2. Princípios Arquiteturais (Clean & DDD)** | Slide 03 | Matriz de responsabilidades das 4 camadas (Domínio, Aplicação, Infra e UI) |
| **02:45 - 03:45** | **3. A Estratégia de TDD** | Slide 04 | Como testamos hardware sem aparelho e sem emulador via Test Doubles (Fakes) |
| **03:45 - 04:45** | **4. O Domínio (Parte 1): Portas** | Slide 05 | Contratos puros (`ICameraGateway`, `IArquivoFotoGateway`, `ILocationGateway`) |
| **04:45 - 05:30** | **4. O Domínio (Parte 2): Invariantes** | Slide 06 | Entidade `Leitura` (foto obrigatória) e `CoordenadasGPS` como prova de apoio (ADR 9.4) |
| **05:30 - 06:30** | **5. A Suíte Automatizada (TDD na Prática)** | Slide 07 | Demonstração dos **765 testes aprovados** (98,7% de cobertura em 4 projetos Jest) |
| **06:30 - 07:15** | **6. Infraestrutura (Parte 1): Câmera** | Slide 08 | `CameraGatewayExpo` no Expo SDK 58 e o padrão de registro de capturador (1 preview ativo) |
| **07:15 - 08:00** | **6. Infraestrutura (Parte 2): Mídia e GPS** | Slide 09 | `ArquivoFotoGatewayExpo` (1080p ~300KB em `Paths.document`) e `LocationGatewayExpo` (timeout 10s) |
| **08:00 - 08:45** | **7. Persistência Local (Parte 1): SQLite** | Slide 10 | `LeituraRepositorySQLite`, índice parcial único (`idx_leituras_vigente_dia`) e `salvarSubstituindo` |
| **08:45 - 09:30** | **7. Persistência Local (Parte 2): Caso de Uso** | Slide 11 | Orquestração em `RegistrarLeituraUseCase` e auditoria geográfica automática |
| **09:30 - 10:00** | **8. Demonstração da UI e Conclusão** | Slide 12 | Rota `[padraoId].tsx`, hook `useNovaLeitura`, modal `CapturaMedidorCamera` e encerramento |

---

## 📋 Script Detalhado de Apresentação (Passo a Passo)

### 1. Abertura e Contextualização (Slides 01 e 02 · 00:00 - 01:45)
* **Slide 01 — O Problema e a Solução:**
  > *"Olá a todos. Nosso projeto é o **Equinox Mobile**, um aplicativo corporativo mobile voltado para a vistoria técnica e coleta de leituras de medidores de energia em padrões Cemig e usinas fotovoltaicas.  
  > **O Problema em Campo:** Os medidores estão frequentemente em áreas rurais ou subsolos sem qualquer cobertura de internet ou sinal 4G. Processos tradicionais em papel ou formulários simples sofrem com alto índice de erros manuais de digitação de kWh e até fraudes de medições feitas longe do local.  
  > **A Solução:** O Equinox Mobile une hardware e engenharia de software: exigimos **foto obrigatória do visor do medidor** (comprimida e salva em armazenamento seguro permanente), utilizamos **geolocalização (GPS) como prova de apoio auditável**, e gravamos tudo instantaneamente em banco local **SQLite com índice parcial único**, operando **100% Offline-First**."*
* **Slide 02 — Estrutura do Fluxo no Projeto:**
  > *"Neste segundo slide vemos a organização real do repositório: o domínio puro isolado no centro, o caso de uso `RegistrarLeituraUseCase` na aplicação, os adaptadores de hardware e SQLite na infraestrutura, e os componentes visuais e hooks na camada de apresentação."*

---

### 2. Princípios Arquiteturais: Clean Architecture e DDD (Slide 03 · 01:45 - 02:45)
* **Pergunta da Banca:** *"Onde aparecem a Câmera, a Geolocalização e o Banco de Dados na arquitetura?"*
* **Fala do Apresentador:**
  > *"Seguindo rigorosamente Clean Architecture e DDD, dividimos o sistema em 4 camadas bem delimitadas na nossa matriz de responsabilidades:  
  > 1. **Domínio (Centro):** Declaramos as portas puras `ICameraGateway`, `ILocationGateway` e `IArquivoFotoGateway`. Zero Expo e zero React Native.  
  > 2. **Aplicação:** O `RegistrarLeituraUseCase` orquestra a validação, aciona a persistência definitiva da foto e persiste no SQLite.  
  > 3. **Infraestrutura:** É aqui que o hardware real do Expo SDK 58 existe (`CameraGatewayExpo`, `ArquivoFotoGatewayExpo`, `LocationGatewayExpo`) junto ao `LeituraRepositorySQLite`.  
  > 4. **Apresentação:** O hook `useNovaLeitura` e o componente `CapturaMedidorCamera` alimentam a rota visual `[padraoId].tsx`."*

---

### 3. A Estratégia de TDD: Como testamos Câmera, GPS e SQLite? (Slide 04 · 02:45 - 03:45)
* **Fala do Apresentador:**
  > *"Adotamos o ciclo rigoroso Red -> Green -> Refactor. Para testar câmera e GPS sem depender de celular conectado ou emulador aberto no Jest, criamos **Test Doubles (Fakes em memória)**: `CameraGatewayFake`, `LocationGatewayFake` e `ArquivoFotoGatewayFake`. E para o banco de dados, usamos testes de integração com o **`node:sqlite`** real em memória."*

---

### 4. O Domínio e as Interfaces: A Base do Contrato (Slides 05 e 06 · 03:45 - 05:30)
* **Slide 05 — Portas de Hardware e Mídia:**
  > *"No Slide 05 vemos os contratos puros: `ICameraGateway` declara `temPermissao`, `solicitarPermissao` e `capturar`, enquanto `IArquivoFotoGateway` define `comprimirEPersistir`, exigindo que a foto saia do cache temporário e vá para o disco permanente."*
* **Slide 06 — Invariantes da Entidade Leitura e GPS:**
  > *"No Slide 06 vemos a proteção de invariantes na entidade `Leitura`: se `fotoLocalUri` estiver vazio, o construtor lança exceção imediata. Já as coordenadas (`CoordenadasGPS`) são opcionais como prova de apoio (ADR 9.4): o técnico nunca fica travado se estiver num subsolo sem satélite."*

---

### 5. A Suíte Automatizada: TDD na Prática (Slide 07 · 05:30 - 06:30)
* **Fala do Apresentador:**
  > *"Aqui comprovamos a qualidade do projeto em números: **765 testes automatizados aprovados em 54 suítes**, divididos nos 4 projetos Jest (`dominio`, `infra`, `integracao` e `ui`), atingindo **98,7% de cobertura de código**. Vemos os testes unitários da compressão para 1080p (~300KB) e do cálculo geodésico de Haversine para o raio de 500 metros."*

---

### 6. A Implementação de Hardware: Os Adaptadores Expo SDK 58 (Slides 08 e 09 · 06:30 - 08:00)
* **Slide 08 — Câmera e Preview Único (`CameraGatewayExpo`):**
  > *"No Expo SDK 58, a `CameraView` é um componente React que só admite **um preview ativo por vez**, e a função de disparo vive numa ref. O `CameraGatewayExpo` resolve isso com o padrão de *registro de capturador*: o componente visual registra o capturador ao montar e remove no cleanup, mantendo o domínio 100% desacoplado do React."*
* **Slide 09 — Compressão 1080p (~300KB) e GPS (`ArquivoFotoGatewayExpo`):**
  > *"No Slide 09 mostramos o `ArquivoFotoGatewayExpo`: usamos `ImageManipulator.manipulate` para redimensionar a largura para 1080px e aplicamos um laço de compressão JPEG progressivo (0.8 até 0.5) até caber no orçamento de **~300KB**, movendo o arquivo para `Paths.document/leituras/`. E no `LocationGatewayExpo`, usamos `Promise.race` contra um timeout de 10 segundos para nunca travar a tela."*

---

### 7. Salvando os Dados no Banco Local: SQLite (Slides 10 e 11 · 08:00 - 09:30)
* **Slide 10 — Transação Exclusiva e Substituição Atômica (`LeituraRepositorySQLite`):**
  > *"Na persistência local, o schema SQLite define o índice parcial único `idx_leituras_vigente_dia` sobre `(padrao_id, data_local)` para leituras registradas ou aprovadas. Quando o técnico refaz uma leitura no mesmo dia, `salvarSubstituindo` roda em transação exclusiva (`emTransacao`): marca a anterior como `substituida` antes de inserir a nova."*
* **Slide 11 — Orquestração e Auditoria (`RegistrarLeituraUseCase`):**
  > *"No Slide 11 vemos os 3 passos atômicos do caso de uso: 1) comprime e move a foto para o disco permanente; 2) grava a leitura no SQLite; 3) avalia a distância GPS com `RegraLocalizacaoLeituraService` e gera alertas automáticos (`LEITURA_FORA_DE_RAIO` ou `LEITURA_SEM_GPS`) para auditoria do administrador."*

---

### 8. Demonstração da UI, Integração e Conclusão (Slide 12 · 09:30 - 10:00)
* **Fala do Apresentador:**
  > *"Por fim, no Slide 12 conectamos tudo na rota `[padraoId].tsx` através do hook `useNovaLeitura`. O GPS é buscado em segundo plano, a modal `CapturaMedidorCamera` exibe a guia de enquadramento do visor, o valor em kWh é validado contra a leitura anterior e o registro é salvo no SQLite em menos de 10 milissegundos. Muito obrigado a todos, estamos à disposição da banca!"*

---

## ❓ Perguntas Frequentes da Banca e Respostas Rápidas

| Pergunta Provável da Banca | Resposta Técnica Objetiva |
|---|---|
| **"E se o técnico estiver num subsolo sem GPS, ele fica travado?"** | *Não. Conforme a Decisão Arquitetural 9.4, a localização é prova de apoio e auditoria, e não condição impeditiva. O gateway possui timeout de 10s e devolve null; a leitura é salva normalmente e o sistema gera automaticamente uma notificação `LEITURA_SEM_GPS` para que o administrador audite.* |
| **"Por que não usar a URI que a câmera devolve direto no banco?"** | *Porque a URI da câmera aponta para a pasta temporária de cache do sistema operacional, que pode ser expurgada a qualquer momento. O `ArquivoFotoGatewayExpo` comprime a foto em 1080p e a move com `expo-file-system` para `Paths.document/leituras/`, que é persistente e seguro.* |
| **"Como garantem que não existem duas leituras vigentes no mesmo dia?"** | *Criamos o índice parcial único no SQLite: `idx_leituras_vigente_dia ON leituras(padrao_id, data_local) WHERE status IN ('registrada', 'aprovada')`. Qualquer substituição de medição no mesmo dia é feita em transação atômica (`salvarSubstituindo`), atualizando a anterior para `substituida` antes de gravar a nova.* |
| **"Como testaram sem celular físico conectado?"** | *No domínio e aplicação usamos dublês fakes rápidos (`CameraGatewayFake`, `LocationGatewayFake`). Na camada de infraestrutura, testamos os repositórios e o schema SQLite com o `node:sqlite` real em memória, e os adaptadores de hardware com mocks isolados das APIs do Expo SDK 58.* |
