#!/usr/bin/env bash
# Instala o brain-mcp, as skills e os hooks deste repo na maquina atual (macOS/Linux/Git Bash).
# Equivalente ao install.ps1. Uso:
#   ./install.sh            instala
#   ./install.sh --dry-run  mostra o que faria
#   ./install.sh --skip-build
set -euo pipefail

DRY=0
SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "opcao desconhecida: $arg" >&2; exit 2 ;;
  esac
done

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
BRAIN_DIR="$REPO/brain-mcp"

# No Git Bash o pwd sai como /c/Users/... — forma que o bash entende e o Node no Windows nao.
# Caminho que vai virar CONTEUDO de arquivo (JSON lido depois pelos hooks) tem que ser nativo,
# senao o fs.existsSync falha em silencio e o hook nunca roda. Fora do Windows, e identidade.
nativo() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi
}

passo() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
feito() { printf '    \033[32m+ %s\033[0m\n' "$1"; }
aviso() { printf '    \033[33m! %s\033[0m\n' "$1"; }
diz()   { printf '    %s\n' "$1"; }

[ "$DRY" = 1 ] && printf '\033[35mMODO DRY-RUN: nada sera escrito.\033[0m\n'

# ------------------------------------------------------------------ 1. pre-requisitos
passo 'Conferindo pre-requisitos'
command -v node >/dev/null || { echo 'Node nao encontrado. Instale Node 22+: https://nodejs.org' >&2; exit 1; }
NODE_V="$(node --version | sed 's/^v//')"
# O indice usa node:sqlite, que so existe a partir do Node 22.
[ "${NODE_V%%.*}" -ge 22 ] || { echo "Node $NODE_V e velho demais; o brain usa node:sqlite (Node 22+)." >&2; exit 1; }
feito "node $NODE_V"

for par in "gh:sincronizar cards e PRs do GitHub" "git:indexar historico de commits" "claude:registrar o MCP automaticamente"; do
  bin="${par%%:*}"; para="${par#*:}"
  if command -v "$bin" >/dev/null; then feito "$bin"; else aviso "$bin nao encontrado - sem ele voce perde: $para"; fi
done

# ------------------------------------------------------------------ 2. compilar
if [ "$SKIP_BUILD" = 1 ]; then
  passo 'Build do brain-mcp: pulado (--skip-build)'
else
  passo 'Compilando o brain-mcp'
  if [ "$DRY" = 1 ]; then
    diz "npm ci + npm run build em $BRAIN_DIR"
  else
    ( cd "$BRAIN_DIR"
      if [ -f package-lock.json ]; then npm ci; else npm install; fi
      npm run build )
    feito 'dist/ gerado'
  fi
fi

# ------------------------------------------------------------------ 3. configuracao pessoal
passo 'Configuracao pessoal (criada so se ainda nao existir)'
CONFIG_NOVA=0
if [ -f "$BRAIN_DIR/brain.config.json" ]; then
  diz '= brain.config.json ja existe, mantido'
else
  CONFIG_NOVA=1
  [ "$DRY" = 1 ] || cp "$BRAIN_DIR/brain.config.example.json" "$BRAIN_DIR/brain.config.json"
  feito 'brain.config.json criado a partir do exemplo'
fi

WS_DEST="$CLAUDE_HOME/brain-workspaces.json"
WS_NOVO=0
if [ -f "$WS_DEST" ]; then
  diz '= brain-workspaces.json ja existe, mantido'
else
  WS_NOVO=1
  if [ "$DRY" != 1 ]; then
    mkdir -p "$CLAUDE_HOME"
    # O db do exemplo aponta para ~/claude-brain; corrige para onde o repo foi mesmo clonado.
    sed "s|\"db\": \"[^\"]*\"|\"db\": \"$(nativo "$BRAIN_DIR")/data/brain.db\"|" \
      "$REPO/templates/brain-workspaces.example.json" > "$WS_DEST"
  fi
  feito "brain-workspaces.json criado: $WS_DEST"
fi

# ------------------------------------------------------------------ 4. skills e hooks
passo 'Copiando skills e hooks para ~/.claude'
if [ "$DRY" = 1 ]; then
  diz "-> $CLAUDE_HOME/skills/  e  $CLAUDE_HOME/hooks/"
else
  mkdir -p "$CLAUDE_HOME/skills" "$CLAUDE_HOME/hooks"
  cp -R "$REPO"/skills/. "$CLAUDE_HOME/skills/"
  cp -R "$REPO"/hooks/. "$CLAUDE_HOME/hooks/"
