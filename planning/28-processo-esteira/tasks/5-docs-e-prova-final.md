✅ Status: Complete

# Task 5: `docs/esteira-gm.md` conta o modo despachado, e a prova final

## Context

- **Spec**: [`planning/28-processo-esteira/spec.md`](../spec.md) — ALL requirements and decisions. Follow it strictly; if reality contradicts it, STOP (deviation protocol).
- Repo `claude-brain`. Work only in the worktree `C:/Users/lokin/pessoal/claude-brain-28-processo`, branch `feat/28-processo-esteira`. Never run `sync push`, never write to `~/.claude`, never touch the main checkout or the sibling worktrees.

This is task 5 of 5. Tasks 1–4 are in the codebase: the source has `## Modo despachado`, the skills carry premissas medidas, épico na triagem, ambiente na entrada and the portão de teste. The docs must describe that — read the skills as they are now, not as the spec predicted.

## Scope

Spec **Área 5** — requirements 5 and 6. Premissas it depends on: row 6 (no heredoc in the skills) and row 11 (base-text sizes, for the example in the docs).

- `docs/esteira-gm.md`: new `## Modo despachado` between `## Convenções de saída` and `## Uma worktree por card` (pt-BR, ≤ 30 lines, contents as Área 5 lists); one sentence each in `## As skills` for `gm-triage`, `gm-spec`, `gm-plan-tasks`, `gm-ship`/`gm-correcao`.
- `README.md`: only if it describes the source section by section (check with the `grep` of Área 5); otherwise untouched, and say so.
- Requirement 5 (heredoc) changes nothing: re-run its `grep` and record the result.

NOT in scope: any skill file.

## Verification

- `grep -n "^## " docs/esteira-gm.md` → `Convenções de saída`, `Modo despachado`, `Uma worktree por card` in that order; `awk '/^## Modo despachado/{f=1;next} f&&/^## /{exit} f' docs/esteira-gm.md | wc -l` ≤ 30.
- No contradiction with the source: read the new doc section side by side with `awk '/^## Modo despachado/{f=1} f' skills/_comum/convencoes.md` — every column (decide · para · não faz) and the two conditions match; note the check in the commit body.
- `grep -n "premissas medidas\|Premissas medidas" docs/esteira-gm.md`, `grep -n "épico" docs/esteira-gm.md`, `grep -n "Ambiente na entrada\|Portão de teste" docs/esteira-gm.md` → each ≥ 1.
- Requirement 5: `grep -c "<<" skills/*/SKILL.md` → `0` in all; `grep -n -- '--body "' skills/*/SKILL.md` → only `gm-hotfix`.
- Final sweep of the card: `node scripts/skills-comum.mjs --check; echo $?` → `0` with `11 skills × 3 blocos`; `node scripts/skills-comum-teste.mjs; echo $?` → `0`.

Acceptance criteria covered: **5, 6** (and the final re-run of 3).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Every verification command above run, with its output pasted into the commit body
- [ ] The doc section agrees with the source, row by row

## Workflow

1. Implement; run the checklist.
2. Summarize: the verification result first, then a risk-ranked reading order.
3. Commit in the worktree with `git commit -F <file>`, trailer `Card: #28`, identity `leonardo-amaral-3 <frashdopredio2005@gmail.com>`.
4. Flip the first line of this file to `✅ Status: Complete` and tick item 5 in the card's `<!-- gm:tasks -->` comment.
