❌ Status: Not Started
Onda: 1
Depende de: —
Toca: `skills/gm-plan-tasks/SKILL.md`

# Task 1: Ondas, contrato da task e `--card` no `/gm-plan-tasks`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Card**: #80, phase F2 of epic #78. Its `<!-- gm:spec-ref -->` comment names what this phase covers and what is deliberately out (the `ondas.mjs` itself is F1; the common table line is F4).
- Premises this task leans on: **M13** (the skill writes an ordered list today, `skills/gm-plan-tasks/SKILL.md:3` and the template at `:92-129`) and the breakdown summary's **P2**: `skills/gm-frente/ondas.mjs` does not exist on this branch (F1 builds it in parallel), so the skill's text must cover "script absent" exactly as the spec says.

The code lives in the `claude-brain/` repo — this worktree, **its own git repository**; run every git command from inside it. Work happens on the branch `feat/80-task-onda` (spec `## Execution` + the `Branch:` line of the card's `gm:spec-ref`), already checked out.

This is task 1 of 2, in wave 1. Task 2 (`skills/gm-implement/SKILL.md`) runs in the same wave and may not be in the code yet; it touches nothing of yours.

## Scope

Edit `skills/gm-plan-tasks/SKILL.md` per spec `## Implementation Details` › *F2* (the `gm-plan-tasks` list), *Contrato da task* and *Gramática dos argumentos* (the `gm-plan-tasks` row):
- frontmatter `description` and `## Phase 1` (proposal grouped by wave, with `Onda`, `Depende de`, `Toca` per task);
- rules of division: the *Regra das ondas* written in full, per-wave validity of "no forward dependency", "compiles" after each task and after each merged wave;
- `### Structure`: lines 2–4 in the template, and the new `## Context` sentence;
- `### Mirror on the card`: ` (onda <k>)` per line;
- `### Quality checks`, item 8 (`ondas.mjs --validar`, with the absent-script fallback);
- `## Setup` accepts `--card <n>`.

Out of scope: the three stamped blocks (`## Como perguntar e como aprovar`, `## Convenções de saída`, `## Modo despachado`) — never edit them; `skills/_comum/`, docs, `CLAUDE.md`, any other skill or script.

## Verification

- `node scripts/skills-comum.mjs --check` → exit code `0` (the stamped blocks stay identical to the source).
- `git diff --name-only origin/dev...HEAD -- skills/` plus the working tree lists only `skills/gm-plan-tasks/SKILL.md` for this task.
- Acceptance criteria covered: R2.1, R2.2 (skill side; the validator itself is F1's), card #80 criterion "R2.1/R2.2" and "`skills-comum.mjs --check` verde".

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] No spec content duplicated beyond what the spec itself orders written in full (the *Regra das ondas*)

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Flip the first line of this file to `✅ Status: Complete`, then commit from inside the repo (task file included), message ending with the trailer `Card: #80` — put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
