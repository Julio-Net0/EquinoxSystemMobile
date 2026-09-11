# 📋 Revisão Técnica — Proposta Acadêmica Equinox Mobile

> **Data da Revisão:** 11/09/2026  
> **Revisor:** Assistente de IA (a pedido de Victor)  
> **Objetivo:** Cruzar o texto da proposta descritiva original com toda a documentação técnica do repositório (`decisions.md`, `documento-software.md`, schemas SQL, `AGENTS.md`, `README.md`, `package.json` e estrutura de pastas) para verificar coerência, identificar divergências e recomendar ações corretivas antes do início da codificação.

---

## Documentos Analisados

| Documento | Caminho |
|-----------|---------|
| Proposta Descritiva Original | Texto fornecido pelo autor (não versionado) |
| Descrição Consolidada | `docs/Descricao.md` |
| Registro de Decisões (ADR) | `docs/decisions.md` |
| Documento de Software (Análise e Projeto) | `docs/documento-software.md` |
| Schema SQLite | `docs/design/schema_sqlite.sql` |
| Schema Supabase | `docs/design/schema_supabase.sql` |
| Matriz de Rastreabilidade TDD | `docs/design/matriz_rastreabilidade_tdd.md` |
| Regras para Agentes | `AGENTS.md` |
| README do Projeto | `README.md` |
| Dependências do Projeto | `package.json` |

---

## ✅ Veredito Geral

**O projeto está extremamente bem estruturado e faz sentido de ponta a ponta.** A proposta descritiva, os ADRs, o documento de software, os schemas SQL e a matriz de rastreabilidade estão coerentes entre si, com decisões técnicas bem justificadas.

Existem, porém, **divergências pontuais e lacunas** entre a proposta original e a documentação real do projeto que devem ser corrigidas para garantir consistência total. Essas divergências estão detalhadas nas seções abaixo.

---

## ✅ Pontos que Estão Corretos e Consistentes

A tabela abaixo lista todos os aspectos que foram verificados e estão **alinhados em todos os documentos** do projeto:

| # | Aspecto Verificado | Docs que Confirmam |
|---|--------------------|--------------------|
| 1 | Estratégia Offline-First com SQLite como fonte de verdade local | Proposta, `Descricao.md`, `decisions.md` ADR 1.1, `documento-software.md`, `README.md` |
| 2 | UUIDv4 como PK em todas as entidades (gerados no Domínio, não auto-incrementais) | Proposta, `decisions.md` ADR 2.1, `schema_sqlite.sql`, `schema_supabase.sql`, `AGENTS.md` |
| 3 | Action Queue como log transacional offline (`action_queue`) | Proposta, `Descricao.md`, `decisions.md` ADR 2.2, `documento-software.md`, schemas SQL |
| 4 | Compressão de imagem (JPEG 1080p, qualidade 70-80%, ~300KB) via `expo-image-manipulator` | Proposta, `decisions.md` ADR 3.1, `AGENTS.md`, `README.md` |
| 5 | Supabase como backend (Auth JWT + Storage bucket `comprovantes` + PostgreSQL + RLS) | Proposta, `Descricao.md`, `schema_supabase.sql`, `AGENTS.md` |
| 6 | Clean Architecture + DDD + TDD como paradigma de código | Proposta, `decisions.md` ADRs 4.1 e 4.2, `documento-software.md`, `AGENTS.md`, `README.md` |
| 7 | TypeScript v5+ em modo estrito (`strict: true`) | `decisions.md` ADR 4.4, `AGENTS.md`, `tsconfig.json` |
| 8 | Expo Router com file-based routing para navegação | Proposta, `Descricao.md`, `package.json`, `AGENTS.md` |
| 9 | Sincronização bidirecional (Push via fila + Pull Delta com `last_sync_timestamp`) | Proposta, `decisions.md` ADR 2.2, `documento-software.md`, `README.md` |
| 10 | Proof of Presence — GPS como auditoria consultiva, **não** como bloqueio | Proposta, `decisions.md` ADR 5.4 |
| 11 | Diagrama de Classes alinhado com o DER e com os schemas SQL | `documento-software.md` seções 3.1 e 3.2 vs `schema_sqlite.sql` e `schema_supabase.sql` |
| 12 | Diagrama de Sequência do fluxo offline de Nova Leitura | `documento-software.md` seção 7 |
| 13 | Diagrama de Estados de Leitura e Usina | `documento-software.md` seção 5 |
| 14 | Matriz de Rastreabilidade RF → Caso de Uso → Entidade → Teste TDD | `matriz_rastreabilidade_tdd.md` |
| 15 | React Context API + Custom Hooks para estado de UI (sem Redux) | `decisions.md` ADR 4.3, `AGENTS.md` |
| 16 | Monitoramento de conectividade via `@react-native-community/netinfo` | Proposta, `decisions.md` ADR 2.2, `AGENTS.md` |

