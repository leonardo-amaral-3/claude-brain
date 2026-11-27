❌ Status: Not Started

# Task 2: `scripts/claude-falso.mjs` e `scripts/gh-falso.mjs`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). **No phase edits the spec**: an amendment is a `PARADA` for the owner of the front.
- **Card**: phase F1 of epic #78 is sub-issue **#79** (read its `<!-- gm:spec-ref -->` comment for what is in and out of scope). Commits carry `Card: #79`, never `#78`.
- **Premises this task leans on**: spec `## Premissas medidas` M2, M3; breakdown summary B3, B4 (in the card #79 `[despacho]` comment of `/gm-plan-tasks`).

The code lives in the worktree `/home/leo/pessoal/claude-brain-79-gm-frente` — **its own git repository** (branch `feat/79-gm-frente`, base `dev`); run every git command from inside it. Phases F2 (#80) and F3 (#81) run at the same time in sibling worktrees: never touch them, the main checkout `/home/leo/pessoal/claude-brain`, or the live installation (`~/.claude/skills`, `~/.claude/hooks`, `~/notoria/claude/brain-mcp`). Touch only the F1 files of spec `## Fases`.

This is task 2 of 6. Task 1 (`ondas.mjs` and the test skeleton) is already in the codebase.

## Scope

- `scripts/claude-falso.mjs` and `scripts/gh-falso.mjs` (new): the stand-ins the conductor's test puts first on `PATH` (spec `## Plano de testes`, rows R1.1–R1.5, and `## Coding Standards`: tests never call the real `claude` or `gh`). Their surface is exactly what `frente.mjs` calls, per spec `#### skills/gm-frente/frente.mjs — o condutor`: for `claude`, the child-session invocation of *Sessão filha* and a JSON output in the shape the *julgamento pela saída* reads; for `gh`, the issue/sub-issue/parent/comment, board field (`Bloqueado`), branch (`createLinkedBranch`), PR and `pr checks` reads and writes that the conductor and the stations use.
- Behaviour comes from a state file in the test's temporary directory (never from the network, never outside the temp dir): the fake `claude` emulates the effect of each station the conductor opens (`/gm-spec`, `/gm-plan-tasks`, `/gm-implement --task`, `/gm-ship`, `/gm-ship --merge`) and can be told, per session, to close in `PARADA`, close without a dispatch line, sleep past the limit, or touch a file outside the task's `Toca:` — the cases the R1.x rows need. It records start and end of every session so overlap can be proven.
- Any shim the test needs so `spawn("claude", …)` and `gh` resolve to these files (an executable wrapper in the temp dir) is created by the test at run time, not committed.
- `scripts/gm-frente-teste.mjs`: a `falsos` section proving the fakes answer as the later sections will rely on (and that `which claude` resolves to the fake when the test's `PATH` is used).
- NOT here: `frente.mjs`, `SKILL.md`.

## Verification

- Command(s) that must pass: `node scripts/gm-frente-teste.mjs` (code 0, sections `ondas.mjs` and `falsos` green).
- Acceptance criteria covered: support for R1.1–R1.5 and R2.x (`claude` and `gh` falsos no `PATH`, sem gastar cota).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles (`node --check` on every new `.mjs`); no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #79` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
