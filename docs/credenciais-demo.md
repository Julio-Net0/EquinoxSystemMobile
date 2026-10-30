# Credenciais e dados de demonstração

O app roda 100% local, sem backend. Na primeira abertura, a migração
`002_seed_demo` popula o SQLite do aparelho com dados de demonstração.

> Estes dados existem apenas no banco local do aparelho, criado pelo próprio
> app. Não há servidor, não há conta em nuvem e nada daqui vale fora deste
> banco de demonstração.

## Usuários

Os três entram com a mesma senha: **`Equinox@2026`**

| Perfil | Login | E-mail | Escopo |
|---|---|---|---|
| Super Admin | `super` | `super@equinox.dev` | Todas as empresas; é o único que vê a tela de Empresas |
| Administrador | `admin` | `admin@equinox.dev` | Só a Equinox Energia Solar |
| Técnico | `tecnico` | `tecnico@equinox.dev` | Registra leituras nos endereços vinculados |

O login aceita **e-mail ou nome de usuário**, como no app antigo.

Há também **Maria Souza** (`maria.souza`) com status `Pendente`, para a tela de
autorizações abrir com um cadastro real esperando decisão.

## Estrutura

**Equinox Energia Solar** (CNPJ 19.131.243/0001-97)

| Endereço | UC | Usina? | Geocerca |
|---|---|---|---|
| Sede administrativa — Av. Afonso Pena, 1500, Centro, BH | 3001234567 | não | sim |
| Galpão Savassi — Rua Pernambuco, 1200, BH | 3002345678 | não | sim |
| Usina Pampulha — Av. Otacílio Negrão de Lima, BH | 3003456789 | **sim** | sim |
| Depósito Contagem — Eldorado, Contagem | 3004567890 | não | **não** |

**Condomínio Solar do Vale** (CNPJ 11.222.333/0001-81) — Bloco A e Usina do
condomínio, ambos em Nova Lima.

Sete padrões Cemig no total, um a dois por endereço.

## Por que o Depósito Contagem não tem coordenada

É deliberado. Um endereço sem coordenada não tem geocerca, e a leitura nele
não é conferida por distância. Serve para exercitar esse caminho sem depender
de onde você está fisicamente.

## Leituras históricas

Onze leituras já aprovadas, nos últimos doze dias, com valores crescentes
(o medidor é acumulado). Elas existem para que a primeira leitura real tenha
referência: digitar um valor menor que o último dispara a pergunta de
conferência.

Mais uma leitura **registrada há 11 dias e sem decisão**, que alimenta a
notificação de leitura atrasada aguardando aprovação.

### Atenção à foto

As leituras do seed apontam para `file:///documents/leituras/seed-demo.jpg`,
que **não existe** no aparelho — elas foram criadas sem passar pela câmera.
O espaço da foto aparece vazio nessas leituras, e só nessas. Leituras feitas
pelo app têm a foto real, comprimida para 1080p.

## Geocerca na demonstração

O raio padrão é de **500 m** e as coordenadas do seed são de Belo Horizonte.
Demonstrando o app em outra cidade, toda leitura cai fora do raio e gera o
aviso correspondente — isso é o comportamento correto, não um defeito. A
leitura **nunca é bloqueada** por distância: a divergência vira notificação
para o administrador.

Para testar sem esse ruído, use o **Depósito Contagem**, que não tem geocerca.

## Recomeçar do zero

As migrações são controladas pelo `PRAGMA user_version` do SQLite, então o
seed roda uma única vez por instalação. Para repopular, desinstale o app (ou
limpe os dados) e abra de novo.
