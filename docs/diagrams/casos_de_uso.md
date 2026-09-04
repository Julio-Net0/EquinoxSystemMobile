# Diagrama de Casos de Uso — Equinox Mobile

```mermaid
flowchart LR
    Usuario((Usuário))
    SuperAdmin((SuperAdmin))
    Admin((Admin))
    Tecnico((Técnico))

    SuperAdmin --|> Usuario
    Admin --|> Usuario
    Tecnico --|> Usuario

    Usuario --> UC01[Autenticar no App]
    UC01 -.include.-> UC02[Validar Credenciais / Token SecureStore]

    SuperAdmin --> UC03[Cadastrar Empresa]
    SuperAdmin --> UC04[Vincular Usina a Empresa]

    Admin --> UC05[Gerenciar/Aprovar Técnicos]
    Admin --> UC04

    Tecnico --> UC06[Consultar Usinas Offline]
    Tecnico --> UC07[Registrar Nova Leitura]
    UC07 -.include.-> UC08[Capturar Foto Medidor]
    UC07 -.include.-> UC09[Capturar Coordenadas GPS]
    UC08 -.include.-> UC10[Comprimir Imagem JPEG]
    
    Tecnico --> UC11[Cadastrar Usina Emergencial]

    Usuario --> UC12[Sincronizar Dados]
    UC12 -.include.-> UC13[Processar Action Queue Push]
    UC12 -.include.-> UC14[Executar Pull Sync Delta]
    UC15[Resolver Conflito de Sincronização] -.extend.-> UC13
```
