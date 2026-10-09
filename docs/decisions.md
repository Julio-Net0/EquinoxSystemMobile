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

### 1.3 Primeiro Acesso e Inicialização (Cold Start)
* **Contexto:** Após instalar o aplicativo, o técnico precisa das informações iniciais (empresas, usinas) para poder trabalhar offline.
* **Decisão:** **Conectividade mandatória no primeiro acesso.**
* **Justificativa:** O primeiro login pós-instalação exige conexão com a internet para gerar a sessão (JWT), configurar o `expo-secure-store` e realizar o *Pull Sync* inicial, populando o SQLite com o catálogo necessário para o trabalho em campo. Apenas os acessos subsequentes estarão liberados para o modo 100% offline.

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

### 2.3 Resolução de Conflitos (Merge Automático)
* **Contexto:** Se múltiplos dispositivos enviarem leituras duplicadas para a mesma usina ou houver colisão de transações na nuvem, como o sistema resolve?
* **Decisão:** **Estratégia "Last Write Wins" (Última Escrita Vence) sem bloqueio de UI.**
* **Justificativa:** Delegar a resolução de conflitos a técnicos leigos através de pop-ups ("Qual versão manter?") gera confusão. O backend no Supabase ou o App avaliará o carimbo de data/hora (`data_hora`) da medição e salvará automaticamente a mais recente. O técnico será avisado por uma simples Notificação Local, mantendo a experiência fluida e 100% autônoma.

### 2.4 Evolução do Esquema Local (SQLite Migrations)
* **Contexto:** Como atualizar a estrutura de tabelas no celular do técnico quando uma nova versão do app for lançada, sem perder os dados não sincronizados?
* **Decisão:** **Uso de scripts de migração versionados na inicialização.**
* **Justificativa:** Diferente do Supabase que usa CLI e migrações no servidor, o SQLite requer que cada dispositivo atualize seu esquema. Será adotado um sistema de controle de versão de banco de dados (ex: `drizzle-orm` local ou `expo-sqlite` pragma `user_version`) para rodar scripts de migração sequenciais na inicialização do aplicativo (Splash Screen), garantindo a integridade dos dados existentes antes de abrir a UI.

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
* **Contexto:** O token JWT de login no Supabase tem tempo de expiração, e estendê-lo infinitamente abre brechas de segurança. Porém, o técnico pode precisar abrir o app no meio do campo após dias sem sinal.
* **Decisão:** **Cofre Local (PIN / Biometria) via `expo-secure-store`.**
* **Justificativa:** Para manter a usabilidade offline sem comprometer a segurança da API na nuvem, o aplicativo solicitará a criação de um PIN de Acesso Local (ou Biometria, como Digital/FaceID) salvo criptografado no cofre do SO. Quando offline, o login ocorre validando este PIN local, liberando a UI e o SQLite e ignorando o JWT expirado. Ao restabelecer a internet, o SyncManager tenta renovar o JWT automaticamente em background ou solicita um novo login web, garantindo acesso perpétuo às ferramentas de campo.

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

### 4.5 Observabilidade e Monitoramento de Erros
* **Contexto:** Sendo um app offline, não podemos depender do console para depurar erros que ocorrem no meio rural. Erros silenciosos corrompem a experiência.
* **Decisão:** **Uso do Sentry (Crashlytics).**
* **Justificativa:** O Sentry captura *stack traces* e eventos de erros (inclusive no processamento da `action_queue`). Quando offline, o SDK do Sentry armazena os relatórios em disco; ao reconectar, envia os relatórios automaticamente, permitindo diagnóstico remoto para os desenvolvedores.

### 4.6 Pipeline de Build e Distribuição (CI/CD)
* **Contexto:** Como gerar builds (APK/AAB/IPA) e enviar correções rápidas para a frota de técnicos em campo?
* **Decisão:** **Ecossistema EAS (Expo Application Services).**
* **Justificativa:** O projeto usará o **EAS Build** para geração de binários em nuvem e o **EAS Update** para enviar atualizações *Over-The-Air* (OTA) para pequenas correções de JS/regras de negócio, sem precisar passar pelo processo demorado de aprovação nas lojas de aplicativos (Play Store / App Store).

### 4.7 Governança e Papel Arquitetural dos Custom Hooks
* **Contexto:** Como conectar as telas do Expo Router aos Casos de Uso (Application Layer) e APIs de sensores (Infrastructure Layer) sem acoplar JSX a regras de negócio ou chamadas de hardware?
* **Opções Consideradas:**
    1. Executar Casos de Uso e chamadas de SQLite/Câmera diretamente dentro dos componentes visuais (inline nos botões).
    2. Adotar Custom Hooks padronizados atuando como Controladores / ViewModels da camada de Apresentação.
