# EAS Build — gerar o APK da demonstração

O **EAS Build** é o serviço de nuvem da Expo que compila o app. Aqui ele gera
um **APK** instalável direto no celular, sem loja. A conta Expo e a execução
do build são do dono do projeto.

O app continua abrindo no **Expo Go** (ADR 9.14): o APK é só uma segunda forma
de instalar, útil para a banca não depender do Expo Go.

## O perfil

`eas.json` tem um perfil, `preview`:

```json
"preview": {
  "distribution": "internal",
  "environment": "preview",
  "android": { "buildType": "apk" }
}
```

- `buildType: apk` gera um arquivo instalável (o padrão seria `.aab`, só para
  a Play Store).
- `distribution: internal` gera um link de download para instalar direto.
- `environment: preview` diz de qual ambiente do EAS vêm as variáveis.

## Passo a passo

1. Crie uma conta em <https://expo.dev> (gratuita).
2. Instale a CLI e entre:

   ```bash
   npm install -g eas-cli
   ```

   ```bash
   eas login
   ```

3. Ligue o repositório a um projeto EAS (cria o `projectId` no `app.json`):

   ```bash
   eas init
   ```

4. **Cadastre as variáveis do Supabase no EAS.** O `.env.local` é ignorado
   pelo git e **não** vai para o servidor de build — sem este passo o APK abre
   na tela "Configuração da nuvem ausente".

   ```bash
   eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --environment preview --visibility plaintext
   ```

   ```bash
   eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <chave-anon> --environment preview --visibility plaintext
   ```

   *Plaintext* é a visibilidade certa: variável `EXPO_PUBLIC_` vai embutida no
   app e é pública por natureza. O que protege os dados é o RLS, não o sigilo
   da chave anônima. (Comando conforme a documentação da Expo consultada em
   17/11/2026; se a sua versão da CLI não o reconhecer, rode `eas env --help`.)

5. Gere o APK:

   ```bash
   eas build -p android --profile preview
   ```

   Leva de 10 a 20 minutos na fila gratuita. No fim, a CLI mostra um link e um
   QR code.

6. Instale: abra o link no celular Android, baixe o APK e permita a instalação
   de fonte desconhecida quando o sistema pedir. Ou, com o aparelho no cabo:

   ```bash
   adb install caminho/do/arquivo.apk
   ```

## O que não está aqui, de propósito

- **EAS Update** (atualização pelo ar) e **EAS Submit** (envio às lojas): fora
  do escopo da demonstração.
- **iOS:** exige conta paga da Apple. Para a banca, o Expo Go no iPhone basta.
- **Sentry:** fora desta fase (ADR 10.13).

Referência: <https://docs.expo.dev/build-reference/apk/> e
<https://docs.expo.dev/eas/environment-variables/>.
