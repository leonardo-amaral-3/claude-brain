#!/usr/bin/env bash
# Prova da F5 (#83): o par do CLAUDE.md do workspace no sync, sem tocar a instalacao viva.
#
#   bash prova-sync.sh <caminho do sync.sh sob teste>
#
# Tudo roda dentro de um mktemp -d: HOME, CLAUDE_CONFIG_DIR e BRAIN_DIR temporarios, e uma copia do
# repo em <tmp>/pessoal/claude-brain/ (a pasta acima do repo se chama `pessoal`, que e o que ativa
# o par). Sai 0 so quando todo caso vale; 1 caso contrario.
set -uo pipefail

ALVO="${1:-}"
[ -f "$ALVO" ] || { echo "uso: $0 <sync.sh>" >&2; exit 2; }
ALVO="$(cd "$(dirname "$ALVO")" && pwd)/$(basename "$ALVO")"
RAIZ="$(cd "$(dirname "$ALVO")" && pwd)"

T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
export HOME="$T/home" CLAUDE_CONFIG_DIR="$T/home/.claude" BRAIN_DIR="$T/brain"
mkdir -p "$HOME" "$CLAUDE_CONFIG_DIR" "$BRAIN_DIR"
WS="$T/pessoal"
REPO="$WS/claude-brain"
mkdir -p "$REPO"
( cd "$RAIZ" && git ls-files -z --cached --others --exclude-standard | tar -c --null -T - ) | tar -x -C "$REPO"
cp "$ALVO" "$REPO/sync.sh"
SYNC="$REPO/sync.sh"
GEN="$REPO/workspaces/pessoal/CLAUDE.md"
VIVO="$WS/CLAUDE.md"
PRIV="$WS/CLAUDE.privado.md"
MARCA='<!-- privado: CLAUDE.privado.md entra aqui -->'

soma() { sha256sum "$1" | cut -d' ' -f1; }
FALHAS=0
caso() { # caso <nome> <comando de teste>
  local nome="$1"; shift
  if "$@"; then echo "  ok    $nome"; else echo "  FALHA $nome"; FALHAS=$((FALHAS + 1)); fi
}
roda() { SAIDA="$("$@" 2>&1 </dev/null)"; RC=$?; }

[ "$(grep -cx "$MARCA" "$GEN")" = 1 ] || { echo "o generico do repo nao tem exatamente uma marcadora"; exit 1; }
GEN_SHA="$(soma "$GEN")"

echo "1. push sem CLAUDE.privado.md"
roda "$SYNC" push
caso "rc 0" test "$RC" = 0
caso "avisa que instala so o generico" grep -q 'so a parte generica' <<<"$SAIDA"
caso "instalado == generico, marcadora intacta" cmp -s "$GEN" "$VIVO"

echo "2. push com CLAUDE.privado.md"
printf '## Board\n\n- dado de mentira, so da prova\n- segunda linha\n' > "$PRIV"
PRIV_SHA="$(soma "$PRIV")"
echo "     sha256 do privado antes: $PRIV_SHA"
roda "$SYNC" push
caso "rc 0" test "$RC" = 0
caso "instalado leva inicio e fim, uma vez cada" test "$(grep -c '^<!-- privado:inicio ' "$VIVO")$(grep -cx '<!-- privado:fim -->' "$VIVO")" = 11
caso "instalado leva o conteudo do privado" grep -q 'dado de mentira' "$VIVO"
caso "marcadora trocada (nao sobra no instalado)" test "$(grep -cx "$MARCA" "$VIVO")" = 0
caso "sem @import" test "$(grep -c '^@' "$VIVO")" = 0
caso "push idempotente: segundo push nada a copiar" bash -c "'$SYNC' push </dev/null 2>&1 | grep -q 'Nada a copiar'"

echo "3. status igual depois do push"
roda "$SYNC" status
caso "rc 0" test "$RC" = 0
caso "tudo igual" grep -q 'Tudo igual' <<<"$SAIDA"

echo "4. pull devolve o generico byte a byte"
roda "$SYNC" pull
caso "rc 0" test "$RC" = 0
caso "generico do repo inalterado (sha256)" test "$(soma "$GEN")" = "$GEN_SHA"

echo "5. status diferente depois de editar o generico"
printf '\nlinha nova do generico\n' >> "$GEN"
roda "$SYNC" status
caso "rc 0" test "$RC" = 0
caso "lista o par" grep -q 'workspaces/pessoal/CLAUDE.md' <<<"$SAIDA"
roda "$SYNC" push
caso "push instala a edicao" grep -q 'linha nova do generico' "$VIVO"
roda "$SYNC" status
caso "status volta a igual" grep -q 'Tudo igual' <<<"$SAIDA"