**Conclusão parcial:** O núcleo técnico do projeto está sólido e internamente coerente.

---

## 🔴 Divergência #1 — Escopo Multi-Tenant e Perfis de Acesso

### O que a proposta original diz:
> *"Os usuários finais do sistema são técnicos instaladores, engenheiros de campo e leituristas de empresas integradoras de energia solar fotovoltaica."*

A proposta descreve **apenas um tipo de usuário** (o técnico em campo) e lista **6 telas** para o app.

### O que a documentação real do projeto define:
- O `Descricao.md` define **3 perfis de acesso** com responsabilidades distintas:
  - **SuperAdmin (Equinox):** cadastra empresas e vincula usinas.
  - **Admin (Empresa):** aprova funcionários e gerencia usinas da empresa.
  - **Técnico:** realiza leituras e cadastros emergenciais em campo.
- O `documento-software.md` detalha requisitos funcionais exclusivos para cada perfil (RF02 para SuperAdmin, RF04 para Admin, RF06/RF07 para Técnico).
- O `Descricao.md` inclui uma **7ª tela** não prevista na proposta: **Tela de Gestão de Empresas/Usuários** (acessível por SuperAdmin e Admin).
- O `decisions.md` ADR 1.2 confirma a decisão de ser **100% Mobile e Multi-Tenant**.

### Por que isso é um problema:
Se a proposta for entregue a um professor para avaliação, ela descreve um escopo significativamente menor do que o que o projeto realmente implementa. O avaliador pode questionar por que o código e os documentos fazem mais do que a proposta prometia, ou pode pensar que o escopo mudou sem controle.

### Ação recomendada:
**Atualizar a proposta** para incluir:
- Os 3 perfis de acesso (SuperAdmin, Admin, Técnico) com suas responsabilidades.
- O modelo Multi-Tenant (cada Empresa como tenant isolado).
- A 7ª tela de Gestão de Empresas/Usuários.

**Prioridade: 🔴 Alta**

---

## 🔴 Divergência #2 — Resolução de Conflitos de Sincronização

### O que a proposta original diz:
> *"Caso o Supabase retorne um conflito de dados (ex: leitura já registrada por outro operador para o mesmo medidor no mesmo mês), o registro local ganha a flag `conflito_sincronizacao`, e o operador é notificado na tela para **escolher entre sobrescrever com seus dados locais ou descartar** a leitura atualizada."*

Isso descreve uma **resolução manual** pelo operador, com pop-up de escolha.

### O que a documentação real do projeto define:
O `decisions.md` ADR 2.3 diz explicitamente:

> *"Decisão: Estratégia 'Last Write Wins' (Última Escrita Vence) sem bloqueio de UI."*
> *"Justificativa: Delegar a resolução de conflitos a técnicos leigos através de pop-ups ('Qual versão manter?') gera confusão. O backend ou o App avaliará o carimbo de data/hora (data_hora) da medição e salvará automaticamente a mais recente. O técnico será avisado por uma simples Notificação Local."*

### Por que isso é um problema:
É uma **contradição direta**. A proposta diz que o operador decide manualmente; o ADR (que é a decisão final do projeto) diz que é automático. Se os dois documentos forem lidos por um avaliador, a contradição será visível e pode levar à perda de pontos por inconsistência.

