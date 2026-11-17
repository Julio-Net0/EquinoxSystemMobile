# Supabase — o que o dono do projeto precisa fazer

O app não cria contas nem projetos em serviços externos. Estes passos são
seus, uma vez só. Depois deles, o app já sincroniza.

Tempo estimado: 20 minutos.

> **Por que não há um "modo sem nuvem".** Sem a URL e a chave, o app abre numa
> tela que explica o que falta, em vez de subir com um cliente de mentira. Foi
> esse tipo de atalho silencioso que escondeu, numa fase anterior, que nada
> estava sendo salvo (ADRs 9.2, 9.9 e 10.1).

---

## 1. Criar o projeto

1. Entre em <https://supabase.com/dashboard> e crie um projeto (o plano
   gratuito basta). Região: **South America (São Paulo)**.
2. Anote a senha do banco num gerenciador de senhas. O app não precisa dela.

## 2. Aplicar o schema, as políticas e o bucket

1. No painel, abra **SQL Editor → New query**.
2. Cole o conteúdo inteiro de
   [`supabase/migrations/20261116120000_schema_equinox.sql`](../supabase/migrations/20261116120000_schema_equinox.sql)
   e clique em **Run**.
3. Deve terminar sem erro. Ele cria as tabelas, liga o RLS em todas, cria as
   funções auxiliares no schema `private`, os gatilhos, as funções
   `buscar_empresas_cadastro`, `sincronizar_leitura` e `sincronizar_perfil`, o
   bucket **privado** `comprovantes` e as políticas do Storage.

4. Depois, rode **cada arquivo seguinte** da pasta `supabase/migrations/`, na
   ordem do nome. Hoje há mais um:
   `20261117120000_perfil_horario_em_milissegundos.sql` (correção que permite
   ao usuário editar o próprio perfil pelo app — ADR 10.16). Ele pode ser
   rodado de novo sem efeito colateral.

> Se tiver o Supabase CLI, o equivalente é `supabase link` seguido de
> `supabase db push`. Pelo painel funciona igual.

**Conferir:** em **Table Editor**, cada tabela deve mostrar o selo
"RLS enabled". Em **Storage**, o bucket `comprovantes` deve aparecer como
*Private*.

## 3. Criar os dados e os usuários de demonstração

1. Ainda no **SQL Editor**, cole e rode
   [`supabase/seed.sql`](../supabase/seed.sql).
2. Ele cria as duas empresas, os seis endereços, os sete padrões, o histórico
   de leituras e **cinco usuários** com a senha `Equinox@2026`:

| E-mail | Perfil | Empresa |
|---|---|---|
| `super@equinox.dev` | Super Admin | todas |
| `admin@equinox.dev` | Administrador | Equinox Energia Solar |
| `tecnico@equinox.dev` | Técnico | Equinox Energia Solar |
| `maria@equinox.dev` | Técnico **pendente** | Equinox Energia Solar |
| `sindica@solardovale.dev` | Administradora | Condomínio Solar do Vale |

Os identificadores são os mesmos do seed local do app: o primeiro login não
duplica nada.

3. **Se você já havia rodado uma versão anterior do `seed.sql`:** rode no **SQL
   Editor** o script de correção
   [`supabase/correcoes/20261117_autoria_seed_condominio.sql`](../supabase/correcoes/20261117_autoria_seed_condominio.sql).
   Ele passa a autoria e a decisão das duas leituras do Condomínio Solar do Vale
   (e o texto do aviso correspondente) para `Helena Síndica` (ADR 10.19). É
   idempotente e pode rodar mais de uma vez.

> **Atenção à senha.** No seu projeto, `Equinox@2026` passa a ser uma senha de
> verdade. Se o repositório for público, troque o valor de `v_senha` no
> `seed.sql` antes de rodar e **não** faça commit do valor novo.

> **Atenção às datas.** O seed data o histórico relativo ao dia em que roda,
> como o seed local. Se rodar num dia e instalar o app em outro, o histórico
> fica deslocado alguns dias; o app se realinha à nuvem no primeiro login.

## 4. Configurar a autenticação

Em **Authentication → Providers → Email**:

- **Enable Email provider:** ligado.
- **Confirm email:** para a demonstração, **desligue**. Ligado, quem se
  cadastra precisa clicar no link do e-mail antes de o administrador poder
  autorizá-lo — funciona, mas complica a apresentação. O app trata os dois
  casos.
- **Minimum password length:** 6, o mesmo que o app valida.

Em **Authentication → URL Configuration** não é preciso nada: o app não usa
login por link.

## 5. Ligar o app ao projeto

1. Em **Project Settings → API** (ou **API Keys**), copie:
   - a **Project URL** (`https://<ref>.supabase.co`);
   - a chave **anon** / **publishable**.
2. Na raiz do repositório, copie o modelo e preencha:

   ```bash
   cp .env.example .env.local
   ```

3. Reinicie o Expo limpando o cache:

   ```bash
   npx expo start -c
   ```

