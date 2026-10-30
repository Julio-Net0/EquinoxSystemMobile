# Testar no Android com o Expo Go

Guia para rodar o app no seu celular. Leva uns 5 minutos na primeira vez.

> **Antes de começar, leia a seção "O que o Expo Go não consegue testar"** no
> fim. Dois dos recursos mais importantes do app — câmera e GPS — funcionam no
> Expo Go, mas a compressão de foto tem uma limitação que vale conhecer.

---

## 1. Preparar

**No computador**, na pasta do projeto:

```bash
npm install
```

**No celular**, instale o **Expo Go** pela Play Store.

O celular e o computador precisam estar **na mesma rede Wi-Fi**. Se a rede do
trabalho isolar os aparelhos entre si (comum em Wi-Fi corporativo), pule para
"Se o celular não conectar".

---

## 2. Subir o servidor

```bash
npx expo start --clear
```

O `--clear` limpa o cache do bundler. Só é necessário na primeira vez ou depois
de mudar `app.json` / `metro.config.js`.

Vai aparecer um QR Code no terminal.

---

## 3. Abrir no celular

Abra o **Expo Go** e toque em **Scan QR code**. Aponte para o QR do terminal.

A primeira abertura demora: o Metro monta o bundle inteiro e envia para o
celular. Espere a barra de progresso chegar a 100%.

Ao abrir, a tela mostra **"Preparando o aparelho…"** por um instante — é o
SQLite criando o banco e populando os dados de demonstração. Isso acontece
**uma única vez por instalação**.

---

## 4. Entrar

Três contas, todas com a senha **`Equinox@2026`**. O campo aceita o login ou o
e-mail.

| Perfil | Login | O que ver |
|---|---|---|
| Técnico | `tecnico` | Registrar leitura; 3 abas |
| Administrador | `admin` | 4 abas, avisos, telas de administração |
| Super Admin | `super` | Tudo, mais a lista de Empresas na Estrutura |

---

## 5. Roteiro de teste

### 5.1 Login — 1 min

1. Entre com `tecnico` e uma senha errada → deve aparecer
   **"E-mail, usuário ou senha incorretos"**.
2. Entre com a senha certa → vai para a Home.
3. Confira que a saudação mostra **JOÃO** em âmbar e o perfil **USUÁRIO**.
4. Repare que há **3 abas** (Início, Leituras, Perfil). A aba de avisos não
   existe para técnico — é intencional.

### 5.2 Leitura com foto e GPS — o principal, 5 min

1. Toque em **Leitura de padrão** → escolha **Sede administrativa → Padrão
   778811**.
2. A tela mostra **"Anterior: 11.150 kWh"**. O GPS começa a buscar sozinho;
   o Android vai pedir permissão de localização — **permita**.
3. Toque em **REGISTRAR LEITURA** sem fazer mais nada →
   **"Tire a foto do visor do medidor antes de registrar."**
   A foto é obrigatória, o GPS não.
4. Toque em **ABRIR CÂMERA** → permita o acesso → enquadre qualquer coisa na
   moldura âmbar e toque no botão de disparo.
5. Digite **`9000`** no consumo (menor que os 11.150 anteriores) e registre.
   → Deve abrir **"Confira o valor"** com o texto:
   *"A última leitura deste padrão foi 11.150 kWh em …. Você digitou 9.000 kWh.
   Está certo?"*
6. Toque em **Corrigir** → o valor digitado continua lá, nada foi salvo.
7. Troque para **`11500`** e registre → tela de sucesso.

**Testar a substituição:** volte ao mesmo padrão e registre **`11600`** no mesmo
dia. Salva normalmente — a leitura anterior do dia foi substituída, porque só
uma vale por padrão por dia.

**Testar a usina:** escolha **Usina Pampulha → Padrão 993344**. Aparece um
segundo campo, **Injeção (103)**, que é obrigatório ali.

**Testar sem geocerca:** escolha **Depósito Contagem → Padrão 114455**. A tela
avisa que o endereço não tem coordenada cadastrada e a distância não é
conferida.

### 5.3 Administração — 4 min

Saia pelo **Perfil → Sair da conta** e entre como **`admin`**.

1. A Home ganha a seção **Administração** e a aba **Avisos**, com um badge
   vermelho.
2. **Avisos**: a leitura atrasada tem **Aprovar** e **Descartar**. Aprove → o
   card passa a mostrar quem resolveu e quando, e os botões somem.
   Se você registrou leituras no passo anterior fora de Belo Horizonte, verá
   também avisos de **leitura fora do local** — isso é o esperado, não um
   defeito (veja "A geocerca" abaixo).
3. **Aprovar cadastros**: a **Maria Souza** está pendente. Tente autorizar sem
   escolher endereço → recusa com *"Selecione ao menos um endereço"*. Escolha
   um e autorize.
4. **Gerenciar usuários**: filtre por **Pendentes**, busque por nome, edite
   alguém. Tente desativar a própria conta → o app recusa.
5. **Gerenciar estrutura**: você vai direto aos endereços da Equinox.
   Expanda **Padrões** num endereço, adicione um número, e tente remover o
   último padrão de um endereço → recusa, porque endereço sem padrão não tem o
   que ler.

### 5.4 Super admin — 1 min

Entre como **`super`**. Em **Gerenciar estrutura** aparece primeiro a lista de
**Empresas** (Equinox e Condomínio Solar do Vale) — só o super admin enxerga
mais de uma empresa e pode cadastrar empresa nova.

---

## O que o Expo Go não consegue testar

**A compressão da foto.** O app reduz a foto para 1080p e ~300 KB antes de
salvar. O `expo-image-manipulator` funciona no Expo Go, mas se você vir
comportamento estranho no tamanho do arquivo, é limitação do ambiente, não do
código. Para conferir de verdade é preciso um *development build*.

**As fotos do seed.** As leituras históricas de demonstração apontam para um
arquivo que não existe — elas foram criadas sem passar pela câmera. Só as
leituras que **você** registrar terão foto de verdade.

**A geocerca.** O raio é de 500 m e as coordenadas do seed são de Belo
Horizonte. Testando de qualquer outro lugar, toda leitura vai gerar o aviso de
*leitura fora do local*. **Isso é o comportamento correto** — a leitura nunca é
bloqueada por distância, só avisa o administrador. Para testar sem esse ruído,
use o **Depósito Contagem**, que não tem coordenada.

---

## Se o celular não conectar

**Rede corporativa ou aparelhos isolados** — force o túnel:

```bash
npx expo start --tunnel
```

Mais lento, mas atravessa quase qualquer rede.

**Alternativa por cabo USB:**

```bash
npx expo start --localhost --android
```

Exige depuração USB ligada e o `adb` instalado.

---

## Recomeçar do zero

O seed roda uma vez por instalação, controlado pelo `PRAGMA user_version` do
SQLite. Para repopular os dados de demonstração:

no celular, **Configurações → Apps → Expo Go → Armazenamento → Limpar dados**.

Isso apaga os dados de todos os projetos abertos no Expo Go, não só deste.

---

## Se algo quebrar

Sacuda o celular para abrir o menu do Expo Go e toque em **Reload**.

Se o erro persistir, o terminal do `npx expo start` mostra a mensagem completa
com o arquivo e a linha. Vale copiar daí, não da tela do celular, que trunca.
