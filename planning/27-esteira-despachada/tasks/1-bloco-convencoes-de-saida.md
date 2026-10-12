✅ Status: Complete

# Task 1: Bloco `## Convenções de saída` nas 11 skills

## Context

- **Spec**: [`planning/27-esteira-despachada/spec.md`](../spec.md) — ALL requirements and decisions. Follow strictly; if reality contradicts it, STOP (deviation protocol).
- Repo `claude-brain` (public: no customer data). Work only in the worktree `C:/Users/lokin/pessoal/claude-brain-27-esteira-despachada`, branch `feat/27-esteira-despachada`. Never run `sync push`, never copy into `~/.claude`.

This is task 1 of 4.

## Scope

Spec "Convenções de saída (11 skills)", requirements 1 and 2.
- Write the canonical block once (Write tool, scratch file outside the repo), then append it to the end of `skills/gm-{card,correcao,explore,hotfix,implement,plan-tasks,prd,release,ship,spec,triage}/SKILL.md` with a script. Identical text in all 11; instructions in English, what the human reads in pt-BR.
- Content: last line of the final answer is `PROXIMO: /gm-<skill> <argumento>` (pipeline continues) or `PARADA: <motivo em uma frase>` (it does not); new file → Write, existing → Edit, heredoc only short (1500-character limit of the context-cost hook); long body (comment, PR, commit) via file + `--body-file`/`-F`. No workspace name.
- Include `planning/27-esteira-despachada/` (spec + tasks) in this commit.
- NOT in scope: `gm-tech-spec`; any other edit to these files.

## Verification

- `grep -L "## Convenções de saída" skills/gm-*/SKILL.md` lists only `gm-tech-spec`
- `grep -c "PROXIMO:"` and `grep -c "1500"` ≥ 1 in the 11 files
- diff between the 11 blocks is empty
- Criteria covered: 1, 2

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification green
- [ ] No workspace-specific name leaked into a skill

## Workflow

1. Implement; run the checklist.
2. Summarize: verification result first, then a risk-ranked reading order.
3. Commit in the worktree with `git commit -F <file>`, trailer `Card: #27`, identity `leonardo-amaral-3 <frashdopredio2005@gmail.com>`.
4. Flip the first line of this file to `✅ Status: Complete`.
