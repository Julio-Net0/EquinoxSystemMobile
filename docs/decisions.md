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

---

## 9. Reconstrução Offline-First sobre o Modelo do App Legado (Fase 6)

Esta fase reescreve o app para rodar **100% local**, sem Supabase e sem
sincronização, portando as nove telas do app em produção
(`example/Equinox.MOBILE`, Tauri + Vite + IndexedDB) e mantendo as duas
features que ele não tinha: foto comprobatória do medidor e GPS.

As decisões abaixo substituem, onde houver conflito, as das seções 5, 7 e 8.

### 9.1 Adoção do Modelo de Domínio do Legado

**Contexto.** O domínio desta base era `Empresa -> Usina (codigoUC,
capacidadeNominal, coordenadas) -> Leitura (valorKwh)`. O app em produção usa
`Empresa -> Endereco (ehUsina, uc, logradouro) -> PadraoCemig -> Leitura
(consumo 003 + injecao 103)`. As telas de Estrutura, Leitura de Padrão e
Usuários do legado não têm equivalente no modelo antigo: não existia o conceito
de padrão de medição, que é a unidade real de leitura.

**Opções.** (a) Manter `Usina` e adaptar as telas, perdendo padrões e leitura
de injeção. (b) Manter `Usina` e pendurar `Padrao` embaixo, convivendo com dois
conceitos sobrepostos. (c) Adotar o modelo do legado e aposentar `Usina`.

**Decisão.** (c). "Usina" passa a ser a flag `ehUsina` do `Endereco`, que é
exatamente o que ela significa no negócio: um endereço que também injeta
energia e por isso exige a leitura do campo 103.

**Consequências.** `Usina`, `StatusUsinaEnum`, `IUsinaRepository`,
`CadastrarUsinaUseCase` e `ConsultarUsinasUseCase` foram removidos. Entraram
`Endereco`, `PadraoCemig`, `Notificacao` e a tabela N:N `usuario_enderecos`.

### 9.2 Remoção da Nuvem e da Sincronização

> **Revogada pela seção 10.1.** A nuvem voltou, desta vez integrada e testada.

**Decisão.** Supabase (cliente, três gateways e `@supabase/supabase-js`),
`SyncManager`, `NetworkMonitor`, `DataPurgeService` e `CrashReporterManager`
saíram do caminho do app. `@react-native-community/netinfo` não foi instalado.

**Justificativa.** O escopo desta fase é o app funcionando sozinho no aparelho.
Manter um cliente de nuvem configurado com placeholders cria a ilusão de
integração e caminhos de código que ninguém exercita.

**Consequência.** `supabase/migrations/001_initial_supabase_rls.sql` fica no
repositório como referência para quando houver backend. A `action_queue`
continua no schema e com repositório implementado (AGENTS.md seção 6), mas
**nada enfileira hoje**: sem destino remoto ela não tem consumidor.

### 9.3 "Enviar para a Planilha" virou "Aprovar"

**Contexto.** No legado, a decisão do administrador sobre uma leitura em
exceção era enviá-la para uma planilha do Google Sheets.

**Decisão.** A decisão passa a ser `aprovar` / `descartar`, gravada localmente.

**Justificativa.** Offline não existe planilha. Um botão "Enviar para a
planilha" prometeria algo que não acontece.

**Consequência.** `StatusLeituraEnum` usa `registrada | aprovada | substituida
| descartada`. O conflito entre administradores do legado (HTTP 409) não
existe: com um banco por aparelho não há decisão concorrente. O que a entidade
protege é o duplo toque.

### 9.4 Localização é Prova de Apoio, não Condição

**Contexto.** `ValidadorDistanciaGpsService` existia desde a fase 2 e **nunca
era chamado**. A regra prevista era raio de 500 m.

**Decisão.** A regra passa a ser aplicada, via
`RegraLocalizacaoLeituraService`, mas **nenhuma situação impede o registro**:

| Situação | Comportamento |
|---|---|
| Dentro do raio | grava |
| Fora do raio | grava e gera `LEITURA_FORA_DE_RAIO` |
| Endereço sem coordenada | não confere nada |
| GPS negado ou sem resposta em 10s | grava sem coordenadas e gera `LEITURA_SEM_GPS` |

**Justificativa.** GPS falha de verdade em casa de medidor, garagem e subsolo.
Bloquear a leitura deixaria o técnico sem saída no local, e a foto já é o
comprovante do valor. A divergência vira trabalho do administrador, não do
técnico em campo.

**Consequência.** `Leitura.coordenadas` é opcional; `fotoLocalUri` não é.

### 9.5 Hash de Senha sem KDF — Dívida Consciente

**Contexto.** A autenticação passou a ser local e exige verificar senha.
`expo-crypto` oferece SHA-256/512 e bytes aleatórios, **não** PBKDF2, scrypt
nem Argon2. Cada `digestStringAsync` é uma chamada à camada nativa.

**Opções.** (a) Encadear as centenas de milhares de iterações de um KDF, o que
travaria o login por vários segundos. (b) Adicionar uma dependência nativa de
cripto. (c) SHA-256 encadeado com salt e um número modesto de iterações.

**Decisão.** (c), com 1000 iterações e salt de 16 bytes
(`HashSenhaExpoCrypto`). A verificação usa as iterações **gravadas no hash**,
não as atuais, para um usuário criado numa versão anterior continuar
autenticando.

**Consequência — risco aceito.** Se o arquivo do banco for extraído do
aparelho, estas senhas resistem muito menos a força bruta offline do que
resistiriam com bcrypt ou Argon2id. É aceitável para um app de demonstração com
dados locais e **não é aceitável em produção**: a troca por um KDF nativo é
pré-requisito de qualquer uso real.

### 9.6 Formatação pt-BR Feita à Mão

**Decisão.** `FormatadorKwh` implementa a formatação de número, kWh e distância
sem `Intl`.

**Justificativa.** O Hermes não garante ICU completo. `Intl.NumberFormat`
poderia devolver `1234.56` no aparelho e `1.234,56` no Node dos testes — e os
textos de aviso de leitura são comparados em teste e mostrados ao técnico.

### 9.7 Migrações Versionadas por `PRAGMA user_version`

**Decisão.** O runner (`migrar.ts`) compara a lista de migrações com o
`PRAGMA user_version` do banco. Cada migração roda na própria transação
exclusiva e a versão só avança **depois** do commit.