### Ação recomendada:
**Corrigir a proposta** removendo a parte de "escolha pelo operador" e substituindo pela estratégia definitiva de "Last Write Wins" automático com notificação silenciosa. Copiar a justificativa do ADR 2.3, que é bem fundamentada.

**Prioridade: 🔴 Alta**

---

## 🔴 Divergência #3 — Schema SQLite da `action_queue` Incompleto

### O que o `decisions.md` ADR 5.1 define:
> *"Para suportar edição e exclusão de usinas de forma offline, inserimos tipos de ações adicionais na tabela action_queue local, como `UPDATE_USINA` e `DELETE_USINA`."*

### O que o `schema_sqlite.sql` realmente implementa (linha 63):
```sql
tipo_operacao TEXT NOT NULL CHECK (tipo_operacao IN ('INSERT_LEITURA', 'INSERT_USINA', 'INSERT_EMPRESA'))
```

Os tipos `UPDATE_USINA` e `DELETE_USINA` **não estão na constraint CHECK**. Se o código tentar inserir uma dessas operações na fila, o SQLite rejeitará com erro de constraint violation.

### Ação recomendada:
Atualizar a linha 63 do `docs/design/schema_sqlite.sql` para:
```sql
tipo_operacao TEXT NOT NULL CHECK (tipo_operacao IN (
    'INSERT_LEITURA', 'INSERT_USINA', 'INSERT_EMPRESA',
    'UPDATE_USINA', 'DELETE_USINA'
))
```

**Prioridade: 🔴 Alta**

---

## 🟡 Divergência #4 — Autenticação Offline (PIN/Biometria) Ausente na Proposta

### O que a proposta original diz:
> *"Permite acesso ao aplicativo por meio de credenciais corporativas com persistência local segura de token."*

Isso é vago e não explica **como** o técnico acessa o app quando o token JWT expirou e ele está sem internet.

### O que a documentação real do projeto define:
O `decisions.md` ADR 3.2 detalha uma solução robusta:
- O app solicita a criação de um **PIN de Acesso Local** (ou Biometria: digital/FaceID).
- O PIN é salvo **criptografado** no cofre do SO via `expo-secure-store`.
- Quando offline, o login ocorre validando o PIN local, liberando a UI e o SQLite, **ignorando o JWT expirado**.
- Ao restabelecer internet, o `SyncManager` tenta **renovar o JWT automaticamente** em background.

### Por que isso importa:
Essa é uma solução sofisticada que demonstra pensamento crítico sobre UX em ambiente desconectado. Incluí-la na proposta **fortalece o trabalho academicamente**.

### Ação recomendada:
Adicionar na seção de Autenticação da proposta uma explicação do mecanismo de PIN/Biometria offline, conforme documentado no ADR 3.2.

**Prioridade: 🟡 Média**

---

## 🟡 Divergência #5 — Conceito de Cold Start Ausente na Proposta

### O que a proposta original diz:
Não menciona nenhum requisito especial para o primeiro acesso ao app após instalação.

### O que a documentação real do projeto define:
O `decisions.md` ADR 1.3 define:
> *"Decisão: Conectividade mandatória no primeiro acesso."*
> *"Justificativa: O primeiro login pós-instalação exige conexão com a internet para gerar a sessão (JWT), configurar o expo-secure-store e realizar o Pull Sync inicial, populando o SQLite com o catálogo necessário."*

### Por que isso importa:
Sem essa informação na proposta, um avaliador pode questionar: "se é offline-first, como funciona o primeiro acesso?". O conceito de Cold Start responde exatamente essa pergunta e demonstra maturidade técnica.

### Ação recomendada:
Adicionar um parágrafo na seção de Estratégia Offline-First da proposta explicando o requisito de Cold Start.

**Prioridade: 🟡 Média**

---

## 🟡 Divergência #6 — Políticas RLS do Supabase Incompletas

### Situação atual no `schema_supabase.sql`:
O arquivo define apenas **3 policies de Row Level Security**:

| # | Policy | Tabela | Operação |
|---|--------|--------|----------|
| 1 | SuperAdmin acesso total | `empresas` | ALL |
| 2 | Leitura por empresa | `usinas` | SELECT |
| 3 | Inserção por empresa | `leituras` | INSERT |

