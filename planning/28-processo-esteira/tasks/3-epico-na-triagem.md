✅ Status: Complete

# Task 3: um escopo com vários pontos nasce épico — triagem, `gm-card` e Phase 6

## Context

- **Spec**: [`planning/28-processo-esteira/spec.md`](../spec.md) — ALL requirements and decisions. Follow it strictly; if reality contradicts it, STOP (deviation protocol).
- **Trechos normativos**: [`trechos/epico-e-premissas.md`](../trechos/epico-e-premissas.md), trechos **D, E, F** — copy verbatim.
- Repo `claude-brain`. Work only in the worktree `C:/Users/lokin/pessoal/claude-brain-28-processo`, branch `feat/28-processo-esteira`. Never run `sync push`, never write to `~/.claude`, never touch the main checkout or the sibling worktrees.

This is task 3 of 5. Tasks 1–2 are in the codebase (`gm-spec` already gained the premissas section and the Phase 3/4 edits — line numbers drifted). Locate text by quoting it.

## Scope

Spec **Área 3** — requirement 2. Premissas it depends on: row 7 (label `épico` exists here; other repos may lack it, the trecho creates it) and row 1 (`--check` invariant).

- `skills/gm-triage/SKILL.md`: trecho D as `## Step 1b — Um escopo ou vários?` between Step 1 and Step 2; the one-line note under `## Step 5 — Publish`.
- `skills/gm-card/SKILL.md`: trecho E as item `2b.` after item 2 of `## Workflow`.
- `skills/gm-spec/SKILL.md`: trecho F after the signals paragraph of Phase 6.

NOT in scope: anything inside the stamped blocks; Phase 2–4 of `gm-spec` (task 2).

## Verification

- `grep -n "^## Step" skills/gm-triage/SKILL.md` → `Step 1`, `Step 1b — Um escopo ou vários?`, `Step 2` in that order.
- `grep -c "épico" skills/gm-triage/SKILL.md skills/gm-card/SKILL.md` → ≥ 1 in each; `grep -n "^2b\." skills/gm-card/SKILL.md` → one hit; `grep -n "## Pontos" skills/gm-card/SKILL.md` → present (Promote preserves it).
- `grep -n "An épico from triage" skills/gm-spec/SKILL.md` → one hit, inside Phase 6.
- `grep -n "header.*Escopo\|Escopo" skills/gm-triage/SKILL.md` → the `AskUserQuestion` header.
- `node scripts/skills-comum.mjs --check; echo $?` → `0`.

Acceptance criteria covered: **2**.

## Completion Checklist

- [x] Everything in scope implemented per the spec
- [x] Every verification command above run, with its output pasted into the commit body
- [x] Trechos verbatim; new prose lines ≤ 100 columns where the target file wraps (gm-spec, gm-plan-tasks and gm-card keep one-line paragraphs, and the trecho follows the file)

## Workflow

1. Implement; run the checklist.
2. Summarize: the verification result first, then a risk-ranked reading order.
3. Commit in the worktree with `git commit -F <file>`, trailer `Card: #28`, identity `leonardo-amaral-3 <frashdopredio2005@gmail.com>`.
4. Flip the first line of this file to `✅ Status: Complete` and tick item 3 in the card's `<!-- gm:tasks -->` comment.