> **Nunca** use a chave `service_role` / `secret`. Ela ignora todas as
> políticas de segurança. O app a recusa ao iniciar e mostra o motivo; se ela
> chegou a ir para algum arquivo, troque-a no painel (**Project Settings → API
> → Reset**), porque foi exposta.

O `.gitignore` ignora `.env` e `.env.*` (menos o `.env.example`), então o
`.env.local` não vai para o git.

---

## 6. Verificação de ponta a ponta

Com o celular no Expo Go (ou o APK de `docs/eas-build.md`):

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 1 | Entrar como `tecnico@equinox.dev` | Entra; a Home mostra "Tudo sincronizado" |
| 2 | Perfil → Diagnóstico e sincronização | "Última sincronização" com a hora de agora |
| 3 | Ligar o **modo avião**, fechar o app (deslizar para fora) e reabrir | Abre já autenticado; o painel diz "Offline" |
| 4 | Registrar uma leitura com foto | Grava; o painel diz "Offline · 1 item pendente de envio"; no catálogo a leitura aparece "Pendente de envio" |
| 5 | Desligar o modo avião | Em segundos, sem tocar em nada, o painel passa a "Tudo sincronizado" e a leitura a "Sincronizada" |
| 6 | No painel: **Table Editor → leituras** | A leitura nova está lá, com `foto_path` |
| 7 | No painel: **Storage → comprovantes** | A foto está em `<empresa>/<endereço>/<leitura>.jpg` |
| 8 | No painel, inserir um padrão novo em `padroes_cemig` para o endereço `2b000000-0000-4000-8000-000000000001` | No app, "Sincronizar agora" — o padrão aparece no catálogo |
| 9 | Sair e entrar como `sindica@solardovale.dev` | Não vê a leitura nem a foto da Equinox (Leituras diárias mostra só os endereços do condomínio) |

### Roteiro de segurança (manual, no painel)

O `npm run test:rls` prova as políticas num Postgres local. Estes três testes
provam o mesmo no seu projeto de verdade, pela API pública.

**Jeito rápido (Windows):** o script abaixo lê a URL e a chave do
`.env.local`, pede a senha das contas de demonstração sem mostrá-la e roda os
três testes, dizendo OK ou FALHOU em cada um:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\testar-seguranca.ps1
```

**À mão, com `curl`:** substitua `URL` e `ANON` pelos seus valores.

**a) Usuário da empresa B tentando ler dado da empresa A.**

```bash
# 1. Token da administradora do condomínio
curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" --data '{"email":"sindica@solardovale.dev","password":"Equinox@2026"}'

# 2. Com o access_token devolvido, pedir as leituras
curl -s "$URL/rest/v1/leituras?select=id,empresa_id" -H "apikey: $ANON" -H "Authorization: Bearer <access_token>"
```

Esperado: só linhas com `empresa_id` `1a000000-0000-4000-8000-000000000002`.

**b) Técnico tentando inserir leitura em endereço alheio.** Com o token de
`tecnico@equinox.dev`, chame a função para o padrão do Galpão Savassi (ao qual
ele não está vinculado):

```bash
curl -s "$URL/rest/v1/rpc/sincronizar_leitura" -H "apikey: $ANON" -H "Authorization: Bearer <token_do_tecnico>" -H "Content-Type: application/json" --data '{"p":{"id":"9b000000-0000-4000-8000-000000000001","padrao_id":"3c000000-0000-4000-8000-000000000003","usuario_id":"4d000000-0000-4000-8000-000000000003","valor_consumo":1,"foto_path":"x/y/z.jpg","medido_em":"2026-11-17T15:00:00Z","data_local":"2026-11-17","status":"registrada"}}'
```

Esperado: erro `Você não está vinculado ao endereço deste padrão`.

**c) Foto sem URL assinada.** Pegue o caminho de uma foto enviada no passo 7 e
tente o endereço público:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$URL/storage/v1/object/public/comprovantes/<caminho>"
```

Esperado: **400** ou **404** (o bucket não é público). Só o app, logado e com
permissão, consegue uma URL assinada — que expira em 60 segundos.

---

## 7. Se algo der errado

| Sintoma | Causa provável |
|---|---|
| Tela "Configuração da nuvem ausente" | `.env.local` faltando ou Expo não reiniciado com `-c` |
| "Sem conexão…" com internet funcionando | URL errada (confira o `https://` e o `.supabase.co`) |
| "Sua conta não tem perfil neste app" | Usuário criado à mão no painel, sem linha em `perfis` |
| "Seu cadastro ainda aguarda autorização" | Esperado para cadastro novo: um administrador precisa autorizar |
| Item "não pôde ser enviado" no Diagnóstico | O servidor recusou; o motivo aparece embaixo do item |
| "A foto do medidor não foi encontrada no aparelho" | Leitura de antes da atualização cuja foto se perdeu. Sem foto ela nunca sobe: no Diagnóstico, "Descartar item" (ADR 10.15) |