### Policies que estão faltando para cobrir os requisitos funcionais:

| Policy Faltante | Tabela | Operação | RF Relacionado | Consequência da Ausência |
|-----------------|--------|----------|----------------|--------------------------|
| SELECT em `leituras` por empresa | `leituras` | SELECT | RF05, RF06 | Técnicos não conseguem consultar leituras existentes |
| SELECT em `profiles` por empresa | `profiles` | SELECT | RF04 | Admin não consegue ver a lista de funcionários |
| INSERT em `usinas` para Admin/SuperAdmin | `usinas` | INSERT | RF03 | Admin não consegue criar usinas no Supabase |
| UPDATE em `usinas` para Admin | `usinas` | UPDATE | RF03 (edição) | Admin não consegue atualizar dados de usinas |
| UPDATE em `profiles` para Admin | `profiles` | UPDATE | RF04 | Admin não consegue aprovar técnicos (mudar status `Pendente` → `Ativo`) |
| SuperAdmin acesso total em `profiles` | `profiles` | ALL | RF02, RF04 | SuperAdmin fica bloqueado na tabela de perfis |
| SuperAdmin acesso total em `usinas` | `usinas` | ALL | RF03 | SuperAdmin fica bloqueado na tabela de usinas |
| SuperAdmin acesso total em `leituras` | `leituras` | ALL | Visualização geral | SuperAdmin fica bloqueado na tabela de leituras |

### Ação recomendada:
Expandir o `schema_supabase.sql` com as policies faltantes. As existentes estão **corretas** — o problema é que são insuficientes para cobrir todos os fluxos do sistema.

**Prioridade: 🟡 Média** (não bloqueia a implementação inicial do app mobile, mas será necessário antes da integração completa com o Supabase)

---

## 🟢 Observação #7 — Limite Máximo de Tentativas da Action Queue

### Situação:
O `decisions.md` ADR 5.2 descreve que, quando um item da `action_queue` atinge o "limite de tentativas", o erro é isolado e a UI exibe uma mensagem amigável. Porém, em **nenhum documento** do projeto está definido qual é esse limite.

O `schema_sqlite.sql` define o campo `tentativas INTEGER NOT NULL DEFAULT 0`, mas não há menção ao valor máximo.

### Ação recomendada:
Definir e documentar uma constante de domínio, por exemplo:
```typescript
// src/domain/constants.ts
export const MAX_TENTATIVAS_SYNC = 5;
```

E mencioná-la brevemente no ADR 5.2 ou no `Descricao.md`.

**Prioridade: 🟢 Baixa** (não bloqueia nada, mas é um detalhe de implementação que pode gerar dúvidas na hora de codificar)

---

## 📝 Observações Adicionais sobre o Estado do Código

### Estrutura de Pastas Atual vs. Planejada

A estrutura planejada no `documento-software.md` (seção 10.1) define:
```
src/
├── domain/           # Entidades, VOs, Enums, Interfaces
├── application/      # Casos de Uso, DTOs
├── infrastructure/   # SQLite, Supabase, Hardware, Sync
└── presentation/     # Telas Expo Router, Contexts, Hooks, Components
```

A estrutura **real atual** do `src/` é:
```
src/
├── app/              # Esqueleto padrão Expo Router
├── components/       # Componentes padrão Expo
├── constants/        # Constantes padrão Expo
├── hooks/            # Hooks padrão Expo
└── global.css        # Estilos globais
```

> **Nota:** Isso é esperado — o projeto está na fase de documentação/planejamento. A estrutura Clean Architecture será criada durante a implementação.

### Dependências Faltantes no `package.json`

O `package.json` atual contém apenas as dependências padrão do Expo SDK 57. As seguintes libs essenciais da stack definida no `AGENTS.md` ainda **não foram instaladas**:

