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

  O CLAUDE.md do workspace (workspaces\pessoal\CLAUDE.md, so quando a pasta acima do repo se
  chama `pessoal`) e MONTADO, nao copiado: o repo guarda so a parte generica, com uma linha
  marcadora, e o push instala generico + CLAUDE.privado.md (local, nunca versionado, na pasta do
  workspace, ao lado do CLAUDE.md instalado) no lugar da marcadora. O pull faz o inverso e nunca
  escreve o privado; o status compara so a parte generica.

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
# Lista fixa, e nao a pasta inteira: a instalacao guarda copia de seguranca (.bak, .pre-detach)
# e pode ter hook de terceiro. A mesma lista e o gabarito do relato de orfao la embaixo.
$hooksVersionados = @('brain-config.js', 'jev.js', 'brain-briefing.js', 'brain-contexto.js',
                      'obsidian-diario.js', 'obsidian-diario-titulo.js',
                      'custo-contexto.js', 'grafo-espelho.js', 'telemetria.js')
$pares += @{ nome = 'hooks'; repo = Join-Path $repo 'hooks'; vivo = Join-Path $claudeHome 'hooks'
             arquivos = $hooksVersionados }

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

# ---------------------------------------------------------------- CLAUDE.md do workspace
# Generico no repo (publico), privado local. @import nao serve (e ignorado em silencio em
# subpasta e worktree), entao o push monta e o pull desmonta. Mesmo comportamento do sync.sh.
$wsDir = Split-Path $repo -Parent
$wsAtivo = (Split-Path $wsDir -Leaf) -ceq 'pessoal'
$wsRepo = Join-Path $repo 'workspaces\pessoal\CLAUDE.md'
$wsVivo = Join-Path $wsDir 'CLAUDE.md'
$wsPriv = Join-Path $wsDir 'CLAUDE.privado.md'
$wsMarca = '<!-- privado: CLAUDE.privado.md entra aqui -->'
$wsIni = '<!-- privado:inicio CLAUDE.privado.md (edite o arquivo local e rode sync push, nao aqui) -->'
$wsFim = '<!-- privado:fim -->'
$wsPrefixoIni = '<!-- privado:inicio '
$utf8 = New-Object System.Text.UTF8Encoding $false

function Aviso($msg) { Write-Host "aviso: $msg" -ForegroundColor Yellow }

function HashTexto($texto) {
  $sha = [Security.Cryptography.SHA256]::Create()
  return ([BitConverter]::ToString($sha.ComputeHash($utf8.GetBytes($texto)))).Replace('-', '')
}

# Instalado -> generico: troca o bloco inicio..fim pela marcadora. Sem bloco, devolve como esta.
# Rc 2 quando o bloco esta torto (orfao, repetido, fim antes do inicio).
function WsDesmonta([string]$texto) {
  $linhas = $texto -split "`n"
  $ini = @($linhas | Where-Object { $_.StartsWith($wsPrefixoIni, [StringComparison]::Ordinal) }).Count
  $fim = @($linhas | Where-Object { $_ -ceq $wsFim }).Count
  if ($ini -eq 0 -and $fim -eq 0) { return [PSCustomObject]@{ Rc = 0; Texto = $texto } }
  if ($ini -ne 1 -or $fim -ne 1) { return [PSCustomObject]@{ Rc = 2; Texto = '' } }
  $n = $linhas.Count
  if ($texto.EndsWith("`n")) { $n-- }
  $saida = New-Object System.Collections.Generic.List[string]
  $dentro = $false; $feito = $false; $torto = $false
  for ($i = 0; $i -lt $n; $i++) {
    $l = $linhas[$i]
    if ($l.StartsWith($wsPrefixoIni, [StringComparison]::Ordinal)) {
      if ($dentro -or $feito) { $torto = $true }
      $dentro = $true; $saida.Add($wsMarca); continue
    }
    if ($l -ceq $wsFim) {
      if ((-not $dentro) -or $feito) { $torto = $true }
      $feito = $true; $dentro = $false; continue
    }
    if (-not $dentro) { $saida.Add($l) }
  }
  if ($torto) { return [PSCustomObject]@{ Rc = 2; Texto = '' } }
  return [PSCustomObject]@{ Rc = 0; Texto = (($saida -join "`n") + "`n") }
}

# O miolo do bloco privado instalado (entre os delimitadores, sem eles), uma linha por \n.
function WsMiolo([string]$texto) {
  $miolo = ''; $dentro = $false
  foreach ($l in ($texto -split "`n")) {
    if ($l -ceq $wsFim) { $dentro = $false }
    if ($dentro) { $miolo += $l + "`n" }
    if ($l.StartsWith($wsPrefixoIni, [StringComparison]::Ordinal)) { $dentro = $true }
  }
  return $miolo
}

# O privado como o awk do sync.sh o le: termina sempre em \n (ou e vazio).
function WsPrivNormalizado {
  $t = [IO.File]::ReadAllText($wsPriv)
  if ($t.Length -gt 0 -and -not $t.EndsWith("`n")) { $t += "`n" }
  return $t
}

# Generico + privado -> instalado: a marcadora vira inicio, o conteudo do privado e fim.
function WsMonta([string]$generico) {
  $priv = WsPrivNormalizado
  $linhas = $generico -split "`n"
  $n = $linhas.Count
  if ($generico.EndsWith("`n")) { $n-- }
  $saida = ''; $feito = $false
  for ($i = 0; $i -lt $n; $i++) {
    if (($linhas[$i] -ceq $wsMarca) -and -not $feito) {
      $saida += $wsIni + "`n" + $priv + $wsFim + "`n"; $feito = $true
    } else { $saida += $linhas[$i] + "`n" }
  }
  return $saida
}

