❌ Status: Not Started

# Task 2: `gm-ship` e `gm-correcao` — correções do mantenedor

## Context

- **Spec**: [`planning/27-esteira-despachada/spec.md`](../spec.md) — ALL requirements and decisions. Follow strictly; if reality contradicts it, STOP (deviation protocol).
- Repo `claude-brain` (public: no customer data). Work only in the worktree `C:/Users/lokin/pessoal/claude-brain-27-esteira-despachada`, branch `feat/27-esteira-despachada`. Never run `sync push`, never copy into `~/.claude`.

This is task 2 of 4. Task 1 is already in the codebase.

## Scope

Spec sections "gm-correcao" and "gm-ship"; requirement 3 (first three bullets) and the `gm-correcao` sentence of requirement 1.
- `gm-ship`: precondition 4 typecheck = the CI command read from the workspace `CLAUDE.md` (the skill names no tsconfig); Report: "entregue" only with green CI and review handled; validated in dev closes the card at once (`gh issue close --reason completed`) and it STAYS in 🧪 Validação em Dev — it does not wait for 🚂 Release, ✅ Produção or `/gm-release`; after closing, confirm the status is still 🧪 (spec requirement 3, amended 2026-10-12).
- `gm-correcao`: replace the `@claude` re-review authorization (~line 148) with "one review per PR, one `/gm-correcao`; do not ask for re-review"; when dispatched it does not wait for CI nor use `ScheduleWakeup`; Report: validated in dev closes the card at once and it stays in 🧪 (same rule as gm-ship).
- NOT in scope: the `## Convenções de saída` block, other skills.

## Verification

- `grep -n "mesmo comando do CI" skills/gm-ship/SKILL.md` hits
- `grep -n "@claude" skills/gm-correcao/SKILL.md` no longer authorizes asking
- `grep -rin "tsconfig" skills/` empty
- Criteria covered: 3 (ship, correcao), 1 (correcao)

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification green
- [ ] No workspace-specific name leaked into a skill

## Workflow

1. Implement; run the checklist.
2. Summarize: verification result first, then a risk-ranked reading order.
3. Commit in the worktree with `git commit -F <file>`, trailer `Card: #27`, identity `leonardo-amaral-3 <frashdopredio2005@gmail.com>`.
4. Flip the first line of this file to `✅ Status: Complete`.
