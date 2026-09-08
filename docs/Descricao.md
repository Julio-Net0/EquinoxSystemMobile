# Aplicativo Móvel Equinox Mobile (Offline-First)

## 1. Visão Geral e Escopo

### Tema e Objetivo
O projeto consiste no desenvolvimento do Equinox Mobile, um aplicativo móvel 100% mobile voltado para a gestão de usinas de energia solar e faturamento. O principal propósito do aplicativo é resolver o problema de coleta de dados de geração de energia e leitura de medidores físicos em áreas rurais ou remotas, que frequentemente sofrem com a falta de conectividade à internet. Ele atua como um elo confiável entre o técnico em campo, administradores e o ecossistema corporativo Equinox, permitindo a digitalização de leituras e cadastros de maneira offline-first.

### Público-Alvo e Níveis de Acesso (Multi-tenant)
O sistema opera em modelo multi-tenant 100% mobile com três perfis de acesso distintos:
1. **SuperAdmin (Equinox):** Responsável por cadastrar e gerenciar Empresas no aplicativo e vincular o pré-cadastro inicial de usinas fotovoltaicas.
2. **Admin (Empresa / Cliente):** Administrador de uma empresa específica. Aprova cadastros de funcionários, cria contas de técnicos e gerencia o acesso a usinas específicas da sua empresa.
3. **Técnico / Operador de Campo:** Profissional que realiza vistorias de manutenção, leituras de medidores em áreas remotas e cadastros emergenciais de usinas em campo.

### Casos de Uso Principais
- **Autenticação e Login Seguro Offline:** Permite acesso ao aplicativo usando PIN Local ou Biometria configurados, garantindo acesso às ferramentas offline mesmo que o token de rede corporativo (JWT) tenha expirado, persistindo a chave segura via `expo-secure-store`.
- **Gestão Corporativa (SuperAdmin/Admin):** Cadastro de empresas, aprovação de funcionários e vinculação de usinas aos técnicos.
- **Consulta de Usinas e Clientes:** Exibição da lista de usinas fotovoltaicas sob responsabilidade do usuário logado, permitindo busca e consulta rápida offline.
- **Registro de Leituras de Campo:** Coleta de dados de consumo (kWh) e geração, exigindo comprovação fotográfica compactada do relógio medidor e registro georreferenciado (GPS).
- **Cadastro Emergencial de Usina:** Cadastro básico de novas unidades geradoras em campo por técnicos, com status inicial `Em Comissionamento` aguardando homologação do Admin.
- **Controle de Sincronização (Push/Pull Delta Sync):** Sincronização bidirecional de dados e visualização de pendências locais e status de processamento da fila de envio para a nuvem.

---

## 2. Interface e Navegação (Expo Router)

### Mapeamento de Telas
- **Tela de Login (Pública):** Autenticação de usuários com suporte a validação local quando offline.
- **Tela Home / Dashboard (Protegida):** Painel principal adaptado ao perfil (SuperAdmin, Admin ou Técnico) com resumo de atividades pendentes, atalhos rápidos e status da fila de sincronização.
- **Tela Gestão de Empresas / Usuários (Protegida - SuperAdmin/Admin):** Painel para criação de empresas, aprovação de usuários e concessão de permissões.
- **Tela Lista de Usinas (Protegida):** Apresenta as usinas mapeadas para o usuário logado com indicadores de status e última leitura.
- **Tela Nova Leitura (Protegida):** Formulário completo para lançamento manual de valores de geração da usina com captura fotográfica.
- **Tela Nova Usina (Protegida):** Formulário para inclusão de novas usinas em campo.
- **Tela Perfil / Configurações (Protegida):** Exibição dos dados do usuário logado, estado do banco local e botão para sincronização forçada manual.

### Estrutura de Roteamento
A navegação será estruturada utilizando o Expo Router, adotando o sistema de roteamento baseado em arquivos (*file-based routing*) do ecossistema Expo:
- **Rotas Públicas (Stack):** Garante um fluxo sequencial rígido no acesso inicial e recuperação de sessão antes do acesso à área logada.
- **Rotas Protegidas (Tabs):** Utilizada na área logada principal do sistema para alternar facilmente entre as seções Dashboard, Usinas, Gestão e Perfil através de uma barra de navegação inferior.
- **Rotas Sequenciais (Stacks Internas):** Para os fluxos de criação de leitura, cadastro de empresas e cadastro de novas usinas.

---

## 3. Estratégia Offline-First & Modelagem Local (SQLite)

### Identificadores Únicos Universais
Todas as entidades do sistema (`Empresa`, `Usuario`, `Usina`, `Leitura`, `ActionQueueItem`) utilizarão obrigatoriamente **UUIDv4** como Chave Primária (PK). Os UUIDs são gerados na camada de domínio antes da gravação no SQLite, garantindo que não ocorram colisões de ID no Supabase ao sincronizar múltiplos dispositivos offline.