* **Decisão:** **Opção 2 (Custom Hooks como Controladores / ViewModels).**
* **Justificativa:**
    * **Desacoplamento:** Componentes visuais cuidam exclusivamente de renderização e estilização, consumindo funções reativas simples (`registrarLeitura()`, `capturarEComprimirFoto()`, `isOnline`).
    * **Testabilidade:** Os hooks podem ser testados de forma isolada via `@testing-library/react-native` (`renderHook`) com mocks dos Casos de Uso, sem necessidade de renderizar telas complexas.
    * **Catálogo Formal:** Organização estruturada em 4 grupos em `src/presentation/hooks/` (`context/`, `usecases/`, `hardware/`, `utils/`), detalhados formalmente em `docs/hooks.md`.

---

## 5. Tratamento de Edge Cases e Comportamentos Específicos

### 5.1 Exclusão e Edição de Dados (Soft Delete Offline)
* **Contexto:** Como tratar a deleção e edição de registros no modo offline sem quebrar a sincronização?
* **Decisão:** **Soft Delete (Advanced CRUD) Universal com Suporte Offline.**
* **Justificativa:** Nunca faremos exclusões físicas (Hard Delete) via app. Registros são apenas inativados (ex: `status = 'Inativa'`). Para suportar edição e exclusão de usinas de forma offline, inserimos tipos de ações adicionais na tabela `action_queue` local, como `UPDATE_USINA` e `DELETE_USINA` (que apenas mudará o status e registrará a data de desativação), mantendo a capacidade de os técnicos continuarem o gerenciamento em campo.

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

### 5.8 Política de Expurgo de Dados (Data Retention)
* **Contexto:** Com o uso frequente, a base local (SQLite) armazenará grande volume de registros e fotos (cache) de leituras sincronizadas, ocupando memória do dispositivo do usuário.
* **Decisão:** **Limpeza Automática de Registros Antigos (30 Dias).**
* **Justificativa:** Para economizar espaço, o app rodará rotinas periódicas em background (ou na inicialização) que removerão permanentemente fotos do FileSystem e registros da tabela `leituras` onde `status = Sincronizada` E `data_hora < (Hoje - 30 dias)`.

### 5.9 Recuperação e Reset de Senha
* **Contexto:** O técnico pode esquecer sua senha. Como resolver isso de forma compatível com o ambiente de campo?
* **Decisão:** **Abordagem Híbrida: Auto-Reset (Online) e Reset Administrativo (Online).**
* **Justificativa:** Por questões de segurança, a redefinição de senhas exige internet. O usuário terá a opção tradicional "Esqueci minha senha" (Auto-Reset) e o fluxo via tela de Gestão no App, onde o `Admin` de uma empresa específica pode resetar ou enviar o link forçado para o funcionário, facilitando o uso para técnicos com menor instrução digital.

### 5.10 Infraestrutura do Banco Remoto e DDL (Supabase)
* **Contexto:** Como controlar, versionar e sincronizar as estruturas do banco de dados remoto (Supabase) com a equipe e com o que é esperado pelo app?
* **Decisão:** **Uso Mandatório do Supabase CLI (Migrations em Repositório).**
* **Justificativa:** As definições de Tabelas, Índices, Triggers e principalmente as políticas de Row Level Security (RLS) não devem ser feitas manualmente no painel web. Utilizaremos migrations `.sql` armazenadas na pasta `supabase/migrations/` como Fonte Única da Verdade para a infraestrutura, facilitando a replicação para ambientes de `staging` e `produção`.

### 5.11 Resolução de Conflito em Soft Delete Remoto
* **Contexto:** Um Admin inativa uma Usina via App, mas o Técnico offline tenta registrar uma leitura para essa Usina no mesmo período.
* **Decisão:** **Registro como "Rejeitada" e Alerta Visual.**
* **Justificativa:** O backend não pode aceitar novas leituras atreladas a uma entidade desativada no momento do processamento. O Supabase deve retornar um erro 409 ou similar, e o App marcará o status local da leitura como `Rejeitada`, notificando o Técnico de que a medição não é mais válida.

### 5.12 Permissões Críticas de Hardware Negadas
* **Contexto:** O Técnico se recusa ou nega permanentemente a permissão de Câmera ou Localização.
* **Decisão:** **Bloqueio de Funcionalidade Direcionado (Fallback UI).**
* **Justificativa:** A foto é pré-requisito rígido para auditoria. Caso negado, o fluxo da Nova Leitura exibe uma *Fallback UI* (tela de bloqueio interativa) instruindo e fornecendo um botão direto para as Configurações do SO (`Linking.openSettings()`). A medição não pode ser iniciada sem estas permissões.