**Justificativa.** O runner anterior executava um bloco único de
`CREATE TABLE IF NOT EXISTS` e nunca era chamado pelo app. Com `IF NOT EXISTS`,
um schema desatualizado passa calado e o erro aparece numa consulta, muito
depois.

**Consequências.** Os `PRAGMA journal_mode` e `foreign_keys` saíram do DDL para
o runner: o primeiro não roda dentro de transação e o segundo é por conexão. O
seed é a migração 2, separada do schema, e recebe o gateway de hash porque as
senhas demo precisam ser calculadas.

### 9.8 Uma Leitura Vigente por Padrão por Dia Local

**Decisão.** Índice parcial único
`idx_leituras_vigente_dia ON leituras(padrao_id, data_local) WHERE status IN
('registrada', 'aprovada')`, com `DataLocal` (UTC-3 fixo) como chave do dia.

**Consequência operacional.** A substituição é `UPDATE` da vigente **antes** do
`INSERT` da nova, na mesma transação (`salvarSubstituindo`). A ordem inversa
falha sempre, porque o índice recusaria duas vigentes.

### 9.9 Fim do Fallback Silencioso em Memória

**Contexto.** `SQLiteDatabaseManager.getDatabase()` devolvia `null` em qualquer
falha e cada repositório caía calado num dublê em memória.

**Decisão.** Ambos removidos. Os repositórios recebem o handle do banco por
injeção e propagam erro; os dublês continuam existindo, mas **só os testes os
injetam**.

**Justificativa.** Foi esse fallback que escondeu por toda a fase anterior o
fato de `expo-sqlite` nunca ter sido instalado: a suíte passava, o app parecia
funcionar, e nada era persistido.

### 9.10 Raiz de Composição Única

**Contexto.** A fiação estava em três lugares: props do layout, `useMemo` em
arquivo de rota e **singletons no escopo do módulo das telas**. Cada tela tinha
um armazenamento isolado — um usuário cadastrado em `/cadastro` nunca aparecia
em `/admin/autorizacoes`.

**Decisão.** `Container` + `montarCasos`, compartilhada entre
`criarContainerSQLite` e `criarContainerFake`, entregue às telas por
`ContainerProvider`. Dois testes de arquitetura verificam a regra: o domínio
não importa biblioteca de terceiros, e nenhuma tela monta dependências.

### 9.11 Testes: Quatro Projetos Jest, um Transform Só

**Decisão.** Quatro projetos, todos com o preset `jest-expo`: `dominio`
(domínio, aplicação e arquitetura, em `testEnvironment: 'node'`), `infra`,
`integracao` e `ui`.

**Contexto da revisão.** A primeira versão usava `ts-jest` em `dominio` e
`jest-expo` nos outros, pela economia do transform de RN nos testes puros.
Isso criou um problema que só apareceu na medição de cobertura: um arquivo
carregado por dois projetos era instrumentado duas vezes, com mapas de
statements diferentes, e o merge do istanbul somava os dois mapas como se
fossem o mesmo. O efeito era grande — a camada de aplicação aparecia com 78%
quando medida junto e 93% quando medida só pelo projeto `dominio`.

**Justificativa.** Um número de cobertura que muda conforme o conjunto de
projetos que roda não serve para decidir nada. Vale mais ter a medição
confiável do que economizar alguns segundos no transform (a suíte inteira roda
em ~8 s de qualquer forma). O `coverageProvider: 'v8'` foi avaliado e
descartado: ele mapeia de volta para o TypeScript original e conta interfaces,
tipos e comentários como código não coberto — `ILeituraRepository.ts`, que não
gera uma linha de JS, aparecia com 0%.

**Consequência.** `dominio` perde a checagem de tipos que o `ts-jest` fazia
durante a execução dos testes. Quem checa tipos passa a ser só o
`npx tsc --noEmit` do gate — que já era obrigatório, porque `jest-expo`
transpila com Babel e **não checa tipos** em nenhum projeto.

**Dublês fora da medição.** `src/infrastructure/fakes/**` está excluído de
`collectCoverageFrom`: são dublês de teste, e medi-los inflava o denominador
com métodos que nenhum caso de uso chama.

### 9.12 Testes de Integração com SQLite de Verdade

**Contexto.** Os sete repositórios SQLite, o container de produção, o
diagnóstico e o seed não tinham teste nenhum — cobertura de 2% a 20%. A razão
era estrutural: `expo-sqlite` não roda em Node (no aparelho é módulo nativo, na
web é wa-sqlite dentro de um Web Worker), então nada exercitava SQL fora do
celular. Foi essa cegueira que deixou passar o deadlock de transação aninhada e
o `getValueWithKeyAsync is not a function` da sessão na web.

**Decisão.** Um adaptador de teste (`tests/helpers/bancoDeTeste.ts`) sobre o
**`node:sqlite`**, o SQLite embutido na runtime do Node, traduzindo a API
síncrona dele para a assíncrona do `expo-sqlite`. O projeto `integracao` roda
os repositórios, as migrações e o seed contra um banco `:memory:` real.

**Justificativa.** O SQL, os tipos, os CHECK, as chaves estrangeiras e o índice
parcial são os mesmos do aparelho, então o teste verifica o schema publicado e
não um dublê dele. Sem dependência nova: `better-sqlite3` exigiria um módulo
nativo com prebuild por plataforma, e o `node:sqlite` já vem na runtime.

**Limite.** O adaptador traduz `BEGIN IMMEDIATE` para
`withExclusiveTransactionAsync` e falha alto se algo tentar aninhar transação —
de propósito, porque tolerar aninhamento no teste esconderia justamente o bug
que o `emTransacao` resolve. O que ele não cobre é o comportamento do driver
nativo em si (WAL em arquivo, concorrência entre conexões), que continua só
verificável no aparelho.

### 9.13 Guardas de Rota

**Contexto.** Não havia guarda nenhuma: `/(tabs)/admin` e `/admin/empresas`
abriam sem login, bastando o link.

**Decisão.** `(app)/_layout.tsx` barra quem não tem sessão;
`(app)/admin/_layout.tsx` barra perfil abaixo de Administrador. Os dois usam
`<Redirect>` declarativo, não `router.replace` em efeito, para a tela protegida
não aparecer por um instante.

**Escopo de dados** não é guarda de rota: continua nos casos de uso, que
recebem o ator da sessão e aplicam `RegraAutorizacaoUsuarioService`.


### 9.14 Migração para o Expo SDK 58 (Compatibilidade com o Expo Go)