| Dependência | Finalidade |
|-------------|-----------|
| `expo-sqlite` | Persistência local offline |
| `@supabase/supabase-js` | Cliente do backend remoto |
| `expo-camera` | Captura de fotos do medidor |
| `expo-location` | Geolocalização (Proof of Presence) |
| `expo-image-manipulator` | Compressão de imagens |
| `expo-secure-store` | Armazenamento criptografado de tokens/PIN |
| `@react-native-community/netinfo` | Monitoramento de conectividade |
| `react-hook-form` | Gerenciamento de formulários |
| `zod` | Validação de schemas e formulários |
| `jest` / `jest-expo` | Framework de testes unitários |
| `@testing-library/react-native` | Testes de componentes |
| `@sentry/react-native` | Monitoramento de erros e crashes |
| `uuid` | Geração de UUIDv4 no domínio |

> **Nota:** Normal para a fase atual. Serão instaladas no início da implementação.

---

## 📊 Tabela Resumo de Ações

| # | Ação | Tipo | Prioridade | Responsável |
|---|------|------|------------|-------------|
| 1 | Atualizar proposta: incluir 3 perfis (SuperAdmin, Admin, Técnico) e Multi-Tenancy | Proposta | 🔴 Alta | Dupla |
| 2 | Corrigir proposta: resolução de conflitos → "Last Write Wins" automático (não manual) | Proposta | 🔴 Alta | Dupla |
| 3 | Atualizar `schema_sqlite.sql`: adicionar `UPDATE_USINA` e `DELETE_USINA` na CHECK da `action_queue` | Schema | 🔴 Alta | Dupla |
| 4 | Atualizar proposta: adicionar mecanismo de PIN/Biometria para login offline | Proposta | 🟡 Média | Dupla |
| 5 | Atualizar proposta: adicionar conceito de Cold Start (primeiro acesso exige internet) | Proposta | 🟡 Média | Dupla |
| 6 | Expandir `schema_supabase.sql`: adicionar policies RLS faltantes para todos os perfis | Schema | 🟡 Média | Dupla |
| 7 | Documentar `MAX_TENTATIVAS_SYNC` como constante de domínio | Domínio | 🟢 Baixa | Dupla |

---

## 🏆 Pontos Fortes do Projeto (Destaques para o Professor)

Vale ressaltar que o projeto apresenta qualidades que **raramente são vistas em trabalhos acadêmicos**:

1. **ADRs (Architecture Decision Records):** Cada decisão arquitetural tem contexto, opções avaliadas, decisão final e justificativa técnica. Isso é prática de engenharia de software profissional e demonstra maturidade na análise de trade-offs.

2. **Matriz de Rastreabilidade End-to-End:** O mapeamento direto RF → Caso de Uso → Entidade de Domínio → Arquivo de Teste TDD comprova rastreabilidade completa dos requisitos, fundamental em Engenharia de Requisitos.

3. **Tratamento de Edge Cases (ADRs 5.1 a 5.12):** Os 12 cenários de borda documentados (Soft Delete offline, queda de cache, permissões negadas, ordem de upload, expurgo de dados, conflito de usina inativa, etc.) demonstram que o projeto não é apenas um protótipo superficial — há pensamento crítico sobre cenários reais de operação em campo.

4. **Storage Always First (ADR 5.5):** A decisão de enviar a foto ao Storage antes de gravar no banco, com a justificativa de que "foto órfã no Storage é tolerável, mas leitura sem foto comprobatória corrompe a regra de negócio", demonstra entendimento profundo das invariantes de domínio.

5. **Diagrama de Estados da Leitura:** O ciclo `Pendente → Sincronizando → Sincronizada | Rejeitada` com os fluxos alternativos de Auto-Merge e Soft Delete está modelado corretamente segundo a UML e reflete fielmente o comportamento descrito nos ADRs.

6. **Separação de Validação (ADR 5.7):** Zod na camada de apresentação para feedback rápido + Invariantes no domínio como barreira de segurança final. Essa dupla validação é padrão em sistemas corporativos e demonstra entendimento das camadas da Clean Architecture.

---

> **Próximo passo sugerido:** A dupla deve revisar as 7 ações listadas acima, decidir quais implementar imediatamente e quais postergar, e então começar a preparar a base de código (instalar dependências + criar a estrutura de pastas da Clean Architecture).
