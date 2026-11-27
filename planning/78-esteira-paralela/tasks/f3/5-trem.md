✅ Status: Complete

# Task 5: `trem.mjs` e o seu teste

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). Nenhuma fase edita a spec (`## Execution`).
- **Card**: #81, phase F3 of epic #78 — its `<!-- gm:spec-ref -->` comment says what this phase covers and what is deliberately out (F1, F2, F4).
- **Premissas**: M16; breakdown premises P3 (`**Card:** #<n>` first line) and P4 (`gh project item-list --format json` exists in gh 2.103.3). The P-lines are in the `[despacho]` comment of the tasks stage on card #81.

The code lives in the `claude-brain` repo — **its own git repository** — in the worktree `~/pessoal/claude-brain-81-pos-pr`; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/81-pos-pr`, already checked out by `/gm-implement`).

Phases F1 and F2 run at the same time in sibling worktrees: touch only the files of F3's row in `## Fases`, and none of `skills/_comum/`, `docs/`, `CLAUDE.md`, `README.md`, `templates/` (F4). Scripts follow `## Coding Standards`; tests never call the real `claude` or `gh`, nor write outside a temp dir.

This is task 5 of 6. Tasks 1..4 are already in the codebase.

## Scope

- `skills/gm-release/trem.mjs` (new): subcommands `cards` (with `--corte` and `--main`) and `itens`, outputs and codes as in the spec's `#### skills/gm-release/trem.mjs`.
- `scripts/gm-release-trem-teste.mjs` (new): temp repo with `main`, `dev` and merges carrying `**Card:** #n`, its own embedded fake `gh` (board items + PR bodies), and the cases of `## Plano de testes` › R3.3, R3.4.
- NOT in scope: the `gm-release` skill text (task 6). Independent of tasks 1–4.

## Verification

- Command(s) that must pass: `node scripts/gm-release-trem-teste.mjs` → code 0
- Acceptance criteria covered: R3.3, R3.4 (script side)

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #81` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
