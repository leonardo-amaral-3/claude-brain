❌ Status: Not Started

# Task 6: `/gm-release`: trem do corte e G5 por trem

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). Nenhuma fase edita a spec (`## Execution`).
- **Card**: #81, phase F3 of epic #78 — its `<!-- gm:spec-ref -->` comment says what this phase covers and what is deliberately out (F1, F2, F4).
- **Premissas**: M16, M17. The P-lines are in the `[despacho]` comment of the tasks stage on card #81.

The code lives in the `claude-brain` repo — **its own git repository** — in the worktree `~/pessoal/claude-brain-81-pos-pr`; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/81-pos-pr`, already checked out by `/gm-implement`).

Phases F1 and F2 run at the same time in sibling worktrees: touch only the files of F3's row in `## Fases`, and none of `skills/_comum/`, `docs/`, `CLAUDE.md`, `README.md`, `templates/` (F4). Scripts follow `## Coding Standards`; tests never call the real `claude` or `gh`, nor write outside a temp dir.

This is task 6 of 6. Tasks 1..5 are already in the codebase.

## Scope

- `skills/gm-release/SKILL.md`, every bullet of the spec's `#### skills/gm-release/SKILL.md`: Phase 1 from `trem.mjs cards --corte`; Phase 4 from `release/v<AAAA.MM.DD>` at the cut sha (no more `--head dev`); the new `## Phase 4b — G5 por trem`; Phase 5 with `--match-head-commit`; Phase 7 with `trem.mjs cards --main`, closing, the held card staying in 🚂 Release, and `main..corte = 0` recorded.
- Do NOT edit the stamped blocks, and do NOT do the F4 clean-ups at the `header`/`multiSelect` explanations (F4, #82).

## Verification

- Command(s) that must pass: `node scripts/skills-comum.mjs --check` → code 0; `node scripts/gm-release-trem-teste.mjs` → code 0
- Acceptance criteria covered: R3.3, R3.4 (skill side)

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #81` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
