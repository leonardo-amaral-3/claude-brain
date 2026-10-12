✅ Status: Complete

# Task 4: `docs/esteira-gm.md` e `templates/CLAUDE.example.md`

## Context

- **Spec**: [`planning/27-esteira-despachada/spec.md`](../spec.md) — ALL requirements and decisions. Follow strictly; if reality contradicts it, STOP (deviation protocol).
- Repo `claude-brain` (public: no customer data). Work only in the worktree `C:/Users/lokin/pessoal/claude-brain-27-esteira-despachada`, branch `feat/27-esteira-despachada`. Never run `sync push`, never copy into `~/.claude`.

This is task 4 of 4. Tasks 1..3 are already in the codebase.

## Scope

Spec "docs e template"; requirement 5.
- `docs/esteira-gm.md`: paragraph on the final-line contract (`PROXIMO`/`PARADA`) and on the independent AI reviewer at G2.
- `templates/CLAUDE.example.md`: ask the workspace to declare the CI typecheck command and whether there is a second human.
- Cross-read against the edited skills; fix contradictions in doc/template (in a skill only if it breaks the spec).
- NOT in scope: Notoria `CLAUDE.md`, dispatch scripts (`d.sh`, `base*.txt`, `cadeia*.sh`) — they live outside the repo.

## Verification

- `grep -n "PROXIMO" docs/esteira-gm.md`; `grep -in "typecheck\|segundo humano" templates/CLAUDE.example.md`
- Cross-reading doc/template vs skills shows no contradiction
- Criteria covered: 5

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification green
- [ ] No workspace-specific name leaked

## Workflow

1. Implement; run the checklist.
2. Summarize: verification result first, then a risk-ranked reading order.
3. Commit in the worktree with `git commit -F <file>`, trailer `Card: #27`, identity `leonardo-amaral-3 <frashdopredio2005@gmail.com>`.
4. Flip the first line of this file to `✅ Status: Complete`.
