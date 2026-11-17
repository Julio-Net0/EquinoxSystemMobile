# Roteiro de Apresentação como Prova — Apresentação Final (Equinox Mobile)

Deck de slides: `slides/apresentacao_final.html`  
Título da Avaliação: **Roteiro de apresentação como prova**

Cada um dos **12 tópicos** exigidos no roteiro da prova possui **1 slide dedicado (01 a 12)** no arquivo `slides/apresentacao_final.html`, mantendo o mesmo design visual (palco 16:9 escuro, tipografia `Outfit` + `JetBrains Mono`, janelas de código com `highlight.js` e navegação por teclado/toque) das apresentações anteriores.

---

## Mapa dos Slides (1 Slide por Requisito da Prova)

| Slide | Tópico do Roteiro de Prova | Elementos de Código / Arquitetura Exibidos |
|:-----:|----------------------------|--------------------------------------------|
| **01** | **Apresentação do que é o aplicativo** | Árvore Clean Architecture (`src/domain`, `application`, `infrastructure`, `presentation`, `app`), métricas (Expo SDK 58, 790 testes, 98,7% cobertura) e credenciais do seed (`tecnico`, `admin`, `super` / `Equinox@2026`). |
| **02** | **Quem é o cliente principal do aplicativo** | Ecossistema **Equinox** em modelo B2B Multi-Tenant (`Equinox -> Empresa [CNPJ] -> Endereco [ehUsina] -> PadraoCemig -> Leitura [003 / 103]`) + entidade `Empresa.ts`. |
| **03** | **Qual é o problema que ele resolve** | Ausência de 4G em zonas rurais/subsolos, risco de "leituras de sofá" sem comprovante visual, erros de digitação e duplicidades no dia × Solução Offline-First com foto obrigatória, GPS (500 m) e `AvisoValorMenorService`. |
| **04** | **Quem é(são) o(s) público(s)-alvo** | 1. Equipes Técnicas de Campo (leituristas); 2. Gestores e Engenheiros das Empresas Clientes (Tenants); 3. Governança Corporativa Equinox (ADR 1.2 — aplicativo 100% mobile unificado). |
| **05** | **Quais são os perfis de usuário** | `USUARIO` (Nível 1 — Técnico), `ADMINISTRADOR` (Nível 2 — Admin da Empresa) e `SUPER_ADMIN` (Nível 3 — Equinox), com `PerfilEnum.ts` e `RegraAutorizacaoUsuarioService.ts`. |
| **06** | **Quais são os principais recursos** | Coleta de leitura (`003` consumo / `103` injeção), **Monitoramento Diário de Usinas com Calendário Mensal** (`LeiturasUsinaScreen` / `ConsultarLeiturasDiaUsinaUseCase`), Central de Notificações e Gestão Multi-Tenant (Autorizações, Estrutura, Usuários, Empresas). |
| **07** | **Como foi utilizada a câmera e a geo-localização** | `CameraGatewayExpo` (preview único), `ArquivoFotoGatewayExpo` (1080p, JPEG ~300 KB em `Paths.document`), `LocationGatewayExpo` (`Promise.race` de 10 s) e `RegraLocalizacaoLeituraService` (Haversine 500 m como prova de apoio auditável — ADR 9.4). |
| **08** | **O que será utilizado online e o que será offline para sincronização posterior** | Matriz completa separando a operação 100% Offline em campo (SQLite local, FileSystem, SecureStore, `action_queue`) da operação Online (Cold Start no 1º acesso, Push Sync da fila, Upload para Storage e Pull Delta Sync). |
| **09** | **Qual a metodologia de sincronização** | PKs `UUIDv4` geradas no Domínio (zero colisão), Push FIFO via `ActionQueueRepositorySQLite`, regra **"Storage Sempre Primeiro"** (ADR 5.5), Pull Delta incremental (`last_sync_timestamp`) e resolução de conflitos **Last Write Wins** (`RegraSincronizacaoService`). |
| **10** | **Como o Supabase é utilizado no aplicativo** | Três pilares: **Supabase Database** (PostgreSQL Multi-Tenant em `supabase/migrations/001_initial_supabase_rls.sql`), **Supabase Auth** (JWT com claims `empresa_id` e `perfil`) e **Supabase Storage** (bucket `comprovantes`). |
| **11** | **Quais outros serviços na nuvem são utilizados e como eles são utilizados** | **Expo EAS Build** (geração de APK/AAB/IPA em nuvem), **Expo EAS Update** (atualizações OTA sem fila de loja), **Sentry Cloud / Crashlytics** (monitoramento de erros com retenção offline) e **GitHub + Expo Tunnel (`@expo/ngrok`)**. |
| **12** | **Quais as medidas de segurança tomadas no acesso aos recursos e dados na nuvem** | **Row Level Security (RLS)** em todas as tabelas e no Storage (`001_initial_supabase_rls.sql`), isolamento de Pull Sync por `empresa_id`, cofre nativo `expo-secure-store` (`SessionStorageSecureStore`), hash com salt (`HashSenhaExpoCrypto`), guardas de rota declarativas (`<Redirect>`) e Soft Delete. |
