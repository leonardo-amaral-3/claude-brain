✅ Status: Complete

# Task 1: `ondas.mjs` (contrato, validador, conferência) e o esqueleto de `scripts/gm-frente-teste.mjs`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). **No phase edits the spec**: an amendment is a `PARADA` for the owner of the front.
- **Card**: phase F1 of epic #78 is sub-issue **#79** (read its `<!-- gm:spec-ref -->` comment for what is in and out of scope). Commits carry `Card: #79`, never `#78`.
- **Premises this task leans on**: spec `## Premissas medidas` M8; breakdown summary B1, B2 (in the card #79 `[despacho]` comment of `/gm-plan-tasks`).

The code lives in the worktree `/home/leo/pessoal/claude-brain-79-gm-frente` — **its own git repository** (branch `feat/79-gm-frente`, base `dev`); run every git command from inside it. Phases F2 (#80) and F3 (#81) run at the same time in sibling worktrees: never touch them, the main checkout `/home/leo/pessoal/claude-brain`, or the live installation (`~/.claude/skills`, `~/.claude/hooks`, `~/notoria/claude/brain-mcp`). Touch only the F1 files of spec `## Fases`; `skills/_comum/`, `docs/esteira-gm.md`, `CLAUDE.md`, `README.md` and `templates/` belong to F4.

This is task 1 of 6. No earlier task.

## Scope

- **First commit of the phase** (spec `## Execution`, M9): `planning/78-esteira-paralela/spec.md` and `sensibilidade.json` exactly as they are, plus `planning/78-esteira-paralela/tasks/f1/` — a `docs(planning): spec do #78 e tasks da F1` commit on its own, before any code.
- `skills/gm-frente/ondas.mjs` (new), entirely: spec `#### skills/gm-frente/ondas.mjs — o contrato da task` and `#### Contrato da task` (the exports, `--validar`, `--conferir`, the exit codes and the four rules of *Regra das ondas* as the validator checks them).
- `scripts/gm-frente-teste.mjs` (new): the test skeleton (style of `scripts/gm-spec-sensivel-teste.mjs`: no framework, named sections, exit `0`/`1`, everything in temporary directories) with **only the `ondas.mjs` section** of spec `## Plano de testes` row *R2.1, R2.2, R2.3*. Later tasks add sections for the fakes and the conductor to this same file — leave a clear place for them; do not stub them as passing.
- NOT here: `frente.mjs`, the fakes, `SKILL.md`.

## Verification

- Command(s) that must pass: `node scripts/gm-frente-teste.mjs` (code 0, section `ondas.mjs` green); `node skills/gm-frente/ondas.mjs --validar planning/66-telemetria/tasks/f1` → `"modo": "sequencial"`, code 0; `node skills/gm-frente/ondas.mjs --validar` with no folder → code 2.
- Acceptance criteria covered: R2.1, R2.2, R2.3 (validator side).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles (`node --check` on every new `.mjs`); no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #79` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
