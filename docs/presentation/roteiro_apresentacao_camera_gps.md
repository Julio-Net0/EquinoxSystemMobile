# 🎤 Roteiro de Apresentação: Câmera, Geolocalização e Persistência de Dados (10 Minutos)

> **Projeto:** [Equinox Mobile](file:///c:/Users/Victor/OneDrive/Documentos/CEFET/6°%20PERÍODO/PROG.%20MOBILE/PROJETO/EquinoxSystemMobile/README.md)  
> **Tema Central:** Câmera, Geolocalização (GPS) e Persistência Local (SQLite) Offline-First  
> **Arquivo de Slides Interativos:** [slides/apresentacao_camera_geolocalizacao_persistencia.html](file:///c:/Users/Victor/OneDrive/Documentos/CEFET/6°%20PERÍODO/PROG.%20MOBILE/PROJETO/EquinoxSystemMobile/slides/apresentacao_camera_geolocalizacao_persistencia.html)  
> **Tempo Total:** 10 Minutos

---

## ⏱️ Cronograma e Minutagem do Apresentador

| Minutagem | Tópico Avaliativo | Slide | Foco da Fala |
|:---------:|-------------------|:-----:|--------------|
| **00:00 - 01:30** | **1. Abertura e Contextualização** | Slide 01 | O Problema de usinas rurais e a Solução com Câmera e GPS |
| **01:30 - 03:00** | **2. Princípios Arquiteturais (Clean & DDD)** | Slide 02 | Onde aparecem Câmera e GPS nas 4 camadas da Clean Architecture |
| **03:00 - 04:30** | **3. A Estratégia de TDD** | Slide 03 | Como testamos hardware sem aparelho físico via Test Doubles |
| **04:30 - 06:00** | **4. O Domínio e as Interfaces** | Slide 04 | A base do contrato puro (`ICameraGateway`, `CoordenadasGPS`, `Leitura`) |
| **06:00 - 07:15** | **5. O Teste (TDD na Prática)** | Slide 05 | Demonstração dos testes automatizados (88 testes passando no Jest) |
| **07:15 - 08:45** | **6. Infraestrutura (Adaptadores Expo)** | Slide 06 | Uso moderno de `expo-camera`, `expo-image-manipulator` e `expo-location` |
| **08:45 - 10:00** | **7. Salvando no Banco Local (SQLite)** | Slide 07 & 08 | Persistência com `expo-sqlite`, `action_queue` e conclusão |

---

## 📋 Script Detalhado de Apresentação (Passo a Passo)

### 1. Abertura e Contextualização (Slide 01 · 00:00 - 01:30)
* **Fala do Apresentador:**
  > *"Olá a todos. Nosso projeto é o **Equinox Mobile**, um sistema corporativo mobile para gestão e vistoria técnica de usinas solares fotovoltaicas.  
  > **O Problema:** Usinas solares estão frequentemente localizadas em áreas rurais remotas, com ausência total de sinal de internet. Nesse cenário, vistorias manuais tradicionais sofrem com fraudes — leituras registradas sem que o técnico tenha ido à usina — e erros de digitação de medições em kWh sem comprovação documental.  
  > **A Solução:** O Equinox Mobile resolve isso unindo hardware e arquitetura: exigimos **Proof of Presence** via GPS em raio de 500m da usina, exigimos **foto obrigatória do relógio medidor** comprimida a ~300KB para caber no aparelho, e gravamos tudo instantaneamente em banco local **SQLite**, operando 100% Offline-First."*

---

### 2. Princípios Arquiteturais: Clean Architecture e DDD (Slide 02 · 01:30 - 03:00)
* **Pergunta da Banca:** *"Onde aparecem a Câmera e a Geolocalização?"*
* **Fala do Apresentador:**
  > *"Seguindo rigorosamente Clean Architecture e DDD, dividimos o sistema em 4 camadas bem delimitadas:  
  > 1. **Domínio (Centro):** Declaramos as portas `ICameraGateway` e `ILocationGateway`. Não importamos nenhuma biblioteca externa aqui. Temos o Value Object `CoordenadasGPS`, o Domain Service `ValidadorDistanciaGpsService` com fórmula de Haversine e a entidade `Leitura`, que impõe foto e coordenadas como campos obrigatórios.  
  > 2. **Aplicação:** O caso de uso `RegistrarLeituraUseCase` orquestra a validação e o salvamento sem saber como o hardware funciona.  
  > 3. **Infraestrutura:** É aqui que o hardware real existe: `ExpoCameraGateway` e `ExpoLocationGateway`, além de `LeituraRepositorySQLite` para o banco local.  
  > 4. **Apresentação:** O hook controller `useNovaLeituraController` gerencia permissões e estados, alimentando a tela `NovaLeituraScreen`."*

---

### 3. A Estratégia de TDD: Como testamos Câmera e GPS? (Slide 03 · 03:00 - 04:30)
* **Fala do Apresentador:**
  > *"**Como foi feito:** Adotamos o ciclo Red -> Green -> Refactor. Como testar câmera e GPS sem depender de celular conectado ou emulador aberto no Jest? Criamos **Test Doubles (Fakes em memória)**: `CameraGatewayFake` e `LocationGatewayFake`.  
  > **Nossos testes garantem que:**  
  > - Se a permissão for negada pelo usuário, o sistema bloqueia e notifica a tela;  
  > - A foto capturada obedece à meta de compressão de até 300KB em JPEG;  
  > - Coordenadas absurdas (como latitude 95) disparam exceções imediatas;  
  > - A fórmula de Haversine bloqueia técnicos fora do raio de 500 metros;  
  > - A entidade `Leitura` impede qualquer gravação sem evidência fotográfica."*

---

### 4. O Domínio e as Interfaces: A Base do Contrato (Slide 04 · 04:30 - 06:00)
* **Fala do Apresentador:**
  > *"Aqui vemos o código do contrato puro. A interface `ICameraGateway` declara apenas `solicitarPermissao` e `capturarEComprimirFoto`, devolvendo `{ uri, sizeBytes }`.  
  > No Value Object `CoordenadasGPS`, a validação matemática está no construtor. Se a latitude não estiver entre -90 e 90, o objeto sequer é instanciado.  
  > E na entidade `Leitura`, verificamos: se `caminhoImagemLocal` estiver vazio, é lançada uma exceção fatal de negócio. O Domínio é o guardião das invariantes."*

---

### 5. O Teste: TDD na Prática (Slide 05 · 06:00 - 07:15)
* **Fala do Apresentador:**
  > *"Neste slide comprovamos o TDD na prática. Os testes foram escritos antes dos adaptadores concretos.  
  > Temos testes unitários em `tests/unit/presentation/hooks/useNovaLeituraController.spec.ts`, em `ValidadorDistanciaGpsService.spec.ts` e testes dedicados para os gateways de hardware.  
  > Hoje, nossa suíte conta com **32 suítes de teste e 88 testes automatizados**, todos passando com 100% de sucesso em milissegundos no terminal via `npm test`."*

---

### 6. A Implementação da Infraestrutura: Os Adaptadores Expo (Slide 06 · 07:15 - 08:45)
* **Tese Central:** *"A infraestrutura se adequa ao domínio, e não o contrário."*
* **Fala do Apresentador:**
  > *"Aqui apresentamos os adaptadores concretos utilizando as APIs modernas do Expo SDK 57:  
  > - No `ExpoCameraGateway`, utilizamos `expo-camera` para checagem e solicitação de permissões, e o `expo-image-manipulator` com `manipulateAsync`, redimensionando a foto para 1080p com compressão JPEG de 75%. Isso atinge com precisão a meta de ~300KB.  
  > - No `ExpoLocationGateway`, chamamos `expo-location` com `Accuracy.High` e convertemos os dados nativos no Value Object `CoordenadasGPS` do Domínio.  
  > **O ponto alto da Clean Architecture:** Se amanhã o Expo for trocado por outra biblioteca nativa ou React Native puro, **o Domínio, os Casos de Uso e as Telas não sofrem nenhuma alteração**."*

---

### 7. Salvando os Dados no Banco Local do Celular: SQLite (Slide 07 e 08 · 08:45 - 10:00)
* **Fala do Apresentador:**
  > *"Por fim, como esses dados são salvos?  
  > Utilizamos o `expo-sqlite` gerenciado pelo `SQLiteDatabaseManager` com `PRAGMA journal_mode = WAL`, criando o banco `equinox_mobile.db`.  
  > Na tabela `leituras`, persistimos a foto local (`foto_local_uri`), a `latitude`, a `longitude`, o `valor_kwh` e o `status_sync = 'Pendente'`.  
  > Simultaneamente, o `RegistrarLeituraUseCase` cria um item na tabela `action_queue` (`tipo_acao = 'INSERT_LEITURA'`). Assim, mesmo que o técnico desligue o celular ou fique dias sem internet, o dado está seguro no aparelho. Quando houver sinal, o `SyncManager` envia a foto para o bucket `comprovantes` do Supabase e sincroniza o banco remoto.  
  > Muito obrigado a todos, encerramos a apresentação e estamos à disposição para dúvidas!"*
