#!/usr/bin/env bash
# Sincroniza este repo com a instalacao viva em ~/.claude. Equivalente ao sync.ps1.
#
#   ./sync.sh status   o que esta diferente, sem escrever nada
#   ./sync.sh pull     ~/.claude + brain-mcp  ->  repo   (antes de commitar)
#   ./sync.sh push     repo -> ~/.claude + brain-mcp     (depois de um git pull)
#
#   ./sync.sh push --sobrescrever    nao pergunta ao trocar a origem da instalacao
#
# A instalacao e uma so e as worktrees sao varias. O push anota em ~/.claude/brain-sync-origem.txt
# de qual pasta e branch ele veio, e pergunta antes de sobrescrever a instalacao de outra origem.
#
# O CLAUDE.md do workspace (workspaces/pessoal/CLAUDE.md, so quando a pasta acima do repo se chama
# `pessoal`) e MONTADO, nao copiado: o repo guarda so a parte generica, com uma linha marcadora, e o
# `push` instala generico + CLAUDE.privado.md (local, nunca versionado, na pasta do workspace, ao
# lado do CLAUDE.md instalado) no lugar da marcadora. O `pull` faz o inverso e nunca escreve o
# privado; o `status` compara so a parte generica.
#
# Nunca entra na sincronia: brain.config.json, ~/.claude/brain-workspaces.json, o proprio
# brain-sync-origem.txt (pessoais de cada maquina) e a pasta data/ (o indice, que se reconstroi).
set -euo pipefail

USO="uso: $0 [status|pull|push] [--sobrescrever]"
ACAO=""
SOBRESCREVER=0
for arg in "$@"; do
  case "$arg" in
    --sobrescrever) SOBRESCREVER=1 ;;
    -h|--help) echo "$USO"; exit 0 ;;
    -*) echo "opcao desconhecida: $arg" >&2; echo "$USO" >&2; exit 2 ;;
    *) if [ -z "$ACAO" ]; then ACAO="$arg"; else echo "$USO" >&2; exit 2; fi ;;
  esac
done
ACAO="${ACAO:-status}"
case "$ACAO" in status|pull|push) ;; *) echo "$USO" >&2; exit 2 ;; esac

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

# ------------------------------------------------- de qual worktree veio a instalacao viva
# O destino e unico e global (~/.claude) e as worktrees sao varias: sem marcador, a ultima que
# rodar `push` enterra o dogfood da outra em silencio. Este arquivo fica fora do git de
# proposito - descreve esta maquina, nao o repo -, e por morar na raiz de ~/.claude nao cai em
# nenhum dos pares abaixo (que sao skills/<nome> e uma lista fixa em hooks/).
MARCADOR="$CLAUDE_HOME/brain-sync-origem.txt"

# Windows escreve o mesmo caminho de dois jeitos (C:\x no PowerShell, /c/x aqui). Minusculas,
# barras normais e sem o dois-pontos do drive fazem os dois scripts baterem no mesmo texto.
normaliza_caminho() {
  local c="${1//\\//}"                 # barra invertida do Windows vira barra normal
  printf '%s' "$c" | tr 'A-Z' 'a-z' | sed -e 's|:||g' -e 's|^/*||' -e 's|/*$||'
}

# O sync.ps1 escreve este mesmo arquivo; o tr tira o \r se ele aparecer, senao o caminho nao bate.
campo_marcador() { [ -f "$MARCADOR" ] || return 0; sed -n "s|^$1=||p" "$MARCADOR" | tr -d '\r' | tail -n 1; }

branch_atual() { git -C "$REPO" rev-parse --abbrev-ref HEAD 2>/dev/null || true; }

registra_origem() {
  mkdir -p "$(dirname "$MARCADOR")"
  {
    echo '# De qual pasta veio a instalacao viva em ~/.claude. Escrito pelo `sync push`.'
    echo '# Fora do git de proposito: descreve esta maquina, nao o repo. Apagar so faz o'
    echo '# proximo push nao ter com o que comparar - ele se reescreve no push seguinte.'
    echo "worktree=$REPO"
    echo "branch=$BRANCH_AGORA"
    echo "data=$(date '+%Y-%m-%d %H:%M:%S')"
  } > "$MARCADOR"
  echo "Origem registrada: $MARCADOR"
}

