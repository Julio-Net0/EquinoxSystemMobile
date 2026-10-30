# 🎤 Roteiro de Apresentação: Câmera, Geolocalização e Persistência de Dados (10 Minutos)

> **Projeto:** [Equinox Mobile](file:///c:/Users/Victor/OneDrive/Documentos/CEFET/6°%20PERÍODO/PROG.%20MOBILE/PROJETO/EquinoxSystemMobile/README.md)  
> **Tema Central:** Câmera, Geolocalização (GPS) e Persistência Local (SQLite) 100% Offline-First  
> **Arquivo de Slides Interativos:** [slides/apresentacao_camera_geolocalizacao_persistencia.html](file:///c:/Users/Victor/OneDrive/Documentos/CEFET/6°%20PERÍODO/PROG.%20MOBILE/PROJETO/EquinoxSystemMobile/slides/apresentacao_camera_geolocalizacao_persistencia.html)  
> **Tempo Total:** 10 Minutos

---

## ⏱️ Cronograma e Minutagem do Apresentador

| Minutagem | Tópico Avaliativo | Slide | Foco da Fala |
|:---------:|-------------------|:-----:|--------------|
| **00:00 - 01:30** | **1. Abertura e Contextualização** | Slide 01 | O Problema em campo (sem sinal/área rural) e a Solução com Foto, GPS e SQLite |
| **01:30 - 03:00** | **2. Princípios Arquiteturais (Clean & DDD)** | Slide 02 | Onde vivem Câmera, GPS e SQLite nas 4 camadas da Clean Architecture |
| **03:00 - 04:30** | **3. A Estratégia de TDD** | Slide 03 | Como testamos hardware sem aparelho e sem emulador via Test Doubles (Fakes) |
| **04:30 - 06:00** | **4. O Domínio e as Interfaces** | Slide 04 | Contratos puros (`ICameraGateway`, `IArquivoFotoGateway`, `CoordenadasGPS`, `Leitura`) |
| **06:00 - 07:15** | **5. A Suíte Automatizada (TDD na Prática)** | Slide 05 | Demonstração dos **765 testes aprovados** (98,7% de cobertura em 4 projetos Jest) |
| **07:15 - 08:30** | **6. Infraestrutura (Adaptadores Expo SDK 57)** | Slide 06 | Uso moderno de `CameraGatewayExpo`, `ArquivoFotoGatewayExpo` e `LocationGatewayExpo` |
| **08:30 - 09:30** | **7. Salvando no Banco Local (SQLite)** | Slide 07 | Persistência transacional com `LeituraRepositorySQLite`, índice parcial e auditoria |
| **09:30 - 10:00** | **8. Demonstração da UI e Conclusão** | Slide 08 | A rota `[padraoId].tsx`, o hook `useNovaLeitura`, a modal de câmera e encerramento |

---

## 📋 Script Detalhado de Apresentação (Passo a Passo)

### 1. Abertura e Contextualização (Slide 01 · 00:00 - 01:30)
* **Fala do Apresentador:**
  > *"Olá a todos. Nosso projeto é o **Equinox Mobile**, um aplicativo corporativo mobile voltado para a vistoria técnica e coleta de leituras de medidores de energia em padrões Cemig e usinas fotovoltaicas.  
  > **O Problema em Campo:** Os medidores estão frequentemente em áreas rurais ou subsolos sem qualquer cobertura de internet ou sinal 4G. Processos tradicionais em papel ou formulários simples sofrem com alto índice de erros manuais de digitação de kWh e até fraudes de medições feitas longe do local.  
  > **A Solução:** O Equinox Mobile une hardware e engenharia de software: exigimos **foto obrigatória do visor do medidor** (comprimida e salva em armazenamento seguro permanente), utilizamos **geolocalização (GPS) como prova de apoio auditável**, e gravamos tudo instantaneamente em banco local **SQLite com índice parcial único**, operando **100% Offline-First** sem qualquer dependência de nuvem."*

---

### 2. Princípios Arquiteturais: Clean Architecture e DDD (Slide 02 · 01:30 - 03:00)
* **Pergunta da Banca:** *"Onde aparecem a Câmera, a Geolocalização e o Banco de Dados na arquitetura?"*
* **Fala do Apresentador:**
  > *"Seguindo rigorosamente Clean Architecture e DDD, dividimos o sistema em 4 camadas bem delimitadas:  
  > 1. **Domínio (Centro):** Declaramos as portas puras `ICameraGateway`, `ILocationGateway` e `IArquivoFotoGateway`. Não importamos nenhuma biblioteca externa aqui — zero Expo e zero React Native. Temos o Value Object `CoordenadasGPS`, o Domain Service `ValidadorDistanciaGpsService` (Haversine), o serviço `RegraLocalizacaoLeituraService` (ADR 9.4) e a entidade `Leitura`, que impõe foto obrigatória.  
  > 2. **Aplicação:** O caso de uso `RegistrarLeituraUseCase` orquestra a validação, aciona a persistência definitiva da foto, cria a entidade e persiste no SQLite, sem saber como a câmera funciona por baixo dos panos.  
  > 3. **Infraestrutura:** É aqui que o hardware real existe: `CameraGatewayExpo` e `ArquivoFotoGatewayExpo` para mídia, `LocationGatewayExpo` para GPS, e `LeituraRepositorySQLite` para o banco local.  
  > 4. **Apresentação:** O hook `useNovaLeitura` e o componente `CapturaMedidorCamera` (que conhece a `CameraView`) alimentam a rota visual `[padraoId].tsx`."*

---

### 3. A Estratégia de TDD: Como testamos Câmera, GPS e SQLite? (Slide 03 · 03:00 - 04:30)
* **Fala do Apresentador:**
  > *"**Como foi feito:** Adotamos o ciclo rigoroso Red -> Green -> Refactor. Mas como testar câmera, GPS e banco sem depender de celular conectado ou emulador aberto no Jest?  
  > Criamos **Test Doubles (Fakes em memória)** para o hardware: `CameraGatewayFake`, `LocationGatewayFake` e `ArquivoFotoGatewayFake`.  
  > E para o banco de dados, usamos testes de integração com o **`node:sqlite`** (SQLite real em memória da runtime).  
  > **Nossos testes automatizados garantem que:**  
  > - Nenhuma leitura é criada sem evidência fotográfica válida;  
  > - A foto em cache temporário é movida e comprimida para o disco permanente do app;  
  > - O GPS fora de 500m ou indisponível em subsolo não trava o técnico em campo: a leitura é salva e gera notificação de exceção para auditoria do gestor (ADR 9.4);  
  > - Duas leituras no mesmo padrão no mesmo dia não conflitam: a substituição atômica atualiza a vigente anterior de forma consistente."*

---

### 4. O Domínio e as Interfaces: A Base do Contrato (Slide 04 · 04:30 - 06:00)
* **Fala do Apresentador:**
  > *"Aqui vemos o código do contrato puro.  
  > A interface `ICameraGateway` declara `temPermissao`, `solicitarPermissao` e `capturar`.  
  > A interface `IArquivoFotoGateway` define o contrato `comprimirEPersistir`, desacoplando a compressão e movimentação de arquivos do sistema operacional.  
  > No Value Object `CoordenadasGPS`, a validação matemática está no construtor. Se a latitude não estiver entre -90 e 90, ou a longitude entre -180 e 180, o objeto sequer é criado.  
  > E na entidade `Leitura`, verificamos: se `fotoLocalUri` estiver vazio, é lançada uma exceção imediata. Já as coordenadas são opcionais como prova de apoio: o técnico nunca fica impedido de registrar a medição se estiver dentro de uma cabine blindada sem sinal de satélite."*

---

### 5. A Suíte Automatizada: TDD na Prática (Slide 05 · 06:00 - 07:15)
* **Fala do Apresentador:**
  > *"Neste slide comprovamos a qualidade do projeto por métricas concretas:  
  > Nossa suíte conta com **765 testes automatizados em 54 test suites**, divididos em 4 projetos Jest (`dominio`, `infra`, `integracao` e `ui`), rodando com **98,7% de cobertura de código geral** (96,6% no domínio, 99,2% na aplicação e 97,0% na infraestrutura).  
  > Temos testes unitários para a fórmula de Haversine (`ValidadorDistanciaGpsService.spec.ts`), testes dedicados para os gateways de hardware com mocks (`ArquivoFotoGatewayExpo.spec.ts`) e testes de tela completa com `@testing-library/react-native` em `NovaLeituraScreen.spec.tsx`."*

---

### 6. A Implementação de Hardware: Os Adaptadores Expo SDK 57 (Slide 06 · 07:15 - 08:30)
* **Tese Central:** *"A infraestrutura se adequa ao domínio, e não o contrário."*
* **Fala do Apresentador:**
  > *"Aqui apresentamos os adaptadores concretos utilizando as APIs modernas do Expo SDK 57:  
  > 1. **Câmera (`CameraGatewayExpo` e `CapturaMedidorCamera`):** No SDK 57, a `CameraView` é um componente React e a captura vive numa ref que só existe com a tela montada. O gateway implementa o padrão de *registro de capturador*: o componente registra sua função de captura e remove no cleanup do efeito. Isso respeita a regra nativa do Expo de manter **apenas um preview ativo por vez**.  
  > 2. **Compressão e Armazenamento (`ArquivoFotoGatewayExpo`):** Usamos a nova API `ImageManipulator.manipulate` do SDK 57. Redimensionamos a imagem para 1080p e executamos um laço de compressão JPEG adaptativo (qualidades 0.8 a 0.5) até que o arquivo caiba no orçamento de **~300KB**. Em seguida, o `expo-file-system` move a foto do cache temporário para a pasta permanente `Paths.document/leituras/`.  
  > 3. **Geolocalização (`LocationGatewayExpo`):** Solicita permissão foreground e chama `getCurrentPositionAsync` com `Accuracy.High`, executando uma corrida (`Promise.race`) contra um timeout de 10 segundos. Se o sinal de satélite falhar, devolve `null` graciosamente."*

---

### 7. Salvando os Dados no Banco Local do Celular: SQLite (Slide 07 · 08:30 - 09:30)
* **Fala do Apresentador:**
  > *"E como esses dados são persistidos no celular?  
  > O `LeituraRepositorySQLite` utiliza o `expo-sqlite` diretamente no dispositivo. Eliminamos qualquer fallback silencioso em memória (ADR 9.9) — o banco falha alto caso ocorra qualquer inconsistência.  
  > **O Schema:** Na tabela `leituras`, persistimos a foto permanente (`foto_local_uri`), coordenadas (`latitude`, `longitude`, `precisao_metros`), medições (`valor_consumo`, `valor_injecao`), datas e status.  
  > **O Índice Parcial Único:** O schema define o índice `idx_leituras_vigente_dia` sobre `(padrao_id, data_local)` onde o status é `registrada` ou `aprovada`. Isso garante que só possa existir **uma leitura vigente por padrão por dia**.  
  > Se o técnico fizer uma nova medição no mesmo dia, o método `salvarSubstituindo` executa uma transação exclusiva: atualiza a leitura anterior para `substituida` antes de inserir a nova, mantendo a consistência do índice único e um histórico auditável completo.  
  > E as notificações de exceção (`LEITURA_FORA_DE_RAIO` ou `LEITURA_SEM_GPS`) são geradas automaticamente para que o gestor possa auditar depois no escritório."*

---

### 8. Demonstração da UI, Integração e Conclusão (Slide 08 · 09:30 - 10:00)
* **Fala do Apresentador:**
  > *"Por fim, conectamos tudo na interface do usuário:  
  > A rota `src/app/(app)/leitura/[padraoId].tsx` e o hook `useNovaLeitura` recebem os gateways e repositórios através do Container de Injeção de Dependências.  
  > **A experiência do técnico:**  
  > 1. O GPS é obtido em segundo plano de forma transparente enquanto o técnico chega em frente ao medidor;  
  > 2. O botão de câmera abre a modal `CapturaMedidorCamera` com uma moldura de enquadramento perfeita para o visor;  
  > 3. O disparo fotográfico fecha o preview, comprime para ~300KB e salva no armazenamento seguro do app;  
  > 4. O sistema valida se o valor digitado é consistente com a leitura anterior;  
  > 5. Ao clicar em 'Salvar Leitura', o dado é persistido no SQLite local em menos de 10 milissegundos, com feedback háptico e confirmação visual.  
  > Em suma, entregamos um software corporativo robusto, resiliente a falhas de rede, 100% coberto por testes e pronto para o ambiente hostil de campo.  
  > Muito obrigado a todos, encerramos a apresentação e estamos à disposição para perguntas da banca!"*

---

## ❓ Perguntas Frequentes da Banca e Respostas Rápidas

| Pergunta Provável da Banca | Resposta Técnica Objetiva |
|---|---|
| **"E se o técnico estiver num subsolo sem GPS, ele fica travado?"** | *Não. Conforme a Decisão Arquitetural 9.4, a localização é prova de apoio e auditoria, e não condição impeditiva. O gateway possui timeout de 10s e devolve null; a leitura é salva normalmente e o sistema gera automaticamente uma notificação `LEITURA_SEM_GPS` para que o administrador audite.* |
| **"Por que não usar a URI que a câmera devolve direto no banco?"** | *Porque a URI da câmera aponta para a pasta temporária de cache do sistema operacional, que pode ser expurgada a qualquer momento. O `ArquivoFotoGatewayExpo` comprime a foto em 1080p e a move com `expo-file-system` para `Paths.document/leituras/`, que é persistente e seguro.* |
| **"Como garantem que não existem duas leituras vigentes no mesmo dia?"** | *Criamos o índice parcial único no SQLite: `idx_leituras_vigente_dia ON leituras(padrao_id, data_local) WHERE status IN ('registrada', 'aprovada')`. Qualquer substituição de medição no mesmo dia é feita em transação atômica (`salvarSubstituindo`), atualizando a anterior para `substituida` antes de gravar a nova.* |
| **"Como testaram sem celular físico conectado?"** | *No domínio e aplicação usamos dublês fakes rápidos (`CameraGatewayFake`, `LocationGatewayFake`). Na camada de infraestrutura, testamos os repositórios e o schema SQLite com o `node:sqlite` real em memória, e os adaptadores de hardware com mocks isolados das APIs do Expo SDK 57.* |
