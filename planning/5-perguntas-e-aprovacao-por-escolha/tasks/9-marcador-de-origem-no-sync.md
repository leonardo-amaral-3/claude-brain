❌ Status: Not Started

# Task 9: O `sync` para de sobrescrever a instalação em silêncio

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/5-perguntas-e-aprovacao-por-escolha/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

Read the **Emenda 2026-09-09** (CA4) in the spec's `## Requisitos & critérios de aceite`, decision
2 in particular. This is task 9 of 9 — the second half of the declared ceiling exception. Task 8
puts each card in its own worktree; this task closes the hole that opens the moment there is more
than one.

**The hole, measured in the spec's session.** `sync.ps1` discovers its destination by reading
`mcpServers.brain.args[0]` from `~/.claude.json`, then copies with `Copy-Item -Force`. The target
is **single and global** (`~/.claude/skills/`) and the script has no notion of who installed last.
With N worktrees, any of them silently buries another's dogfood — and this very feature edits 11
skills, so it is the most exposed change in the repo's history to date.

Task 8 may already be `✅` when you start; nothing here depends on its diff, only on its premise.

## Scope

`sync.ps1` and `sync.sh`, and nothing else.

1. **Record the origin.** On `push`, write which worktree/branch the installation came from. The
   spec's `## Migrations & compatibilidade` item 4 places this marker in `~/.claude/` — state
   outside git, on purpose, because it describes the machine and not the repo.
2. **Ask before overwriting a different origin.** If the marker names worktree A and the push comes
   from worktree B, **stop and put it to the human as a choice** rather than copying. Pushing from
   A again proceeds without asking — the question exists to catch the switch, not to tax the
   routine.
3. **First push has nothing to compare against.** An installation that never saw the marker has no
   recorded origin: that push **writes without asking**. Asking there would be requesting
   confirmation against data that does not exist.

**Both scripts, one behaviour.** `sync.sh` and `sync.ps1` share no code — they are independent
implementations of the same contract, and this is exactly the kind of change that lands in one and
rots in the other. The spec's T6.2 requires proving it in both by hand for that reason.

Mind the repo's `.gitattributes`: `*.ps1` is `eol=crlf` and `*.sh` is `eol=lf`. A shell script
with CRLF does not run on Linux/macOS (`bad interpreter: ^M`).

**Explicitly NOT in this task:** the skills — task 8 owns those. The `status` and `pull` verbs stay
as they are; only `push` overwrites. Do **not** try to fix card **#3** (the `status` bug that calls
files identical when only line endings differ) while you are in here — it is a separate card, and
the spec's `## Migrations & compatibilidade` item 1 already routes around it.

## Verification

- Command(s) that must pass:
  - **T6.2**, by hand, in both scripts: with the marker pointing at worktree A, running `push` from
    worktree B **stops and asks** instead of copying; running it from A again proceeds silently;
    and with the marker absent, the first `push` writes without asking.
  - The installed copies still match the repo afterwards — compare with
    `diff --strip-trailing-cr` between each `skills/gm-*/SKILL.md` and its pair in
    `~/.claude/skills/`. Do **not** use `./sync.ps1 status` as the check here; see the spec's
    `## Migrations & compatibilidade` item 1 for why it cannot be trusted for this.
- Acceptance criteria covered: **CA4**, the `sync push` clause. With this task green, CA4 is
  complete and the feature is ready for `/gm-ship`.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Behaviour proven in **both** `sync.ps1` and `sync.sh`, not just the one you run
- [ ] Line endings honour `.gitattributes`; `status` and `pull` unchanged; card #3 untouched

## Workflow

1. Implement; run the checklist.
2. Present the summary risk-first, then put it to the human as a choice — *Aprovar · Ajustar ·
   Rejeitar*, per `## Como perguntar e como aprovar`. Iterate until it comes back *Aprovar*.
3. Then commit from the repo root, message ending with the trailer `Card: #5`.
4. Flip the first line of this file to `✅ Status: Complete`.
