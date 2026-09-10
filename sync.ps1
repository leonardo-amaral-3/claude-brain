<#
.SYNOPSIS
  Sincroniza este repo com a instalacao viva em ~/.claude (e com o brain-mcp registrado).

.DESCRIPTION
  Voce edita skills e hooks direto em ~/.claude, como sempre. Este script leva essas edicoes
  para o repo (pull), ou leva o repo para a maquina (push).

    .\sync.ps1 status   # o que esta diferente, sem escrever nada
    .\sync.ps1 pull     # ~/.claude + brain-mcp  ->  repo    (antes de commitar)
    .\sync.ps1 push     # repo -> ~/.claude + brain-mcp      (depois de um git pull)
    .\sync.ps1 push -Sobrescrever   # nao pergunta ao trocar a origem da instalacao

  O que entra na sincronia:
    skills/<nome>/**              <->  ~/.claude/skills/<nome>/**
    hooks/*.js                    <->  ~/.claude/hooks/*.js
    brain-mcp/{src,scripts}/**    <->  <brain-mcp instalado>/{src,scripts}/**
    brain-mcp/{package.json, package-lock.json, tsconfig.json, README.md, brain.config.example.json}

  O que NUNCA entra: brain.config.json, ~/.claude/brain-workspaces.json e o proprio
  ~/.claude/brain-sync-origem.txt (sao pessoais, de cada maquina) e a pasta data/ (o indice,
  que se reconstroi).

  A instalacao e uma so e as worktrees sao varias. O push anota em brain-sync-origem.txt de qual
  pasta e branch ele veio, e pergunta antes de sobrescrever a instalacao de outra origem.

.PARAMETER Acao
  status (padrao), pull ou push.

.PARAMETER BrainDir
  Onde esta o brain-mcp instalado. Por padrao descobre lendo o MCP registrado em ~/.claude.json.

.PARAMETER DryRun
  Em pull/push, lista o que copiaria sem copiar.

.PARAMETER Sobrescrever
  Em push, assume a troca de origem sem perguntar (para quando a decisao ja esta tomada).
#>
[CmdletBinding()]
param(
  [ValidateSet('status', 'pull', 'push')]
  [string]$Acao = 'status',
  [string]$BrainDir,
  [switch]$DryRun,
  [switch]$Sobrescrever
)

$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$claudeHome = $env:CLAUDE_CONFIG_DIR
if (-not $claudeHome) { $claudeHome = Join-Path $HOME '.claude' }

# ------------------------------------------------ de qual worktree veio a instalacao viva
# O destino e unico e global (~/.claude) e as worktrees sao varias: sem marcador, a ultima que
# rodar `push` enterra o dogfood da outra em silencio. Este arquivo fica fora do git de
# proposito - descreve esta maquina, nao o repo -, e por morar na raiz de ~/.claude nao cai em
# nenhum dos pares abaixo (que sao skills\<nome> e uma lista fixa em hooks\).
$marcador = Join-Path $claudeHome 'brain-sync-origem.txt'

# Windows escreve o mesmo caminho de dois jeitos (C:\x aqui, /c/x no sync.sh). Minusculas,
# barras normais e sem o dois-pontos do drive fazem os dois scripts baterem no mesmo texto.
function NormalizaCaminho($caminho) {
  if (-not $caminho) { return '' }
  return $caminho.Replace('\', '/').Replace(':', '').ToLowerInvariant().Trim('/')
}

function CampoMarcador($chave) {
  if (-not (Test-Path $marcador)) { return '' }
  $linhas = @(Get-Content -LiteralPath $marcador | Where-Object { $_ -like "$chave=*" })
  if ($linhas.Count -eq 0) { return '' }
  return $linhas[-1].Substring($chave.Length + 1).TrimEnd()
}

function BranchAtual {
  # 2>$null com ErrorActionPreference='Stop' vira erro terminante no PS 5.1, entao o Continue
  # aqui nao e detalhe: e o que faz uma pasta sem git devolver '' em vez de derrubar o script.
  $antes = $ErrorActionPreference
  $codigoAntes = $global:LASTEXITCODE
  $ErrorActionPreference = 'Continue'
  try {
    $b = & git -C $repo rev-parse --abbrev-ref HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and $b) { return ("$b").Trim() }
  } catch { } finally {
    $ErrorActionPreference = $antes
    # Pasta sem git faz o git sair 128, e sem isto o 128 vira o codigo de saida do proprio
    # script: um push que copiou tudo direito reportando falha para quem o chamou.
    $global:LASTEXITCODE = $codigoAntes
  }
  return ''
}

function RegistraOrigem($branch) {
  $pai = Split-Path $marcador -Parent
  if (-not (Test-Path $pai)) { New-Item -ItemType Directory -Force $pai | Out-Null }
  $linhas = @(
    '# De qual pasta veio a instalacao viva em ~/.claude. Escrito pelo `sync push`.',
    '# Fora do git de proposito: descreve esta maquina, nao o repo. Apagar so faz o',
    '# proximo push nao ter com o que comparar - ele se reescreve no push seguinte.',
    "worktree=$repo",
    "branch=$branch",
    "data=$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  )
  # LF e sem BOM de proposito: o sync.sh le este mesmo arquivo, e um \r no fim do valor faria
  # o caminho gravado aqui nunca bater com o que ele calcula la.
  [IO.File]::WriteAllText($marcador, (($linhas -join "`n") + "`n"), (New-Object System.Text.UTF8Encoding $false))
  Write-Host "Origem registrada: $marcador" -ForegroundColor DarkGray
}

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

# O push sobrescreve a instalacao inteira. Se ela veio de outra pasta ou de outra branch, seguir
# apaga o dogfood de outro card em voo - e apagar em silencio e o que esta pergunta impede.
# Instalacao sem marcador nao tem origem registrada: ai o push grava sem perguntar, porque
# perguntar seria pedir confirmacao contra um dado que nao existe.
$branchAgora = BranchAtual
if ($Acao -eq 'push') {
  $origemAntiga = CampoMarcador 'worktree'
  $branchAntiga = CampoMarcador 'branch'
  $outraPasta = $false
  $outraBranch = $false
  if ($origemAntiga) {
    $outraPasta = (NormalizaCaminho $origemAntiga) -ne (NormalizaCaminho $repo)
    $outraBranch = $branchAntiga -cne $branchAgora
  }
  if ($outraPasta -or $outraBranch) {
    $dataAntiga = CampoMarcador 'data'
    if (-not $dataAntiga) { $dataAntiga = '(sem data)' }
    $bAntiga = if ($branchAntiga) { $branchAntiga } else { '(nao registrada)' }
    $bAgora = if ($branchAgora) { $branchAgora } else { '(nenhuma)' }
    $titulo = if ($outraPasta) { 'A instalacao viva nao veio desta pasta.' }
              else { 'A instalacao viva veio desta pasta, mas de outra branch.' }
    Write-Host ''
    Write-Host $titulo -ForegroundColor Yellow
    Write-Host ''
    Write-Host "  instalada a partir de: $origemAntiga"
    Write-Host "             na branch:  $bAntiga   em $dataAntiga"
    Write-Host "  este push vem de:      $repo"
    Write-Host "             na branch:  $bAgora"
    Write-Host ''
    Write-Host "Cada worktree tem a sua versao das skills e dos hooks. Seguir agora troca $($difs.Count) arquivo(s) da"
    Write-Host 'instalacao pelos desta pasta: a sessao que estiver rodando com a outra passa a ler o texto desta'
    Write-Host 'aqui, sem aviso nenhum.'
    Write-Host ''
    Write-Host '  [s] sobrescrever - a instalacao viva passa a ser a desta pasta'
    Write-Host '  [n] cancelar     - nada e copiado, a instalacao continua como esta (padrao)'
    Write-Host ''
    if ($DryRun) {
      Write-Host 'DRY-RUN: nada sera copiado; num push de verdade a pergunta apareceria aqui.' -ForegroundColor Magenta
    } elseif ($Sobrescrever) {
      Write-Host 'Escolhido em -Sobrescrever: seguindo sem perguntar.' -ForegroundColor Yellow
    } else {
      $temTerminal = $false
      try { $temTerminal = -not [Console]::IsInputRedirected } catch { $temTerminal = $false }
      if (-not $temTerminal) {
        Write-Host 'Sem terminal para perguntar, e silencio nao e aprovacao: nada foi copiado.' -ForegroundColor Yellow
        Write-Host 'Rode num terminal, ou passe -Sobrescrever se a decisao ja esta tomada.'
        exit 1
      }
      $resposta = Read-Host 'Sobrescrever? [s/N]'
      if ("$resposta".Trim() -notmatch '^(s|sim|y|yes)$') {
        Write-Host 'Cancelado: nada foi copiado.' -ForegroundColor Yellow
        exit 1
      }
    }
  }
}

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
  if ($copiados -gt 0) { RegistraOrigem $branchAgora }
  Write-Host ''
  Write-Host 'Se mudou algo em brain-mcp/src, recompile:'
  Write-Host "  cd `"$BrainDir`"; npm install; npm run build"
  Write-Host 'E reinicie o Claude Code para o servidor novo subir.'
}
