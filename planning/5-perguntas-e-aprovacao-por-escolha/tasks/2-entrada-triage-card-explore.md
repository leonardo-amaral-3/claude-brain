✅ Status: Complete

# Task 2: Entrada — `gm-triage`, `gm-card`, `gm-explore`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/5-perguntas-e-aprovacao-por-escolha/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The files live in the **root of this repo** (`claude-brain`) — the skills are not inside a module subfolder, so every git command runs from the repo root. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 2 of 7. Task 1 is already in the codebase: the block `## Como perguntar e como aprovar` exists, byte-identical, in all 11 skills. **Read it before writing anything** — it is the convention you are applying, and the two default sets it defines are what the `A` points delegate to.

**The line numbers in the spec's `## File Change Summary` are `origin/dev` coordinates, and task 1 invalidated them.** Inserting the block pushed everything below it down by a constant number of lines. Locate each point by its text, not by its line number.

## Scope

Every point in the spec's `## File Change Summary` rows for `skills/gm-triage/SKILL.md`, `skills/gm-card/SKILL.md` and `skills/gm-explore/SKILL.md` — seven in total: three `P` (own options, written on the line), three `A` (artifact, delegating to the block) and one `R` (a hard rule that now points at the block instead of restating the old gesture).

The three `P` points are the work here; the parenthetical in each table cell says what the choice is about. Write their option sets under the block's five rules and the tool limits in `## Coding Standards` — 2–4 options, `header` up to 12 chars, `label` of 1–5 words, pt-BR, and each option's `description` carrying the consequence of picking it.

For the `A` points: the artifact goes in the message **before** the call (the tool shows no long body), and the point itself delegates to the block rather than re-spelling the set.

**Explicitly NOT in this task:** the block's text (task 1 owns it — do not touch it, in any of the 11 skills; an edit there breaks T1 silently and task 7 will find it). No other skill. And none of the lines in the spec's second table, "Deliberadamente fora, apesar de parecerem pontos" — `gm-explore:70` and the two "Offer exactly one follow-up" closings in this task's files stay exactly as they are.

## Verification

- Command(s) that must pass:
  - **T2** — `grep -c AskUserQuestion` returns **at least 2** for `gm-triage`, **3** for `gm-card`, **1** for `gm-explore` (the formula is `1 + p`; the `1` is the mention inside the block).
  - **T3, scoped to these three files** — the vocabulary grep from the spec's `## Plano de testes`, excluding the `description:` frontmatter lines and the block's region, returns zero lines for the three.
  - **T1 still green** — re-run task 1's hash loop; it must still report 11 files on a single hash.
- Acceptance criteria covered: **CA1** and **CA2** for these seven points, proven by **T4** — read them one by one against the two criteria: each arrives as a choice from the right bucket, each option states the consequence of choosing it, and none opens by citing an identifier before the context.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] T4 read done point by point, not skipped because T2 and T3 are green — the spec's own ressalva says the greps covered 11 of 43 points and are a net, not the proof

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from the repo root with a clear message ending with the trailer `Card: #5`.
4. Flip the first line of this file to `✅ Status: Complete`.
