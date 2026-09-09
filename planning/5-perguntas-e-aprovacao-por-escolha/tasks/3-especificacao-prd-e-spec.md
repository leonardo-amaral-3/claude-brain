✅ Status: Complete

# Task 3: Especificação — `gm-prd` e `gm-spec`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/5-perguntas-e-aprovacao-por-escolha/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The files live in the **root of this repo** (`claude-brain`) — the skills are not inside a module subfolder, so every git command runs from the repo root. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 3 of 7. Tasks 1–2 are already in the codebase. The block `## Como perguntar e como aprovar` exists byte-identical in all 11 skills — **read it before writing anything**; it is the convention you are applying.

**The line numbers in the spec's `## File Change Summary` are `origin/dev` coordinates, and task 1 invalidated them.** Locate each point by its text, not by its line number.

**This is the densest pair in the feature, and it holds the gate the old grep missed.** The spec's T3 ressalva measured that the first pattern let `gm-spec:106` — the **G2**, the human gate on the spec itself — slip through, only because "Explicit" starts with a capital letter. A green grep here means nothing on its own.

## Scope

Every point in the spec's `## File Change Summary` rows for `skills/gm-prd/SKILL.md` and `skills/gm-spec/SKILL.md` — fifteen in total: six `P` (own options), six `A` (artifact, delegating to the block), one `R` (hard rule now pointing at the block) and two `=` (already say the right thing; only "ritmo" becomes "mecanismo").

The six `P` points are the work; the parenthetical in each table cell says what each choice is about. Note that the depth point in `gm-spec` spans a range of lines rather than one, and is a single decision. Write the option sets under the block's five rules and the tool limits in `## Coding Standards` — 2–4 options, `header` up to 12 chars, `label` of 1–5 words, pt-BR, each `description` carrying the consequence of choosing it.

`## Coding Standards` also names a use for the per-option `preview` field that lands naturally in this pair: when the options are alternative wordings, seeing the difference is what decides. It is per-option, so it never displays the artifact of an `A` gate.

**Explicitly NOT in this task:** the block's text (task 1 owns it — an edit there breaks T1 silently). No other skill. And nothing from the spec's second table: the "Ask the user to describe the feature" line in `gm-prd` is legitimate free text and stays, as do the two "Offer exactly one follow-up" closings in `gm-spec`.

## Verification

- Command(s) that must pass:
  - **T2** — `grep -c AskUserQuestion` returns **at least 3** for `gm-prd` and **5** for `gm-spec` (`1 + p`; the `1` is the mention inside the block).
  - **T3, scoped to these two files** — the vocabulary grep from the spec's `## Plano de testes`, excluding `description:` frontmatter lines and the block's region, returns zero lines.
  - **T1 still green** — re-run task 1's hash loop; 11 files, one hash.
- Acceptance criteria covered: **CA1** and **CA2** for these fifteen points, proven by **T4** — read them one by one: each arrives as a choice from the right bucket, each option states the consequence of choosing it, and none opens by citing an identifier before the context. Give the G2 gate its own careful read.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] T4 read done point by point, including the G2 gate — the greps are a net, not the proof

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from the repo root with a clear message ending with the trailer `Card: #5`.
4. Flip the first line of this file to `✅ Status: Complete`.