### Modelagem de Dados Local
Para suportar a operação offline, o SQLite do dispositivo armazenará as seguintes entidades mapeadas:
- **Tabela `empresas`:** ID (UUIDv4), nome, CNPJ, data de cadastro.
- **Tabela `usuarios`:** ID (UUIDv4), `empresa_id`, nome, email, perfil (`SuperAdmin`, `Admin`, `Tecnico`), status (`Ativo`, `Pendente`).
- **Tabela `usinas`:** ID (UUIDv4), `empresa_id`, nome, codigo_uc, capacidade_nominal, latitude, longitude, status (`Ativa`, `Em Comissionamento`, `Inativa`), data_ultima_visita.
- **Tabela `leituras`:** ID local (UUIDv4), `usina_id`, `usuario_id`, valor_consumo_kwh, data_hora, caminho_imagem_local, latitude, longitude, status_sincronizacao (`Pendente`, `Sincronizada`, `Conflito`, `Rejeitada`).
- **Tabela `action_queue`:** Fila operacional contendo ID (UUIDv4), tipo_operacao (`INSERT_LEITURA`, `INSERT_USINA`, `INSERT_EMPRESA`), timestamp e payload completo em JSON.

### Fila de Ações (Action Queue)
Toda modificação ou inserção feita pelo usuário sem sinal de internet gerará uma entrada na tabela `action_queue`. Esta fila serve como um log transacional local. O aplicativo tentará processar e consumir os itens desta fila assim que o dispositivo restabelecer conectividade estável com o servidor remoto.

---

## 4. Backend e Sincronização (Supabase)

### Modelagem de Dados Remota
No Supabase, as tabelas serão equivalentes às do SQLite, garantindo consistência relacional e incluindo chaves estrangeiras apropriadas:
- **Tabela `empresas`:** Registro de empresas clientes.
- **Tabela `profiles` (estendendo `auth.users`):** Gerencia cadastro, vínculo com empresa e perfil de acesso dos usuários.
- **Tabela `usinas`:** Banco de dados mestre de todas as usinas fotovoltaicas ativas e em comissionamento.
- **Tabela `leituras`:** Registros finais consolidados e validados de geração e leitura.

### Estratégia de Sincronização Delta (Push / Pull)
- **Push Sync (Fila Local -> Nuvem):** Quando a biblioteca de rede detectar internet, o `SyncManager` iniciará a varredura da `action_queue` de forma assíncrona. Os itens com sucesso são removidos do SQLite local.
- **Pull Sync (Novem -> SQLite Local):** Ao realizar login online ou disparar a sincronização, o app busca alterações remotas via `last_sync_timestamp`, baixando do Supabase apenas os dados de empresas/usinas/leituras que o perfil do usuário logado tem permissão de visualizar.
- **Resolução de Conflitos:** Caso o Supabase retorne conflito (ex: leitura duplicada no mesmo mês), o sistema aplica a estratégia *Last Write Wins*, sobrescrevendo o registro baseando-se na data/hora mais recente de medição, notificando o técnico que o registro foi atualizado sem exigir intervenção manual de *merge*.

### Autenticação e Armazenamento de Sessão Offline
A autenticação será controlada pelo Supabase Auth (JWT). O token JWT e o estado do perfil do usuário são armazenados de forma criptografada no dispositivo usando `expo-secure-store`. Isso permite que o aplicativo valide a sessão localmente e autorize a operação quando o dispositivo estiver sem acesso à rede. O acesso aos dados remotos no Supabase utiliza políticas rígidas de Row Level Security (RLS).

---

## 5. Integração com Hardware e Sensores

### Uso da Câmera e Compressão de Imagens
A câmera do dispositivo é acionada no fluxo de Nova Leitura para capturar a foto do visor do medidor físico. Para evitar consumo excessivo de armazenamento local e falhas no upload em redes 3G/4G instáveis:
- A imagem capturada é comprimida e redimensionada na camada de infraestrutura móvel (máx. 1080p, qualidade JPEG 70-80%, reduzindo o arquivo para ~300KB).
- O arquivo binário comprimido é salvo na pasta local do app (`FileSystem.documentDirectory`).
- O SQLite armazena o caminho local da imagem.
- Durante a sincronização, a imagem é enviada para o bucket de Storage do Supabase (`comprovantes`), e o link público HTTPS gerado é associado à leitura no banco remoto.

### Uso da Geolocalização
A geolocalização do usuário (coordenadas GPS: latitude e longitude) será capturada pontualmente no instante em que uma nova leitura ou um novo cadastro de usina for salvo. Essa funcionalidade serve para auditoria física de conformidade (*Proof of Presence*), validando se o técnico estava realmente presente nas coordenadas da usina no momento do envio.

---

## 6. Arquitetura e Padrões de Código

### Clean Architecture, DDD e TDD
O código do projeto será totalmente desacoplado e estruturado conforme os princípios de Clean Architecture, Domain-Driven Design (DDD) e Test-Driven Development (TDD):

- **Camada de Domínio (`Domain`):** Entidades puras (`Usina`, `Leitura`, `Empresa`, `Usuario`), Objetos de Valor (`UUID`, `CoordenadasGPS`, `ConsumokWh`), Interfaces de Repositório e Regras de Negócio puras (sem dependência de frameworks).
- **Camada de Aplicação (`Application`):** Casos de Uso (`RealizarLeituraUseCase`, `CadastrarUsinaUseCase`, `ProcessarFilaSincronizacaoUseCase`), DTOs e Portas de Comunicação.
- **Camada de Adaptação e Infraestrutura (`Infrastructure / Adapters`):** Implementação dos Repositórios SQLite local, cliente Supabase, gerenciador de rede (`NetInfo`), manipulação de câmera/imagem e serviço de GPS.
- **Camada de Apresentação (`Presentation`):** Telas React Native com Expo Router, ViewModels/Controllers e componentes reutilizáveis.