---

## 6. Implementação Completa das Telas por Papel de Acesso (User, Admin e SuperAdmin)

### 6.1 Consolidação dos Perfis e Adaptabilidade Visual do Protótipo
* **Contexto:** O sistema demandava finalizar todas as interfaces móveis adaptando a experiência visual demonstrada no protótipo `example/Equinox.MOBILE` para React Native e Expo SDK 57.
* **Opções Consideradas:**
  1. Utilizar utilitários ad-hoc de terceiros ou bibliotecas genéricas sem padrão visual unificado.
  2. Construir um Design System Solar Dark Mode nativo via React Native `StyleSheet` ancorado no `theme.ts` centralizado e estruturado por Clean Architecture + DDD.
* **Decisão:** **Opção 2 (Design System Solar Dark Mode + Clean Architecture).**
* **Justificativa:** Garante alta fidelidade estética ao protótipo de referência com performance nativa superior (Slate Obsidian `#0F172A`, Solar Gold `#F9A825`, Surface Containers `#1E293B`), desacoplando completamente as telas da camada de infraestrutura e viabilizando validação TDD prévia.

### 6.2 Mapeamento de Casos de Uso e Telas Desenvolvidas

| Rota / Arquivo | Componente de Tela | Papéis Autorizados | Funcionalidade e Casos de Uso |
|:---|:---|:---|:---|
| `src/app/login.tsx` | `LoginScreen` | Público | Autenticação online, acesso por PIN local (offline) e atalho para pré-cadastro. |
| `src/app/cadastro.tsx` | `CadastroScreen` | Público | Cadastro em 2 etapas com busca de empresa em modal e registro de status `Pendente` (`CadastrarUsuarioPendenteUseCase`). |
| `src/app/(tabs)/dashboard.tsx` | `DashboardScreen` | Técnico, Admin, SuperAdmin | Dashboard com métricas visuais, contagem da `action_queue`, banner de conectividade e ações rápidas. |
| `src/app/leitura/nova.tsx` | `NovaLeituraScreen` | Técnico, Admin, SuperAdmin | Leitura de medidor em kWh com foto nativa (`expo-camera`), compressão JPEG (~300KB), GPS (`expo-location`) e Fallback UI para permissões. |
| `src/app/(tabs)/usinas.tsx` | `ListaUsinasScreen` | Técnico, Admin, SuperAdmin | Catálogo offline de usinas com busca, filtro e cadastro emergencial em campo (status `Em Comissionamento`). |
| `src/app/(tabs)/perfil.tsx` | `PerfilScreen` | Técnico, Admin, SuperAdmin | Avatar com iniciais, dados pessoais, badge do perfil, alteração de senha e encerramento de sessão. |
| `src/app/(tabs)/admin.tsx` | `AdminHubScreen` | Admin, SuperAdmin | Hub do Painel Administrativo com atalhos para Autorizações, Usuários, Estrutura, Notificações e Empresas. |
| `src/app/admin/autorizacoes.tsx` | `AutorizacoesPendentesScreen` | Admin, SuperAdmin | Gestão de solicitações pendentes: atribuição de nível de acesso (Técnico/Admin/SuperAdmin) e vinculo multi-select de usinas (`AutorizarUsuarioUseCase`). |
| `src/app/admin/usuarios.tsx` | `GestaoUsuariosScreen` | Admin, SuperAdmin | Gestão de integrantes da empresa: busca por texto, filtro por status, ativação/desativação e exclusão (`GerenciarUsuariosEmpresaUseCase`). |
| `src/app/admin/estrutura.tsx` | `GestaoEstruturaScreen` | Admin, SuperAdmin | Cadastro e manutenção de Usinas/Endereços da empresa e inclusão de padrões de medidores (CEMIG/Energisa, multiplicadores). |
| `src/app/admin/notificacoes.tsx` | `CentralNotificacoesAdminScreen` | Admin, SuperAdmin | Central de alertas administrativos: leituras atrasadas, resoluções de conflitos (Last Write Wins) e medições menores que a anterior. |
| `src/app/admin/empresas.tsx` | `GestaoEmpresasScreen` | SuperAdmin (Exclusivo) | Visão Multi-Tenant global da plataforma: listagem, busca e cadastro de novas Empresas/Tenants clientes com validação de CNPJ (`GerenciarEmpresasUseCase`). |

