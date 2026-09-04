# Registro de Decisões de Arquitetura e Design (ADR - Architecture Decision Records)

Este documento registra de forma minuciosa todas as decisões arquiteturais, técnicas e de negócios tomadas durante a fase de planejamento do **Equinox Mobile**, desde a análise do documento descritivo inicial até a elaboração dos diagramas de software.

Para cada decisão, listamos o contexto, as opções consideradas, a decisão tomada e a justificativa que a fundamenta.

---

## 1. Arquitetura Geral do Sistema

### 1.1 Paradigma de Conectividade
* **Contexto:** Técnicos em áreas rurais precisam registrar dados de usinas fotovoltaicas onde a conexão de internet é instável ou inexistente.
* **Opções Consideradas:**
    1.  Aplicativo Cloud-Dependent (requer internet constante).
    2.  Aplicativo Offline-First (dados gravados localmente primeiro e sincronizados depois).
* **Decisão:** **Opção 2 (Offline-First).**
* **Justificativa:** É a única forma de garantir que o leiturista possa realizar seu trabalho em campo sem interrupções. O SQLite local atua como a *Single Source of Truth* (Fonte Única da Verdade) para o aplicativo, enquanto o Supabase atua como o backend centralizador.

### 1.2 Plataforma e Distribuição de Perfis
* **Contexto:** O sistema atende SuperAdmins (Equinox), Admins (Empresas/Tenants) e Técnicos. Inicialmente, havia a dúvida se o pré-cadastro das usinas seria feito em um painel Web separado.
* **Opções Consideradas:**
    1.  Painel Web (React/Next.js) para gestão + App Mobile para técnicos.
    2.  Sistema 100% Mobile, onde todos os perfis usam o mesmo aplicativo, com telas dinâmicas baseadas em permissões.
* **Decisão:** **Opção 2 (100% Mobile).**
* **Justificativa:** Conforme esclarecido pelo usuário, a premissa do negócio é ser inteiramente mobile. Isso unifica a base de código (React Native/Expo) e utiliza as políticas de Row Level Security (RLS) do Supabase para garantir que cada perfil veja apenas o que tem permissão, reduzindo o custo de manutenção de múltiplos front-ends.

---

## 2. Estratégia de Dados e Sincronização

### 2.1 Estratégia de Chaves Primárias (PK)
* **Contexto:** Dispositivos operando offline precisam gerar IDs para novos registros (como Leituras e Usinas) antes de sincronizar com a nuvem.
* **Opções Consideradas:**
    1.  IDs auto-incrementais gerados pelo SQLite.
    2.  Identificadores Únicos Universais (UUIDv4) gerados pela aplicação.
* **Decisão:** **Opção 2 (UUIDv4 gerados na camada de Domínio).**
* **Justificativa:** Se o SQLite gerasse IDs sequenciais (1, 2, 3), quando o dispositivo A e o dispositivo B sincronizassem com a nuvem ao mesmo tempo, haveria colisão catastrófica de IDs no banco remoto. O UUIDv4 garante que cada registro gerado offline no mundo seja matematicamente único.

### 2.2 Motor de Sincronização (SyncManager)
* **Contexto:** Como enviar os dados coletados offline de forma confiável para o Supabase e como atualizar o app com dados novos?
* **Opções Consideradas:**
    1.  Sincronização manual em lote disparada pelo usuário.
    2.  Sincronização Bidirecional Delta (Push via Fila + Pull Incremental) reativa ao estado da rede.
* **Decisão:** **Opção 2 (Sincronização Delta Bidirecional).**
* **Justificativa:** Toda ação de escrita (`INSERT_LEITURA`, etc.) é salva numa tabela de log (`action_queue`). Assim que o `@react-native-community/netinfo` detecta internet, o app faz o *Push* ordenado da fila, garantindo que nenhuma transação seja perdida. Em seguida, faz o *Pull* pedindo ao Supabase apenas os registros alterados desde a última sincronização (`last_sync_timestamp`), economizando pacote de dados 3G/4G.

---

## 3. Integração com Hardware e Mídia