# Onde esta o brain instalado: a verdade ja esta no MCP registrado (args[0] = .../dist/index.js).
BRAIN_DIR="${BRAIN_DIR:-}"
if [ -z "$BRAIN_DIR" ] && [ -f "$HOME/.claude.json" ]; then
  BRAIN_DIR="$(node -e '
    try {
      const c = require(process.env.HOME + "/.claude.json");
      const a = c.mcpServers && c.mcpServers.brain && c.mcpServers.brain.args[0];
      if (a) process.stdout.write(require("path").dirname(require("path").dirname(a)));
    } catch {}' 2>/dev/null || true)"
fi
[ -n "$BRAIN_DIR" ] || BRAIN_DIR="$REPO/brain-mcp"

# Pares "origem_no_repo :: destino_vivo :: lista opcional de arquivos".
# Sem a lista, a subarvore inteira entra.
pares=()
for d in "$REPO"/skills/*/; do
  nome="$(basename "$d")"
  pares+=("$REPO/skills/$nome::$CLAUDE_HOME/skills/$nome::")
done
# Lista fixa, e nao a pasta inteira: a instalacao guarda copia de seguranca (.bak, .pre-detach)
# e pode ter hook de terceiro. A mesma lista e o gabarito do relato de orfao la embaixo.
HOOKS_VERSIONADOS='brain-config.js jev.js brain-briefing.js brain-contexto.js obsidian-diario.js obsidian-diario-titulo.js custo-contexto.js grafo-espelho.js telemetria.js'
pares+=("$REPO/hooks::$CLAUDE_HOME/hooks::$HOOKS_VERSIONADOS")

if [ "$(cd "$REPO/brain-mcp" && pwd)" = "$(cd "$BRAIN_DIR" 2>/dev/null && pwd || echo x)" ]; then
  echo "brain-mcp: o registrado E o deste repo - nada a sincronizar nele."
elif [ -d "$BRAIN_DIR" ]; then
  pares+=("$REPO/brain-mcp/src::$BRAIN_DIR/src::")
  pares+=("$REPO/brain-mcp/scripts::$BRAIN_DIR/scripts::")
  pares+=("$REPO/brain-mcp::$BRAIN_DIR::package.json package-lock.json tsconfig.json README.md")
else
  echo "brain-mcp: nao achei em $BRAIN_DIR - defina BRAIN_DIR=... " >&2
fi

# Rascunho local nao e divergencia: .bak/.orig/.tmp so poluiriam o status.
relativos() {
  local raiz="$1" lista="$2"
  [ -d "$raiz" ] || return 0
  if [ -n "$lista" ]; then
    for f in $lista; do [ -f "$raiz/$f" ] && echo "$f"; done
    return 0
  fi
  ( cd "$raiz" && find . -type f \
      ! -name '*.bak' ! -name '*.orig' ! -name '*.tmp' ! -name '.DS_Store' \
      | sed 's|^\./||' )
}

soma() { [ -f "$1" ] && (sha256sum "$1" 2>/dev/null || shasum -a 256 "$1") | cut -d' ' -f1 || echo ''; }

# ------------------------------------------------- CLAUDE.md do workspace: generico no repo, privado local
# O repo e publico; o CLAUDE.md instalado tem coordenadas do repo privado. @import nao serve (e
# ignorado em silencio em subpasta e worktree), entao o push monta e o pull desmonta.
WS_ATIVO=0
WS_DIR="$(dirname "$REPO")"
[ "$(basename "$WS_DIR")" = pessoal ] && WS_ATIVO=1
WS_REPO="$REPO/workspaces/pessoal/CLAUDE.md"
WS_VIVO="$WS_DIR/CLAUDE.md"
WS_PRIV="$WS_DIR/CLAUDE.privado.md"
WS_MARCA='<!-- privado: CLAUDE.privado.md entra aqui -->'
WS_INI='<!-- privado:inicio CLAUDE.privado.md (edite o arquivo local e rode sync push, nao aqui) -->'
WS_FIM='<!-- privado:fim -->'
WS_TMP="$(mktemp -d)"
trap 'rm -rf "$WS_TMP"' EXIT
aviso() { echo "aviso: $*" >&2; }

# Instalado -> generico: troca o bloco inicio..fim pela marcadora. Sem bloco, devolve como esta.
# Codigo 2 quando o bloco esta torto (orfao, repetido, fim antes do inicio).
ws_desmonta() {
  local f="$1" ini fim
  ini="$(grep -c '^<!-- privado:inicio ' "$f" || true)"
  fim="$(grep -cx '<!-- privado:fim -->' "$f" || true)"
  if [ "$ini" -eq 0 ] && [ "$fim" -eq 0 ]; then cat "$f"; return 0; fi
  [ "$ini" -eq 1 ] && [ "$fim" -eq 1 ] || return 2
  awk -v m="$WS_MARCA" '
    /^<!-- privado:inicio /     { if (s || d) bad = 1; s = 1; print m; next }
    $0 == "<!-- privado:fim -->" { if (!s || d) bad = 1; d = 1; s = 0; next }
    !s                          { print }
    END                         { exit bad ? 2 : 0 }' "$f"
}

# O miolo do bloco privado instalado (entre os delimitadores, sem eles).
ws_miolo() {
  awk '$0 == "<!-- privado:fim -->" { s = 0 } s { print } /^<!-- privado:inicio / { s = 1 }' "$1"
}

# Generico + privado -> instalado: a marcadora vira inicio, o conteudo do privado e fim.
ws_monta() {
  awk -v m="$WS_MARCA" -v i="$WS_INI" -v f="$WS_FIM" -v priv="$WS_PRIV" '
    $0 == m && !feito { print i; while ((getline l < priv) > 0) print l; print f; feito = 1; next }
    { print }' "$1"
}

# Prepara o que as acoes precisam: o generico desmontado do instalado e (no push) o instalado esperado.
WS_DESMONTADO=""; WS_ESPERADO=""; WS_RC_DESMONTA=0; WS_TEM_PRIV=0; WS_SEM_MARCA=0
if [ "$WS_ATIVO" -eq 1 ] && [ -f "$WS_REPO" ]; then
  [ -f "$WS_PRIV" ] && WS_TEM_PRIV=1
  if [ -f "$WS_VIVO" ]; then
    WS_DESMONTADO="$WS_TMP/desmontado.md"
    ws_desmonta "$WS_VIVO" > "$WS_DESMONTADO" || WS_RC_DESMONTA=$?
  fi
  if [ "$ACAO" = push ]; then
    WS_ESPERADO="$WS_TMP/esperado.md"
    nmarca="$(grep -cx "$WS_MARCA" "$WS_REPO" || true)"
    if [ "$WS_TEM_PRIV" -eq 0 ]; then
      aviso "nao achei $WS_PRIV: o CLAUDE.md instalado leva so a parte generica."
      cp "$WS_REPO" "$WS_ESPERADO"
    elif [ "$nmarca" -ne 1 ]; then
      aviso "workspaces/pessoal/CLAUDE.md tem $nmarca linhas marcadoras (esperada: 1): instalando o generico sem o privado."
      cp "$WS_REPO" "$WS_ESPERADO"
    else
      ws_monta "$WS_REPO" > "$WS_ESPERADO"
    fi
  fi
  # Instalado sem bloco privado e sem marcadora (o CLAUDE.md antigo, inteiro, ou editado a mao):
  # nao ha como saber o que nele e privado. Diferente do repo, o pull recusa e o status avisa.
  if [ -n "$WS_DESMONTADO" ] && [ "$WS_RC_DESMONTA" -eq 0 ] \
     && ! grep -q '^<!-- privado:inicio ' "$WS_VIVO" && ! grep -qxF "$WS_MARCA" "$WS_VIVO" \
     && ! cmp -s "$WS_REPO" "$WS_VIVO"; then
    WS_SEM_MARCA=1
  fi
  if [ "$ACAO" = pull ] && [ "$WS_SEM_MARCA" -eq 1 ]; then
    echo "erro: $WS_VIVO nao tem bloco privado nem linha marcadora; sem eles nao da para separar o que e privado. Nada foi escrito (rode push primeiro ou edite o repo)." >&2
    exit 2
  fi
  # Delimitador torto no instalado: o pull nao tem como desmontar e nao escreve nada.
  if [ "$ACAO" = pull ] && [ "$WS_RC_DESMONTA" -eq 2 ]; then
    echo "erro: $WS_VIVO tem delimitador privado:inicio/privado:fim orfao ou repetido; nada foi escrito." >&2
    exit 2
  fi
  # Bloco privado instalado diferente do arquivo local: o pull/status avisam, o push resolve.
  if [ "$ACAO" != push ] && [ -f "$WS_VIVO" ] && [ "$WS_RC_DESMONTA" -eq 0 ] && grep -q '^<!-- privado:inicio ' "$WS_VIVO"; then
    ws_miolo "$WS_VIVO" > "$WS_TMP/miolo.md"
    if [ "$WS_TEM_PRIV" -eq 0 ] || ! awk 1 "$WS_PRIV" | cmp -s - "$WS_TMP/miolo.md"; then
      if [ "$ACAO" = pull ]; then
        aviso "o bloco privado instalado difere de $WS_PRIV; essa edicao nao volta a lugar nenhum (o pull nunca escreve o privado)."
      else
        aviso "o bloco privado instalado esta defasado em relacao a $WS_PRIV (nao conta como diferenca; rode push)."
      fi
    fi
  fi
fi

difs=()
for par in "${pares[@]}"; do
  origem="${par%%::*}"; resto="${par#*::}"
  vivo="${resto%%::*}"; lista="${resto#*::}"
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    [ "$(soma "$origem/$rel")" = "$(soma "$vivo/$rel")" ] && continue
    difs+=("$origem/$rel::$vivo/$rel")
  done < <( { relativos "$origem" "$lista"; relativos "$vivo" "$lista"; } | sort -u )
done

if [ "$WS_ATIVO" -eq 1 ] && [ -f "$WS_REPO" ]; then
  if [ "$ACAO" = push ]; then
    [ "$(soma "$WS_ESPERADO")" = "$(soma "$WS_VIVO")" ] || difs+=("$WS_REPO::$WS_VIVO")
  elif [ -z "$WS_DESMONTADO" ]; then
    difs+=("$WS_REPO::$WS_VIVO")
  elif [ "$WS_RC_DESMONTA" -eq 2 ]; then
    aviso "$WS_VIVO tem delimitador privado orfao ou repetido: o par entra na lista, mas nao da para desmontar."
    difs+=("$WS_REPO::$WS_VIVO")
  elif [ "$WS_SEM_MARCA" -eq 1 ]; then
    aviso "$WS_VIVO nao tem bloco privado nem linha marcadora: o par entra na lista, mas o pull recusa (rode push)."
    difs+=("$WS_REPO::$WS_VIVO")
  else
    [ "$(soma "$WS_REPO")" = "$(soma "$WS_DESMONTADO")" ] || difs+=("$WS_REPO::$WS_VIVO")
  fi
fi

if [ "$ACAO" = status ]; then
  if [ ${#difs[@]} -eq 0 ]; then echo 'Tudo igual entre repo e maquina.'; else
    printf '\n%s arquivo(s) fora de sincronia:\n' "${#difs[@]}"
    for d in "${difs[@]}"; do echo "  ${d%%::*}"; done
    echo 'pull = trazer da maquina para o repo | push = levar o repo para a maquina'
  fi
  # Skill viva que nao esta no repo nao e diferenca, e skill nova ainda nao versionada.
  if [ -d "$CLAUDE_HOME/skills" ]; then
    novas=""
    for s in "$CLAUDE_HOME"/skills/*/; do
      n="$(basename "$s")"; [ -d "$REPO/skills/$n" ] || novas="$novas  - $n"$'\n'
    done
    [ -n "$novas" ] && printf '\nSkills em ~/.claude/skills fora do repo:\n%s' "$novas"
  fi
  # Hook vivo fora da lista fixa e invisivel ao laco acima - foi assim que o brain-contexto.js
  # ficou dois dias fora do git sem ninguem notar. So *.js: a instalacao guarda copias de
  # seguranca (.bak, .pre-detach) que nao sao hook e virariam falso positivo permanente.
  if [ -d "$CLAUDE_HOME/hooks" ]; then
    orfaos=""
    for h in "$CLAUDE_HOME"/hooks/*.js; do
      [ -f "$h" ] || continue
      nome="$(basename "$h")"
      case " $HOOKS_VERSIONADOS " in *" $nome "*) continue ;; esac
      orfaos="$orfaos  - $nome"$'\n'
    done
    [ -n "$orfaos" ] && printf '\nHooks em ~/.claude/hooks fora do repo:\n%s' "$orfaos"
  fi
  exit 0
fi

[ ${#difs[@]} -gt 0 ] || { echo 'Nada a copiar: ja esta tudo igual.'; exit 0; }

# O push sobrescreve a instalacao inteira. Se ela veio de outra pasta ou de outra branch, seguir
# apaga o dogfood de outro card em voo - e apagar em silencio e o que esta pergunta impede.
# Instalacao sem marcador nao tem origem registrada: ai o push grava sem perguntar, porque
# perguntar seria pedir confirmacao contra um dado que nao existe.
BRANCH_AGORA="$(branch_atual)"
if [ "$ACAO" = push ]; then
  ORIGEM_ANTIGA="$(campo_marcador worktree)"
  BRANCH_ANTIGA="$(campo_marcador branch)"
  OUTRA_PASTA=0
  OUTRA_BRANCH=0
  if [ -n "$ORIGEM_ANTIGA" ]; then
    if [ "$(normaliza_caminho "$ORIGEM_ANTIGA")" != "$(normaliza_caminho "$REPO")" ]; then OUTRA_PASTA=1; fi
    if [ "$BRANCH_ANTIGA" != "$BRANCH_AGORA" ]; then OUTRA_BRANCH=1; fi
  fi
  if [ "$OUTRA_PASTA" -eq 1 ] || [ "$OUTRA_BRANCH" -eq 1 ]; then
    BRANCH_ANTIGA_TXT="$BRANCH_ANTIGA"; [ -n "$BRANCH_ANTIGA_TXT" ] || BRANCH_ANTIGA_TXT='(nao registrada)'
    BRANCH_AGORA_TXT="$BRANCH_AGORA";   [ -n "$BRANCH_AGORA_TXT" ]  || BRANCH_AGORA_TXT='(nenhuma)'
    DATA_ANTIGA="$(campo_marcador data)"; [ -n "$DATA_ANTIGA" ] || DATA_ANTIGA='(sem data)'
    TITULO='A instalacao viva nao veio desta pasta.'
    [ "$OUTRA_PASTA" -eq 1 ] || TITULO='A instalacao viva veio desta pasta, mas de outra branch.'
    cat <<FIM

$TITULO

  instalada a partir de: $ORIGEM_ANTIGA
             na branch:  $BRANCH_ANTIGA_TXT   em $DATA_ANTIGA
  este push vem de:      $REPO
             na branch:  $BRANCH_AGORA_TXT

Cada worktree tem a sua versao das skills e dos hooks. Seguir agora troca ${#difs[@]} arquivo(s) da
instalacao pelos desta pasta: a sessao que estiver rodando com a outra passa a ler o texto desta
aqui, sem aviso nenhum.

  [s] sobrescrever - a instalacao viva passa a ser a desta pasta
  [n] cancelar     - nada e copiado, a instalacao continua como esta (padrao)
FIM
    echo ''
    if [ "$SOBRESCREVER" -eq 1 ]; then
      echo 'Escolhido em --sobrescrever: seguindo sem perguntar.'
    elif [ -t 0 ]; then
      printf 'Sobrescrever? [s/N] '
      RESPOSTA=''
      read -r RESPOSTA || true
      case "$RESPOSTA" in
        [sS]|[sS][iI][mM]|[yY]|[yY][eE][sS]) ;;
        *) echo 'Cancelado: nada foi copiado.'; exit 1 ;;
      esac
    else
      echo 'Sem terminal para perguntar, e silencio nao e aprovacao: nada foi copiado.'
      echo 'Rode num terminal, ou passe --sobrescrever se a decisao ja esta tomada.'
      exit 1
    fi
  fi
fi

n=0
for d in "${difs[@]}"; do
  a="${d%%::*}"; b="${d#*::}"
  if [ "$ACAO" = pull ]; then de="$b"; para="$a"; else de="$a"; para="$b"; fi
  if [ "$WS_ATIVO" -eq 1 ] && [ "$a" = "$WS_REPO" ]; then
    # o par do workspace nao e copia: push instala o montado, pull devolve o desmontado
    if [ "$ACAO" = pull ]; then de="$WS_DESMONTADO"; else de="$WS_ESPERADO"; fi
  fi
  [ -n "$de" ] && [ -f "$de" ] || { echo "  ? $(basename "$a"): nao existe na origem, pulado"; continue; }
  mkdir -p "$(dirname "$para")"
  cp "$de" "$para"
  echo "  + $para"
  n=$((n + 1))
done

printf '\n%s arquivo(s) copiados.\n' "$n"
if [ "$ACAO" = pull ]; then
  echo "Agora: git -C \"$REPO\" add -A && git commit && git push"
else
  if [ "$n" -gt 0 ]; then registra_origem; fi
  echo "Se mudou algo em brain-mcp/src, recompile:  cd \"$BRAIN_DIR\" && npm install && npm run build"
  echo 'E reinicie o Claude Code para o servidor novo subir.'
fi