**Contexto.** A Play Store e a App Store atualizaram o aplicativo **Expo Go**
para a **SDK 58**, recusando a abertura de projetos em SDK 57 com a mensagem
`The installed version of Expo Go is for SDK 58. The project you opened uses SDK 57`.

**Opções.** (a) Exigir sideload de APK antigo do Expo Go SDK 57 em cada aparelho.
(b) Atualizar o projeto e todos os pacotes nativos para as versões homologadas da
**Expo SDK 58** (`expo ~58.0.22`, `react-native 0.88.1`, `react 19.3.0`,
`expo-router ~58.0.29`, `expo-sqlite ~58.0.15`, `expo-camera ~58.0.14`,
`expo-location ~58.0.20`, `expo-image-manipulator ~58.0.16`, `jest-expo ~58.0.13`)
e revalidar 100% da suíte automatizada e tipagem estrita.

**Decisão.** (b). Todos os pacotes foram atualizados para as versões oficiais da
SDK 58 e validados com `npx tsc --noEmit` e as 54 suítes de testes (765 testes).

**Justificativa.** Permite testar imediatamente o aplicativo na versão atual do
Expo Go distribuída nas lojas oficiais sem necessidade de instalar APKs antigos
ou desabilitar atualizações automáticas nos aparelhos da equipe e da banca.

### 9.15 Tela de Monitoramento Diário de Usinas e Medidores (Admin e SuperAdmin)

**Contexto.** Administradores e SuperAdmins necessitavam de uma visão analítica
centralizada para acompanhar todas as leituras de um determinado dia em uma usina
específica. Essa visão precisava detalhar o estado de cada medidor (padrão) da usina
(lido ou pendente), permitir inspecionar o histórico de substituições no dia caso
tenha ocorrido releitura (last-write-wins), e alertar visualmente quando o valor
registrado estivesse fora do padrão histórico (anomalia de valor menor que a leitura
anterior acumulada).

**Opções Consideradas.**
1. Adicionar filtros complexos na tela de catálogo geral de leituras.
2. Criar caso de uso e tela dedicada (`ConsultarLeiturasDiaUsinaUseCase` + `LeiturasUsinaScreen`),
   protegida no escopo de administração (`/admin/leituras-usina`), permitindo seleção rápida
   de usinas, navegação de datas dia a dia, estatísticas consolidadas (KPIs), acordeão para
   substituições diárias e exibição explícita do aviso de valor menor baseado em
   `AvisoValorMenorService` e `ReferenciaLeituraService`.

**Decisão.** **Opção 2.**

**Justificativa e Consequências.**
* **Isolamento de Escopo e Segurança:** A rota `(app)/admin/leituras-usina` é resguardada
  pela guarda de papel (`nivelDe >= 2`), impedindo acesso de Técnicos. No caso de uso,
  o `Admin` vê estritamente as usinas da sua empresa, enquanto o `SuperAdmin` possui visão
  global de todas as usinas cadastradas.
* **Transparência Operacional:** A interface destaca os valores vigentes de consumo (003)
  e injeção (103), dados do autor e horário, além de indicar no rodapé a integridade da
  localização e foto.
* **Inspeção de Substituições:** Caso um padrão tenha sido relido no mesmo dia, a leitura
  antiga é preservada com status `substituida` e pode ser expandida pelo administrador
  para auditoria completa.
* **Alerta de Histórico Integrado:** Se a medição for menor que o valor acumulado anterior,
  o card do medidor exibe um alerta contextual explicando a divergência com base nas regras
  já consolidadas no domínio.
* **Qualidade e TDD:** Implementado seguindo o ciclo Red-Green-Refactor, com cobertura de
  testes unitários no caso de uso (`ConsultarLeiturasDiaUsinaUseCase.spec.ts`) e testes de
  componentes no padrão Testing Library (`LeiturasUsinaScreen.spec.tsx`), elevando a suíte
  para 56 test suites (790 testes) e cobertura acima de 98%.
* **Fluxo Otimizado & Calendário Mensal com Indicadores:**
  Ao acessar, o usuário visualiza as usinas disponíveis em formato de cartões limpos e, ao
  tocar em uma delas, abre automaticamente as leituras do dia atual. Caso queira consultar
  outra data, ao tocar na barra de data abre-se um modal com o calendário mensal da usina,
  onde os dias que possuem leituras registradas são sinalizados visualmente com pontos indicadores,
  permitindo ao administrador auditar qualquer dia do histórico com um único toque.


---

## 10. Nuvem de Volta: Offline-First com Supabase (Fase 7)

Esta fase traz de volta a nuvem que a seção 9.2 removeu — agora integrada de
ponta a ponta e verificada por teste. Onde houver conflito, as decisões abaixo
substituem as das seções 2, 3.2, 4.5, 4.6, 5 e 7, e **revogam a 9.2**.

### 10.1 Reintrodução da Nuvem (revoga 9.2)

**Contexto.** A disciplina exige, demonstrável no app: acesso a WebServices,
autenticação, Context API e uso do `expo-secure-store`. A apresentação precisa
explicar o que é online, o que é offline e como sincroniza. Com o app 100%
local, metade disso não tinha o que mostrar.

**Opções.** (a) Manter o app local e só descrever a nuvem nos slides. (b) Um
backend próprio (API REST). (c) Supabase: Postgres, Auth e Storage gerenciados,
com segurança declarada no próprio banco (RLS).

**Decisão.** (c), com o projeto criado e administrado pelo dono do repositório.
O app recebe só a URL e a chave anônima, por `EXPO_PUBLIC_SUPABASE_URL` e
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (`.env.local`).

**Justificativa.** (a) seria exatamente a "ilusão de integração" que a 9.2
condenou. (b) exigiria escrever, hospedar e proteger uma API inteira. O
Supabase entrega autenticação e armazenamento prontos, e o modelo de segurança
(RLS) fica versionado em SQL no repositório, testável.

**O que a 9.2 ensinou e continua valendo.** Sem as variáveis, o app **não sobe**
com um cliente de mentira: `lerConfiguracaoSupabase` lança
`ConfiguracaoAusenteError` e o `ErrorBoundary` raiz mostra o que falta e como
resolver. Nenhum teste fala com o Supabase real.

### 10.2 Autenticação pelo Supabase Auth e Fim da Senha Local (encerra 9.5)

