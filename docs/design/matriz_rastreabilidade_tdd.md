# Matriz de Rastreabilidade de Requisitos & Design TDD

Este documento mapeia o encadeamento direto de cada **Requisito Funcional (RF)** até o **Caso de Uso (Clean Architecture)**, a **Entidade de Domínio (DDD)** e o **Arquivo de Teste Automatizado (TDD)** que comprovará sua aceitação.

---

## 1. Tabela de Rastreabilidade End-to-End

| ID Requisito | Descrição Resumida | Caso de Uso (`application/use-cases`) | Entidade / VO (`domain/`) | Arquivo de Teste TDD (`tests/`) | Status TDD |
|--------------|---------------------|---------------------------------------|---------------------------|----------------------------------|------------|
| **RF01** | Autenticação com sessão local segura | `AutenticarUsuarioUseCase` | `Usuario` | `tests/unit/domain/Usuario.spec.ts` | 🔴 Pendente (Red) |
| **RF02** | Cadastrar Empresas (SuperAdmin) | `CadastrarEmpresaUseCase` | `Empresa` | `tests/unit/domain/Empresa.spec.ts` | 🔴 Pendente (Red) |
| **RF03** | Pré-cadastro de Usinas | `CadastrarUsinaUseCase` | `Usina`, `CoordenadasGPS` | `tests/unit/domain/Usina.spec.ts` | 🔴 Pendente (Red) |
| **RF04** | Gestão/Aprovação de Funcionários | `AprovarUsuarioUseCase` | `Usuario` | `tests/unit/domain/Usuario.spec.ts` | 🔴 Pendente (Red) |
| **RF05** | Consulta offline de Usinas | `ConsultarUsinasOfflineUseCase` | `Usina` | `tests/unit/application/ConsultarUsinasUseCase.spec.ts` | 🔴 Pendente (Red) |
| **RF06** | Registro de Nova Leitura | `RegistrarLeituraUseCase` | `Leitura`, `CoordenadasGPS` | `tests/unit/domain/Leitura.spec.ts` | 🔴 Pendente (Red) |
| **RF07** | Cadastro Emergencial de Usina | `CadastrarUsinaEmergencialUseCase` | `Usina` | `tests/unit/domain/Usina.spec.ts` | 🔴 Pendente (Red) |
| **RF08** | Compressão de Mídia da Câmera | N/A (InfraService) | `CameraAdapter` | `tests/integration/infrastructure/CameraAdapter.spec.ts` | 🔴 Pendente (Red) |
| **RF09** | Enfileiramento na `ActionQueue` | `ProcessarActionQueueUseCase` | `ActionQueueItem` | `tests/unit/domain/ActionQueueItem.spec.ts` | 🔴 Pendente (Red) |
| **RF10** | Push Sync com disparador de Conexão | `ProcessarFilaSincronizacaoUseCase` | `SyncManager` | `tests/integration/infrastructure/SyncManager.spec.ts` | 🔴 Pendente (Red) |
| **RF11** | Pull Sync Delta de Atualização | `ExecutarPullSyncUseCase` | `SyncManager` | `tests/integration/infrastructure/SyncManager.spec.ts` | 🔴 Pendente (Red) |
| **RF12** | Resolução de Conflitos de Leitura | `ResolverConflitoLeituraUseCase` | `Leitura` | `tests/unit/application/ResolverConflitoUseCase.spec.ts` | 🔴 Pendente (Red) |

---

## 2. Padrão de Execução do Ciclo TDD

Todos os arquivos de teste listados acima deverão seguir o ciclo de vida rigoroso:

1. **Escrever a suíte de testes unitários** no diretório `tests/` especificando o comportamento esperado.
2. **Rodar o comando de teste:** `npm test`
3. **Confirmar que o teste falhou (RED):** Garantir que a falha é pelo motivo correto (ex: classe não existente ou método não implementado).
4. **Escrever o código mínimo de produção** na camada adequada (`domain`, `application`, etc.).
5. **Rodar o teste novamente (GREEN):** Confirmar que passou sem side-effects.
6. **Refatorar o código (REFACTOR):** Limpar e otimizar mantendo 100% dos testes verdes.
