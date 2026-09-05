<#
.SYNOPSIS
  Instala o brain-mcp, as skills e os hooks deste repo na maquina atual.

.DESCRIPTION
  Copia skills e hooks para ~/.claude, compila o servidor MCP, registra ele no Claude Code e
  cria os dois arquivos de configuracao pessoais (brain.config.json e brain-workspaces.json)
  a partir dos exemplos, se ainda nao existirem.

  O script NUNCA sobrescreve configuracao pessoal ja existente e nunca apaga skill que nao
  seja deste repo. Pode rodar quantas vezes quiser.

.PARAMETER DryRun
  Mostra o que faria, sem escrever nada.

.PARAMETER SkipBuild
  Nao roda npm install/build (util quando so mudaram skills ou hooks).

.EXAMPLE
  .\install.ps1
  .\install.ps1 -DryRun
#>
[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$claudeHome = $env:CLAUDE_CONFIG_DIR
if (-not $claudeHome) { $claudeHome = Join-Path $HOME '.claude' }
$brainDir = Join-Path $repo 'brain-mcp'

function Say([string]$msg) { Write-Host $msg -ForegroundColor Gray }
function Passo([string]$msg) { Write-Host ''; Write-Host "==> $msg" -ForegroundColor Cyan }
function Aviso([string]$msg) { Write-Host "    ! $msg" -ForegroundColor Yellow }
function Feito([string]$msg) { Write-Host "    + $msg" -ForegroundColor Green }

if ($DryRun) { Write-Host 'MODO DRY-RUN: nada sera escrito.' -ForegroundColor Magenta }

# ---------------------------------------------------------------- 1. pre-requisitos
Passo 'Conferindo pre-requisitos'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node nao encontrado no PATH. Instale Node 22 ou mais novo: https://nodejs.org'
}
$versao = (& node --version).TrimStart('v')
$maior = [int]($versao -split '\.')[0]
# O indice usa node:sqlite, que so existe a partir do Node 22.
if ($maior -lt 22) { throw "Node $versao e velho demais. O brain usa node:sqlite, que exige Node 22+." }
Feito "node $versao"

$opcionais = @(
  @{ nome = 'gh';     para = 'sincronizar cards e PRs do GitHub (fonte "github")' },
  @{ nome = 'git';    para = 'indexar historico de commits (fonte "git")' },
  @{ nome = 'claude'; para = 'registrar o MCP automaticamente' }
)
foreach ($o in $opcionais) {
  if (Get-Command $o.nome -ErrorAction SilentlyContinue) { Feito $o.nome }
  else { Aviso "$($o.nome) nao encontrado - sem ele voce perde: $($o.para)" }
}

# ---------------------------------------------------------------- 2. compilar o servidor
if ($SkipBuild) {
  Passo 'Build do brain-mcp: pulado (-SkipBuild)'
} else {
  Passo 'Compilando o brain-mcp'
  if ($DryRun) {
    Say "    npm ci + npm run build em $brainDir"
  } else {
    Push-Location $brainDir
    try {
      if (Test-Path (Join-Path $brainDir 'package-lock.json')) { & npm ci } else { & npm install }
      if ($LASTEXITCODE -ne 0) { throw 'npm falhou ao instalar as dependencias.' }
      & npm run build
      if ($LASTEXITCODE -ne 0) { throw 'npm run build falhou.' }
    } finally { Pop-Location }
    Feito 'dist/ gerado'
  }
}

# ---------------------------------------------------------------- 3. configuracao pessoal
Passo 'Configuracao pessoal (criada so se ainda nao existir)'

$configPath = Join-Path $brainDir 'brain.config.json'
$configNova = $false
if (Test-Path $configPath) {
  Say "    = brain.config.json ja existe, mantido"
} else {
  $configNova = $true
  if (-not $DryRun) { Copy-Item (Join-Path $brainDir 'brain.config.example.json') $configPath }
  Feito "brain.config.json criado a partir do exemplo"
}

$dbPadrao = (Join-Path $brainDir 'data/brain.db') -replace '\\', '/'
$wsDestino = Join-Path $claudeHome 'brain-workspaces.json'
$wsNovo = $false
if (Test-Path $wsDestino) {
  Say "    = brain-workspaces.json ja existe, mantido"
} else {
  $wsNovo = $true
  if (-not $DryRun) {
    $modelo = Get-Content (Join-Path $repo 'templates/brain-workspaces.example.json') -Raw
    # O db do exemplo aponta para ~/claude-brain; corrige para onde o repo foi mesmo clonado.
    $modelo = $modelo -replace '"db":\s*"[^"]*"', ('"db": "' + $dbPadrao + '"')
    if (-not (Test-Path $claudeHome)) { New-Item -ItemType Directory -Force $claudeHome | Out-Null }
    Set-Content -Path $wsDestino -Value $modelo -Encoding utf8
  }
  Feito "brain-workspaces.json criado: $wsDestino"
}

# ---------------------------------------------------------------- 4. skills e hooks
Passo 'Copiando skills e hooks para ~/.claude'

function CopiarPasta([string]$origem, [string]$destino) {
  if ($DryRun) { Say "    -> $destino"; return }
  if (-not (Test-Path $destino)) { New-Item -ItemType Directory -Force $destino | Out-Null }
  Copy-Item -Path (Join-Path $origem '*') -Destination $destino -Recurse -Force
}