**Decisão.** Login com e-mail e senha pelo Supabase Auth
(`AutenticacaoSupabase`). O perfil (nível, empresa, endereços, status) vem da
tabela `perfis` do banco remoto. O cadastro cria a identidade no Auth; o perfil
nasce de um gatilho no banco, **sempre** como Técnico e `Pendente`, ignorando o
que o cliente mandar nos metadados.

**Login por nome de usuário: abandonado.** O Auth autentica por e-mail. Manter
o nome de usuário exigiria traduzir nome → e-mail **antes** do login, ou seja,
uma consulta aberta a anônimos que devolve e-mails — uma porta para descobrir
quais contas existem. O campo `usuario` continua existindo e único, como
apelido. O login recusa texto sem `@` com uma mensagem que explica a mudança.

**Senha local: aposentada.** Nenhuma senha (nem hash) fica no aparelho.
> **Revisto na 10.18:** para permitir entrar sem rede depois de sair, o
> aparelho voltou a guardar, no cofre, uma **verificação PBKDF2** derivada da
> senha (nunca a senha), por conta. A tabela `usuarios.senha_hash` continua
> vazia; a verificação não fica no SQLite.
- `HashSenhaExpoCrypto` foi removido, e com ele a dívida de segurança da 9.5.
- A coluna `usuarios.senha_hash` não pode sair: a migração 002 (publicada, não
  editável) a preenche. A **migração 003** a esvazia e o repositório passa a
  gravar sempre `''`.
- A 002 ainda pede um `IHashSenhaGateway`; quem a atende é o
  `HashSenhaAposentado`, que devolve um valor inerte e não deriva nada da senha.
- Trocar a senha é feito na nuvem (`alterarSenha` confere a atual com um novo
  login e grava a nova). O e-mail, por ser a identidade, não é editável no app.

**PIN local (ADR 3.2): não adotado.** A sessão no armazenamento seguro já
libera o uso offline (10.4). Um PIN acrescentaria fricção sem ganho na
demonstração. Os métodos de PIN do `ISessionStorage` seguem sem uso.

### 10.3 Tokens Somente no Armazenamento Seguro, em Partes

**Contexto.** A sessão do Supabase serializada (token de acesso, token de
renovação, dados do usuário) passa de 2 KB. A documentação do
`expo-secure-store` da SDK 58 avisa que algumas versões do iOS recusam valores
acima de ~2048 bytes. A documentação do Supabase para Expo contorna cifrando a
sessão com AES, guardando o texto cifrado no AsyncStorage e só a chave no cofre.

**Opções.** (a) A receita do Supabase (AsyncStorage + `aes-js` + gerador de
aleatórios). (b) Repartir a sessão em vários itens do próprio cofre.

**Decisão.** (b): `CofreSeguroEmPartes`. Partes de até 600 unidades UTF-16
(≤ 1800 bytes em UTF-8), sem nunca partir um par substituto (emoji). Gravação
em duas gerações: as partes novas vão para a geração livre e só então o
ponteiro muda — se o app morrer no meio, a sessão anterior segue inteira.

**Justificativa.** Nada da sessão, nem cifrado, sai do Keychain/Keystore; e são
três dependências a menos. Na web (alvo só de desenvolvimento) a variante
`.web.ts` usa `localStorage`, marcada no código como **não segura**.

**Configuração do cliente** (`clienteSupabase.ts`): `autoRefreshToken: true`,
`persistSession: true`, `detectSessionInUrl: false`; renovação ligada só com o
app em primeiro plano (`AppState`), como o Supabase orienta para React Native.

### 10.4 Divisão Online / Offline

| Operação | Rede | Como |
|---|---|---|
| Primeiro login **de cada conta** no aparelho | **Obrigatória** | Supabase Auth + primeira sincronização antes de liberar a interface |
| Logins seguintes da mesma conta | Não | Verificação PBKDF2 no cofre; entra na nuvem sozinho quando a rede volta (10.18) |
| Cadastro de usuário | **Obrigatória** | Supabase Auth + gatilho cria o perfil |
| Busca de empresas no cadastro | **Obrigatória** | Função `buscar_empresas_cadastro` (só id e nome) |
| Trocar a senha | **Obrigatória** | Supabase Auth |
| Registrar leitura (foto + GPS) | Não | SQLite + fila; sobe depois |
| Decidir leitura, avisos, estrutura, usuários | Não | SQLite + fila (10.6) |
| Telas (consulta) | Não | Sempre o SQLite. Nenhuma tela consulta o Supabase para exibir |
| Ver comprovante feito em outro aparelho | Sim, só nesse caso | URL assinada (10.8); a foto local tem prioridade |

**Login offline.** O `AuthProvider` só lê a sessão do armazenamento seguro, sem
rede: quem já entrou reabre o app autenticado em modo avião, mesmo com o token
de acesso vencido. Com rede, o `SincronizarUseCase` chama `garantirSessao`, que
renova o token. Falha de **rede** na renovação conta como "offline" e não
derruba ninguém; token de renovação **recusado** pelo servidor vira a situação
`reautenticar` — o técnico continua trabalhando, os pendentes ficam guardados e
a tela pede novo login com internet. Logout (`EncerrarSessaoUseCase`) apaga a
sessão e os tokens. ~~O próximo login exige rede~~ — revisto na 10.18: quem já
entrou com internet neste aparelho pode entrar de novo sem rede. A fila **não**
é apagada no logout, e o Perfil avisa antes quantos itens ainda não subiram.

### 10.5 Metodologia de Sincronização

**Push — fila de envio transacional (outbox).**
- Toda escrita local que precisa chegar à nuvem deixa um item na
  `action_queue` **na mesma transação** (`IUnidadeDeTrabalho` /
  `UnidadeDeTrabalhoSQLite`). Quem faz isso é o decorador
  `repositoriosComFila`: os casos de uso continuam chamando
  `leituraRepo.salvar()` e recebem, sem saber, um repositório que salva e
  enfileira. Os tipos foram refeitos para o modelo atual (`UPSERT_LEITURA`,
  `UPSERT_ENDERECO`, `EXCLUIR_PADRAO`… — nada de `INSERT_USINA`).
- O item guarda **só o id**. No envio, o processador lê o estado atual do
  SQLite: uma leitura decidida depois de enfileirada sobe já decidida.
