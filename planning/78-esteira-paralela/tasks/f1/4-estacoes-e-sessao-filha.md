❌ Status: Not Started

# Task 4: `frente.mjs` — estações, sessão filha, prompt gerado e modo sequencial

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). **No phase edits the spec**: an amendment is a `PARADA` for the owner of the front.
- **Card**: phase F1 of epic #78 is sub-issue **#79** (read its `<!-- gm:spec-ref -->` comment for what is in and out of scope). Commits carry `Card: #79`, never `#78`.
- **Premises this task leans on**: spec `## Premissas medidas` M2, M3, M12; breakdown summary B3, B7 (in the card #79 `[despacho]` comment of `/gm-plan-tasks`).

The code lives in the worktree `/home/leo/pessoal/claude-brain-79-gm-frente` — **its own git repository** (branch `feat/79-gm-frente`, base `dev`); run every git command from inside it. Phases F2 (#80) and F3 (#81) run at the same time in sibling worktrees: never touch them, the main checkout `/home/leo/pessoal/claude-brain`, or the live installation (`~/.claude/skills`, `~/.claude/hooks`, `~/notoria/claude/brain-mcp`). Touch only the F1 files of spec `## Fases`.

This is task 4 of 6. Tasks 1–3 (`ondas.mjs`, the fakes, the conductor's state, units and unit worktree) are already in the codebase.

## Scope

- `skills/gm-frente/frente.mjs`, from spec `#### skills/gm-frente/frente.mjs — o condutor`: the **Estações** table and the paragraph after it (all six, including station 3's `-spec` worktree and the move of the folder to the state dir, and station 4's tasks commit); **Sessão filha** (spawn, files, limit, judgement by the JSON output, waiting on a live `pid` on resume); **Prompt da sessão filha** (the fixed template, nothing more); **Espera de CI**; the one-`/gm-ship`-per-repo rule; and from **Ondas** only the validator call and the **sequential mode** (old tasks, one per session, in the unit worktree) plus the single-task wave — the multi-task wave is task 5.
- Arguments of every station follow spec `### Gramática dos argumentos` exactly.
- `scripts/gm-frente-teste.mjs`: sections for spec `## Plano de testes` rows R1.2 (*épico*: two chains overlapping, two PRs in the fake `gh`), R1.3 (*prompt gerado*), R1.4 (*task antiga*) and, from R1.5, *PARADA de filho* (the other unit goes on), *saída sem linha*, *limite* (`--limite-min 0.05`) and *precedência* (merged PR does not reopen ship).
- NOT here: worktree per task, merge of the wave, push and checkboxes (task 5); `SKILL.md`.

## Verification

- Command(s) that must pass: `node scripts/gm-frente-teste.mjs` (code 0; sections of tasks 1–3 still green, plus this task's).
- Acceptance criteria covered: R1.2, R1.3, R1.4, R1.5 (PARADA, saída sem linha, limite).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles (`node --check`); no unused imports/variables; no detached process left alive after the test

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #79` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
