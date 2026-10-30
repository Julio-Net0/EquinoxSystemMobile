# Roteiro para dois apresentadores — 10 minutos

Deck: `slides/apresentacao_camera_geolocalizacao_persistencia.html`
Tema da banca: **Câmera, Geolocalização e Persistência de Dados**

**Pessoa A** abre e entrega a arquitetura (slides 1 a 4).
**Pessoa B** entrega execução, infraestrutura e fechamento (slides 5 a 8).

Total falado: **9:30**, deixando 30 s de folga. Apresentação sempre estica.

---

## Cronômetro

| Slide | Quem | Entra em | Dura | Item da banca |
|:-----:|:----:|:--------:|:----:|---|
| 1 | **A** | 00:00 | 1:10 | 1. Abertura e contextualização |
| 2 | **A** | 01:10 | 1:40 | 2. Clean Architecture e DDD |
| 3 | **A** | 02:50 | 1:10 | 3. Estratégia de TDD |
| 4 | **A** | 04:00 | 1:15 | 4. O domínio e as interfaces |
| — | — | **05:15** | — | **passagem de bastão** |
| 5 | **B** | 05:15 | 0:55 | 5. O teste na prática |
| 6 | **B** | 06:10 | 1:25 | 6. Infraestrutura e adaptadores |
| 7 | **B** | 07:35 | 1:25 | 7. Salvando no banco local |
| 8 | **B** | 09:00 | 0:30 | Demonstração e conclusão |

Se às **05:15** a pessoa A ainda estiver no slide 3, corta o slide 4 para 40 s
falando só do `ICameraGateway`. É o ajuste mais barato do roteiro.

---

# PESSOA A — slides 1 a 4

## Slide 1 · Abertura — 1:10

**Abre pelo problema, não pelo app.**

> "Medidor de energia não fica em escritório. Fica em área rural, em subsolo de
> prédio, em casa de máquinas. Lugar sem 4G. E o processo era manual: o técnico
> anotava o número no papel. Três riscos nisso — leitura feita fora do local,
> valor digitado errado sem comprovante nenhum, e o técnico travado quando a
> internet cai."

**Então a solução, em três provas:**

- **Foto obrigatória do visor** — sem foto, não existe leitura
- **GPS como prova de apoio auditável** — não bloqueia o técnico, registra
- **SQLite local** — grava na hora, sem nuvem, sem sincronização

**Os três números do rodapé** (aponta): foto em 1080p e ~300 KB, raio de apoio
de 500 m, 100% offline.

> "Hoje a gente vai mostrar onde cada uma dessas três coisas vive na
> arquitetura, como elas são testadas, e onde elas caem no banco do aparelho."

## Slide 2 · Clean Architecture e DDD — 1:40

**Este é o slide mais importante da pessoa A. Use a matriz.**

> "A pergunta é: onde moram a câmera e o GPS numa Clean Architecture? A resposta
> é que eles moram em dois lugares diferentes, e é isso que faz a arquitetura
> funcionar."

Percorre a matriz de cima para baixo:

- **Domínio** — só as **portas**: `ICameraGateway`, `ILocationGateway`,
  `IArquivoFotoGateway`. Mais o value object `CoordenadasGPS` e a entidade
  `Leitura`. Zero import de Expo, de React, de qualquer biblioteca.
- **Aplicação** — `RegistrarLeituraUseCase` orquestra: valida, manda comprimir,
  persiste, gera notificação.
- **Infraestrutura** — aí sim o Expo: `CameraGatewayExpo`, `LocationGatewayExpo`,
  `ArquivoFotoGatewayExpo`, `LeituraRepositorySQLite`.
- **Apresentação** — a tela, o hook, o ciclo de permissão.

**O argumento forte, e termina nele:**

> "A dependência aponta sempre para dentro. O caso de uso conhece
> `ICameraGateway`; nunca conhece `expo-camera`. E isso não é promessa de slide:
> a gente tem dois testes de arquitetura que varrem o código. Um falha se
> aparecer qualquer import de React, Expo ou biblioteca de terceiros dentro de
> `src/domain`. O outro falha se alguma tela instanciar o próprio repositório em
> vez de receber por injeção. Se alguém quebrar a arquitetura, a suíte acusa."

*(Arquivos, se perguntarem: `tests/unit/arquitetura/dominio-sem-dependencias.spec.ts`
e `sem-instanciacao-em-telas.spec.ts`.)*

## Slide 3 · Estratégia de TDD — 1:10

