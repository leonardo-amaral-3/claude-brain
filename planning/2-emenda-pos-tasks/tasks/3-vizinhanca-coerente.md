✅ Status: Complete

# Task 3: A vizinhança que passaria a mentir (CA4)

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/2-emenda-pos-tasks/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the **root of this repository** (`claude-brain`) — there is **no nested module repo**; run every git command from the repo root. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 3 of 3. Tasks 1 e 2 já estão no código: a seção `## Emenda pós-tasks` existe no `gm-implement` e a regra de detecção existe no `## Open the PR` do `gm-ship`.

## Scope

Somente a **Área 3** do `## Implementation Details` da spec — as quatro frases do CA4, em quatro pontos de três arquivos: `skills/gm-spec/SKILL.md`, `docs/esteira-gm.md` (dois verbetes) e `skills/gm-correcao/SKILL.md`.

A forma importa e a spec é explícita: em todas, a cláusula é **frase nova ao fim**, nunca inserção depois do parêntese — o parêntese é seguido do verbo da oração (`atualizam` / `atualiza`), e inserir ali produz texto agramatical.

**Fora desta task:** `README.md:245` e `skills/gm-plan-tasks/SKILL.md:28`, ambos deliberadamente fora com motivo registrado na tabela da spec. Não reabra `gm-implement` nem `gm-ship`. Nada de "já que estou aqui" — em especial, **não** corrija a contagem de skills do `CLAUDE.md` (`:4` e `:86`), que o `## Coding Standards` nomeia como outro assunto, de card novo pelo protocolo de achado.

**Depois do commit desta task**, e só desta: `./sync.sh push`, porque o que o Claude Code carrega é a instalação em `~/.claude/skills/`, não esta pasta. Confira com `./sync.sh status` (esperado: `Tudo igual entre repo e maquina.`). `docs/` não é sincronizado — por desenho, é conferido no repo pelo script abaixo.

## Verification

Esta é a última task: o comando é o **script inteiro** do `## Plano de testes` da spec, ponta a ponta, da raiz do repo. Ele prova CA1, CA2, CA3, CA4, o passo 0 e os invariantes de frontmatter de uma vez:

```bash
set -e
I=skills/gm-implement/SKILL.md ; S=skills/gm-ship/SKILL.md
falha() { echo "FALHA: $1" >&2 ; exit 1 ; }

SEC=$(mktemp)
sed -n '/^## Emenda pós-tasks/,/^## Present for review/p' "$I" > "$SEC"
test -s "$SEC" || falha "CA1: seção Emenda pós-tasks ausente"

for p in 'N+1' 'Uma emenda, uma task' 'gm-plan-tasks' 'gm-spec' \
         'exceção nomeada ao teto' 'Segunda emenda' ; do
  grep -q "$p" "$SEC" || falha "CA1: '$p' fora da seção"
done

if grep -qF 'All tasks `✅` → offer `/gm-ship <folder>`.' "$I" ; then
  falha "CA1: a saída única antiga sobrou no Setup"
fi
grep -q 'emenda pós-tasks' "$I"                          || falha "CA1: Setup não cita a seção"
grep -qF 'All `✅` → offer `/gm-ship <folder>`.' "$I"     || falha "CA1: :91 foi alterada à toa"

for p in 'aprovação humana explícita' 'Emenda AAAA-MM-DD' 'gm:spec' 'spec.md' \
         'gm:tasks' 'gm:spec-ref' 'superada pela emenda' ; do
  grep -q "$p" "$SEC" || falha "CA3: '$p' fora da seção"
done

awk '/^## Open the PR/,/^## Board/' "$S" > "$SEC.ship"
for p in 'emenda pós-tasks' 'não abra a PR' 'medições' 'precondição 2' ; do
  grep -q "$p" "$SEC.ship" || falha "CA2: '$p' fora de Open the PR"
done
grep -q 'Emenda AAAA-MM-DD' "$S" || falha "CA3: corpo da PR não nomeia a emenda"

grep -q 'emenda pós-tasks' skills/gm-spec/SKILL.md     || falha "CA4: gm-spec"
grep -q 'emenda pós-tasks' skills/gm-correcao/SKILL.md || falha "CA4: gm-correcao"
test "$(grep -c 'emenda pós-tasks' docs/esteira-gm.md)" -ge 2 || falha "CA4: docs (2 pontos)"

git ls-remote --exit-code --heads origin dev >/dev/null || falha "passo 0: branch dev"
grep -q 'disable-model-invocation: true' "$I" || falha "frontmatter gm-implement"
grep -q 'disable-model-invocation: true' "$S" || falha "frontmatter gm-ship"

rm -f "$SEC" "$SEC.ship" ; echo OK
```

Acceptance criteria covered: **CA4** inteiro, e a re-prova de CA1 + CA2 + CA3 depois de tudo integrado.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green — o script inteiro sai `OK`
- [ ] As quatro frases são frase nova ao fim, nenhuma dentro de parêntese
- [ ] Depois do commit: `./sync.sh push` e `./sync.sh status` limpo

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from the repo root with a clear message ending with the trailer `Card: #2`. Depois do commit, `./sync.sh push`.
4. Flip the first line of this file to `✅ Status: Complete`.
