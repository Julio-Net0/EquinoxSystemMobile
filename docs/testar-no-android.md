# Testar no Android com o Expo Go

Guia para rodar o app no seu celular e conferir que os dados estão mesmo sendo
gravados no aparelho.

- [1. Preparar](#1-preparar)
- [2. Subir o servidor](#2-subir-o-servidor)
- [3. Abrir no celular](#3-abrir-no-celular)
- [4. Entrar](#4-entrar)
- [5. Roteiro de teste](#5-roteiro-de-teste) — 11 min
- [6. Como verificar que está salvo local](#6-como-verificar-que-está-salvo-local) ← a parte importante
- [7. O que o Expo Go não cobre](#7-o-que-o-expo-go-não-cobre)
- [8. Se o celular não conectar](#8-se-o-celular-não-conectar)

---

## 1. Preparar

No computador, na pasta do projeto:

```bash
npm install
```

No celular, instale o **Expo Go** pela Play Store.

Celular e computador na **mesma rede Wi-Fi**. Se a rede isolar os aparelhos
entre si (comum em Wi-Fi corporativo), pule para a seção 8.

---

## 2. Subir o servidor

```bash
npx expo start --clear
```

O `--clear` limpa o cache do bundler. Só é necessário na primeira vez ou depois
de mudar `app.json` / `metro.config.js`.

---

## 3. Abrir no celular

Abra o **Expo Go** → **Scan QR code** → aponte para o QR do terminal.

A primeira abertura demora: o Metro monta o bundle inteiro e envia. Espere a
barra chegar a 100%.

Ao abrir aparece **"Preparando o aparelho…"** por um instante — é o SQLite
criando o banco e populando os dados de demonstração. Acontece **uma vez por
instalação**.

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

1. Entre com `tecnico` e uma senha errada → **"E-mail, usuário ou senha
   incorretos"**.
2. Entre com a senha certa → vai para a Home.
3. A saudação mostra **JOÃO** em âmbar, perfil **USUÁRIO**.
4. Repare: **3 abas** (Início, Leituras, Perfil). A de avisos não existe para
   técnico — é intencional.

### 5.2 Leitura com foto e GPS — o principal, 5 min

1. **Leitura de padrão** → **Sede administrativa → Padrão 778811**.
2. A tela mostra **"Anterior: 11.150 kWh"**. O GPS começa a buscar sozinho; o
   Android pede permissão de localização — **permita**.
3. Toque em **REGISTRAR LEITURA** sem mais nada →
   **"Tire a foto do visor do medidor antes de registrar."**
   A foto é obrigatória; o GPS não.
4. **ABRIR CÂMERA** → permita → enquadre qualquer coisa na moldura âmbar →
   botão de disparo.
5. Digite **`9000`** (menor que os 11.150 anteriores) e registre →
   abre **"Confira o valor"**:
   *"A última leitura deste padrão foi 11.150 kWh em …. Você digitou 9.000 kWh.
   Está certo?"*
6. **Corrigir** → o valor digitado continua lá, nada foi salvo.
7. Troque para **`11500`** e registre → tela de sucesso.

**Substituição:** volte ao mesmo padrão e registre **`11600`** no mesmo dia.
Salva normalmente — a leitura anterior do dia foi substituída, porque só uma
vale por padrão por dia.

**Usina:** **Usina Pampulha → Padrão 993344** tem um segundo campo,
**Injeção (103)**, obrigatório ali.

**Sem geocerca:** **Depósito Contagem → Padrão 114455** avisa que o endereço
não tem coordenada e a distância não é conferida.

### 5.3 Administração — 4 min

Saia pelo **Perfil → Sair da conta** e entre como **`admin`**.

1. A Home ganha **Administração** e a aba **Avisos**, com badge vermelho.
2. **Avisos**: a leitura atrasada tem **Aprovar** e **Descartar**. Aprove → o
   card passa a mostrar quem resolveu e quando.
3. **Aprovar cadastros**: **Maria Souza** está pendente. Tente autorizar sem
   escolher endereço → *"Selecione ao menos um endereço"*. Escolha um e
   autorize.
4. **Gerenciar usuários**: filtre, busque, edite. Tente desativar a própria
   conta → recusa.
5. **Gerenciar estrutura**: expanda **Padrões** num endereço, adicione um
   número, tente remover o último padrão → recusa, porque endereço sem padrão
   não tem o que ler.

### 5.4 Super admin — 1 min

Entre como **`super`**. Em **Gerenciar estrutura** aparece primeiro a lista de
**Empresas** — só o super admin vê mais de uma e pode cadastrar empresa nova.

---

## 6. Como verificar que está salvo local

Três provas, da mais simples à mais detalhada.

### 6.1 Feche o app e reabra — a prova definitiva

1. Registre uma leitura (passo 5.2).
2. **Feche o Expo Go de verdade**: botão de apps recentes → deslize o Expo Go
   para fora. Não basta ir para a tela inicial.
3. Reabra o Expo Go e entre de novo no projeto.
4. Vá em **Leituras → Sede administrativa → Padrão 778811**.

A tela mostra **"Anterior: 11.600 kWh"** — o valor que *você* registrou, não o
11.150 do seed. Se o dado estivesse só na memória do app, teria sumido.

### 6.2 Modo avião — prova que não depende de rede

Ligue o **modo avião** e repita o passo 5.2 inteiro: registrar, fotografar,
salvar, consultar. Tudo funciona.

O GPS continua funcionando em modo avião na maioria dos aparelhos, porque é
recepção de satélite. Se o seu desligar junto, a leitura é gravada sem
localização e gera um aviso — que também é o comportamento correto.

> O app **nunca** usa rede. Não há servidor, não há sincronização. O modo avião
> não muda nada, e é por isso que ele é uma boa prova.

### 6.3 Tela de diagnóstico — ver o banco por dentro

**Perfil → Diagnóstico local.**

Mostra o que está gravado no SQLite deste aparelho:

**Banco de dados**
- `equinox.db` — o arquivo, na área privada do app
- **Versão do schema** — o `PRAGMA user_version`, que diz até que migração o
  banco foi levado. Deve ser **2** (1 = estrutura, 2 = dados de demonstração).

**Linhas por tabela** — contagem real de cada tabela. Logo após instalar:

| Tabela | Esperado |
|---|---|
| Empresas | 2 |
| Endereços | 6 |
| Padrões | 7 |
| Usuários | 4 |
| Vínculos usuário-endereço | 7 |
| Leituras | 12 |
| Notificações | 3 |

**Cada leitura que você registrar aumenta "Leituras" em 1.** Registre uma,
puxe para atualizar, e veja o número subir. Essa é a prova de que a gravação
chegou ao banco, e não parou num estado de tela.

**Suas últimas leituras gravadas** — valor, injeção, dia local e status de cada
uma, mais duas marcas:

- **Foto no disco** — o arquivo da imagem existe mesmo. A linha no banco e o
  arquivo são coisas separadas, e esta marca confere a segunda.
- **Com GPS / Sem GPS** — se a leitura guardou coordenadas.

As leituras de demonstração aparecem como **Foto ausente**: elas foram criadas
sem passar pela câmera. As que *você* registrar devem aparecer como **Foto no
disco** — se aparecerem como ausente, aí sim há um problema.

### 6.4 Recomeçar do zero

O seed roda uma vez por instalação, controlado pelo `user_version`. Para
repopular: **Configurações → Apps → Expo Go → Armazenamento → Limpar dados**.

Isso apaga os dados de todos os projetos abertos no Expo Go, não só deste.

---

## 7. O que o Expo Go não cobre

**A compressão da foto.** O app reduz para 1080p e ~300 KB antes de salvar. O
`expo-image-manipulator` funciona no Expo Go, mas para conferir o tamanho final
com rigor é preciso um *development build*.

**As fotos do seed.** Apontam para um arquivo que não existe — é por isso que
aparecem como "Foto ausente" no diagnóstico. Só as que você registrar têm
imagem de verdade.

**A geocerca.** Raio de 500 m, coordenadas do seed em Belo Horizonte. Testando
de outra cidade, toda leitura gera o aviso de *leitura fora do local*. **Isso é
o comportamento correto** — a leitura nunca é bloqueada por distância, só avisa
o administrador. Para testar sem esse ruído, use o **Depósito Contagem**, que
não tem coordenada.

---

## 8. Se o celular não conectar

Rede corporativa ou aparelhos isolados — force o túnel:

```bash
npx expo start --tunnel
```

Mais lento, mas atravessa quase qualquer rede.

Alternativa por cabo USB (exige depuração USB e `adb`):

```bash
npx expo start --localhost --android
```

---

## Se algo quebrar

Sacuda o celular para abrir o menu do Expo Go → **Reload**.

Se persistir, o terminal do `npx expo start` mostra a mensagem completa com
arquivo e linha. Copie de lá, não da tela do celular, que trunca.