$wsOk = $wsAtivo -and (Test-Path -LiteralPath $wsRepo)
$wsTemVivo = $false; $wsDesmontado = ''; $wsEsperado = ''; $wsRcDesmonta = 0; $wsTemPriv = $false
if ($wsOk) {
  $wsTemPriv = Test-Path -LiteralPath $wsPriv
  $wsTemVivo = Test-Path -LiteralPath $wsVivo
  $textoVivo = ''
  if ($wsTemVivo) {
    $textoVivo = [IO.File]::ReadAllText($wsVivo)
    $r = WsDesmonta $textoVivo
    $wsRcDesmonta = $r.Rc; $wsDesmontado = $r.Texto
  }
  if ($Acao -eq 'push') {
    $textoRepo = [IO.File]::ReadAllText($wsRepo)
    $nmarca = @($textoRepo -split "`n" | Where-Object { $_ -ceq $wsMarca }).Count
    if (-not $wsTemPriv) {
      Aviso "nao achei $wsPriv: o CLAUDE.md instalado leva so a parte generica."
      $wsEsperado = $textoRepo
    } elseif ($nmarca -ne 1) {
      Aviso "workspaces/pessoal/CLAUDE.md tem $nmarca linhas marcadoras (esperada: 1): instalando o generico sem o privado."
      $wsEsperado = $textoRepo
    } else {
      $wsEsperado = WsMonta $textoRepo
    }
  }
  # Delimitador torto no instalado: o pull nao tem como desmontar e nao escreve nada.
  if ($Acao -eq 'pull' -and $wsRcDesmonta -eq 2) {
    [Console]::Error.WriteLine("erro: $wsVivo tem delimitador privado:inicio/privado:fim orfao ou repetido; nada foi escrito.")
    exit 2
  }
  # Bloco privado instalado diferente do arquivo local: o pull/status avisam, o push resolve.
  $wsTemBloco = $wsTemVivo -and ($textoVivo -cmatch '(?m)^<!-- privado:inicio ')
  if ($Acao -ne 'push' -and $wsRcDesmonta -eq 0 -and $wsTemBloco) {
    if ((-not $wsTemPriv) -or ((WsMiolo $textoVivo) -cne (WsPrivNormalizado))) {
      if ($Acao -eq 'pull') {
        Aviso "o bloco privado instalado difere de $wsPriv; essa edicao nao volta a lugar nenhum (o pull nunca escreve o privado)."
      } else {
        Aviso "o bloco privado instalado esta defasado em relacao a $wsPriv (nao conta como diferenca; rode push)."
      }
    }
  }
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

if ($wsOk) {
  $wsDif = $null
  if ($Acao -eq 'push') {
    if ((-not $wsTemVivo) -or ((HashTexto $wsEsperado) -ne (Hash $wsVivo))) { $wsDif = $true }
  } elseif (-not $wsTemVivo) {
    $wsDif = $true
  } elseif ($wsRcDesmonta -eq 2) {
    Aviso "$wsVivo tem delimitador privado orfao ou repetido: o par entra na lista, mas nao da para desmontar."
    $wsDif = $true
  } elseif ((HashTexto $wsDesmontado) -ne (Hash $wsRepo)) {
    $wsDif = $true
  }
  if ($wsDif) {
    $estado = if (-not $wsTemVivo) { 'so no repo' } else { 'diferente' }
    $difs += [PSCustomObject]@{ Par = 'workspace'; Arquivo = 'workspaces/pessoal/CLAUDE.md'; Estado = $estado
                                Repo = $wsRepo; Vivo = $wsVivo; Ws = $true }
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

# Hook vivo fora da lista fixa e invisivel ao laco acima - foi assim que o brain-contexto.js
# ficou dois dias fora do git sem ninguem notar. So *.js: a instalacao guarda copias de
# seguranca (.bak, .pre-detach) que nao sao hook e virariam falso positivo permanente.
$orfaos = @()
$hooksVivos = Join-Path $claudeHome 'hooks'
if (Test-Path $hooksVivos) {
  # Extension, e nao -Filter '*.js': o filtro do provider casa tambem pelo nome curto 8.3 e
  # deixaria um obsidian-diario.js.bak entrar como se fosse hook.
  foreach ($h in Get-ChildItem $hooksVivos -File | Where-Object { $_.Extension -eq '.js' }) {
    if ($hooksVersionados -notcontains $h.Name) { $orfaos += $h.Name }
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
  if ($orfaos.Count) {
    Write-Host ''
    Write-Host "Hooks em ~/.claude/hooks que nao estao no repo:" -ForegroundColor Cyan
    foreach ($n in $orfaos) { Write-Host "  - $n" }
    Write-Host '  (para versionar um deles: copie para .\hooks\ e acrescente-o a $hooksVersionados)'
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
  if ($d.Ws) {
    # o par do workspace nao e copia: push instala o montado, pull devolve o desmontado
    if ($Acao -eq 'pull' -and -not $wsTemVivo) {
      Write-Host "  ? $($d.Arquivo): nao existe na origem, pulado ($($d.Estado))" -ForegroundColor DarkYellow
      continue
    }
    $texto = if ($Acao -eq 'pull') { $wsDesmontado } else { $wsEsperado }
    if ($DryRun) { Write-Host "  -> $para" -ForegroundColor Gray; $copiados++; continue }
    $pai = Split-Path $para -Parent
    if (-not (Test-Path $pai)) { New-Item -ItemType Directory -Force $pai | Out-Null }
    [IO.File]::WriteAllText($para, $texto, $utf8)
    Write-Host "  + $($d.Par): $($d.Arquivo)" -ForegroundColor Green
    $copiados++
    continue
  }
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
