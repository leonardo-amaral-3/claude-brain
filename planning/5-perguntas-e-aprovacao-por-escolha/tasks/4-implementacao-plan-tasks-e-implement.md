❌ Status: Not Started

# Task 4: Implementação — `gm-plan-tasks` e `gm-implement`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/5-perguntas-e-aprovacao-por-escolha/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The files live in the **root of this repo** (`claude-brain`) — the skills are not inside a module subfolder, so every git command runs from the repo root. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 4 of 7. Tasks 1–3 are already in the codebase. The block `## Como perguntar e como aprovar` exists byte-identical in all 11 skills — **read it before writing anything**.

**The line numbers in the spec's `## File Change Summary` are `origin/dev` coordinates, and task 1 invalidated them.** Locate each point by its text, not by its line number.

**You are editing the skill that is executing you.** `gm-implement` is the file this session runs from, and `gm-plan-tasks` wrote the file you are reading. Neither reloads mid-session: your edits take effect on the *next* invocation, and the running copy is the installed one under `~/.claude/skills/`, not the repo. Do not try to make the change apply to yourself.

## Scope

Every point in the spec's `## File Change Summary` rows for `skills/gm-plan-tasks/SKILL.md` and `skills/gm-implement/SKILL.md` — eleven in total: three `P` (own options), five `A` (artifact, delegating to the block), one `X` (irreversible action — the commit, which gets *executar · revisar antes de executar · cancelar* with the physical consequence written in the `description`), plus two edits that are not points:

- **The closing line of `gm-plan-tasks`'s Phase 1** — today it forbids the question-by-question ceremony, which now contradicts rule 2 of the block ("one question per call, no batching"). The two are not actually in conflict once written properly: the *breakdown* is still presented whole, in one message, and only the approval of it arrives as a single choice. Rewrite it so it says that, instead of appearing to ban the mechanism the block mandates.
- **The task template**, in the fenced block that `gm-plan-tasks` emits. The two lines named in the table are **inside** the fence, so they are content of the generated task file, not instructions to the skill. Change them for future tasks only. The spec's `## Migrations & compatibilidade` measured 119 existing task files with the old text and decided **not** to migrate them; do not.

**Explicitly NOT in this task:** the block's text (task 1 owns it — an edit there breaks T1 silently). No other skill. Nothing from the spec's second table: the `gh auth refresh` instruction in `gm-implement` and the "Offer exactly one follow-up" closing in `gm-plan-tasks` stay as they are.

## Verification

- Command(s) that must pass:
  - **T2** — `grep -c AskUserQuestion` returns **at least 1** for `gm-plan-tasks` (it has no `P` points; the `1` is the mention inside the block) and **4** for `gm-implement`.
  - **T3, scoped to these two files** — the vocabulary grep from the spec's `## Plano de testes`, excluding `description:` frontmatter lines and the block's region, returns zero lines. Watch the fenced template: `veto or adjust` and `wait for the user's review` are both in the pattern.
  - **T1 still green** — re-run task 1's hash loop; 11 files, one hash.
- Acceptance criteria covered: **CA1** and **CA2** for these eleven points, proven by **T4** — read them one by one: right bucket, consequence in every option, context before any identifier. The `X` point is the one to read hardest: "ajustar" means nothing about a commit, and a dead option in a menu trains the reflex click this card exists to kill.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Existing task files across the workspaces left untouched — the template change is forward-only
- [ ] T4 read done point by point — the greps are a net, not the proof

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from the repo root with a clear message ending with the trailer `Card: #5`.
4. Flip the first line of this file to `✅ Status: Complete`.
