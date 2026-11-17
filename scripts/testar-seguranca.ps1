# Roteiro de segurança contra o projeto Supabase real (docs/supabase-setup.md).
#
# Usa só a API pública e a chave anônima do .env.local, como o app. Pede a
# senha das contas de demonstração uma vez, sem mostrá-la, e não a grava.
#
#   powershell -ExecutionPolicy Bypass -File scripts\testar-seguranca.ps1
#
# Testes:
#   a) a administradora do condomínio não lê nada da Equinox;
#   b) o técnico não registra leitura em endereço ao qual não está vinculado;
#   c) a foto não abre pelo endereço público, e outra empresa não a baixa nem
#      com login — só por URL assinada, que o app pede ao servidor.

$ErrorActionPreference = 'Stop'

$EQUINOX = '1a000000-0000-4000-8000-000000000001'
$CONDOMINIO = '1a000000-0000-4000-8000-000000000002'
$PADRAO_SAVASSI = '3c000000-0000-4000-8000-000000000003'
$TECNICO = '4d000000-0000-4000-8000-000000000003'

# --------------------------------------------------------------- configuração
$envFile = Join-Path $PSScriptRoot '..\.env.local'
if (-not (Test-Path $envFile)) { throw '.env.local não encontrado na raiz do projeto.' }
$config = @{}
Get-Content $envFile | Where-Object { $_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$' } | ForEach-Object {
  $config[$Matches[1]] = $Matches[2]
}
$URL = $config['EXPO_PUBLIC_SUPABASE_URL'].TrimEnd('/')
$ANON = $config['EXPO_PUBLIC_SUPABASE_ANON_KEY']
if (-not $URL -or -not $ANON) { throw 'Faltam as variáveis EXPO_PUBLIC_SUPABASE_* no .env.local.' }

$seguro = Read-Host -AsSecureString 'Senha das contas de demonstração'
$SENHA = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro))

$falhas = 0
function Resultado($nome, $passou, $detalhe) {
  if ($passou) { Write-Host "  OK      $nome" -ForegroundColor Green }
  else { Write-Host "  FALHOU  $nome — $detalhe" -ForegroundColor Red; $script:falhas++ }
}