- `ProcessarFilaSincronizacaoUseCase`, em ordem de criação:
  1. **Foto antes da linha** (ADR 5.5): o comprovante sobe para o Storage
     (`{empresa}/{endereco}/{leitura}.jpg`) e só depois a leitura. Se a rede
     cair no meio, sobra uma foto órfã, nunca uma leitura sem comprovante.
  2. **Idempotência**: upload que já existe conta como sucesso; a leitura sobe
     pela função `sincronizar_leitura` (upsert pelo UUID); estrutura e
     usuários por upsert pelo id. O item só sai da fila após a confirmação.
  3. **Rede não é culpa do dado**: sem conexão ou sem sessão a rodada para e
     nada conta como tentativa.
  4. **Isolamento**: só a recusa do servidor conta tentativa. Após 5
     (`ActionQueueItem.MAX_TENTATIVAS`) o item sai do caminho, a leitura fica
     `falhou` ("Não enviada") e a fila segue. A tela mostra o motivo em
     português e oferece "Tentar de novo".
- A confirmação do envio é gravada pelo repositório **cru** — senão geraria
  outro envio, para sempre.

**Pull — incremental, restrito ao que o usuário pode ver.**
- Toda tabela remota tem `atualizado_em`, carimbado por gatilho com o relógio
  **do servidor** (`clock_timestamp()`). Relógio de aparelho não serve de
  cursor.
- O aparelho guarda um cursor por tabela em `sync_meta` (tabela nova) e pede só
  o que veio depois. O cursor é guardado como o servidor o mandou (com
  microssegundos), para não repetir nem pular linhas.
- Quem filtra é o RLS: o app não pede "dados da empresa X", pede "o que mudou".
- Pacote e cursores são gravados **numa transação só**: cursor adiantado sem os
  dados faria o aparelho pular alterações para sempre.
- **Exclusões**: linha apagada não "muda", some. Gatilhos gravam lápides em
  `exclusoes`, que o pull aplica.
- **Escopo mudou** (vínculo novo, outro nível): linhas antigas que só agora
  ficaram visíveis não têm carimbo novo. O pull detecta, zera os cursores e
  baixa tudo de novo na mesma rodada. Trocar de usuário no aparelho também zera.
- O que vem da nuvem é gravado pelos repositórios crus: não volta para a fila.

**Conflito — última escrita vence, sem perguntar ao técnico.** Dois aparelhos
leram o mesmo padrão no mesmo dia: a `sincronizar_leitura` aplica no servidor a
mesma regra do aparelho (`RegraSubstituicaoLeituraService`): fica vigente a
medida mais tarde, a outra vira `substituida`, e o servidor gera o aviso
`LEITURA_SUBSTITUIDA` para o administrador. No pull, a decisão do servidor
prevalece sobre a cópia local já sincronizada; uma leitura com alteração local
**ainda não enviada** não é sobrescrita — espera o próprio envio.

**Gatilhos.** Ao abrir o app autenticado; quando a conexão volta
(`ConectividadeContext`, NetInfo); pelo botão "Sincronizar agora"; e, de
conveniência, 1,5 s após qualquer escrita local.

### 10.6 Operações Administrativas Pelo Mesmo Caminho

**Opções.** (a) Escrita local + fila, como a leitura. (b) "Exigem conexão".

**Decisão.** (a). Estrutura, autorizações, gestão de usuários, decisão sobre
leitura e notificações gravam no SQLite e enfileiram.

**Justificativa.** O decorador `repositoriosComFila` já cobre todas as escritas:
um caminho só é mais simples de testar e de explicar. E o administrador também
vai a campo.

**Consequências.** A autoridade final é o servidor: uma operação que o RLS ou os
gatilhos recusam (ex.: administrador tentando promover alguém a nível 3) vira
item recusado com motivo legível e, após 5 recusas, fica isolada. Perfil e
vínculos sobem juntos pela função `sincronizar_perfil` (SECURITY INVOKER: valem
o RLS e o gatilho `proteger_perfil`). Excluir usuário apaga o **perfil**; a
identidade no Auth fica, sem acesso a nada (apagar conta do Auth exige a
`service_role`, que não pode estar no app).

### 10.7 Notificações em Mais de Um Aparelho

**Problema.** As notificações nascem no aparelho de quem registra a leitura.
O administrador está em outro aparelho.

**Decisão.** Elas sincronizam como qualquer escrita: sobem pela fila
(`UPSERT_NOTIFICACAO`) e descem no pull para quem pode vê-las (administrador e
super admin, pelo RLS). O técnico pode **inserir** aviso da própria empresa mas
não lê-los. O aviso de conflito entre aparelhos é gerado **no servidor**, onde o
conflito é resolvido. A varredura de leituras atrasadas
(`AvaliarLeiturasAtrasadasUseCase`) roda só no aparelho de administrador.

**Limite conhecido.** Dois administradores, cada um em seu aparelho, podem
gerar o aviso de atraso da mesma leitura com ids diferentes antes de
sincronizarem — haverá dois cartões para o mesmo caso. Corrigir exigiria um id
determinístico por (leitura, tipo) ou uma restrição única no banco; ficou
registrado e não foi feito nesta fase.

### 10.8 Modelo de Segurança na Nuvem

- **RLS em todas as tabelas.** Isolamento por empresa e por nível usando
  funções `SECURITY DEFINER` no schema `private` (fora da Data API), que
  consultam `perfis` por `auth.uid()`: `meu_nivel()`, `minha_empresa()`,
  `meus_enderecos()`. Nada depende de claim gravado no JWT — o SQL antigo lia
  `empresa_id` e `perfil` de dentro do token, e nada jamais os gravava. As
  funções leem `perfis` sem passar pelo RLS dela, o que evita a recursão
  infinita (`42P17`) que a documentação do Supabase descreve. Usuário
  `Pendente`, `Recusado` ou `Inativo` tem nível 0 e não lê nada além do
  próprio perfil.
- **Técnico só insere leitura em endereço vinculado e em nome próprio**, na
  política de INSERT e na `sincronizar_leitura`. Empresa e endereço da leitura
  são derivados do padrão por gatilho, nunca aceitos do cliente.
- **Medição imutável.** Gatilho `proteger_leitura`: depois de gravada, só mudam
  status e rastros de decisão/substituição — nem o administrador reescreve o
  valor.
- **Ninguém se promove.** Gatilho `proteger_perfil`: política não enxerga
  coluna; o gatilho decide o que cada nível pode mudar (administrador mexe em
  nível ≤ 2 da própria empresa; só o super admin cria nível 3).
