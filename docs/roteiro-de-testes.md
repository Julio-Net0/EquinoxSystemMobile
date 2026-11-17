# Roteiro de testes — Equinox Mobile

33 casos, cerca de 25 minutos. Para subir o app no celular, veja
[testar-no-android.md](testar-no-android.md). Pré-requisito: o projeto
Supabase configurado ([supabase-setup.md](supabase-setup.md)) e o `.env.local`
preenchido.

```bash
npx expo start --clear
```

Senha de todas as contas: **`Equinox@2026`**. O login é **por e-mail**.

---

## A. Autenticação — 3 min

| # | Caso | Passos | Esperado |
|---|---|---|---|
| A1 | Credencial errada é recusada | `tecnico@equinox.dev` com senha errada | `E-mail ou senha incorretos`. A mesma frase para conta inexistente, de propósito |
| A2 | Nome de usuário não entra mais | Entrar com `tecnico` | Explica que o acesso é por e-mail |
| A3 | Primeiro login exige rede | Com o modo avião ligado, num aparelho sem sessão, entrar | `Sem conexão. O primeiro acesso neste aparelho precisa de internet…` |
| A4 | Pendente não entra | `maria@equinox.dev` | `Seu cadastro ainda aguarda autorização…` |
| A5 | Abas mudam conforme o perfil | Contar as abas como técnico e como admin | Técnico vê 3; administrador vê 4, com Avisos |
| A6 | Tela protegida exige sessão | Sair e tentar voltar pelo botão de voltar do Android | Permanece no login |

## B. Leitura de padrão — 6 min

Use **Sede administrativa → Padrão 778811**, cuja última leitura é 11.150 kWh.

| # | Caso | Passos | Esperado |
|---|---|---|---|
| B1 | Foto é obrigatória | Registrar sem fazer mais nada | `Tire a foto do visor do medidor antes de registrar.` |
| B2 | Câmera captura | Abrir câmera, permitir, disparar | A foto aparece com a opção Tirar de novo |
| B3 | GPS é buscado sozinho | Observar Localização ao abrir a tela | Passa de Obtendo para Localização obtida sem toque |
| B4 | Valor menor pede confirmação | Digitar `9000` e registrar | Pergunta de conferência com o último valor |
| B5 | Corrigir não salva | Tocar em Corrigir | Volta ao formulário. Nada gravado |
| B6 | Registro válido conclui | Trocar para `11500` e registrar | Tela de sucesso |
| B7 | Segunda leitura substitui a do dia | Registrar `11600` no mesmo dia | Só uma leitura vale por padrão por dia |
| B8 | Usina exige a injeção | Usina Pampulha → Padrão 993344, só consumo | Registro recusado sem a injeção |
| B9 | Endereço sem geocerca avisa | Depósito Contagem → Padrão 114455 | Informa que a distância não é conferida |

## C. Offline e sincronização — 8 min

O coração da demonstração. Faça como `tecnico@equinox.dev`.

| # | Caso | Passos | Esperado |
|---|---|---|---|
| C1 | Login traz os dados da nuvem | Instalação nova, entrar com rede | Home com "Tudo sincronizado"; catálogo com os endereços |
| C2 | Reabre offline | Modo avião, fechar o app (deslizar para fora), reabrir | Entra direto, sem pedir senha. Painel: "Offline" |
| C3 | Leitura offline fica pendente | Ainda em modo avião, registrar leitura com foto | Painel: "Offline · 1 item pendente de envio"; catálogo: "Pendente de envio" |
| C4 | Sobe sozinho ao voltar a rede | Desligar o modo avião e esperar | Sem tocar em nada: painel "Tudo sincronizado", catálogo "Sincronizada" |
| C5 | Está mesmo na nuvem | Painel do Supabase → `leituras` e Storage → `comprovantes` | A linha e a foto, em `<empresa>/<endereço>/<leitura>.jpg` |
| C6 | O que é criado na nuvem chega | No painel, criar um padrão no endereço da Sede; no app, "Sincronizar agora" | O padrão aparece no catálogo |
| C7 | Diagnóstico mostra a fila | Perfil → Diagnóstico e sincronização, com um item pendente | Conexão, itens na fila, tentativas e a hora da última sincronização. Versão do schema **3** |
| C8 | Sair avisa dos pendentes | Com item pendente, abrir o Perfil | Aviso de que há itens não enviados antes do botão Sair |
| C9 | Foto por URL assinada | Como `admin`, Leituras da usina → dia da leitura → "Ver foto" | Abre a foto. Se ela não estiver no aparelho, a legenda diz que veio por endereço assinado |

## D. Isolamento entre empresas — 2 min

| # | Caso | Passos | Esperado |
|---|---|---|---|
| D1 | Outra empresa não vê | Entrar como `sindica@solardovale.dev` | Só o Bloco A e a Usina do condomínio; nenhuma leitura nem foto da Equinox |
| D2 | Roteiro técnico | Os três testes `curl` de [supabase-setup.md](supabase-setup.md#roteiro-de-segurança-manual-no-painel) | Leitura alheia invisível, inserção em endereço alheio recusada, foto sem URL assinada recusada |

## E. Administração — 5 min

Entre como `admin@equinox.dev`.

| # | Caso | Passos | Esperado |
|---|---|---|---|
| E1 | Decidir leitura atrasada | Avisos → Aprovar na leitura do padrão 881122 | Card mostra `Aprovada em …`; sobe para a nuvem |
| E2 | Autorizar sem endereço é recusado | Autorizar Maria Souza sem endereço | `Selecione ao menos um endereço…` |
| E3 | Autorizar com endereço | Escolher um endereço e autorizar; depois entrar como `maria@equinox.dev` em outro aparelho | Maria entra e vê só o endereço vinculado |
| E4 | Não mexe na própria conta | Tentar Desativar e Excluir o próprio admin | As duas recusadas |
| E5 | Escopo por empresa | Gerenciar estrutura | Só os endereços da Equinox |

## F. Super admin — 2 min

| # | Caso | Passos | Esperado |
|---|---|---|---|
| F1 | Lista de empresas | Gerenciar estrutura | Equinox e Condomínio Solar do Vale |
| F2 | CNPJ inválido recusado | Nova empresa com CNPJ `11111111111111` | Mensagem sobre CNPJ inválido |
| F3 | Avisos das duas empresas | Aba Avisos | Aparecem também os do Condomínio |

---

## Comportamentos que parecem defeito e não são

**A geocerca.** O seed usa coordenadas de Belo Horizonte, raio de 500 m. Em
outra cidade, toda leitura gera aviso de fora do local. A leitura **nunca** é
bloqueada. Use o Depósito Contagem para evitar o ruído.

**As fotos do seed.** Não existem em lugar nenhum — nasceram sem câmera. Só as
que você registrar têm foto.

**"Sua sessão na nuvem expirou".** Aparece quando o token de renovação foi
revogado (troca de senha em outro aparelho, por exemplo). O app continua
funcionando offline; os pendentes ficam guardados até um novo login com rede.

## O que este roteiro não cobre

A compressão da foto para 1080p e ~300 KB. O `expo-image-manipulator` funciona
no Expo Go, mas conferir o tamanho final com rigor exige um *development build*.
