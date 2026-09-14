❌ Status: Not Started

# Task 1: A tabela e o frontmatter

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/21-modelo-por-estacao/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `claude-brain` repository of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/21-modelo-por-estacao`, in the worktree `claude-brain-21-modelo-por-estacao`, already checked out by `/gm-implement`). Shell: Git Bash, from the root of that worktree.

This is task 1 of 4. Nothing of this card is in the codebase yet.

## Scope

Markdown only, two pieces of the spec:

- **`### 1. Frontmatter das 12 skills`** — the single `model:` line in each of the 12 `skills/gm-*/SKILL.md`, in the position and with the values the spec gives. Nothing else in those files changes (LF stays LF).
- **`### 2. docs/esteira-gm.md — seção nova`** — the block copied byte for byte, in the position the spec gives. No other line of the doc changes.

**Out of scope:** `scripts/prova-modelo.mjs` (tasks 2 and 3), `./sync.sh push` and anything under `~/.claude` (task 4), `README.md`, `CLAUDE.md`, `brain-mcp/`, `hooks/`. Never edit the installation directly — `CLAUDE.md`, Regra 1.

Note from planning (2026-09-14): `origin/dev` moved from `74f97a2` (the commit the spec cites) to `396ddb6` — card #18 merged. `docs/esteira-gm.md` and `skills/` are identical in both, and the line 138/139 anchors of the doc still hold. Re-check before editing; if they no longer hold, that is a deviation.

## Verification

From `## Plano de testes` of the spec, run as written there: **T3**, **T4**, **T10** and the `skills/` half of **T11** (12 lines `1	0`).

Before the commit, the comparisons that read `HEAD` do not see your work yet: use `git diff --numstat origin/dev -- …` in place of `origin/dev...HEAD`, and `confere < docs/esteira-gm.md` in place of `git show HEAD:docs/esteira-gm.md | confere`. After the commit, run them once more exactly as the spec writes them.

Plus one local check that anticipates T1 (the script that proves it only exists after tasks 2 and 4) — frontmatter against the spec's table, line position, and line endings:

```bash
esperado() { grep -oE '^\| `gm-[a-z-]+` \| `[^`]+`' planning/21-modelo-por-estacao/spec.md | sed -E 's/^\| `([^`]+)` \| `([^`]+)`$/\1 \2/' | sort -u ; }
visto()    { for f in skills/gm-*/SKILL.md; do s=$(basename "$(dirname "$f")"); awk -v s="$s" 'NR==1{next} /^---$/{exit} /^model:/{print s, $2}' "$f"; done | sort ; }
diff <(esperado) <(visto)                                                    # vazio
for f in skills/gm-*/SKILL.md; do grep -A1 -x 'disable-model-invocation: true' "$f" | sed -n 2p | grep -q '^model: ' || echo "FORA DE LUGAR: $f"; done   # nenhuma saída
grep -lU $'\r' skills/gm-*/SKILL.md docs/esteira-gm.md                       # nenhuma saída
```

- Acceptance criteria covered: **CA1** — the table and the repo frontmatter say the same, and the section is the spec's text at the specified position (the installation half of CA1 closes in task 4); **CA3** in full (the text of the section).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the `claude-brain` worktree, message ending with the trailer `Card: #21` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
