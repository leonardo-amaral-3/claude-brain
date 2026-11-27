✅ Status: Complete

# Task 1: Pasta de planning no primeiro commit e a emenda da F5 em commit próprio

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). This phase is **F5** of epic #78: read `## Execution`, `## Fases` (row F5) and `## Implementation Details` › `### F5 — CLAUDE.md do workspace`, including the dated note **Emenda 2026-11-27**, which governs this phase.

The code lives in the `claude-brain/` repository — here, the worktree `/home/leo/pessoal/claude-brain-83-claude-md-workspace`, **its own git repository**; run every git command from inside it. Work happens on branch `feat/83-claude-md-workspace` (base `dev`), already checked out.

This is task 1 of 4.

Premises this task leans on (measured in the breakdown, 2026-11-27):
- The original spec — the one the other phase branches commit — is blob `a43ecff68bf0ae52916c559b24f2eec9e90a4a28` (`git ls-tree origin/feat/79-gm-frente planning/78-esteira-paralela/spec.md`, same in `feat/80-task-onda` and `feat/81-pos-pr`).
- The spec in this worktree already carries the amendment, uncommitted.

## Scope

- **Commit A** — the phase's first commit, per `## Execution`: `planning/78-esteira-paralela/` with `spec.md` **byte-identical to blob `a43ecff`** (restore it with `git show a43ecff…`, keeping the amended copy aside), `sensibilidade.json` as it is, and `tasks/f5/`.
- **Commit B** — only the amendment: `spec.md` back to the amended text, nothing else in the diff. This is the commit the owner of the front carries to the other open phase branches, so it must touch `spec.md` alone.
- Does **not** touch `workspaces/`, `sync.sh`, `sync.ps1`, nor run `sensivel.mjs` (reclassifying after the amendment is the owner's, per `## Execution`).

## Verification

- `git show HEAD~1:planning/78-esteira-paralela/spec.md | git hash-object --stdin` → `a43ecff68bf0ae52916c559b24f2eec9e90a4a28`
- `git show --stat HEAD` → only `planning/78-esteira-paralela/spec.md`
- `git status --short` → clean
- Acceptance criteria covered: `## Execution` (spec identical in the first commit, M9) and the argument's "registre a emenda na spec".

## Completion Checklist

- [ ] Both commits exist in that order, each with trailer `Card: #83`
- [ ] Verification commands green
- [ ] Nothing outside `planning/78-esteira-paralela/` changed

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order.
3. Commit from inside the worktree, each message ending with the trailer `Card: #83` — and put the commit to the human as a choice (*ação irreversível*), never as consent to be typed (dispatched mode: decide, with verification green).
4. Flip the first line of this file to `✅ Status: Complete` after commit B. The flip is committed together with task 2, because commit B must touch `spec.md` alone.