- **Bucket `comprovantes` privado**, só JPEG, até 1 MB. Caminho
  `{empresa}/{endereco}/{leitura}.jpg`; as políticas do Storage conferem o
  prefixo (técnico: só pasta de endereço vinculado). Sem política de UPDATE nem
  DELETE. A exibição usa **URL assinada de 60 s** (`VIDA_DA_URL_ASSINADA`). O SQL
  antigo criava o bucket público.
- **Cadastro sem abrir tabela.** O papel `anon` não tem privilégio em tabela
  nenhuma. A busca de empresas é a função `buscar_empresas_cadastro`, que
  devolve só id e nome.
- **Só a chave anônima no app.** `lerConfiguracaoSupabase` recusa chave
  `service_role` (JWT) e `sb_secret_…`. A `service_role` não aparece no
  repositório.
- **Segredos fora do git.** `.gitignore` passou de `.env*.local` para `.env` e
  `.env.*` (exceto `.env.example`, sem valores).
- **Senhas fora do aparelho** (10.2).

### 10.9 Schema Remoto: Fonte Única e Seed Espelhado

**Decisão.** `supabase/migrations/20261116120000_schema_equinox.sql` é a fonte
única do schema remoto, com as mesmas regras do SQLite — inclusive o índice
parcial único de uma leitura vigente por padrão por dia local e a restrição de
que `data_local` é o dia de Brasília (UTC-3 fixo) de `medido_em`. O
`001_initial_supabase_rls.sql` (modelo de usinas) foi removido;
`docs/design/schema_supabase.sql` passou a apontar para a migração.

`supabase/seed.sql` cria os dados de demonstração com **os mesmos UUIDs** do
seed local: o primeiro pull atualiza em vez de duplicar. Inclui uma
administradora da segunda empresa (`sindica@solardovale.dev`) para demonstrar o
isolamento.

**Limite.** Os dois seeds datam o histórico relativo ao dia em que rodam. Se o
SQL remoto rodar em outro dia, o histórico fica deslocado; o pull realinha o
aparelho à nuvem sem violar a vaga do dia (há teste de integração para isso).
As fotos das leituras do seed não existem no bucket.

### 10.10 Migração Local 003

`003_sincronizacao`: colunas `leituras.foto_remota_path` e `leituras.sync_status`
(`pendente | sincronizada | falhou`), `action_queue.ultimo_erro`, tabela
`sync_meta`, `senha_hash` esvaziada. Leituras do seed local já contam como
sincronizadas; leituras feitas antes da nuvem existir **entram na fila**, em
ordem de medição, para subir no primeiro login online. As migrações 001 e 002
não foram tocadas.

**Detalhe de implementação.** O repositório de leituras insere usando só as
colunas da versão 1 (e grava o estado de sincronização à parte quando ele não é
o padrão), porque a migração 002 grava leituras por ele **antes** de a 003
criar as colunas novas.

### 10.11 Expurgo Respeita a Fila

`PurgarLeiturasAntigasUseCase` só apaga leitura decidida, com mais de 30 dias
**e sincronizada**. A que ainda não subiu existe só no aparelho e fica, tenha a
idade que tiver. A cópia na nuvem não é apagada. As únicas exceções são o
descarte manual de um envio impossível (10.15) e a limpeza do banco local
quando outra pessoa entra com rede e a fila está vazia (10.19).

### 10.12 Testes da Nuvem Sem Rede

- Casos de uso de sincronização: dublês `AutenticacaoRemotaFake`,
  `SincronizacaoRemotaFake`, `ConectividadeFake`, `UnidadeDeTrabalhoMemory` e
  `SyncMetaRepositoryMemory`, todos no `criarContainerFake`.
- Adaptadores Supabase: cliente falso que imita o construtor do PostgREST, o
  Auth e o Storage (`tests/helpers/clienteSupabaseFalso.ts`).
- Fila, migração 003 e pull contra SQLite de verdade (`node:sqlite`).
- **Políticas de segurança** contra um Postgres de verdade embutido
  (**PGlite**, dependência de desenvolvimento): `npm run test:rls` aplica a
  migração e o seed sobre um dublê mínimo de `auth` e `storage`
  (`tests/supabase/preludio.sql`) e age como cada usuário. Fica fora do Jest
  porque o PGlite é ESM com WebAssembly.
- **Limite.** O PGlite não é o Supabase: não exercita o PostgREST, o servidor
  de Auth nem a API do Storage (URL assinada, upload). Isso fica para o roteiro
  manual de `docs/supabase-setup.md`.

### 10.13 Serviços de Nuvem: EAS Build Sim, Sentry Não (revisa 4.5 e 4.6)

**EAS Build** gera o APK de demonstração (`eas.json`, perfil `preview`,
`buildType: apk`, `distribution: internal`); guia em `docs/eas-build.md`. A
conta Expo e a execução do build são do dono do projeto. **EAS Update** e
**Sentry** ficam fora desta fase. Nenhuma dependência nova exige cliente de
desenvolvimento customizado: `@supabase/supabase-js` é JavaScript puro e
`@react-native-community/netinfo` faz parte do Expo Go; ambos instalados com
`npx expo install`.

### 10.14 Contextos da Interface

Quatro contextos, de fora para dentro: `ContainerProvider` (dependências),
`AuthProvider` (sessão), `ConectividadeProvider` (rede, sobre a porta
`IConectividadeGateway`) e `SincronizacaoProvider` (gatilhos, pendentes, última
sincronização, aviso). A Home e o Diagnóstico mostram o `PainelSincronizacao`;
o catálogo mostra "Pendente de envio / Sincronizada / Não enviada" na última
leitura de cada padrão; a tela de leituras da usina abre o comprovante
(`VisualizadorComprovante`).

### 10.15 Foto por Referência Relativa e Descarte de Envio Impossível

**Contexto.** No primeiro teste contra o projeto Supabase real (17/11/2026),
um aparelho que já usava o app na fase local ficou com 3 leituras presas na
fila. Todas recusadas com "A foto do medidor não foi encontrada no aparelho".
O banco guardava o **caminho absoluto** da foto (`file:///…/leituras/<id>.jpg`).
Esse caminho muda quando o app é atualizado: no iOS a cada atualização, e no
Expo Go quando ele mesmo é atualizado (aqui, da SDK 57 para a 58). O arquivo
podia estar intacto e ainda assim ficar inalcançável. E, sem foto, a regra é
que a leitura não sobe: os itens rodavam até o limite de tentativas, eram
isolados, e "Tentar de novo" só repetia o ciclo. Não havia saída.

