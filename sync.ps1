<#
.SYNOPSIS
  Sincroniza este repo com a instalacao viva em ~/.claude (e com o brain-mcp registrado).

.DESCRIPTION
  Voce edita skills e hooks direto em ~/.claude, como sempre. Este script leva essas edicoes
  para o repo (pull), ou leva o repo para a maquina (push).

    .\sync.ps1 status   # o que esta diferente, sem escrever nada
    .\sync.ps1 pull     # ~/.claude + brain-mcp  ->  repo    (antes de commitar)
    .\sync.ps1 push     # repo -> ~/.claude + brain-mcp      (depois de um git pull)

  O que entra na sincronia:
    skills/<nome>/**              <->  ~/.claude/skills/<nome>/**
    hooks/*.js                    <->  ~/.claude/hooks/*.js
    brain-mcp/{src,scripts}/**    <->  <brain-mcp instalado>/{src,scripts}/**
    brain-mcp/{package.json, package-lock.json, tsconfig.json, README.md, brain.config.example.json}

  O que NUNCA entra: brain.config.json e ~/.claude/brain-workspaces.json (sao pessoais, de
  cada maquina) e a pasta data/ (o indice, que se reconstroi).

.PARAMETER Acao
  status (padrao), pull ou push.

.PARAMETER BrainDir
  Onde esta o brain-mcp instalado. Por padrao descobre lendo o MCP registrado em ~/.claude.json.

.PARAMETER DryRun
  Em pull/push, lista o que copiaria sem copiar.
#>
[CmdletBinding()]
param(
  [ValidateSet('status', 'pull', 'push')]
  [string]$Acao = 'status',
  [string]$BrainDir,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$claudeHome = $env:CLAUDE_CONFIG_DIR
if (-not $claudeHome) { $claudeHome = Join-Path $HOME '.claude' }

# ---------------------------------------------------------------- onde esta o brain instalado
if (-not $BrainDir) {
  # A verdade ja esta no MCP registrado: args[0] e .../brain-mcp/dist/index.js. Perguntar ao
  # usuario um caminho que o proprio Claude Code ja sabe seria pedir para ele errar.
  $claudeJson = Join-Path $HOME '.claude.json'
  if (Test-Path $claudeJson) {
    try {
      $cfg = Get-Content $claudeJson -Raw | ConvertFrom-Json
      $entry = $cfg.mcpServers.brain.args[0]
      if ($entry) { $BrainDir = Split-Path (Split-Path $entry -Parent) -Parent }
    } catch { }
  }
}
if (-not $BrainDir) { $BrainDir = Join-Path $repo 'brain-mcp' }
$BrainDir = $BrainDir -replace '/', '\'
$mesmoLugar = (Resolve-Path -LiteralPath (Join-Path $repo 'brain-mcp')).Path -eq
              (Resolve-Path -LiteralPath $BrainDir -ErrorAction SilentlyContinue).Path

# ---------------------------------------------------------------- pares repo <-> maquina
# Cada par: um pedaco do repo e o lugar vivo correspondente. `arquivos` limita o par a uma
# lista fixa (o resto da pasta nao entra); sem ele, a subarvore inteira entra.
$pares = @()
foreach ($s in Get-ChildItem (Join-Path $repo 'skills') -Directory) {
  $pares += @{ nome = "skill $($s.Name)"; repo = $s.FullName; vivo = Join-Path $claudeHome "skills\$($s.Name)" }
}
$pares += @{ nome = 'hooks'; repo = Join-Path $repo 'hooks'; vivo = Join-Path $claudeHome 'hooks'
             arquivos = @('brain-config.js', 'brain-briefing.js', 'obsidian-diario.js', 'obsidian-diario-titulo.js') }

if ($mesmoLugar) {
  Write-Host "brain-mcp: o registrado E o deste repo - nada a sincronizar nele." -ForegroundColor DarkGray
} elseif (Test-Path $BrainDir) {
  $pares += @{ nome = 'brain-mcp/src';     repo = Join-Path $repo 'brain-mcp\src';     vivo = Join-Path $BrainDir 'src' }
  $pares += @{ nome = 'brain-mcp/scripts'; repo = Join-Path $repo 'brain-mcp\scripts'; vivo = Join-Path $BrainDir 'scripts' }
  $pares += @{ nome = 'brain-mcp (raiz)';  repo = Join-Path $repo 'brain-mcp';         vivo = $BrainDir
               arquivos = @('package.json', 'package-lock.json', 'tsconfig.json', 'README.md') }
} else {
  Write-Host "brain-mcp: nao achei em $BrainDir - passe -BrainDir." -ForegroundColor Yellow
}

# ---------------------------------------------------------------- comparacao
# Rascunho local nao e divergencia: .bak/.orig/.tmp aparecem enquanto se mexe num arquivo e
# so poluiriam o status com ruido que ninguem quer versionar nem instalar.
$IGNORAR = '\.(bak|orig|tmp|swp)$|(^|\\)\.DS_Store$'

function Relativos($raiz, $lista) {
  if (-not (Test-Path $raiz)) { return @() }
  if ($lista) { return @($lista | Where-Object { Test-Path (Join-Path $raiz $_) }) }
  $n = (Resolve-Path -LiteralPath $raiz).Path.Length + 1
  return @(Get-ChildItem $raiz -Recurse -File |
    ForEach-Object { $_.FullName.Substring($n) } |
    Where-Object { $_ -notmatch $IGNORAR })
}

function Hash($caminho) {
  if (-not (Test-Path $caminho)) { return $null }
  return (Get-FileHash -LiteralPath $caminho -Algorithm SHA256).Hash
}

$difs = @()
foreach ($p in $pares) {
  $rels = @(Relativos $p.repo $p.arquivos) + @(Relativos $p.vivo $p.arquivos) | Sort-Object -Unique
  foreach ($rel in $rels) {
    $a = Join-Path $p.repo $rel
    $b = Join-Path $p.vivo $rel
    $ha = Hash $a
    $hb = Hash $b
    if ($ha -eq $hb) { continue }
    $estado = 'diferente'
    if (-not $ha) { $estado = 'so na maquina' }
    if (-not $hb) { $estado = 'so no repo' }
    $difs += [PSCustomObject]@{ Par = $p.nome; Arquivo = $rel; Estado = $estado; Repo = $a; Vivo = $b }
  }
}

# Skill que existe viva mas nao esta no repo: nao e "diferenca", e skill nova. Vale avisar,
# porque copiar arquivo nao adivinha que voce criou uma skill e ainda nao versionou.
$novas = @()
$skillsVivas = Join-Path $claudeHome 'skills'
if (Test-Path $skillsVivas) {
  $noRepo = @(Get-ChildItem (Join-Path $repo 'skills') -Directory | ForEach-Object { $_.Name })
  foreach ($s in Get-ChildItem $skillsVivas -Directory) {
    if ($noRepo -notcontains $s.Name) { $novas += $s.Name }
  }
}

# ---------------------------------------------------------------- acao
if ($Acao -eq 'status') {
  if ($difs.Count -eq 0) { Write-Host 'Tudo igual entre repo e maquina.' -ForegroundColor Green }
  else {
    Write-Host ''
    Write-Host "$($difs.Count) arquivo(s) fora de sincronia:" -ForegroundColor Yellow
    $difs | Format-Table Par, Arquivo, Estado -AutoSize
    Write-Host 'pull = trazer da maquina para o repo | push = levar o repo para a maquina'
  }
  if ($novas.Count) {
    Write-Host ''
    Write-Host "Skills em ~/.claude/skills que nao estao no repo:" -ForegroundColor Cyan
    foreach ($n in $novas) { Write-Host "  - $n" }
    Write-Host '  (para versionar uma delas: copie a pasta para .\skills\ e rode git add)'
  }
  return
}

if ($difs.Count -eq 0) { Write-Host 'Nada a copiar: ja esta tudo igual.' -ForegroundColor Green; return }

$copiados = 0
foreach ($d in $difs) {
  if ($Acao -eq 'pull') { $de = $d.Vivo; $para = $d.Repo } else { $de = $d.Repo; $para = $d.Vivo }
  if (-not (Test-Path $de)) {
    Write-Host "  ? $($d.Arquivo): nao existe na origem, pulado ($($d.Estado))" -ForegroundColor DarkYellow
    continue
  }
  if ($DryRun) { Write-Host "  -> $para" -ForegroundColor Gray; $copiados++; continue }
  $pai = Split-Path $para -Parent
  if (-not (Test-Path $pai)) { New-Item -ItemType Directory -Force $pai | Out-Null }
  Copy-Item -LiteralPath $de -Destination $para -Force
  Write-Host "  + $($d.Par): $($d.Arquivo)" -ForegroundColor Green
  $copiados++
}

Write-Host ''
if ($DryRun) { Write-Host "DRY-RUN: $copiados arquivo(s) seriam copiados." -ForegroundColor Magenta; return }
Write-Host "$copiados arquivo(s) copiados." -ForegroundColor Green

if ($Acao -eq 'pull') {
  Write-Host ''
  Write-Host 'Agora: git -C "' -NoNewline; Write-Host $repo -NoNewline; Write-Host '" add -A ; git commit ; git push'
} else {
  Write-Host ''
  Write-Host 'Se mudou algo em brain-mcp/src, recompile:'
  Write-Host "  cd `"$BrainDir`"; npm install; npm run build"
  Write-Host 'E reinicie o Claude Code para o servidor novo subir.'
}
