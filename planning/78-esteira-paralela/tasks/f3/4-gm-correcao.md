✅ Status: Complete

# Task 4: `/gm-correcao`: G4 depois do push

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). Nenhuma fase edita a spec (`## Execution`).
- **Card**: #81, phase F3 of epic #78 — its `<!-- gm:spec-ref -->` comment says what this phase covers and what is deliberately out (F1, F2, F4).
- **Premissas**: M15. The P-lines are in the `[despacho]` comment of the tasks stage on card #81.

The code lives in the `claude-brain` repo — **its own git repository** — in the worktree `~/pessoal/claude-brain-81-pos-pr`; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/81-pos-pr`, already checked out by `/gm-implement`).

Phases F1 and F2 run at the same time in sibling worktrees: touch only the files of F3's row in `## Fases`, and none of `skills/_comum/`, `docs/`, `CLAUDE.md`, `README.md`, `templates/` (F4). Scripts follow `## Coding Standards`; tests never call the real `claude` or `gh`, nor write outside a temp dir.

This is task 4 of 6. Tasks 1..3 are already in the codebase.

## Scope

- `skills/gm-correcao/SKILL.md`, per the spec's `#### skills/gm-correcao/SKILL.md`: every push on an open PR is followed by the local gate + the `## G4 — revisão de IA` of `gm-ship` (task 3) over the new range, and the `gm:g4` comment updated (`Head final`, `Portão local`); the `PROXIMO` line becomes `/gm-ship <pasta> --card <n> --merge`.
- Do NOT edit the stamped blocks nor `## Ambiente na entrada` (F4).

## Verification

- Command(s) that must pass: `node scripts/skills-comum.mjs --check` → code 0
- Acceptance criteria covered: R3.1 (the `g4` condition stays true after a correction)

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #81` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
