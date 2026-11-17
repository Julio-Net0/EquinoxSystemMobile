# Índice de Diagramas da Arquitetura — Equinox Mobile

Diagramas em **Mermaid**.

> **Situação de cada arquivo (17/11/2026).** Só o
> `sequencia_e_arquitetura.md` corresponde ao código atual. Os outros três
> ainda desenham o modelo **anterior à fase 6** (entidade `Usina`, ADR 9.1) e
> precisam ser refeitos. Enquanto isso, as fontes que valem para o modelo de
> dados são os schemas:
> [SQLite](../../src/infrastructure/database/sqlite/migrations/) e
> [Supabase](../../supabase/migrations/20261116120000_schema_equinox.sql).

1. **[sequencia_e_arquitetura.md](sequencia_e_arquitetura.md)** — atualizado
   - BCE da leitura
   - Sequência: leitura registrada offline, com a fila na mesma transação
   - Atividades: uma rodada de sincronização (push e pull)
   - Estados de sincronização de uma leitura
   - Componentes (Clean Architecture)

2. **[casos_de_uso.md](casos_de_uso.md)** — desatualizado (modelo `Usina`)

3. **[classes_e_der.md](classes_e_der.md)** — desatualizado (modelo `Usina`)

4. **[objetos_e_estados.md](objetos_e_estados.md)** — desatualizado (modelo
   `Usina`; o ciclo de sincronização atual está no item 1)
