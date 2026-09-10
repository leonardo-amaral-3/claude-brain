✅ Status: Complete

# Task 6: Emergência — `gm-hotfix`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/5-perguntas-e-aprovacao-por-escolha/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The files live in the **root of this repo** (`claude-brain`) — the skills are not inside a module subfolder, so every git command runs from the repo root. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 6 of 7. Tasks 1–5 are already in the codebase. The block `## Como perguntar e como aprovar` exists byte-identical in all 11 skills — **read it before writing anything**.

**The line numbers in the spec's `## File Change Summary` are `origin/dev` coordinates, and task 1 invalidated them.** Locate each point by its text, not by its line number.

**This is the file with the most irreversible decisions per line, and the one read under the worst conditions.** A hotfix runs while something is broken in production, by someone in a hurry. Every option here is read fast or not at all — which is exactly why the consequence has to be in the option itself and not one screen up.

## Scope

Every point in the spec's `## File Change Summary` row for `skills/gm-hotfix/SKILL.md` — nine in total: five `P` (own options), one `A` (artifact), two `X` (the commit, and the merge into `main` that puts the change in production) and one `R`.

Two notes the spec makes about this file specifically:

- **The migration-in-a-hotfix question is one point cited in two places** — the hard rule near the top and the step it points at. Convert it once; make the other citation refer to it.
- **Contain before fixing** and **which of the two emergencies** are both decisions taken at the worst moment; their option `description`s carry more weight than anywhere else in the feature.

**Explicitly NOT in this task:** the block's text (task 1 owns it — an edit there breaks T1 silently). No other skill. And nothing from the spec's second table: the human-review step of this file stays as-is, because that review happens on GitHub and has no artifact to present in the chat — the in-session gate of a hotfix is the merge, which is one of the two `X` points above. The "Offer exactly one follow-up" closing stays too.

## Verification

- Command(s) that must pass:
  - **T2** — `grep -c AskUserQuestion skills/gm-hotfix/SKILL.md` returns **at least 6** (`1 + 5`; the `1` is the mention inside the block).
  - **T3, scoped to this file** — the vocabulary grep from the spec's `## Plano de testes`, excluding `description:` frontmatter lines and the block's region, returns zero lines.
  - **T1 still green** — re-run task 1's hash loop; 11 files, one hash.
- Acceptance criteria covered: **CA1** and **CA2** for these nine points, proven by **T4** — read them one by one: right bucket, consequence in every option, context before any identifier. For the two `X` points, the physical consequence has to be written out, not implied.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] The migration question exists once, and the second citation points at it rather than duplicating it
- [ ] T4 read done point by point — the greps are a net, not the proof

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from the repo root with a clear message ending with the trailer `Card: #5`.
4. Flip the first line of this file to `✅ Status: Complete`.
