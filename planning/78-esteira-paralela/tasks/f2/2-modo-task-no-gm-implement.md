✅ Status: Complete
Onda: 1
Depende de: —
Toca: `skills/gm-implement/SKILL.md`

# Task 2: Modo `--task`, conferência do `Toca:` e `✅` dentro do commit no `/gm-implement`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Card**: #80, phase F2 of epic #78. Its `<!-- gm:spec-ref -->` comment names what this phase covers and what is deliberately out (the `ondas.mjs` itself is F1; the PR base in `/gm-ship` is F3; the common table line "Base da PR em branch de outro card" is F4).
- Premises this task leans on: **M14** (today the skill picks the lowest `❌`, commits **before** flipping `✅` and ticks the `gm:tasks` checkbox — `skills/gm-implement/SKILL.md:70`, `:252-259`) and the breakdown summary's **P2**: `skills/gm-frente/ondas.mjs` does not exist on this branch (F1 builds it in parallel), so the skill's text must cover "script absent" as the spec says. Locate the script the same way task 1 does in `gm-plan-tasks` (spec *F2*, quality check item 8).

The code lives in the `claude-brain/` repo — this worktree, **its own git repository**; run every git command from inside it. Work happens on the branch `feat/80-task-onda` (spec `## Execution` + the `Branch:` line of the card's `gm:spec-ref`), already checked out.

This is task 2 of 2, in wave 1. Task 1 (`skills/gm-plan-tasks/SKILL.md`) runs in the same wave and may not be in the code yet; it touches nothing of yours.

## Scope

Edit `skills/gm-implement/SKILL.md` per spec `## Implementation Details` › *F2* (the `gm-implement` list) and *Gramática dos argumentos* (the `gm-implement` row):
- `## Setup`: the **task mode** (`<pasta> --card <n> --branch <b> --task <arquivo>`) — only that task, which Setup/Guarantee steps do not apply, the branch check, the dependency refusal via `--conferir`;
- before the commit, in every mode: the `Toca:` conformance via `--conferir` (and the absent-script fallback);
- `## Close the task`: `✅` flips before the commit and goes in it (every mode); task mode does no push and ticks no checkbox;
- `## Guarantee the branch` step 2: the rule against a stacked base (`Motivo da base:`);
- `## Board (task 1 only)` → "first task to run".

Out of scope: the three stamped blocks (`## Como perguntar e como aprovar`, `## Convenções de saída`, `## Modo despachado`) — never edit them; `skills/_comum/`, docs, `CLAUDE.md`, `skills/gm-ship/`, any other skill or script.

## Verification

- `node scripts/skills-comum.mjs --check` → exit code `0` (the stamped blocks stay identical to the source).
- `git diff --name-only origin/dev...HEAD -- skills/` plus the working tree lists only `skills/gm-implement/SKILL.md` for this task.
- Acceptance criteria covered: R2.3 (skill side; `--conferir` itself is F1's), card #80 criteria "R2.3" and "`skills-comum.mjs --check` verde".

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Old-format tasks (no lines 2–4) still run as today, except the `✅` now inside the commit (spec `## Migrations & compatibilidade`)

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Flip the first line of this file to `✅ Status: Complete`, then commit from inside the repo (task file included), message ending with the trailer `Card: #80` — put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
