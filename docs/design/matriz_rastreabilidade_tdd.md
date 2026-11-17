# Matriz de Rastreabilidade de Requisitos & Design TDD

Este documento mapeia o encadeamento direto de cada **Requisito Funcional (RF)** até o **Caso de Uso (Clean Architecture)**, a **Entidade de Domínio (DDD)** e o **Arquivo de Teste Automatizado (TDD)** que comprovará sua aceitação.

---

## 1. Tabela de Rastreabilidade End-to-End

> Atualizada em 17/11/2026 só nas linhas de autenticação e sincronização (RF01, RF09–RF12). As demais são do planejamento e ainda citam o modelo `Usina`, aposentado na ADR 9.1.

| ID Requisito | Descrição Resumida | Caso de Uso (`application/use-cases`) | Entidade / VO (`domain/`) | Arquivo de Teste TDD (`tests/`) | Status TDD |
|--------------|---------------------|---------------------------------------|---------------------------|----------------------------------|------------|
| **RF01** | Autenticação na nuvem com sessão local segura | `AutenticarUsuarioUseCase`, `EncerrarSessaoUseCase` | `Usuario` | `tests/unit/application/use-cases/AutenticarUsuarioUseCase.spec.ts`, `tests/unit/infrastructure/supabase/AutenticacaoSupabase.spec.ts`, `tests/unit/infrastructure/adapters/CofreSeguroEmPartes.spec.ts` | 🟢 Verde |
| **RF02** | Cadastrar Empresas (SuperAdmin) | `CadastrarEmpresaUseCase` | `Empresa` | `tests/unit/domain/Empresa.spec.ts` | 🔴 Pendente (Red) |
| **RF03** | Pré-cadastro de Usinas | `CadastrarUsinaUseCase` | `Usina`, `CoordenadasGPS` | `tests/unit/domain/Usina.spec.ts` | 🔴 Pendente (Red) |
| **RF04** | Gestão/Aprovação de Funcionários | `AprovarUsuarioUseCase` | `Usuario` | `tests/unit/domain/Usuario.spec.ts` | 🔴 Pendente (Red) |
| **RF05** | Consulta offline de Usinas | `ConsultarUsinasOfflineUseCase` | `Usina` | `tests/unit/application/ConsultarUsinasUseCase.spec.ts` | 🔴 Pendente (Red) |
| **RF06** | Registro de Nova Leitura | `RegistrarLeituraUseCase` | `Leitura`, `CoordenadasGPS` | `tests/unit/domain/Leitura.spec.ts` | 🔴 Pendente (Red) |
| **RF07** | Cadastro Emergencial de Usina | `CadastrarUsinaEmergencialUseCase` | `Usina` | `tests/unit/domain/Usina.spec.ts` | 🔴 Pendente (Red) |
| **RF08** | Compressão de Mídia da Câmera | N/A (InfraService) | `CameraAdapter` | `tests/integration/infrastructure/CameraAdapter.spec.ts` | 🔴 Pendente (Red) |
| **RF09** | Enfileiramento na `action_queue` (mesma transação) | todos os de escrita, via `repositoriosComFila` | `ActionQueueItem` | `tests/unit/application/use-cases/FilaDeEnvioNosCasosDeUso.spec.ts`, `tests/integration/sqlite/sincronizacao.spec.ts` | 🟢 Verde |
| **RF10** | Push com disparo por conexão | `ProcessarFilaSincronizacaoUseCase`, `SincronizarUseCase` | `ActionQueueItem`, `Leitura` | `tests/unit/application/use-cases/ProcessarFilaSincronizacaoUseCase.spec.ts`, `tests/component/SincronizacaoContextos.spec.tsx` | 🟢 Verde |
| **RF11** | Pull incremental | `BaixarAlteracoesUseCase` | todas | `tests/unit/application/use-cases/BaixarAlteracoesUseCase.spec.ts`, `tests/unit/infrastructure/supabase/SincronizacaoSupabase.spec.ts` | 🟢 Verde |
| **RF12** | Conflito: última medição vence | `RegistrarLeituraUseCase` (local) + função `sincronizar_leitura` (servidor) | `Leitura`, `RegraSubstituicaoLeituraService` | `tests/supabase/politicas.test.mjs` (`npm run test:rls`) | 🟢 Verde |

---

## 2. Padrão de Execução do Ciclo TDD

Todos os arquivos de teste listados acima deverão seguir o ciclo de vida rigoroso:

1. **Escrever a suíte de testes unitários** no diretório `tests/` especificando o comportamento esperado.
2. **Rodar o comando de teste:** `npm test`
3. **Confirmar que o teste falhou (RED):** Garantir que a falha é pelo motivo correto (ex: classe não existente ou método não implementado).
4. **Escrever o código mínimo de produção** na camada adequada (`domain`, `application`, etc.).
5. **Rodar o teste novamente (GREEN):** Confirmar que passou sem side-effects.
6. **Refatorar o código (REFACTOR):** Limpar e otimizar mantendo 100% dos testes verdes.
