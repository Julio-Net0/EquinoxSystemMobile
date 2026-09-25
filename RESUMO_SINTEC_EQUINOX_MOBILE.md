# SIMPÓSIO DE INOVAÇÃO, TECNOLOGIA, EMPREENDEDORISMO E CIÊNCIAS COMPUTACIONAIS (SINTEC 2026)

**EQUINOX MOBILE: APLICATIVO MÓVEL MULTI-TENANT E OFFLINE-FIRST PARA GESTÃO GEORREFERENCIADA DE USINAS FOTOVOLTAICAS**

Victor Couto Zanaroli  
victorzanaroli@gmail.com  

Júlio Ignácio Miranda Neto  
jjulio2468@gmail.com  

Lázaro Eduardo da Silva (Orientador)  
lazaro@cefetmg.br  

---

### RESUMO

Este trabalho apresenta o desenvolvimento do aplicativo Equinox Mobile, uma solução móvel multi-tenant e offline-first projetada para otimizar a gestão e o faturamento de usinas fotovoltaicas em regiões rurais e remotas com conectividade de rede ausente ou instável. O objetivo principal consiste em digitalizar o processo de coleta de dados de consumo e geração fotovoltaica (quilowatt-hora), garantindo integridade de dados e auditoria georreferenciada sem dependência contínua de internet. A metodologia adotada fundamenta-se nos princípios da Arquitetura Limpa (Clean Architecture), Design Guiado por Domínio (Domain-Driven Design) e Desenvolvimento Orientado a Testes (Test-Driven Development), utilizando o ecossistema React Native com Expo SDK 57 e TypeScript. A persistência local utiliza o banco de dados SQLite operando com Identificadores Únicos Universais versão quatro (UUIDv4) gerados no domínio para impedir colisões de dados. Para comprovação de presença, o sistema integra recursos nativos de câmera e localização geográfica, comprimindo automaticamente fotografias dos medidores físicos para formatos otimizados em segundo plano. A sincronização assíncrona com o ecossistema em nuvem Supabase é gerenciada por uma fila operacional local (action queue) associada a estratégias de sincronização incremental e resolução automática de conflitos por data e hora mais recente. A inteligência artificial atuou no suporte à estruturação arquitetural e ao refinamento da redação técnica deste resumo. Os resultados demonstram um fluxo de trabalho resiliente, com execução fluida de leituras offline, redução expressiva do tamanho de mídias armazenadas e sincronização eficiente após o restabelecimento da rede. Conclui-se que a abordagem offline-first combinada a padrões rigorosos de engenharia de software elimina falhas na coleta de medições no campo, oferecendo alta confiabilidade operacional para a gestão distribuída de energia solar.

**Palavras-chave:** Energia Solar; Aplicativo Móvel; Arquitetura Offline-First; Georreferenciamento; Sincronização de Dados.

---

### REFERÊNCIAS

1. BECK, Kent. **Test-Driven Development: By Example**. Boston: Addison-Wesley, 2002.
2. EVANS, Eric. **Domain-Driven Design: Tackling Complexity in the Heart of Software**. Boston: Addison-Wesley, 2003.
3. EXPO. **Expo Documentation - SDK 57**. 2026. Disponível em: https://docs.expo.dev/versions/v57.0.0/. Acesso em: 17 set. 2026.
4. FOWLER, Martin. **Patterns of Enterprise Application Architecture**. Boston: Addison-Wesley, 2002.
5. MARTIN, Robert C. **Clean Architecture: A Craftsman's Guide to Software Structure and Design**. Upper Saddle River: Prentice Hall, 2017.
6. REACT NATIVE. **React Native: Learn the basics**. 2026. Disponível em: https://reactnative.dev/docs/getting-started. Acesso em: 17 set. 2026.
7. SQLITE. **SQLite Documentation**. 2026. Disponível em: https://www.sqlite.org/docs.html. Acesso em: 17 set. 2026.
8. SUPABASE. **Supabase Documentation: Database & Authentication**. 2026. Disponível em: https://supabase.com/docs. Acesso em: 17 set. 2026.