**Abre com a dificuldade real.**

> "Como é que se testa câmera e GPS? Hardware não cabe num teste automatizado.
> Pedir permissão, abrir preview, esperar satélite — nada disso roda no Jest."

**A resposta é a própria arquitetura:**

> "Como o domínio só conhece interfaces, a gente escreve implementações de
> mentira delas. `CameraGatewayFake` devolve uma foto fixa e simula permissão
> negada e o usuário fechando a câmera sem bater a foto. `LocationGatewayFake`
> devolve uma coordenada conhecida de Belo Horizonte, ou nulo. A regra de
> negócio inteira é testada em milissegundos, sem emulador, sem celular, sem
> permissão de sistema operacional."

**As garantias, rápido** (não leia a lista toda, escolha duas):

- foto obrigatória barrada na entidade **e** no caso de uso
- Haversine conferindo os 500 m
- GPS falhando: a leitura **é salva** e gera notificação de exceção

> "Essa é a parte que o desacoplamento paga. Sem a porta no domínio, nada disso
> seria testável sem aparelho."

## Slide 4 · O domínio e as interfaces — 1:15

**O ponto central deste slide: a interface não é cópia do Expo.**

> "Olhem o `ICameraGateway`. Três métodos: tem permissão, pede permissão,
> captura. Só isso. Agora, no Expo SDK 57 a câmera é um **componente React**, e
> a função que tira a foto vive numa `ref`. Isso não cabe numa interface de
> domínio. Se a gente tivesse copiado a API do Expo para dentro do domínio, o
> domínio passaria a conhecer React."

> "Então a interface foi desenhada pela necessidade do negócio, não pela
> biblioteca. A bagunça do ciclo de vida do React fica inteira na
> infraestrutura — e a pessoa B mostra como, no slide 6."

**Os invariantes da `Leitura`** (aponta o segundo bloco):

- `fotoLocalUri` vazio → lança. **Não existe leitura sem comprovante.**
- o dia local tem de corresponder ao instante medido — é o que amarra o fuso
  UTC-3 e sustenta a regra de uma leitura por dia que vem no slide 7
- `coordenadas` aceita nulo, **de propósito**: casa de medidor tem sombra de
  satélite, e travar o técnico seria pior que registrar sem GPS

**Passagem de bastão:**

> "Esse é o contrato. Agora o [nome] mostra como ele é cumprido e testado."

---

# PESSOA B — slides 5 a 8

## Slide 5 · O teste na prática — 0:55

**Este é o slide mais curto. Números primeiro, depois um exemplo.**

> "A suíte tem **765 testes** em **54 suítes**, com **98,7% de cobertura**:
> 96,6% no domínio, 99,2% na aplicação, 97% na infraestrutura. São quatro
> projetos Jest — domínio, infra, integração e UI."

**Escolhe um dos dois blocos e comenta** (não os dois, não há tempo):

- o de compressão: `expect(contexto.resize).toHaveBeenCalledWith({ width: 1080 })`
- ou o de Haversine, que confere os 500 m com coordenadas reais

> "E 61 desses testes rodam contra um SQLite de verdade, em memória — não um
> dublê de banco. É o que valida o schema, o índice e as transações antes de
> chegar no celular."

## Slide 6 · Infraestrutura e adaptadores — 1:25

**Três adaptadores, um problema resolvido em cada. Esse é o ritmo.**

**1. Câmera — o problema da `ref`:**
> "A `CameraView` do SDK 57 admite um preview ativo por vez, e a captura vive
> numa ref React. A solução: o gateway expõe um `registrarCapturador`. A tela,
> ao montar, registra a função ligada à ref e recebe uma função de limpeza. O
> domínio continua só pedindo 'capture uma foto'."

**2. Foto — API nova e orçamento de tamanho:**
> "Usamos a API contextual `ImageManipulator.manipulate`, do SDK 57 — o
> `manipulateAsync` antigo está deprecado. Redimensiona só a largura para 1080,
> preservando a proporção, e tenta as qualidades 0.8, 0.7, 0.6, 0.5 até o
> arquivo caber em ~300 KB. Depois move do cache para `Paths.document`, porque a
> uri da câmera é um arquivo temporário que o sistema pode apagar — sem esse
> passo a leitura ficaria sem comprovante."

**3. GPS — desistir é uma decisão de projeto:**
> "Dispara o `expo-location` com alta precisão numa corrida contra um timeout de
> 10 segundos. Se estourar, ou a permissão for negada, ou a plataforma falhar,
> devolve **nulo** — não lança. Em subsolo, travar o técnico esperando satélite
> seria o pior resultado possível."