fi
feito "$(find "$REPO/skills" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ') skills + hooks"

# ------------------------------------------------------------------ 5. settings.json
passo 'Ligando os hooks no settings.json'
if [ "$DRY" = 1 ]; then
  diz "SessionStart -> brain-briefing.js ; SessionEnd -> obsidian-diario.js ; UserPromptSubmit -> brain-contexto.js"
else
  # A fusao e feita em node porque jq nao e pre-requisito e node ja e.
  CLAUDE_HOME="$(nativo "$CLAUDE_HOME")" node - <<'JS'
const fs = require('fs'), path = require('path');
const home = process.env.CLAUDE_HOME;
const p = path.join(home, 'settings.json');
const s = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
s.hooks = s.hooks || {};
const desejados = [
  { evento: 'SessionStart', arquivo: 'brain-briefing.js', timeout: 15, statusMessage: 'Lendo o cerebro do produto...' },
  { evento: 'SessionEnd', arquivo: 'obsidian-diario.js', timeout: 10 },
  { evento: 'UserPromptSubmit', arquivo: 'brain-contexto.js', timeout: 10,
    statusMessage: 'Perguntando ao cerebro...' },
];
let mudou = false;
for (const d of desejados) {
  const lista = (s.hooks[d.evento] = s.hooks[d.evento] || []);
  // Compara pelo NOME DO ARQUIVO: o caminho muda de maquina para maquina, e comparar a linha
  // inteira criaria um hook duplicado a cada clone novo.
  const jaTem = lista.some((g) => (g.hooks || []).some((h) => String(h.command || '').includes(d.arquivo)));
  if (jaTem) { console.log(`    = ${d.evento}: ${d.arquivo} ja estava ligado`); continue; }
  // Barra normal mesmo no Windows: a linha vai para dentro de um JSON, e "\" vira escape.
  const cmd = path.join(home, 'hooks', d.arquivo).replace(/\\/g, '/');
  const h = { type: 'command', command: `node ${cmd}`, timeout: d.timeout };
  if (d.statusMessage) h.statusMessage = d.statusMessage;
  lista.push({ hooks: [h] });
  mudou = true;
  console.log(`    + ${d.evento}: ${d.arquivo}`);
}
if (mudou) {
  if (fs.existsSync(p)) fs.copyFileSync(p, p + '.bak');
  fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
}
JS
fi

# ------------------------------------------------------------------ 6. registrar o MCP
passo 'Registrando o MCP no Claude Code'
ENTRY="$(nativo "$BRAIN_DIR")/dist/index.js"
if command -v claude >/dev/null; then
  if [ "$DRY" = 1 ]; then
    diz "claude mcp add --scope user brain -- node $ENTRY"
  else
    claude mcp remove --scope user brain >/dev/null 2>&1 || true
    if claude mcp add --scope user brain -- node "$ENTRY"; then feito 'MCP "brain" registrado (escopo user)'
    else aviso 'claude mcp add falhou - registre a mao (veja o README)'; fi
  fi
else
  aviso 'CLI claude nao encontrada. Registre a mao:'
  diz "  claude mcp add --scope user brain -- node $ENTRY"
fi

# ------------------------------------------------------------------ 7. proximos passos
printf '\n\033[32mInstalado.\033[0m\n\nFalta voce fazer, nesta ordem:\n'
n=1
if [ "$CONFIG_NOVA" = 1 ]; then
  echo "  $n. Editar $BRAIN_DIR/brain.config.json"
  echo "     (quais pastas e repos indexar - e a unica etapa que exige pensar)"
  n=$((n + 1))
fi
if [ "$WS_NOVO" = 1 ]; then
  echo "  $n. Editar $WS_DEST  (onde ficam seus workspaces)"; n=$((n + 1))
fi
echo "  $n. cd \"$BRAIN_DIR\""; n=$((n + 1))
echo "  $n. npm run index    # varre e indexa"; n=$((n + 1))
echo "  $n. npm run embed    # gera os embeddings (a 1a vez baixa o modelo e demora)"; n=$((n + 1))
echo "  $n. npm run grafo    # monta o grafo de entidades"; n=$((n + 1))
echo "  $n. npm run smoke    # confere que o servidor responde"
printf '\nDepois abra o Claude Code numa pasta do workspace: as tools mcp__brain__* aparecem.\n'
