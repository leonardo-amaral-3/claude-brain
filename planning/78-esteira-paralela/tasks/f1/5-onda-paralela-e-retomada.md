✅ Status: Complete

# Task 5: `frente.mjs` — onda paralela, junção, conflito e retomada

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). **No phase edits the spec**: an amendment is a `PARADA` for the owner of the front.
- **Card**: phase F1 of epic #78 is sub-issue **#79** (read its `<!-- gm:spec-ref -->` comment for what is in and out of scope). Commits carry `Card: #79`, never `#78`.
- **Premises this task leans on**: spec `## Premissas medidas` M6, M8, M10, M14; breakdown summary B5, B6 (in the card #79 `[despacho]` comment of `/gm-plan-tasks`).

The code lives in the worktree `/home/leo/pessoal/claude-brain-79-gm-frente` — **its own git repository** (branch `feat/79-gm-frente`, base `dev`); run every git command from inside it. Phases F2 (#80) and F3 (#81) run at the same time in sibling worktrees: never touch them, the main checkout `/home/leo/pessoal/claude-brain`, or the live installation (`~/.claude/skills`, `~/.claude/hooks`, `~/notoria/claude/brain-mcp`). Touch only the F1 files of spec `## Fases`.

This is task 5 of 6. Tasks 1–4 (`ondas.mjs`, the fakes, the conductor with units, stations, child sessions and sequential mode) are already in the codebase.

## Scope

- `skills/gm-frente/frente.mjs`, the rest of spec **Ondas**: the wave with two or more tasks (one worktree and local branch per task, all at once up to `--paralelo`), the join in number order with its preconditions, conflict → `git merge --abort` and the unit stops with the message, cleanup without `--force`/`-D`, then `git push` and the `gm:tasks` checkboxes one at a time re-reading the comment; a task of the wave that closed in `PARADA` (the others still joined, the unit stops after).
- The resume of spec R1.5 end to end: killing `conduzir` mid-wave and running `iniciar` again waits for the live child, does not reopen a `✅` task, and does not recreate a task worktree that already exists.
- `scripts/gm-frente-teste.mjs`: sections for spec `## Plano de testes` R1.1 (*onda paralela*, every item of that row) and, from R1.5, *conflito* (the fake lies in `Toca:`) and *retomada*.
- NOT here: `SKILL.md`.

## Verification

- Command(s) that must pass: `node scripts/gm-frente-teste.mjs` (code 0; sections of tasks 1–4 still green, plus this task's).
- Acceptance criteria covered: R1.1, R1.5 (conflito, retomada).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles (`node --check`); no unused imports/variables; no detached process, worktree or branch left behind outside the test's temp dir

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #79` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
