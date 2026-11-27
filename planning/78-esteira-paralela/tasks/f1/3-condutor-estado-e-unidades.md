❌ Status: Not Started

# Task 3: `frente.mjs` — estado, `iniciar`/`estado`, unidades, trava e worktree da unidade

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). **No phase edits the spec**: an amendment is a `PARADA` for the owner of the front.
- **Card**: phase F1 of epic #78 is sub-issue **#79** (read its `<!-- gm:spec-ref -->` comment for what is in and out of scope). Commits carry `Card: #79`, never `#78`.
- **Premises this task leans on**: spec `## Premissas medidas` M6, M9, M10; breakdown summary B5, B6 (in the card #79 `[despacho]` comment of `/gm-plan-tasks`).

The code lives in the worktree `/home/leo/pessoal/claude-brain-79-gm-frente` — **its own git repository** (branch `feat/79-gm-frente`, base `dev`); run every git command from inside it. Phases F2 (#80) and F3 (#81) run at the same time in sibling worktrees: never touch them, the main checkout `/home/leo/pessoal/claude-brain`, or the live installation (`~/.claude/skills`, `~/.claude/hooks`, `~/notoria/claude/brain-mcp`). Touch only the F1 files of spec `## Fases`.

This is task 3 of 6. Tasks 1–2 (`ondas.mjs`, the test skeleton, the fakes) are already in the codebase.

## Scope

- `skills/gm-frente/frente.mjs` (new), from spec `#### skills/gm-frente/frente.mjs — o condutor`: the state folder and `estado.json` (atomic write, `versao`), the subcommands `iniciar` (arguments, exit codes, *vivo* by `batimento`, `retomada`, `--reabrir`, the detached launch of `conduzir`) and `estado` (with `--esperar`); and, inside `conduzir`, the loop skeleton with the heartbeat, the **Unidades** paragraph (card vs. epic, `pulada` with its reasons, the per-unit lock in the `git-common-dir`, the `--paralelo` and one-`/gm-ship`-per-repo slots as counters the next tasks fill) and the **Branch e worktree da unidade** paragraph (including the spec copy and its commit), and **Fim**.
- The stations, the child sessions and the waves are NOT here (tasks 4 and 5): with no station logic yet, `conduzir` may leave each eligible unit in a clearly named not-yet-evaluated state — never mark it `concluida`.
- `scripts/gm-frente-teste.mjs`: sections for `iniciar` (missing argument or empty delivery → code 2; live conductor → `retomada: true`, no second process; unknown `versao` → 2), `estado --esperar`, the epic's unit discovery (two promoted sub-issues as units, one with `Bloqueado` and one not promoted as `pulada` with the reason — the R1.2 half that does not need sessions), the lock (spec `## Plano de testes` R1.2 *trava*) and the unit worktree/branch creation against a temp repo with a bare `origin`.
- NOT here: `SKILL.md`.

## Verification

- Command(s) that must pass: `node scripts/gm-frente-teste.mjs` (code 0; sections of tasks 1–2 still green, plus this task's).
- Acceptance criteria covered: R1.2 (unidades e trava), part of R1.5 (retomada: `iniciar` com condutor vivo).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles (`node --check` on every new `.mjs`); no unused imports/variables; no detached process left alive after the test

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #79` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