### 6.3 Garantia de Cobertura e Qualidade (TDD)
* **Resultado:** Todas as entidades e casos de uso associados aos fluxos das telas foram testados unitariamente utilizando repositórios em memória (`src/infrastructure/fakes/`). A suíte de testes passou com **19 test suites e 54 unit tests executados com 100% de sucesso**.

---

## 7. Backend Cloud Supabase & Row Level Security (Fase 4)

### 7.1 Cliente Supabase API Singleton (`supabaseClient.ts`)
* **Contexto:** Necessidade de comunicação reativa e segura com as APIs REST/Realtime e Auth do Supabase no ambiente React Native.
* **Decisão:** **Inicialização de cliente singleton via `getSupabaseClient()` em `src/infrastructure/database/supabase/supabaseClient.ts`.**
* **Justificativa:** Centraliza o tratamento de variáveis de ambiente (`EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`), desativa a persistência padrão do SDK (`persistSession: false`) para evitar concorrência com o `SessionStorageSecureStore` do app, e oferece fallback transparente para execução de testes unitários isolados sob Node.js/Jest.

### 7.2 Migrações SQL Remotas e Isolamento Multi-Tenant (`001_initial_supabase_rls.sql`)
* **Contexto:** Garantir que empresas (Tenants) concorrentes não acessem dados umas das outras na nuvem e que técnicos tenham permissões estritas de inserção.
* **Decisão:** **Uso de scripts SQL versionados em `supabase/migrations/` com Row Level Security (RLS) obrigatório.**
* **Justificativa:**
  * Habilitação de `ENABLE ROW LEVEL SECURITY` em todas as tabelas PostgreSQL (`empresas`, `usuarios`, `usinas`, `leituras`).
  * Políticas de isolamento baseadas no claim JWT `empresa_id` e no papel `perfil` (`SuperAdmin`, `Admin`, `Leitor`).
  * `SuperAdmin` possui visão global cross-tenant; Admins e Leitores ficam estritamente limitados ao `empresa_id` correspondente.

### 7.3 Gateways Concretos e Tolerância a Desconexões (`SupabaseGateways`)
* **Contexto:** Integrar o envio e recebimento de dados remotos sem bloquear o aplicativo em ambientes sem sinal de celular.
* **Decisão:** **Implementação dos Gateways Concretos (`SupabaseStorageGateway`, `SupabaseAuthGateway`, `SupabaseDatabaseGateway`) com padrão `comTimeout`.**
* **Justificativa:** 
  * `SupabaseStorageGateway`: Realiza upload de imagens array buffer para o bucket `comprovantes` com estrutura `{empresa_id}/{usina_id}/{leitura_id}.jpg` e URL pública formatada.
  * `SupabaseAuthGateway`: Valida credenciais e obtém perfis estendidos no banco remoto.
  * `SupabaseDatabaseGateway`: Implementa a interface `IRemoteDatabaseGateway` para operações de push/pull delta de leituras, usinas, usuários e empresas com proteção `comTimeout` de 300ms, assegurando que o app responda instantaneamente em modo offline sem travar nem falhar a suíte de testes (25 test suites e 73 testes unitários com 100% de sucesso).

---

## 8. Testes de UI & Observabilidade Sentry (Fase 5)

### 8.1 Gerenciador de Crash Reporting Offline-First (`CrashReporterManager.ts`)
* **Contexto:** Necessidade de capturar exceções não tratadas em campo e rastrear bugs sem depender de conexões contínuas.
* **Decisão:** **Implementação do `CrashReporterManager.ts` em `src/infrastructure/monitoring/`.**
* **Justificativa:** Centraliza o registro de erros, vinculação de contexto de usuário (sem dados PII sensíveis) e mantém um buffer de logs locais em memória. Quando houver o DSN do Sentry configurado e conectividade ativa, faz o envio automático dos relatórios de exceção.

### 8.2 Suíte de Testes de Componentes Visuais (`tests/component/`)
* **Contexto:** Validar a renderização, os fluxos de navegação e as interações dos componentes visuais do ecossistema React Native.
* **Decisão:** **Adopção de testes de componentes integrados via `@testing-library/react-native`.**
* **Justificativa:** Foram criadas suítes de testes de componentes cobrindo `LoginScreen.spec.tsx`, `DashboardScreen.spec.tsx`, `AutorizacoesPendentesScreen.spec.tsx` e `GestaoEmpresasScreen.spec.tsx`. A suíte completa expandiu para **30 test suites e 80 testes unitários/componentes 100% aprovados**.



