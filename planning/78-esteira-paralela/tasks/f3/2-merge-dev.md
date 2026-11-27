❌ Status: Not Started

# Task 2: `merge-dev.mjs` e o seu teste

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). Nenhuma fase edita a spec (`## Execution`).
- **Card**: #81, phase F3 of epic #78 — its `<!-- gm:spec-ref -->` comment says what this phase covers and what is deliberately out (F1, F2, F4).
- **Premissas**: M17, M18, M24; breakdown premises P2 (`gh pr checks --json bucket` exists in gh 2.103.3) and P3 (merged PR bodies open with `**Card:** #<n>`). The P-lines are in the `[despacho]` comment of the tasks stage on card #81.

The code lives in the `claude-brain` repo — **its own git repository** — in the worktree `~/pessoal/claude-brain-81-pos-pr`; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/81-pos-pr`, already checked out by `/gm-implement`).

Phases F1 and F2 run at the same time in sibling worktrees: touch only the files of F3's row in `## Fases`, and none of `skills/_comum/`, `docs/`, `CLAUDE.md`, `README.md`, `templates/` (F4). Scripts follow `## Coding Standards`; tests never call the real `claude` or `gh`, nor write outside a temp dir.

This is task 2 of 6. Tasks 1..1 are already in the codebase.

## Scope

- `skills/gm-ship/merge-dev.mjs` (new): the six conditions, output line, `acao` values and exit codes of the spec's `#### skills/gm-ship/merge-dev.mjs`. It calls `sensivel.mjs --consultar` from task 1 (resolve it relative to its own file: `../gm-spec/sensivel.mjs`).
- `scripts/gm-ship-merge-teste.mjs` (new): temp repo with a bare `origin`, its **own embedded** fake `gh` at the front of `PATH` (never F1's `scripts/gh-falso.mjs`, which does not exist on this branch — spec `## Technical Decisions`), and every case listed in `## Plano de testes` › R3.1, R3.2.
- NOT in scope: the `gm-ship` skill text (task 3).

## Verification

- Command(s) that must pass: `node scripts/gm-ship-merge-teste.mjs` → code 0; `node scripts/gm-spec-sensivel-teste.mjs` → code 0; `node scripts/skills-comum.mjs --check` → code 0
- Acceptance criteria covered: R3.1, R3.2

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #81` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
