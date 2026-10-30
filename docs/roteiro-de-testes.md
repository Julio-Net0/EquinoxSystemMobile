# Roteiro de testes — Equinox Mobile

27 casos, cerca de 20 minutos. Para o passo a passo de como subir o app no
celular, veja [testar-no-android.md](testar-no-android.md).

```bash
npx expo start --clear
```

Senha das três contas (`tecnico`, `admin`, `super`): **`Equinox@2026`**.
O campo de login aceita o nome de usuário ou o e-mail.

---

## A. Autenticação — 2 min

| # | Caso | Passos | Esperado |
|---|---|---|---|
| A1 | Credencial errada é recusada | Entrar com `tecnico` e uma senha errada | `E-mail, usuário ou senha incorretos`. A mesma frase aparece para usuário inexistente, de propósito |
| A2 | Login por usuário e por e-mail | Entrar com `tecnico`, sair, entrar com `tecnico@equinox.dev` | As duas formas levam à Home |
| A3 | Abas mudam conforme o perfil | Contar as abas como `tecnico` e como `admin` | Técnico vê 3; administrador vê 4, com Avisos e badge. Saudação com o primeiro nome em âmbar |
| A4 | Tela protegida exige sessão | Sair e tentar voltar pelo botão de voltar do Android | Permanece no login |

## B. Leitura de padrão — 6 min

Use **Sede administrativa → Padrão 778811**, cuja última leitura é 11.150 kWh.

| # | Caso | Passos | Esperado |
|---|---|---|---|
| B1 | Foto é obrigatória | Registrar sem fazer mais nada | `Tire a foto do visor do medidor antes de registrar.` A foto é obrigatória; o GPS não |
| B2 | Câmera captura | Abrir câmera, permitir, disparar | A foto aparece com a opção Tirar de novo |
| B3 | GPS é buscado sozinho | Observar Localização ao abrir a tela | Passa de Obtendo para Localização obtida sem toque. Falhando, mostra Sem localização + Tentar |
| B4 | Valor menor pede confirmação | Digitar `9000` e registrar | `A última leitura deste padrão foi 11.150 kWh em … Você digitou 9.000 kWh. Está certo?` |
| B5 | Corrigir não salva | Tocar em Corrigir | Volta ao formulário com o 9000 digitado. Nada gravado |
| B6 | Registro válido conclui | Trocar para `11500` e registrar | Tela de sucesso com valor e padrão |
| B7 | Segunda leitura substitui a do dia | Registrar `11600` no mesmo dia | Salva. Ao reabrir, Anterior mostra 11.600 — só uma leitura vale por padrão por dia |
| B8 | Usina exige a injeção | Usina Pampulha → Padrão 993344, só consumo | Aparece Injeção (103) e o registro é recusado sem ele |
| B9 | Endereço sem geocerca avisa | Depósito Contagem → Padrão 114455 | Informa que não há coordenada e a distância não é conferida |

## C. Persistência local — 5 min

Faça depois de registrar ao menos uma leitura.

| # | Caso | Passos | Esperado |
|---|---|---|---|
| C1 | Fechar o app e reabrir | Apps recentes → **deslizar o Expo Go para fora**. Reabrir e voltar ao Padrão 778811 | Anterior mostra o valor que você registrou, não o do seed. **Prova definitiva** |
| C2 | Modo avião | Ligar o modo avião e repetir um registro completo | Funciona igual. O app nunca usa rede |
| C3 | Contagem de leituras sobe | Perfil → Diagnóstico local, anotar Leituras. Registrar uma e atualizar | O número sobe em 1. Prova que a gravação chegou ao banco |
| C4 | A foto existe no disco | Olhar a marca da leitura recém-registrada | `Foto no disco`. As de demonstração ficam como Foto ausente |
| C5 | Banco migrado | Conferir o cabeçalho Banco de dados | `equinox.db`, Versão do schema `2` |
| C6 | Contagens iniciais | Numa instalação nova, conferir Linhas por tabela | 2 empresas, 6 endereços, 7 padrões, 4 usuários, 7 vínculos, 12 leituras, 3 notificações |

## D. Administração — 5 min

Entre como `admin`, que enxerga apenas a Equinox Energia Solar.

| # | Caso | Passos | Esperado |
|---|---|---|---|
| D1 | Decidir leitura atrasada | Avisos → Aprovar na leitura do padrão 881122 | Botões somem, card mostra `Aprovada em …`, ponto de não lida some |
| D2 | Autorizar sem endereço é recusado | Aprovar cadastros → Autorizar Maria Souza sem escolher endereço | `Selecione ao menos um endereço (perfis Usuário e Administrador)` |
| D3 | Autorizar com endereço | Escolher um endereço e autorizar | Sai dos pendentes; aparece como Ativo em Gerenciar usuários |
| D4 | Não mexe na própria conta | Tentar Desativar e Excluir o próprio Carlos Administrador | As duas recusadas |
| D5 | Endereço não fica sem padrão | Expandir Padrões num endereço de 1 padrão e remover | `O endereço precisa de ao menos um padrão` |
| D6 | Escopo por empresa | Gerenciar estrutura como `admin` | Vai direto aos endereços da Equinox; os do Condomínio não aparecem |

## E. Super admin — 2 min

| # | Caso | Passos | Esperado |
|---|---|---|---|
| E1 | Lista de empresas | Gerenciar estrutura | Abre a lista com Equinox e Condomínio Solar do Vale |
| E2 | CNPJ inválido recusado | Nova empresa com CNPJ `11111111111111` | Mensagem sobre CNPJ inválido, não erro cru do banco |
| E3 | Avisos das duas empresas | Abrir a aba Avisos | Aparecem também os avisos do Condomínio |

---

## Dois comportamentos que parecem defeito e não são

**A geocerca.** O seed usa coordenadas de Belo Horizonte, raio de 500 m.
Testando de outra cidade, toda leitura gera aviso de fora do local. A leitura
**nunca** é bloqueada por distância — só avisa o administrador. Para testar sem
esse ruído, use o Depósito Contagem, que não tem coordenada.

**As fotos do seed.** As leituras de demonstração aparecem como *Foto ausente*
no diagnóstico porque nasceram sem passar pela câmera. Só as que você registrar
devem aparecer como *Foto no disco* — se aparecerem como ausente, aí sim há
problema.

## O que este roteiro não cobre

A compressão da foto para 1080p e ~300 KB. O `expo-image-manipulator` funciona
no Expo Go, mas conferir o tamanho final com rigor exige um *development build*.
