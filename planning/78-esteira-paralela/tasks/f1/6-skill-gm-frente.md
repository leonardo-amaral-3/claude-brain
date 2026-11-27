❌ Status: Not Started

# Task 6: `skills/gm-frente/SKILL.md` — a skill fina, com os blocos carimbados

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). **No phase edits the spec**: an amendment is a `PARADA` for the owner of the front.
- **Card**: phase F1 of epic #78 is sub-issue **#79** (read its `<!-- gm:spec-ref -->` comment for what is in and out of scope). Commits carry `Card: #79`, never `#78`.
- **Premises this task leans on**: spec `## Premissas medidas` M1, M4, M5, M7, M11; breakdown summary B8 (in the card #79 `[despacho]` comment of `/gm-plan-tasks`).

The code lives in the worktree `/home/leo/pessoal/claude-brain-79-gm-frente` — **its own git repository** (branch `feat/79-gm-frente`, base `dev`); run every git command from inside it. Phases F2 (#80) and F3 (#81) run at the same time in sibling worktrees: never touch them, the main checkout `/home/leo/pessoal/claude-brain`, or the live installation (`~/.claude/skills`, `~/.claude/hooks`, `~/notoria/claude/brain-mcp`). Touch only the F1 files of spec `## Fases`: **`skills/_comum/` is F4's** — the blocks are filled by running the stamper, never by editing the source.

This is task 6 of 6. Tasks 1–5 (`ondas.mjs`, the fakes, the whole conductor `frente.mjs`) are already in the codebase.

## Scope

- `skills/gm-frente/SKILL.md` (new), exactly spec `#### skills/gm-frente/SKILL.md`: frontmatter, the seven steps, and the three common blocks entered as bare headers and filled by `node scripts/skills-comum.mjs` (only this file may change when it runs — any other `SKILL.md` it rewrites is a stop). The commands the skill runs are the `frente.mjs` CLI as task 3–5 built it; if the CLI and spec step 5/6 disagree, the spec wins and the CLI is the bug.
- NOT here: any other skill, `_comum`, docs, `CLAUDE.md`, `README.md` (F4).

## Verification

- Command(s) that must pass: `node scripts/skills-comum.mjs --check` (code 0, now `12 skills × 3 blocos`); `grep -L "disable-model-invocation: true" skills/gm-*/SKILL.md` empty; `node scripts/gm-frente-teste.mjs` still code 0; `git status --porcelain skills/` shows only `skills/gm-frente/`.
- Acceptance criteria covered: R1.3 (a única entrada é `/gm-frente <owner>/<repo>#<n>` mais a entrega).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] No other `SKILL.md` touched by the stamper

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #79` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