$skillsDest = Join-Path $claudeHome 'skills'
$nSkills = 0
foreach ($skill in Get-ChildItem (Join-Path $repo 'skills') -Directory) {
  CopiarPasta $skill.FullName (Join-Path $skillsDest $skill.Name)
  $nSkills++
}
Feito "$nSkills skills em $skillsDest"

$hooksDest = Join-Path $claudeHome 'hooks'
CopiarPasta (Join-Path $repo 'hooks') $hooksDest
Feito "hooks em $hooksDest"

# ---------------------------------------------------------------- 5. settings.json
Passo 'Ligando os hooks no settings.json'

$settingsPath = Join-Path $claudeHome 'settings.json'
$desejados = @(
  @{ evento = 'SessionStart'; arquivo = 'brain-briefing.js';  timeout = 15; status = 'Lendo o cerebro do produto...' },
  @{ evento = 'SessionEnd';   arquivo = 'obsidian-diario.js'; timeout = 10; status = $null }
)

if (Test-Path $settingsPath) { $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json }
else { $settings = [PSCustomObject]@{} }
if (-not $settings.PSObject.Properties['hooks']) {
  $settings | Add-Member -NotePropertyName hooks -NotePropertyValue ([PSCustomObject]@{})
}

$mudou = $false
foreach ($d in $desejados) {
  $cmd = 'node ' + ((Join-Path $hooksDest $d.arquivo) -replace '\\', '/')
  $atuais = @()
  if ($settings.hooks.PSObject.Properties[$d.evento]) { $atuais = @($settings.hooks.($d.evento)) }

  # Ja registrado? Compara pelo NOME DO ARQUIVO, nao pela linha inteira: o caminho muda de
  # maquina para maquina, e comparar string exata criaria um hook duplicado a cada clone novo.
  $jaTem = $false
  foreach ($grupo in $atuais) {
    foreach ($h in @($grupo.hooks)) {
      if ($h.command -and $h.command -like ('*' + $d.arquivo + '*')) { $jaTem = $true }
    }
  }
  if ($jaTem) { Say "    = $($d.evento): $($d.arquivo) ja estava ligado"; continue }

  $novo = [ordered]@{ type = 'command'; command = $cmd; timeout = $d.timeout }
  if ($d.status) { $novo['statusMessage'] = $d.status }
  $lista = @($atuais) + [PSCustomObject]@{ hooks = @([PSCustomObject]$novo) }

  if ($settings.hooks.PSObject.Properties[$d.evento]) { $settings.hooks.($d.evento) = $lista }
  else { $settings.hooks | Add-Member -NotePropertyName $d.evento -NotePropertyValue $lista }
  $mudou = $true
  Feito "$($d.evento): $($d.arquivo)"
}

if ($mudou -and -not $DryRun) {
  if (Test-Path $settingsPath) {
    Copy-Item $settingsPath "$settingsPath.bak" -Force
    Say '    (backup em settings.json.bak)'
  }
  $settings | ConvertTo-Json -Depth 20 | Set-Content -Path $settingsPath -Encoding utf8
}

# ---------------------------------------------------------------- 6. registrar o MCP
Passo 'Registrando o MCP no Claude Code'

$entry = (Join-Path $brainDir 'dist/index.js') -replace '\\', '/'
if (Get-Command claude -ErrorAction SilentlyContinue) {
  if ($DryRun) {
    Say "    claude mcp add --scope user brain -- node $entry"
  } else {
    # Remove antes para o comando ser idempotente (nao existia? o erro nao interessa).
    try { & claude mcp remove --scope user brain 2>$null | Out-Null } catch { }
    & claude mcp add --scope user brain -- node $entry
    if ($LASTEXITCODE -eq 0) { Feito 'MCP "brain" registrado (escopo user)' }
    else { Aviso 'claude mcp add falhou - registre a mao (veja o README)' }
  }
} else {
  Aviso 'CLI claude nao encontrada. Registre a mao:'
  Say "      claude mcp add --scope user brain -- node $entry"
}

# ---------------------------------------------------------------- 7. proximos passos
Write-Host ''
Write-Host 'Instalado.' -ForegroundColor Green
Write-Host ''
Write-Host 'Falta voce fazer, nesta ordem:' -ForegroundColor White
$n = 1
if ($configNova) {
  Write-Host "  $n. Editar $configPath"
  Write-Host "     (quais pastas e repos indexar - e a unica etapa que exige pensar)"
  $n++
}
if ($wsNovo) {
  Write-Host "  $n. Editar $wsDestino  (onde ficam seus workspaces)"
  $n++
}
Write-Host "  $n. cd `"$brainDir`""; $n++
Write-Host "  $n. npm run index    # varre e indexa"; $n++
Write-Host "  $n. npm run embed    # gera os embeddings (a 1a vez baixa o modelo e demora)"; $n++
Write-Host "  $n. npm run grafo    # monta o grafo de entidades"; $n++
Write-Host "  $n. npm run smoke    # confere que o servidor responde"
Write-Host ''
Write-Host 'Depois abra o Claude Code numa pasta do workspace: as tools mcp__brain__* aparecem.'