### 3.1 Tratamento de Fotos de Comprovação
* **Contexto:** O técnico precisa tirar fotos dos medidores. Câmeras modernas geram fotos de 5MB a 15MB.
* **Opções Consideradas:**
    1.  Salvar a foto em resolução original e fazer upload direto.
    2.  Comprimir a foto localmente antes de salvar e sincronizar.
* **Decisão:** **Opção 2 (Compressão agressiva na captura).**
* **Justificativa:** Salvar dezenas de fotos originais em offline lotaria rapidamente o armazenamento do celular. Além disso, tentar fazer upload de 100MB de fotos numa rede 3G rural resultaria em timeout constante. A decisão de usar `expo-image-manipulator` para comprimir para JPEG 1080p (qualidade 70-80%, reduzindo para ~300KB) resolve os dois problemas garantindo escalabilidade.

### 3.2 Autenticação em Ambiente Desconectado
* **Contexto:** O token JWT de login expira ou o técnico abre o app no meio do campo sem sinal.
* **Opções Consideradas:**
    1.  Forçar o usuário a logar online antes de ir a campo.
    2.  Persistir a sessão ativamente e validá-la localmente.
* **Decisão:** **Opção 2 (Persistência segura via `expo-secure-store`).**
* **Justificativa:** Se o app fechar da memória, o técnico não pode ficar travado na tela de login sem internet. Ao gravar o hash/token criptografado no cofre do SO (`secure-store`), o app consegue validar "quem é" o usuário offline e liberar o acesso às suas tabelas locais do SQLite.

---

## 4. Engenharia de Software e Qualidade

### 4.1 Padrão Arquitetural
* **Contexto:** Como organizar as pastas e responsabilidades do código fonte para evitar código espaguete no React Native?
* **Opções Consideradas:**
    1.  Arquitetura padrão MVC ou baseada em Componentes (lógica misturada na UI).
    2.  Clean Architecture + Domain-Driven Design (DDD).
* **Decisão:** **Opção 2 (Clean Arch + DDD).**
* **Justificativa:** Exigência primária do projeto. A lógica de offline-first e fila de sincronização é altamente complexa. Isolar o coração do negócio (`Domain`) sem nenhuma dependência do Expo, SQLite ou Supabase garante que as regras vitais possam ser testadas em milissegundos, além de tornar o código extremamente manutenível a longo prazo.

### 4.2 Estratégia de Qualidade e Testes
* **Contexto:** Garantir que as regras de negócio funcionem antes mesmo do app rodar no emulador.
* **Opções Consideradas:**
    1.  Testes escritos após o desenvolvimento (ou ausência de testes unitários).
    2.  Test-Driven Development (TDD) estrito.
* **Decisão:** **Opção 2 (TDD via Jest + React Native Testing Library).**
* **Justificativa:** Ao adotar a disciplina TDD (Red -> Green -> Refactor), garantimos 100% de cobertura no Domínio e nos Casos de Uso. Adotou-se o `@testing-library/jest-native/extend-expect` para asserções amigáveis no ecossistema RN.

### 4.3 Gerenciamento de Estado UI
* **Contexto:** Como propagar estados de conexão ou dados do usuário entre as telas do Expo Router?
* **Opções Consideradas:**
    1.  Redux, Zustand ou MobX.
    2.  React Context API + Custom Hooks.
* **Decisão:** **Opção 2 (Context API + Hooks).**
* **Justificativa:** Como a fonte principal da verdade dos dados de negócio é o SQLite, um gerenciador de estado global pesado como Redux traria complexidade desnecessária. A Context API é perfeita e leve o suficiente para estados transversais simples, como `AuthContext` e `ConnectionContext`.

### 4.4 Linguagem de Programação
* **Contexto:** Qual tecnologia adotar para escrever o sistema?
* **Opções Consideradas:**
    1.  JavaScript puro.
    2.  TypeScript em modo estrito.
* **Decisão:** **Opção 2 (TypeScript v5+ com `strict: true`).**
* **Justificativa:** A tipagem forte e estática é pré-requisito fundamental para implementar o Domain-Driven Design de maneira segura, permitindo o uso eficiente de Interfaces, DTOs e Value Objects, eliminando uma classe inteira de erros em tempo de execução.

