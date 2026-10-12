❌ Status: Not Started

# Task 4: `docs/`, o `CLAUDE.md` deste repo e o `README.md`

## Context

- **Spec**: [`planning/29-limpeza-skills/spec.md`](../spec.md) — ALL requirements and decisions. Follow it strictly; if reality contradicts it, STOP (deviation protocol).
- **Trecho normativo**: [`trechos/template-docs-claude-md.md`](../trechos/template-docs-claude-md.md) — **partes B, C and D** (parte A landed in task 3). Copy verbatim what comes below each `---`.
- Repo `claude-brain`. Work only in the worktree `C:/Users/lokin/pessoal/claude-brain-29-limpeza`, branch `feat/29-limpeza-skills`. Never run `sync push`, never write to `~/.claude`, never touch the main checkout or the sibling worktrees.

This is task 4 of 4, the last one. Tasks 1-3 are in the codebase: the source and the script exist, the 11 skills are stamped, `gm-ship` points at `gm-implement`, and `gm-release` reads the ensaio from the workspace. This task makes the prose around them tell the same story — it is also what installs the **gate**: from here on, a change under `skills/` is shipped only with `--check` green.

## Scope

Spec áreas **7 and 8** — requirements 5 (the `docs/`, `CLAUDE.md` and `README.md` parts), 6, and the `docs/` half of 3c.

- `docs/esteira-gm.md` (parte C): lines `147-149` and `189` lose the hardcoded "onze" and name the source instead; a new paragraph **Uma fonte, várias cópias** closes `## Convenções de saída` (before `## Uma worktree por card`, `:203`), describing stamp + check **and the measurement that chose it** — 0 of 480 `/gm-*` sessions ever read the cited doc, and `@arquivo` expands only by absolute or cwd-relative path.
- `CLAUDE.md` of this repo (parte B): a new item 3 in `## A esteira` declaring `node scripts/skills-comum.mjs --check` as the `/gm-ship` suite for any change under `skills/`; "e mais dois que são deste repo" (`:62`) becomes "três"; `skills/_comum/` named in `## Onde ficam as coisas` (`:97`).
- `README.md` (parte D): the tree (`~:310`) gains `_comum/` under `skills/` and a `scripts/` entry right below — the tree is not alphabetical, so follow the trecho's placement.

NOT in scope: the Notoria workspace `CLAUDE.md` (out of scope by the card); the Fase 2 (#28) gate table — `skills/_comum/convencoes.md` only **reserves** its place; `install.sh:101` / `install.ps1:124-128`, which will count `_comum/` and say "16 skills" (spec decision 8 filed it as cosmetic, for another card — the README stays correct at 15).

## Verification

- `grep -n "onze" docs/esteira-gm.md` → empty (lines 148, 189 today).
- `grep -n "skills-comum" CLAUDE.md docs/esteira-gm.md README.md` → ≥ 1 each; `grep -n "mais dois que são deste repo" CLAUDE.md` → empty.
- `grep -rn "eleven" skills/` → still empty; `node scripts/skills-comum.mjs --check; echo $?` → `0`.
- **No broken link** (CA6): extract every backquoted path starting with `skills/`, `scripts/`, `docs/` or `templates/` from `skills/_comum/convencoes.md`, `CLAUDE.md`, `README.md`, `docs/esteira-gm.md` and `skills/gm-card/SKILL.md` — `grep -ohE` with the class `[A-Za-z0-9_./-]+` between backquotes, `sort -u` — and `test -e` each one; no `FALTA`.
- Cross-reading with no contradiction: card, spec, `_comum/convencoes.md`, `docs/esteira-gm.md`, `CLAUDE.md` and `README.md` must say the same thing about who stamps, who checks, and where the source lives. Read them; say so in the summary.
- Final tally for the `gm:tasks` comment: `wc -c skills/gm-*/SKILL.md | tail -1` (**183.391** before task 1) and the delta over the whole card.

Acceptance criteria covered: **5** (the remainder), **6**, **3c** (the `docs/` half).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Every verification command above run, with its output pasted into the commit body
- [ ] `test -e` clean on every cited path; `--check` still `0`
- [ ] Cross-reading done and reported: no document contradicts another

## Workflow

1. Implement; run the checklist.
2. Summarize: the verification result first, then a risk-ranked reading order. This being the last task, close with the whole card's mechanical proof gathered in one place — it is what `/gm-ship` will carry into the PR body.
3. Commit in the worktree with `git commit -F <file>`, trailer `Card: #29`, identity `leonardo-amaral-3 <frashdopredio2005@gmail.com>`.
4. Flip the first line of this file to `✅ Status: Complete` and tick item 4 in the card's `<!-- gm:tasks -->` comment.
