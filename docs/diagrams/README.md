# Índice de Diagramas da Arquitetura — Equinox Mobile

Esta pasta contém a especificação UML completa em **Mermaid** estruturada e modularizada:

---

### 📂 Arquivos de Diagramas

1. 📄 **[casos_de_uso.md](file:///home/alunos/Desktop/www/EqSystemMobile/EquinoxSystemMobile/docs/diagrams/casos_de_uso.md)**
   - **Diagrama de Casos de Uso (UML):** Mapeamento dos 4 atores (`Usuário`, `SuperAdmin`, `Admin`, `Técnico`), herança, `<<include>>` e `<<extend>>`.

2. 📄 **[classes_e_der.md](file:///home/alunos/Desktop/www/EqSystemMobile/EquinoxSystemMobile/docs/diagrams/classes_e_der.md)**
   - **Diagrama de Classes de Domínio:** Entidades DDD e Value Objects.
   - **Diagrama Entidade-Relacionamento (DER):** Modelagem relacional para SQLite e Supabase.

3. 📄 **[objetos_e_estados.md](file:///home/alunos/Desktop/www/EqSystemMobile/EquinoxSystemMobile/docs/diagrams/objetos_e_estados.md)**
   - **Diagrama de Objetos:** Instantâneo da execução com dados de exemplo.
   - **Diagramas de Estados:** Ciclo de vida das entidades `Leitura` e `Usina`.

4. 📄 **[sequencia_e_arquitetura.md](file:///home/alunos/Desktop/www/EqSystemMobile/EquinoxSystemMobile/docs/diagrams/sequencia_e_arquitetura.md)**
   - **Mapeamento BCE (Boundary-Control-Entity):** Separação de responsabilidades.
   - **Diagrama de Sequência:** Fluxo temporal do lançamento offline de leitura.
   - **Diagrama de Atividades:** Algoritmo de sincronização em segundo plano do `SyncManager`.
   - **Diagrama de Componentes:** Camadas Clean Architecture e direção das dependências.