---

## 5. Tratamento de Edge Cases e Comportamentos Específicos

### 5.1 Exclusão de Dados (Soft Delete)
* **Contexto:** Como tratar a deleção de registros no modo offline sem quebrar a sincronização?
* **Decisão:** **Soft Delete (Advanced CRUD) Universal.**
* **Justificativa:** Nunca faremos exclusões físicas (Hard Delete) via app. Registros são apenas inativados (ex: `status = 'Inativa'`). Isso garante que os dispositivos mantenham o histórico rastreável.

### 5.2 Limite e Erros na Fila de Sincronização
* **Contexto:** O que ocorre quando um item da `action_queue` atinge o limite de tentativas?
* **Decisão:** **Isolamento do Erro e UX Amigável.**
* **Justificativa:** A fila não deve travar infinitamente. Se o limite de `tentativas` estourar, o erro é isolado, e a interface exibirá uma mensagem amigável e não técnica ao usuário (ex: *"Sistema offline. Por favor, mais tarde, clique nesse botão para tentar mandar suas leituras novamente, as mesmas estão salvas apenas no seu telefone"*).

### 5.3 Queda do Cache de Imagens Locais
* **Contexto:** O SO do celular (Android/iOS) pode apagar a imagem salva localmente para liberar espaço em disco.
* **Decisão:** **Fallback automático de caminhos de imagem.**
* **Justificativa:** A interface do usuário deve sempre tentar carregar a `url_imagem_remota` primeiro e, como plano B, o `caminho_imagem_local`. Isso previne que a foto desapareça do app se o cache for limpo após a sincronização ter ocorrido com sucesso.

### 5.4 Dependência de Geolocalização (Proof of Presence)
* **Contexto:** O técnico precisa tirar a foto com o GPS ativo, mas pode estar em um local sem sinal.
* **Decisão:** **GPS como Consulta, não como Bloqueio.**
* **Justificativa:** O técnico não deve ser impedido de trabalhar por problemas de satélite. A localização não é estritamente obrigatória para salvar a leitura local, servindo apenas para que o técnico (e o sistema) consulte se ele está no local certo.

### 5.5 Ordem de Upload na Sincronização
* **Contexto:** Devemos enviar o texto para o banco PostgreSQL primeiro, ou a foto para o Storage primeiro?
* **Decisão:** **Storage (Imagem) Sempre Primeiro.**
* **Justificativa:** O `ProcessarFilaSincronizacaoUseCase` faz o upload da mídia primeiro. Se a internet cair, no máximo teremos uma foto órfã no Storage. Se enviássemos o banco primeiro e a internet caísse, teríamos uma "Leitura" formalizada sem sua respectiva foto comprobatória, corrompendo a regra de negócio.

### 5.6 Isolamento Multi-Tenant no SQLite
* **Contexto:** Quando o app faz o *Pull Sync* para puxar usinas e leituras da nuvem para o SQLite local, como evitamos puxar o banco inteiro do Brasil para o celular?
* **Decisão:** **Pull Sync estritamente isolado por `empresa_id`.**
* **Justificativa:** O frontend só solicita as tabelas filtradas pelo `empresa_id` do usuário logado. Além de poupar dados e armazenamento do aparelho, impede o vazamento de dados corporativos (Mesmo com o Supabase RLS já garantindo a barreira de segurança na nuvem).

### 5.7 Invariantes de Domínio vs Validação de Interface
* **Contexto:** Formulários vão usar Zod para validação. Precisamos de validação dupla?
* **Decisão:** **Zod para UX Rápida + Invariantes para Segurança do Core.**
* **Justificativa:** O Zod vai na camada de Apresentação/Aplicação para dar *feedback* rápido na tela. Porém, as classes da camada de Domínio (`Leitura`, `Usina`) devem manter suas regras rigorosamente fechadas (`Invariantes`). Se algum dado passar quebrado pelo Zod, o Domínio levanta uma exceção fatal, barrando a corrupção do banco local.
