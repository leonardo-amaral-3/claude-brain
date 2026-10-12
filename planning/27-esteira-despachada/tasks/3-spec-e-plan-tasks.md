❌ Status: Not Started

# Task 3: `gm-spec` e `gm-plan-tasks` — e2e/catálogo e 2º revisor de IA

## Context

- **Spec**: [`planning/27-esteira-despachada/spec.md`](../spec.md) — ALL requirements and decisions. Follow strictly; if reality contradicts it, STOP (deviation protocol).
- Repo `claude-brain` (public: no customer data). Work only in the worktree `C:/Users/lokin/pessoal/claude-brain-27-esteira-despachada`, branch `feat/27-esteira-despachada`. Never run `sync push`, never copy into `~/.claude`.

This is task 3 of 4. Tasks 1..2 are already in the codebase.

## Scope

Spec sections "gm-spec" and "gm-plan-tasks"; requirement 3 (last bullet) and requirement 4.
- `gm-spec` Phase 3: bullet — in e2e a slow external system is simulated at the edge; a premise inherited from a catalog is checked against the environment.
- `gm-spec` Phase 4: paragraph — sensitive spec (data, billing, migration) and a workspace that declares no second human (or the human chooses to go without): dispatch an independent AI agent (fresh context, receives only the spec path, findings with `file:line`) and bring the findings to the human with the spec, before G2.
- `gm-plan-tasks` quality checks: the same e2e/catalog item.
- NOT in scope: docs/template.

## Verification

- `grep -n "independent" skills/gm-spec/SKILL.md` hits inside Phase 4
- `grep -n "catalog" skills/gm-spec/SKILL.md skills/gm-plan-tasks/SKILL.md` hits in both
- Criteria covered: 3 (last bullet), 4

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification green
- [ ] No workspace-specific name leaked into a skill

## Workflow

1. Implement; run the checklist.
2. Summarize: verification result first, then a risk-ranked reading order.
3. Commit in the worktree with `git commit -F <file>`, trailer `Card: #27`, identity `leonardo-amaral-3 <frashdopredio2005@gmail.com>`.
4. Flip the first line of this file to `✅ Status: Complete`.