echo "6. pull traz edicao feita fora do bloco e deixa o privado em paz"
printf '\nlinha editada na instalacao\n' >> "$VIVO"
roda "$SYNC" pull
caso "rc 0" test "$RC" = 0
caso "edicao voltou ao generico do repo" grep -q 'linha editada na instalacao' "$GEN"
caso "repo nao ganhou o conteudo privado" test "$(grep -c 'dado de mentira' "$GEN")" = 0
caso "repo manteve uma marcadora e nenhum delimitador" test "$(grep -cx "$MARCA" "$GEN")$(grep -c 'privado:inicio\|privado:fim' "$GEN")" = 10
GEN_SHA="$(soma "$GEN")"

echo "7. bloco privado instalado editado a mao"
sed -i 's/segunda linha/segunda linha EDITADA NA INSTALACAO/' "$VIVO"
roda "$SYNC" pull
caso "pull avisa que a edicao nao volta" grep -q 'nao volta a lugar nenhum' <<<"$SAIDA"
caso "generico do repo inalterado" test "$(soma "$GEN")" = "$GEN_SHA"
roda "$SYNC" status
caso "status avisa o bloco defasado, sem listar o par" bash -c "grep -q 'defasado' <<<'$SAIDA' && ! grep -q 'fora de sincronia' <<<'$SAIDA'"
roda "$SYNC" push
caso "push refaz o bloco a partir do arquivo local" test "$(grep -c 'EDITADA NA INSTALACAO' "$VIVO")" = 0

echo "8. delimitador orfao"
cp "$VIVO" "$T/vivo.bom"
grep -vx '<!-- privado:fim -->' "$T/vivo.bom" > "$VIVO"
roda "$SYNC" pull
caso "pull sai com 2" test "$RC" = 2
caso "nada escrito no repo" test "$(soma "$GEN")" = "$GEN_SHA"
cp "$T/vivo.bom" "$VIVO"
{ cat "$T/vivo.bom"; echo '<!-- privado:fim -->'; } > "$VIVO"
roda "$SYNC" pull
caso "fim repetido tambem sai com 2" test "$RC" = 2
cp "$T/vivo.bom" "$VIVO"

echo "8b. instalado antigo, inteiro, sem bloco nem marcadora (o CLAUDE.md de antes da F5)"
grep -v '^<!-- privado:' "$T/vivo.bom" > "$VIVO"
roda "$SYNC" pull
caso "pull sai com 2" test "$RC" = 2
caso "diz por que recusou" grep -q 'nem linha marcadora' <<<"$SAIDA"
caso "nada escrito no repo" test "$(soma "$GEN")" = "$GEN_SHA"
caso "repo nao ganhou o conteudo privado" test "$(grep -c 'dado de mentira' "$GEN")" = 0
roda "$SYNC" status
caso "status rc 0" test "$RC" = 0
caso "status avisa" grep -q 'nem linha marcadora' <<<"$SAIDA"
caso "status lista o par" grep -q 'CLAUDE.md' <<<"$SAIDA"
roda "$SYNC" push
caso "push repoe o montado" test "$(grep -c '^<!-- privado:inicio ' "$VIVO")" = 1
cp "$T/vivo.bom" "$VIVO"

echo "9. generico sem marcadora"
cp "$GEN" "$T/gen.bom"
grep -vx "$MARCA" "$T/gen.bom" > "$GEN"
roda "$SYNC" push
caso "rc 0" test "$RC" = 0
caso "avisa" grep -q 'linhas marcadoras' <<<"$SAIDA"
caso "instala o generico sem o privado" bash -c "cmp -s '$GEN' '$VIVO'"
cp "$T/gen.bom" "$GEN"

echo "10. fora de uma pasta chamada pessoal o par some"
FORA="$T/outro/claude-brain"
mkdir -p "$FORA"
cp -r "$REPO"/. "$FORA"/
printf 'intocado\n' > "$T/outro/CLAUDE.md"
roda "$FORA/sync.sh" push
caso "CLAUDE.md do vizinho intocado" test "$(cat "$T/outro/CLAUDE.md")" = intocado

echo "11. o privado nao mudou em nada"
echo "     sha256 do privado depois: $(soma "$PRIV")"
caso "sha256 igual antes e depois" test "$(soma "$PRIV")" = "$PRIV_SHA"

echo
if [ "$FALHAS" -eq 0 ]; then echo "PROVA VERDE"; exit 0; else echo "PROVA VERMELHA: $FALHAS caso(s)"; exit 1; fi
