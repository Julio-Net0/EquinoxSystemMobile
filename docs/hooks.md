# Contextos e hooks — Equinox Mobile

Como a interface chega aos casos de uso e à infraestrutura sem conhecê-los.

> Esta é a versão que corresponde ao código. A versão anterior deste documento
> descrevia um catálogo planejado (`useConnectionState`, `useSync`,
> `useUsinas`, PIN local…) que nunca existiu desta forma.

## Regra

As telas (`src/presentation/screens/`) só recebem props. Rotas
(`src/app/`) e hooks (`src/presentation/hooks/`) pedem dependências ao
`ContainerProvider` — **nenhum** deles instancia repositório, gateway ou caso de
uso (há teste de arquitetura que reprova: `sem-instanciacao-em-telas.spec.ts`).
Nenhuma tela fala com o Supabase: todas leem o SQLite, que a sincronização
alimenta.

```
Tela (props) ⇄ Rota / Hook ⇄ Contexto ⇄ Container ⇄ Caso de uso ⇄ Porta do domínio ⇄ Adaptador
```

## Contextos (`src/presentation/context/`)

Montados em [`src/app/_layout.tsx`](../src/app/_layout.tsx), de fora para
dentro:

| Contexto | Hook | O que expõe |
|---|---|---|
| `ContainerProvider` (via `ContainerProviderSQLite`) | `useContainer`, `useCasos` | O grafo de dependências; `observarFila` avisa quando uma escrita entrou na fila |
| `CameraExpoContext` | `useCameraExpo` | O gateway concreto da câmera, para a `CameraView` registrar o capturador |
| `AuthProvider` | `useAuth` | `usuario`, `perfil`, `nivel`, `empresaId`, `isAutenticado`, `entrar(email, senha)`, `sair()`, `recarregar()` |
| `ConectividadeProvider` | `useConectividade` | `online`, `conhecida` — sobre a porta `IConectividadeGateway` (NetInfo) |
| `SincronizacaoProvider` | `useSincronizacao` | `sincronizando`, `pendentes`, `isolados`, `ultimaSincronizacaoEm`, `aviso`, `estado` da fila, `versaoDosDados`, `sincronizar()`, `tentarDeNovo()` |

**`AuthProvider`** — na abertura só lê a sessão do secure store (sem rede): é
isso que deixa o app abrir em modo avião. `entrar` faz o login na nuvem e a
primeira sincronização antes de liberar a interface.

**`SincronizacaoProvider`** — dispara a sincronização ao abrir autenticado, ao
voltar a rede, 1,5 s após escritas locais e pelo botão. Depois da primeira,
roda as rotinas de manutenção (atrasos, só em administrador; expurgo).
`versaoDosDados` sobe quando chega algo da nuvem, e as telas a usam como
gatilho para reler o SQLite.

## Hooks (`src/presentation/hooks/`)

| Hook | Tela | Papel |
|---|---|---|
| `useAuth` | todas | Lê o `AuthContext` |
| `useHome` | Home, Leituras | Catálogo do técnico e contagem de avisos; relê quando a sincronização traz dados ou a fila muda |
| `usePainelSincronizacao` | Home, Diagnóstico | Junta conexão e sincronização nas props do `PainelSincronizacao` |
| `useNovaLeitura` | Nova leitura | Foto, GPS, valores, confirmação de valor menor, registro |
| `useNotificacoes` | Avisos | Lista paginada, marcar lida, decidir |
| `useAutorizacoes` | Autorizações | Pendentes, autorizar, recusar |
| `useGestaoUsuarios` | Usuários | Busca, filtro, editar, desativar, excluir |
| `useEstrutura` | Estrutura | Empresas, endereços, padrões |
| `useLeiturasUsina` | Leituras da usina | Dia, usina, medidores, calendário |
| `useVoltar` | várias | Volta ou vai para uma rota padrão |

## Testes

- Contextos: [`tests/component/SincronizacaoContextos.spec.tsx`](../tests/component/SincronizacaoContextos.spec.tsx)
  monta os quatro sobre o `criarContainerFake` e prova login offline, leitura
  pendente subindo ao voltar a rede, acesso revogado e "Tentar de novo".
- Telas: `tests/component/*.spec.tsx`, com `@testing-library/react-native` (no
  qual `render` e `fireEvent` são assíncronos).