**Decisão 1 — referência relativa.** A foto passa a ser guardada como
`leituras/<id>.jpg`, relativa a `Paths.document`, e o caminho completo é
montado a cada uso (`fotoNoAparelho.ts`). O gateway de fotos ganhou
`uriParaExibir(referencia)` para a tela. A **migração 004**
(`004_foto_relativa`) converte o que já estava gravado: tudo que contém
`/leituras/` vira a parte a partir de `leituras/`; vazio (leitura vinda da
nuvem) e o que já é relativo ficam. Caminho absoluto que sobrar é usado como
está. Se o arquivo ainda existir na pasta atual, a leitura presa volta a subir
sozinha depois da migração.

**Decisão 2 — descartar item recusado de vez.** No Diagnóstico, cada item
**isolado** (5 recusas) ganha "Descartar item", com confirmação que diz o que
acontece. Para uma leitura, ela, os avisos ligados a ela e a foto saem do
aparelho, o que também libera a vaga do dia. Para os outros tipos, só o item
sai da fila; o registro local fica. Item ainda na fila automática não pode ser
descartado.

**Exceção consciente à 10.11.** "Nunca apagar o que não subiu" continua
valendo para o expurgo automático. O descarte é a exceção, e por isso só por
decisão explícita de quem está no aparelho, só para o que o servidor já recusou
até o limite, e com o aviso de que não há como recuperar.

**Opções avaliadas.** (a) Deixar como estava: a fila nunca esvaziaria, e o app
diria "tente mais tarde" para sempre. (b) Descartar sozinho os itens sem foto:
apagaria dado sem ninguém ver. (c) Mandar limpar os dados do app: perderia
também o que ainda poderia subir. (d) Escolhida: corrigir a causa (referência
relativa) e dar uma saída explícita para o que não tem conserto.

**Limite.** Se a leitura descartada tinha substituído outra no mesmo dia, a
anterior continua "substituída" e o dia fica sem leitura vigente no aparelho
até uma nova ser registrada ou o pull trazer a da nuvem.

### 10.16 Horários: Microssegundos na Nuvem, Milissegundos no App

**Contexto.** No teste de ponta a ponta (17/11/2026), o técnico mudou o
próprio nome e a nuvem recusou com "Seu perfil não permite alterar nível,
status ou empresa". O Postgres guarda `timestamptz` com microssegundos; o
`Date` do JavaScript, com milissegundos. O `autorizado_em` baixado pelo pull
voltava truncado na RPC `sincronizar_perfil`, e o gatilho `proteger_perfil`
lia isso como tentativa de mexer na autorização. Afetava o técnico e o
administrador editando o próprio perfil. O PGlite dos testes não pegou porque
o relógio dele não tem microssegundos.

**Decisão.** Migração nova `20261117120000_perfil_horario_em_milissegundos.sql`
(a anterior já estava aplicada no projeto): `sincronizar_perfil` mantém o
horário da nuvem quando o recebido é igual a ele até o milissegundo. Diferença
real continua passando pelo gatilho. Os testes de política agora aplicam
**todas** as migrações da pasta, em ordem, e gravam um horário com
microssegundos antes de agir como o usuário.

**Por que não mudar as colunas para `timestamptz(3)`.** Arredondaria em vez de
truncar, e mexeria também em `atualizado_em`, que é o cursor do pull: com menos
precisão, duas alterações no mesmo milissegundo empatariam no cursor.

**Onde mais isso poderia morder.** `sincronizar_leitura` não compara os
horários que recebe (só anda o estado) e as notificações não têm gatilho de
proteção; nenhum dos dois é afetado.

### 10.17 Leituras Diárias de Todos os Endereços (amplia 9.15)

**Contexto.** A tela de monitoramento diário (9.15) listava só endereços com
`ehUsina`. Com a nuvem, ela virou também o lugar onde o administrador abre o
comprovante ("Ver foto", por URL assinada). Leituras da sede, do galpão ou do
depósito subiam normalmente, mas não havia tela onde o administrador as
acompanhasse dia a dia nem visse a foto.

**Decisão.** A consulta passa a listar **todos os endereços do escopo** do
ator (a empresa dele; todas, para o super admin), usina ou não. Cada item traz
`ehUsina`: a tela mostra o selo "Usina" só nesses, e a injeção só aparece
quando a leitura a tem. O título passou a "Leituras diárias". Técnico continua
sem acesso.

**Nomes.** Arquivos, rota (`/admin/leituras-usina`) e tipos mantêm "usina" no
nome para não espalhar a mudança; o comentário do caso de uso explica a origem.

### 10.18 Entrar Sem Rede Depois do Primeiro Acesso (revisa 10.2 e 10.4)

**Contexto.** Até aqui o uso offline dependia de **não sair da conta**: a
sessão no cofre reabria o app sem rede, mas "Sair" a apagava e o próximo login
exigia internet, porque quem confere a senha é o Supabase. No teste em campo
isso pareceu defeito, e a mensagem ("o primeiro acesso precisa de internet")
estava errada nesse caso. A especificação diz que só o **primeiro** login no
aparelho exige rede. O dono do projeto decidiu permitir o login offline depois
de sair (17/11/2026).

**Decisão.**

1. No login **com** internet, o aparelho guarda, no Keychain/Keystore e por
   e-mail, a sessão e uma **verificação derivada da senha**: PBKDF2-HMAC-SHA256,
   sal aleatório de 16 bytes, 30 000 iterações (`HashSenhaPbkdf2`, com
   `@noble/hashes`, JavaScript puro, que roda no Expo Go). A senha não é
   guardada.
2. No login **sem** internet, a senha digitada é conferida contra essa
   verificação, em tempo constante. Confere: abre a sessão local. Não confere:
   "E-mail ou senha incorretos", a mesma frase de sempre. Conta que nunca
   entrou neste aparelho: "o primeiro acesso desta conta neste aparelho precisa
   de internet".
3. A senha digitada offline fica **só em memória** (`ReautenticacaoEmMemoria`).
   Quando a rede volta, a sincronização entra no Supabase com ela e a apaga.
   Fechar o app também a apaga; aí os pendentes esperam um login com rede.
4. A verificação é **esquecida** quando deixa de ser confiável: senha trocada
   pelo app; senha recusada pela nuvem quando é a mesma que o aparelho conhecia
   (trocada em outro lugar); acesso desativado (no login ou no pull). "Sair"
   **não** a apaga — é isso que permite entrar de novo sem rede.

