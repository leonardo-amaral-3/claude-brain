✅ Status: Complete

# Task 1: `## Modo despachado` na fonte e carimbado nas 11 skills

## Context

- **Spec**: [`planning/28-processo-esteira/spec.md`](../spec.md) — ALL requirements and decisions. Follow it strictly; if reality contradicts it, STOP (deviation protocol).
- **Trecho normativo**: [`trechos/modo-despachado.md`](../trechos/modo-despachado.md) — copy **verbatim**, from `## Modo despachado` to the end.
- Repo `claude-brain`. Work only in the worktree `C:/Users/lokin/pessoal/claude-brain-28-processo`, branch `feat/28-processo-esteira`. Never run `sync push`, never write to `~/.claude`, never touch the main checkout or the sibling worktrees.

This is task 1 of 5. Nothing of this card is in the codebase yet.

## Scope

Spec **Área 1** — requirement 3. Premissas it depends on (spec `## Premissas medidas`): rows 1–5 (`--check` green with 2 blocks, the test green, the script takes any number of sections, the test survives a 3rd section — **confirm it by running**, `## Convenções de saída` is the last section of all 11).

- `skills/_comum/convencoes.md`: the four text edits and the new section listed in Área 1.
- The 11 skills receive the section **only through the script**: add the bare header at EOF, then `node scripts/skills-comum.mjs`. Never write the block body by hand.
- `scripts/skills-comum-teste.mjs` does not change. If it exits `1` with the 3rd section, that is the deviation the spec names — stop.

NOT in scope: any text outside the stamped blocks of the skills (tasks 2–4), docs (task 5).

## Verification

- `grep -c "^## " skills/_comum/convencoes.md` → `3`; `grep -c "Reservado para a Fase 2" skills/_comum/convencoes.md` → `0`.
- The section is the trecho verbatim: `awk '/^## Modo despachado/{f=1} f' skills/_comum/convencoes.md | md5sum` equals the same `awk` over `planning/28-processo-esteira/trechos/modo-despachado.md`; `| wc -m` ≤ 3600.
- `node scripts/skills-comum.mjs --check; echo $?` → `11 skills × 3 blocos iguais à fonte`, `0`.
- `node scripts/skills-comum-teste.mjs; echo $?` → `0`.
- `grep -c "^## Modo despachado" skills/gm-*/SKILL.md` → `1` in the 11, `0` in `gm-tech-spec`.
- Base text shrank: `wc -c planning/28-processo-esteira/trechos/base-29-reescrita.txt ../claude/despachos-30/base-29.txt` → 1718 < 2871; `grep -ci "sync push\|mergeie\|lembrar\|primeiro plano\|PROXIMO\|PARE\|frashdopredio\|Card: #" planning/28-processo-esteira/trechos/base-29-reescrita.txt` → `0`.

Acceptance criteria covered: **3**.

## Completion Checklist

- [x] Everything in scope implemented per the spec
- [x] Every verification command above run, with its output pasted into the commit body
- [x] Skill bodies changed only by the script

## Workflow

1. Implement; run the checklist.
2. Summarize: the verification result first, then a risk-ranked reading order.
3. Commit in the worktree with `git commit -F <file>`, trailer `Card: #28`, identity `leonardo-amaral-3 <frashdopredio2005@gmail.com>`.
4. Flip the first line of this file to `✅ Status: Complete` and tick item 1 in the card's `<!-- gm:tasks -->` comment.
