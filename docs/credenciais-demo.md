# Credenciais e dados de demonstração

Os dados de demonstração existem **dos dois lados, com os mesmos
identificadores**:

- **No aparelho:** a migração local `002_seed_demo` popula o SQLite na
  primeira abertura.
- **Na nuvem:** [`supabase/seed.sql`](../supabase/seed.sql), rodado pelo dono do
  projeto (veja [supabase-setup.md](supabase-setup.md)).

Como os UUIDs são iguais, o primeiro login atualiza o que já existe no
aparelho em vez de duplicar.

## Usuários

Todos com a senha **`Equinox@2026`**. O login é **só por e-mail** — o acesso por
nome de usuário foi desativado quando a autenticação foi para o Supabase
(ADR 10.2).

| Perfil | E-mail | Escopo |
|---|---|---|
| Super Admin | `super@equinox.dev` | Todas as empresas; é o único que vê a lista de Empresas |
| Administrador | `admin@equinox.dev` | Só a Equinox Energia Solar |
| Técnico | `tecnico@equinox.dev` | Registra leituras nos endereços vinculados (Sede, Usina Pampulha, Depósito Contagem) |
| Técnico **pendente** | `maria@equinox.dev` | Não entra até ser autorizado — serve para a tela de autorizações |
| Administradora | `sindica@solardovale.dev` | Só o Condomínio Solar do Vale. **Existe só na nuvem**: é a conta para mostrar que uma empresa não vê os dados da outra |

> **A senha só vale no seu projeto Supabase.** No aparelho não há senha nenhuma
> (nem hash): a conta é conferida na nuvem. Por isso o **primeiro login de cada
> aparelho precisa de internet**. Depois dele, o app abre offline.

> Se o repositório for público, troque a senha no `seed.sql` antes de rodar
> (veja o aviso em [supabase-setup.md](supabase-setup.md)).

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
(o medidor é acumulado), mais uma **registrada há 11 dias e sem decisão**, que
alimenta a notificação de leitura atrasada.

Elas já contam como **sincronizadas** (existem na nuvem com os mesmos ids).

### Atenção à foto

As fotos das leituras do seed **não existem** — nem no aparelho, nem no bucket.
Foram criadas sem passar pela câmera. Só as leituras que você registrar têm foto
real, que aparece pelo botão "Ver foto" em Leituras da usina.

### Atenção às datas

Os dois seeds datam o histórico relativo ao dia em que rodam. Se o SQL da nuvem
rodou num dia diferente da instalação do app, o histórico fica deslocado alguns
dias; o primeiro login realinha o aparelho à nuvem.

## Geocerca na demonstração

O raio padrão é de **500 m** e as coordenadas do seed são de Belo Horizonte.
Demonstrando em outra cidade, toda leitura cai fora do raio e gera o aviso
correspondente — é o comportamento correto. A leitura **nunca é bloqueada** por
distância. Para evitar esse ruído, use o **Depósito Contagem**.

## Recomeçar do zero

No aparelho, as migrações rodam uma vez por instalação (`PRAGMA user_version`).
Para repopular, desinstale o app (ou limpe os dados) e abra de novo. Na nuvem, o
`seed.sql` pode ser rodado de novo sem duplicar (`on conflict do nothing`), mas
não desfaz o que você alterou.
