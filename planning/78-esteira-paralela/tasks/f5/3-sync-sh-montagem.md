✅ Status: Complete

# Task 3: `sync.sh` — o par do workspace, montagem no `push`, desmontagem no `pull`, `status` pela parte genérica

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). This phase is **F5** of epic #78; the dated note **Emenda 2026-11-27** under `### F5 — CLAUDE.md do workspace` governs it (bullets *Montagem*, *Desmontagem*, `status`, *Escopo do par*, *Prova*).

The code lives in the `claude-brain/` repository — here, the worktree `/home/leo/pessoal/claude-brain-83-claude-md-workspace`, **its own git repository**; run every git command from inside it. Work happens on branch `feat/83-claude-md-workspace` (base `dev`), already checked out.

This is task 3 of 4. Tasks 1–2 are already in the codebase.

Premises this task leans on (measured in the breakdown, 2026-11-27, and in cofre #3631):
- Today's `sync.sh` compares and copies whole files by sha256, pair by pair (`pares`, `difs`, the copy loop at the end); the workspace pair of `f798e21` (`git show f798e21 -- sync.sh`, 4 lines, `basename` of the parent = `pessoal`) is a reference for the pairing only, not a base.
- With `HOME`, `CLAUDE_CONFIG_DIR` and `BRAIN_DIR` temporary and a repo copy under `<tmp>/pessoal/claude-brain/`, `sync.sh push` and `pull` run with `rc=0` and leave a neighbor `CLAUDE.privado.md` untouched (#3631, P2). With no `brain-sync-origem.txt` in the temp config dir, `push` does not prompt.

## Scope

- `sync.sh` only: the workspace pair and the special handling of that one file, per the amendment. Every other pair keeps today's behavior and output.
- The sandbox proof the amendment's *Prova* bullet lists, as `planning/78-esteira-paralela/tasks/f5/prova-sync.sh` (inside this phase's folder; it must never write outside its own `mktemp -d` and must exit `0` only when every case holds, `1` otherwise). It takes the script under test as an argument (`sync.sh` now; task 4 reuses it where possible).
- Does **not** run `./sync.sh` against the real `HOME`, does **not** touch `/home/leo/pessoal/CLAUDE.md`, `~/.claude`, `~/notoria/claude/brain-mcp`, nor create `/home/leo/pessoal/CLAUDE.privado.md`. Does not touch `sync.ps1` (task 4).

## Verification

- `bash -n sync.sh` → `0`
- `bash planning/78-esteira-paralela/tasks/f5/prova-sync.sh ./sync.sh` → `0`, with each case of the *Prova* bullet printed with its result, including the sha256 of the private file before and after
- `./sync.sh status` in the real worktree is **not** run (it would read the live installation); the sandbox `status` cases stand for the card's "`./sync.sh status` lista o par"
- Acceptance criteria covered: the card's `./sync.sh status` criterion; the amendment's *Montagem*, *Desmontagem*, `status` and *Prova* bullets.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification commands green; their output kept for the PR body
- [ ] No other pair's behavior changed (the sandbox run shows the skills/hooks pairs as before)

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #83` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed (dispatched mode: decide, with verification green).
4. Flip the first line of this file to `✅ Status: Complete`.
