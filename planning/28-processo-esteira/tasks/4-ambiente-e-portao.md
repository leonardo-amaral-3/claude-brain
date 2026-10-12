❌ Status: Not Started

# Task 4: ambiente na entrada e portão de teste lido do `CLAUDE.md`

## Context

- **Spec**: [`planning/28-processo-esteira/spec.md`](../spec.md) — ALL requirements and decisions (the choice `local`/`CI` and what was discarded are in `## Technical Decisions` 1 and 3). Follow it strictly; if reality contradicts it, STOP (deviation protocol).
- **Trechos normativos**: [`trechos/ambiente-e-portao.md`](../trechos/ambiente-e-portao.md), trechos **A, B, C, D** — copy verbatim.
- Repo `claude-brain`. Work only in the worktree `C:/Users/lokin/pessoal/claude-brain-28-processo`, branch `feat/28-processo-esteira`. Never run `sync push`, never write to `~/.claude`, never touch the main checkout or the sibling worktrees.

This is task 4 of 5. Tasks 1–3 are in the codebase. Locate text by quoting it.

## Scope

Spec **Área 4** — requirement 4. Premissas it depends on: rows 8 (`df -Pk .` works in Git Bash), 9 (no `CLAUDE.md` declares *Portão de teste*/*Ambiente* today), 10 (Notoria's practice) and 1 (`--check` invariant).

- `skills/gm-ship/SKILL.md`: trecho A as `## Ambiente na entrada` right before `## Preconditions`; trecho B replaces precondition 4 entirely.
- `skills/gm-correcao/SKILL.md`: trecho A, byte-identical, right before `## Preconditions`; trecho C replaces item 2 of *Corrige*.
- `templates/CLAUDE.example.md`: trecho D after the *Typecheck do CI* item; the closing sentence of the *Despacho* item, as Área 4 states.
- `CLAUDE.md` (this repo): the *Portão de teste* / *Ambiente* paragraph of Área 4, after the three deltas and before "Regras duras".

NOT in scope: the Notoria `CLAUDE.md` (out of repo — it is the post-deploy recommendation), anything inside stamped blocks.

## Verification

- Same section in both skills: `for f in skills/gm-ship/SKILL.md skills/gm-correcao/SKILL.md; do awk '/^## Ambiente na entrada/{f=1;print;next} f&&/^## /{exit} f' "$f" | md5sum; done` → two identical md5.
- `grep -n "^## Ambiente na entrada\|^## Preconditions" skills/gm-ship/SKILL.md skills/gm-correcao/SKILL.md` → `Ambiente` immediately precedes `Preconditions` in each.
- `grep -n "Portão de teste" skills/gm-ship/SKILL.md skills/gm-correcao/SKILL.md templates/CLAUDE.example.md CLAUDE.md` → hits in all four; `grep -n "Ambiente\*\*\|\*\*Ambiente" templates/CLAUDE.example.md CLAUDE.md` → hits in both.
- `node scripts/skills-comum.mjs --check; echo $?` → `0`.

Acceptance criteria covered: **4**.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Every verification command above run, with its output pasted into the commit body
- [ ] Trechos verbatim; trecho A byte-identical in both skills

## Workflow

1. Implement; run the checklist.
2. Summarize: the verification result first, then a risk-ranked reading order.
3. Commit in the worktree with `git commit -F <file>`, trailer `Card: #28`, identity `leonardo-amaral-3 <frashdopredio2005@gmail.com>`.
4. Flip the first line of this file to `✅ Status: Complete` and tick item 4 in the card's `<!-- gm:tasks -->` comment.
