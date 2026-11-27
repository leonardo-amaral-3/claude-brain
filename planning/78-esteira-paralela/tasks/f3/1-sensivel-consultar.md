✅ Status: Complete

# Task 1: `sensivel.mjs --consultar`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). Nenhuma fase edita a spec (`## Execution`).
- **Card**: #81, phase F3 of epic #78 — its `<!-- gm:spec-ref -->` comment says what this phase covers and what is deliberately out (F1, F2, F4).
- **Premissas**: M18 (spec's `## Premissas medidas`); breakdown premise P1 (the live `sensibilidade.json` of this spec has the last round's `sha256` equal to `spec.md` and a non-empty `uniao`, so `--consultar` on it must answer `true`). The P-lines are in the `[despacho]` comment of the tasks stage on card #81.

The code lives in the `claude-brain` repo — **its own git repository** — in the worktree `~/pessoal/claude-brain-81-pos-pr`; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/81-pos-pr`, already checked out by `/gm-implement`).

Phases F1 and F2 run at the same time in sibling worktrees: touch only the files of F3's row in `## Fases`, and none of `skills/_comum/`, `docs/`, `CLAUDE.md`, `README.md`, `templates/` (F4). Scripts follow `## Coding Standards`; tests never call the real `claude` or `gh`, nor write outside a temp dir.

This is task 1 of 6. No earlier task of this phase.

## Scope

- `skills/gm-spec/sensivel.mjs`: the `--consultar --spec <caminho>` mode, exactly as in the spec's `### F3 — pós-PR` › `#### skills/gm-spec/sensivel.mjs` (read-only, no Jev, no write; the four `motivo` values; one JSON line, code `0`; `2` only for argument). The existing classify mode (`--spec … --autor …`) must behave byte-for-byte as today.
- `scripts/gm-spec-sensivel-teste.mjs`: the `--consultar` cases of `## Plano de testes` › R3.1/R3.2 (clean record with equal sha → `false`; no record, different sha, unreadable, non-empty union → `true`), proving the Jev is never called (no `jev.js` reachable, registry unchanged after the call).
- NOT in scope: `merge-dev.mjs` (task 2), any `SKILL.md`.

## Verification

- Command(s) that must pass: `node scripts/gm-spec-sensivel-teste.mjs` → code 0 (old cases still green); `node scripts/skills-comum.mjs --check` → code 0
- Acceptance criteria covered: R3.1 (the `sensivel` condition)

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #81` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
