❌ Status: Not Started

# Task 4: `sync.ps1` com o mesmo comportamento do `sync.sh`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). This phase is **F5** of epic #78; the dated note **Emenda 2026-11-27** under `### F5 — CLAUDE.md do workspace` governs it.

The code lives in the `claude-brain/` repository — here, the worktree `/home/leo/pessoal/claude-brain-83-claude-md-workspace`, **its own git repository**; run every git command from inside it. Work happens on branch `feat/83-claude-md-workspace` (base `dev`), already checked out.

This is task 4 of 4 — the last one. Tasks 1–3 are already in the codebase; `sync.sh` and its sandbox proof (`tasks/f5/prova-sync.sh`) are the reference behavior.

Premises this task leans on (measured in the breakdown, 2026-11-27):
- There is no `pwsh` nor `powershell` on this machine (`which pwsh powershell` → none). `sync.ps1` cannot be executed here; it is checked by reading against `sync.sh`. Installing PowerShell is out of scope.
- The workspace pair of `f798e21` (`git show f798e21 -- sync.ps1`) is a reference for the pairing only, not a base.

## Scope

- `sync.ps1` only: the same workspace pair, montagem, desmontagem, `status`, warnings and exit codes as `sync.sh`, in the script's existing style. Every other pair unchanged.
- A case-by-case parity table (each case of the amendment's *Prova* bullet → the `sync.sh` line and the `sync.ps1` line that implement it), kept for the PR body, stating plainly that `sync.ps1` was **not executed**.
- Does **not** touch `sync.sh` (a divergence found while reading it is a finding to report, not a silent fix), nor the live installation.

## Verification

- `bash planning/78-esteira-paralela/tasks/f5/prova-sync.sh ./sync.sh` → still `0`
- The parity table covers every *Prova* case, with no case marked divergent
- Final phase checks: `grep -c "a confirmar" workspaces/pessoal/CLAUDE.md` → `0`, `grep -c "Reconstruído" workspaces/pessoal/CLAUDE.md` → `0`, `grep -cE 'PVT|operations-center|notoria' workspaces/pessoal/CLAUDE.md` → `0`; `git diff --name-only origin/dev...HEAD` lists only `planning/78-esteira-paralela/**`, `workspaces/pessoal/CLAUDE.md`, `sync.sh`, `sync.ps1`
- Acceptance criteria covered: the amendment's *Escopo do par* (`sync.ps1` parity) and the whole F5 row of `## Fases`.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification commands green; parity table written
- [ ] The PR body (written by `/gm-ship`) will need: the sandbox output, the parity table, and a by-section description of what `CLAUDE.privado.md` will contain (the amendment's *Privado* bullet, derived by diffing `/home/leo/pessoal/CLAUDE.md` against the generic file) — **section names and kinds of data only, never the data itself**

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #83` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed (dispatched mode: decide, with verification green).
4. Flip the first line of this file to `✅ Status: Complete`.