## Slide 7 · Salvando no banco local — 1:25

**Começa pelo schema. É a resposta direta à pergunta do item.**

> "Essa é a tabela `leituras`. Reparem em duas linhas: `foto_local_uri` é
> `NOT NULL`, e as três colunas de GPS — latitude, longitude e precisão — aceitam
> nulo. A regra de negócio inteira está aí: **foto é obrigatória, localização é
> prova de apoio.** Não é um `if` de tela que garante isso, é o banco."

**Depois o índice parcial:**
> "E esse índice único parcial garante no máximo uma leitura vigente por padrão
> por dia local. A substituída e a descartada saem do índice e ficam como
> histórico."

**Por fim a transação, apontando o segundo bloco:**
> "Quando o técnico refaz a medição no mesmo dia, as duas operações vão na mesma
> transação exclusiva: a antiga passa para 'substituida' **antes** de a nova
> entrar. Invertido, o índice rejeitaria. E se qualquer uma falhar, as duas
> voltam atrás — o dia nunca fica sem leitura vigente."

**Fecha com a auditoria:**
> "Se o GPS falhar, ou a leitura sair dos 500 m, o app grava normalmente e cria
> uma notificação para o administrador decidir. A exceção vira trabalho de
> escritório, não bloqueio em campo."

## Slide 8 · Demonstração e conclusão — 0:30

**Meio minuto. Não detalhe, feche.**

> "Na tela, a rota recebe tudo por injeção de dependência: o hook
> `useNovaLeitura` busca o GPS em segundo plano enquanto o técnico observa o
> padrão, a câmera abre com uma moldura guiando o visor, e ao salvar o dado vai
> para o SQLite com a confirmação na tela."

> "Em resumo: uma arquitetura em que o domínio não conhece o hardware, com 765
> testes automatizados e 98,7% de cobertura, e que funciona com o celular em
> modo avião do começo ao fim. Obrigado — estamos à disposição."

---

## Combinados entre os dois

- **Quem clica.** Uma pessoa só controla o teclado o tempo todo, inclusive na
  parte da outra. Troca de mão no meio custa 10 segundos e sempre dá errado.
- **A passagem de bastão** é uma frase, não uma pausa. Fica no fim do slide 4.
- **Se estourar o tempo**, o corte é o slide 8: vai direto para a frase final.
- **Quem não está falando** fica atento às perguntas, anotando.

## Teste antes de entrar

1. Abrir o deck **na rede da sala**. Ele puxa fonte do Google Fonts e o
   highlight.js de CDN. Sem internet o código ainda aparece, mas sem cor e com
   fonte feia. Se a rede for ruim, abra o deck antes e **não feche a aba**.
2. Passar pelo slide 7 uma vez, conferindo que o bloco de SQL coube na tela.
3. `F` entra em tela cheia. Setas navegam.
4. Não abra `slides/apresentacao_prova.html` por engano — é um deck antigo, de
   antes da refatoração, e ainda fala em Supabase.

## Perguntas prováveis

**"Como garantem que não há duas leituras vigentes no mesmo dia?"**
Índice único parcial no SQLite: `idx_leituras_vigente_dia ON leituras(padrao_id,
data_local) WHERE status IN ('registrada','aprovada')`. Substituição em
transação exclusiva, atualizando a anterior antes de inserir a nova.

**"E se o técnico não tiver GPS?"**
A leitura é gravada sem coordenadas e gera notificação de auditoria. Bloquear
seria transformar uma limitação de hardware em impedimento de trabalho.

**"Por que não usaram um banco na nuvem?"**
Nesta fase o app é 100% local, por decisão registrada em `docs/decisions.md`
seção 9.2. O lugar onde o técnico trabalha não tem sinal; sincronizar seria
resolver um problema que ainda não existe.

**"A senha está segura?"**
É SHA-256 encadeado, **não é um KDF**. Está documentado como dívida consciente
na seção 9.5 do ADR, com a troca por Argon2id prevista para quando houver
backend. Para dados locais de demonstração serve; para produção não.

**"Os testes foram escritos antes do código?"**
No domínio e na aplicação, sim — é de onde vêm os 96,6% e 99,2%. Os adaptadores
de hardware e os testes de integração com SQLite vieram depois, quando
identificamos que a camada que toca o aparelho era a única sem cobertura.
