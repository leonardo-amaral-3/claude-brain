❌ Status: Not Started

# Task 2: `workspaces/pessoal/CLAUDE.md` — a parte genérica, com a linha marcadora

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). This phase is **F5** of epic #78; the dated note **Emenda 2026-11-27** under `### F5 — CLAUDE.md do workspace` governs it (bullets *Genérico* and *Privado*).

The code lives in the `claude-brain/` repository — here, the worktree `/home/leo/pessoal/claude-brain-83-claude-md-workspace`, **its own git repository**; run every git command from inside it. Work happens on branch `feat/83-claude-md-workspace` (base `dev`), already checked out.

This is task 2 of 4. Task 1 is already in the codebase.

Premises this task leans on (measured in the breakdown, 2026-11-27):
- The content source is the installed `/home/leo/pessoal/CLAUDE.md` (read only — never write it). It is byte-identical to `workspaces/pessoal/CLAUDE.md` of the local commit `f798e21`, which is **not** a base and is not cherry-picked.
- `docs/esteira-gm.md` has the heading `## O caminho` (line 14 on `origin/dev`), the target of the pointer that replaces the norm (M23).
- Private content in the source today: lines 6, 10, 59–72, 78, 97, 124, 129, 133 (`grep -nE 'notoria|operations-center|PVT'`).

## Scope

- Create `workspaces/pessoal/CLAUDE.md` (new; the folder does not exist on `dev`) per the amendment's *Genérico* bullet: no reconstruction note, no "(a confirmar)", the pointer to `docs/esteira-gm.md` › `## O caminho`, `- **Paralelo**: 3`, no private data, and exactly one marker line at the end of `## Convenções da esteira`.
- The private part is **not** written anywhere on disk. Every passage of the source that leaves the generic file must fit one of the sections of the amendment's *Privado* bullet; a passage that fits none is a deviation (STOP).
- Does **not** touch `sync.sh`, `sync.ps1`, `/home/leo/pessoal/CLAUDE.md`, nor create `/home/leo/pessoal/CLAUDE.privado.md`.

## Verification

- `grep -c "a confirmar" workspaces/pessoal/CLAUDE.md` → `0`; `grep -c "Reconstruído" workspaces/pessoal/CLAUDE.md` → `0` (R4.2)
- `grep -cE 'PVT|operations-center|notoria' workspaces/pessoal/CLAUDE.md` → `0`
- `grep -cx '<!-- privado: CLAUDE.privado.md entra aqui -->' workspaces/pessoal/CLAUDE.md` → `1`
- `file workspaces/pessoal/CLAUDE.md` → UTF-8 text, LF, no BOM
- Acceptance criteria covered: R4.2; the amendment's *Genérico* bullet.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification commands green
- [ ] Task 1's status flip is in this commit

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #83` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed (dispatched mode: decide, with verification green).
4. Flip the first line of this file to `✅ Status: Complete`.