**Riscos aceitos.**

- Conta **desativada** ou senha **trocada em outro aparelho** continua entrando
  offline naquele aparelho até ele voltar a ficar online. Quando volta, a
  sincronização derruba a sessão (acesso revogado) ou pede novo login (senha
  mudou), e a verificação some.
- Volta a existir no aparelho algo derivado da senha. Fica dentro do cofre da
  plataforma, que é a primeira barreira; as iterações são a segunda. É uma
  verificação, não a senha, e não serve para entrar na nuvem.
- O custo de 30 000 iterações é um equilíbrio para o Hermes, que não tem JIT:
  no Node leva ~40 ms, no aparelho deve ficar na casa de um segundo. Cada hash
  grava as próprias iterações, então o custo pode subir depois sem invalidar os
  já guardados.

**Opções avaliadas.** (a) Manter "offline = não sair" e só corrigir a mensagem:
mais seguro, mas contraria a especificação. (b) Guardar a senha cifrada:
recusada — daria para recuperá-la. (c) PIN local separado: mais uma senha para
o técnico decorar. (d) Escolhida: verificação PBKDF2 no cofre, senha só em
memória.

**Testes.** `AcessoOfflineService.spec`, casos novos em
`AutenticarUsuarioUseCase.spec` e `SincronizarUseCase.spec` (entra sozinho
quando a rede volta; senha trocada; senha de outra conta; acesso revogado),
`HashSenhaPbkdf2.spec` (conferido contra o PBKDF2 do `node:crypto`) e
`CredencialOfflineSecureStore.spec`.

### 10.19 Aparelho Compartilhado, Recusa Definitiva e Autoria do Seed

**Contexto.** No uso real de um mesmo aparelho por mais de uma pessoa (técnico,
administrador e síndica do condomínio durante a validação de 17/11/2026),
apareceram quatro problemas correlatos:

1. **Recusa sem conserto esperava 5 rodadas.** Uma leitura cuja foto sumiu do
   aparelho (ou cujo padrão foi removido antes do envio) nunca vai subir: o
   problema está no próprio aparelho, não na nuvem. Gastar 5 tentativas antes de
   isolar só adiava o "Descartar item" (10.15).
2. **Fila sem dono.** Um item enfileirado offline pelo técnico tentava subir
   quando outra pessoa entrava no aparelho — e ou era recusado pela nuvem (gastando
   tentativas de quem não o criou) ou, em operações permitidas, subiria com a
   sessão errada.
3. **Resíduo no banco local ao trocar de conta.** Quando outra pessoa entrava,
   os dados baixados pela conta anterior continuavam no SQLite (e as fotos no
   disco), embora filtrados pelas telas; inclusive o seed inicial, que traz as
   duas empresas.
4. **Autoria cruzada no seed do Condomínio.** As leituras 10 e 11 do seed
   (`5e…010` e `5e…011`, padrões do Condomínio `1a…002`) estavam com `usuario_id`
   do técnico da Equinox (`4d…003`) e `decidida_por_id` do administrador da
   Equinox (`4d…002`), e o aviso `6f…003` citava João da Silva.

**Decisões.**

1. **Recusa definitiva isola na primeira vez.** `ResultadoRemoto` ganhou
   `definitivo?: boolean`, e `ActionQueueItem.registrarFalha(msg, definitiva)`
   leva `tentativas` direto a `MAX_TENTATIVAS`. `ProcessarFilaSincronizacaoUseCase`
   marca como definitivas as recusas locais ("foto não encontrada no aparelho" e
   "padrão não existe mais"). Recusas do servidor continuam contando uma por vez
   até 5.
2. **Fila com dono (migração 005).** `005_fila_com_dono` adiciona
   `action_queue.usuario_id` (com índice) e preenche o dono dos itens
   `UPSERT_LEITURA` já existentes pelo autor da leitura quando ela está
   `registrada` ou `substituida` (decisões de administrador e demais itens
   antigos ficam com `usuario_id` nulo e podem subir por qualquer sessão). Daqui
   em diante, `repositoriosComFila` grava o `usuarioId` da sessão atual em cada
   item. `ProcessarFila` pula itens de outro usuário sem gastar tentativa;
   `EncerrarSessao.pendentes()` e `ConsultarEstadoSincronizacao` separam o que é
   de quem está logado (`pendentes`) do que aguarda outro usuário
   (`deOutrosUsuarios`), e o Diagnóstico mostra "Aguardando o dono entrar" sem
   oferecer descarte para itens alheios.
3. **Limpeza na troca de usuário (`TrocaDeUsuarioService`).** Ao autenticar
   outro usuário (diferente de `CHAVE_USUARIO_DO_CURSOR` em `sync_meta`),
   **com rede e com a fila vazia**, `IDadosLocaisRepository.limparTudo()` apaga
   notificações, leituras, vínculos, padrões, endereços, usuários e empresas do
   SQLite (mantendo `action_queue` e `sync_meta`) e remove os arquivos de foto
   das leituras apagadas; o pull seguinte reconstrói o banco só no escopo de
   quem entrou. Em **qualquer** troca de usuário, os cursores do pull são
   zerados e `CHAVE_USUARIO_DO_CURSOR` é atualizado.
   - **Limitação consciente:** se houver itens na fila (aguardando o dono) ou se
     o login for offline (10.18), o banco local **não** é limpo — apagar com
     fila perderia trabalho não enviado, e apagar sem rede deixaria o aparelho
     vazio sem ter como baixar da nuvem. As consultas por escopo continuam
     isolando o que cada tela exibe.
4. **Autoria do seed do Condomínio (migração 006 e `supabase/correcoes/`).**
   `006_autoria_seed_condominio` insere Helena Síndica (`4d…005`,
   `sindica@solardovale.dev`, nível 2, sem senha local) e seus vínculos com os
   endereços do Condomínio se a empresa `1a…002` ainda existir no aparelho,
   passa para ela a autoria e a decisão das leituras `5e…010` e `5e…011`, e
   corrige o texto da notificação `6f…003`. Num aparelho já limpo pela troca de
   usuário, nada acontece. `supabase/seed.sql` foi alinhado para projetos novos,
   e `supabase/correcoes/20261117_autoria_seed_condominio.sql` acerta de forma
   idempotente o projeto Supabase já em produção (desabilitando e reabilitando
   `trg_leituras_protecao` apenas durante o `UPDATE`).