function Token($email) {
  $corpo = @{ email = $email; password = $SENHA } | ConvertTo-Json
  $r = Invoke-RestMethod -Method Post -Uri "$URL/auth/v1/token?grant_type=password" `
    -Headers @{ apikey = $ANON } -ContentType 'application/json' -Body $corpo
  return $r.access_token
}

function Cabecalhos($token) { @{ apikey = $ANON; Authorization = "Bearer $token" } }

# Status HTTP e corpo de uma chamada que pode falhar, sem estourar o script.
function Chamar($metodo, $uri, $cabecalhos, $corpo) {
  try {
    $params = @{ Method = $metodo; Uri = $uri; Headers = $cabecalhos; UseBasicParsing = $true }
    if ($corpo) { $params.ContentType = 'application/json'; $params.Body = $corpo }
    $r = Invoke-WebRequest @params
    return @{ Status = [int]$r.StatusCode; Corpo = $r.Content }
  } catch {
    $status = 0
    $corpo = "$($_.ErrorDetails.Message)"
    $resposta = $_.Exception.Response
    if ($resposta) {
      $status = [int]$resposta.StatusCode
      # No PowerShell 5.1 o corpo do erro às vezes não vem em ErrorDetails;
      # aí ele ainda está no fluxo da resposta.
      if (-not $corpo) {
        try {
          $fluxo = $resposta.GetResponseStream()
          if ($fluxo.CanSeek) { $fluxo.Position = 0 }
          $corpo = (New-Object IO.StreamReader($fluxo, [Text.Encoding]::UTF8)).ReadToEnd()
        } catch { }
      }
    }
    return @{ Status = $status; Corpo = $corpo }
  }
}

Write-Host "`nProjeto: $URL`n"

# ------------------------------------------------- a) isolamento entre empresas
Write-Host 'a) A administradora do condomínio tenta ler dados da Equinox'
$tSindica = Token 'sindica@solardovale.dev'
$leituras = Invoke-RestMethod -Uri "$URL/rest/v1/leituras?select=id,empresa_id" -Headers (Cabecalhos $tSindica)
$enderecos = Invoke-RestMethod -Uri "$URL/rest/v1/enderecos?select=id,empresa_id" -Headers (Cabecalhos $tSindica)
$perfis = Invoke-RestMethod -Uri "$URL/rest/v1/perfis?select=id,empresa_id" -Headers (Cabecalhos $tSindica)
Resultado 'só vê leituras do condomínio' `
  (@($leituras | Where-Object { $_.empresa_id -ne $CONDOMINIO }).Count -eq 0) `
  "$(@($leituras | Where-Object { $_.empresa_id -ne $CONDOMINIO }).Count) leitura(s) de outra empresa"
Resultado 'só vê endereços do condomínio' `
  (@($enderecos | Where-Object { $_.empresa_id -ne $CONDOMINIO }).Count -eq 0) 'viu endereço de outra empresa'
Resultado 'não vê usuários da Equinox' `
  (@($perfis | Where-Object { $_.empresa_id -eq $EQUINOX }).Count -eq 0) 'viu perfil da Equinox'

# ------------------------------------------- b) leitura em endereço não vinculado
Write-Host "`nb) O técnico tenta registrar leitura no Galpão Savassi (não vinculado)"
$tTecnico = Token 'tecnico@equinox.dev'
$agora = (Get-Date).ToUniversalTime()
$medido = $agora.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
$dia = $agora.AddHours(-3).ToString('yyyy-MM-dd')
$leitura = @{ p = @{
  id = [guid]::NewGuid().ToString(); padrao_id = $PADRAO_SAVASSI; usuario_id = $TECNICO
  valor_consumo = 1; foto_path = 'x/y/z.jpg'; medido_em = $medido; data_local = $dia
  status = 'registrada'
} } | ConvertTo-Json -Depth 3
$r = Chamar 'Post' "$URL/rest/v1/rpc/sincronizar_leitura" (Cabecalhos $tTecnico) $leitura
Resultado 'recusada pelo servidor' ($r.Status -ge 400 -and $r.Status -lt 500) `
  "status $($r.Status): $($r.Corpo)"
if ($r.Corpo) { Write-Host "          motivo: $($r.Corpo)" -ForegroundColor DarkGray }

# ------------------------------------------------------------- c) foto privada
Write-Host "`nc) Uma foto enviada pelo app, fora do caminho permitido"
# A foto real mais recente. As do seed (seed-demo.jpg) nunca existiram no
# bucket: com elas tudo daria "não encontrado" e o teste não provaria nada.
$comFoto = Invoke-RestMethod -Uri "$URL/rest/v1/leituras?select=foto_path&foto_path=not.like.*seed-demo.jpg&empresa_id=eq.$EQUINOX&order=criado_em.desc&limit=1" `
  -Headers (Cabecalhos $tTecnico)
if (-not $comFoto -or -not $comFoto[0].foto_path) {
  Write-Host '  (pulado: nenhuma leitura com foto enviada pelo app — registre uma no celular)' -ForegroundColor Yellow
} else {
  $caminho = $comFoto[0].foto_path
  Write-Host "          foto: $caminho" -ForegroundColor DarkGray
  # Controle primeiro: se nem quem tem permissão baixa, os outros resultados
  # não querem dizer nada.
  $dono = Chamar 'Get' "$URL/storage/v1/object/authenticated/comprovantes/$caminho" (Cabecalhos $tTecnico) $null
  Resultado 'quem tem permissão baixa (controle do teste)' ($dono.Status -eq 200) "status $($dono.Status): $($dono.Corpo)"
  if ($dono.Status -ne 200) {
    Write-Host '  (os dois testes abaixo ficam inconclusivos sem o controle)' -ForegroundColor Yellow
  } else {
    $publico = Chamar 'Get' "$URL/storage/v1/object/public/comprovantes/$caminho" @{} $null
    Resultado 'endereço público não abre a foto' ($publico.Status -ge 400) "status $($publico.Status)"
    $alheio = Chamar 'Get' "$URL/storage/v1/object/authenticated/comprovantes/$caminho" (Cabecalhos $tSindica) $null
    Resultado 'outra empresa não baixa a foto, mesmo logada' ($alheio.Status -ge 400) "status $($alheio.Status)"
  }
}

$SENHA = $null
Write-Host ''
if ($falhas -eq 0) { Write-Host 'Todos os testes de segurança passaram.' -ForegroundColor Green }
else { Write-Host "$falhas teste(s) falharam." -ForegroundColor Red; exit 1 }
