❌ Status: Not Started

# Task 8: Worktree por card — a convenção nas 4 skills que mexem em branch

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/5-perguntas-e-aprovacao-por-escolha/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

This task exists because of the **Emenda 2026-09-09** in the spec's `## Requisitos & critérios de
aceite` (CA4). Read that amendment block **before the scope below** — it records the three design
decisions the human closed by choice (where the worktree lives, the `sync push` conflict, when the
worktree dies) and, more importantly, the one consequence that was *derived* rather than chosen:
because the worktree dies at `/gm-ship`, `/gm-correcao` runs after it is gone and must **recreate**
it. Working in the main checkout there would violate the very CA4 this task implements.

This is task 8 of 9 — a declared exception to the 6–8 ceiling, recorded in the same amendment.
Tasks 1–7 are about *how skills ask*; this one and task 9 are about *how skills handle git*. They
share the card and nothing else.

## Scope

`docs/esteira-gm.md` plus the four skills that touch branches. No other skill has a branch step —
verified: `grep -l 'git checkout\|createLinkedBranch' skills/gm-*/SKILL.md` returns exactly
`gm-implement`, `gm-hotfix` and `gm-release`, and `gm-correcao` joins them because of the
recreation rule above.

1. **`skills/gm-implement/SKILL.md`, `## Guarantee the branch`** — before writing anything, the
   branch must live in a dedicated worktree at `<workspace>/<repo>-<n>-<slug>`, sibling to the
   repo and **inside the workspace prefix**. The `createLinkedBranch` mutation stays as it is (it
   is what puts the branch in the card's Development field); what changes is that
   `git checkout` gives way to `git worktree add`, and the session continues **inside that path**.
2. **`skills/gm-ship/SKILL.md`** — after the PR is open and the card has moved to 👀 Revisão,
   remove the worktree (`git worktree remove`, then `git worktree prune`).
3. **`skills/gm-correcao/SKILL.md`** — when the parecer requires code, recreate the worktree by the
   same convention before touching a file.
4. **`skills/gm-hotfix/SKILL.md`** — the same rule on `release/hotfix-*`. Urgency buys priority,
   never a bypass; the spec's `## File Change Summary` says so in that file's row.
5. **`docs/esteira-gm.md`** — the human-facing version of the worktree convention, next to
   `## Como as skills perguntam` that task 1 created.

**Three wrinkles the spec names and this task must answer in the text, not discover later:**
- **`planning/` lives inside the repo**, so each worktree carries its own copy of the spec and the
  task files. Say which one is authoritative and how a session knows it is reading the right one.
- **The working directory changes mid-skill.** `/gm-implement` starts wherever the user invoked it
  and must continue somewhere else. Every `gh`/`git` command after that point runs from the new
  path.
- **A card already in flight in the main checkout** (the case of #5 itself) must not be forcibly
  moved — the spec's `## Migrations & compatibilidade` item 3 says the rule applies from the next
  card on. The skill needs to say what it does when it finds this.

**Explicitly NOT in this task:** `sync.ps1`/`sync.sh` — that is task 9. None of the 43 question
points; tasks 2–7 own those. Do not migrate the three worktrees that exist today.

## Verification

- Command(s) that must pass:
  - **T6.1** — `grep -l 'git worktree' skills/gm-implement/SKILL.md skills/gm-ship/SKILL.md skills/gm-correcao/SKILL.md skills/gm-hotfix/SKILL.md`
    returns all four, and the path pattern cited in every one of them is
    `<workspace>/<repo>-<n>-<slug>` — never a path outside the workspace prefix.
  - **T1 must stay green** — the canonical block from task 1 is byte-identical across the 11.
    You are editing four of those files; re-run T1 and confirm the single hash survives.
  - **T3 must not regress on `docs/esteira-gm.md`** — the vocabulary grep (with the corrected
    `aprovaç(ã|a)o` token; see the T3 amendment) still returns zero lines over that file.
- Acceptance criteria covered: **CA4**, everything except the `sync push` clause.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green, including T1 and the T3 non-regression
- [ ] `sync.ps1`/`sync.sh` untouched; no question point converted; existing worktrees left alone

## Workflow

1. Implement; run the checklist.
2. Present the summary risk-first, then put it to the human as a choice — *Aprovar · Ajustar ·
   Rejeitar*, per `## Como perguntar e como aprovar`. Iterate until it comes back *Aprovar*.
3. Then commit from the repo root, message ending with the trailer `Card: #5`.
4. Flip the first line of this file to `✅ Status: Complete`.
