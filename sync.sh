#!/usr/bin/env bash
# Sincroniza este repo com a instalacao viva em ~/.claude. Equivalente ao sync.ps1.
#
#   ./sync.sh status   o que esta diferente, sem escrever nada
#   ./sync.sh pull     ~/.claude + brain-mcp  ->  repo   (antes de commitar)
#   ./sync.sh push     repo -> ~/.claude + brain-mcp     (depois de um git pull)
#
# Nunca entra na sincronia: brain.config.json, ~/.claude/brain-workspaces.json (pessoais de
# cada maquina) e a pasta data/ (o indice, que se reconstroi).
set -euo pipefail

ACAO="${1:-status}"
case "$ACAO" in status|pull|push) ;; *) echo "uso: $0 [status|pull|push]" >&2; exit 2 ;; esac

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

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
pares+=("$REPO/hooks::$CLAUDE_HOME/hooks::brain-config.js brain-briefing.js obsidian-diario.js obsidian-diario-titulo.js")

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
  exit 0
fi

[ ${#difs[@]} -gt 0 ] || { echo 'Nada a copiar: ja esta tudo igual.'; exit 0; }

n=0
for d in "${difs[@]}"; do
  a="${d%%::*}"; b="${d#*::}"
  if [ "$ACAO" = pull ]; then de="$b"; para="$a"; else de="$a"; para="$b"; fi
  [ -f "$de" ] || { echo "  ? $(basename "$de"): nao existe na origem, pulado"; continue; }
  mkdir -p "$(dirname "$para")"
  cp "$de" "$para"
  echo "  + $para"
  n=$((n + 1))
done

printf '\n%s arquivo(s) copiados.\n' "$n"
if [ "$ACAO" = pull ]; then
  echo "Agora: git -C \"$REPO\" add -A && git commit && git push"
else
  echo "Se mudou algo em brain-mcp/src, recompile:  cd \"$BRAIN_DIR\" && npm install && npm run build"
  echo 'E reinicie o Claude Code para o servidor novo subir.'
fi
