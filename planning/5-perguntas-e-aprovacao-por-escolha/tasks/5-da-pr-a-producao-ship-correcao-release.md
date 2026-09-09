❌ Status: Not Started

# Task 5: Da PR à produção — `gm-ship`, `gm-correcao`, `gm-release`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/5-perguntas-e-aprovacao-por-escolha/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The files live in the **root of this repo** (`claude-brain`) — the skills are not inside a module subfolder, so every git command runs from the repo root. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 5 of 7. Tasks 1–4 are already in the codebase. The block `## Como perguntar e como aprovar` exists byte-identical in all 11 skills — **read it before writing anything**.

**The line numbers in the spec's `## File Change Summary` are `origin/dev` coordinates, and task 1 invalidated them.** Locate each point by its text, not by its line number.

## Scope

Every point in the spec's `## File Change Summary` rows for `skills/gm-ship/SKILL.md`, `skills/gm-correcao/SKILL.md` and `skills/gm-release/SKILL.md` — nine in total: five `P` (own options), two `A` (artifact), one `X` (the merge that deploys production with no manual step in between — *executar · revisar antes de executar · cancelar*, with that consequence written in the `description`) and one `R`.

Three of the five `P` points need more than the default treatment, and the spec says so explicitly:

- **The sensitive train** is **one** point cited in two places — the hard rule near the top and the phase it points at. Convert it once; make the other citation refer to it.
- **The carona** is one of the two cases in `## Coding Standards` that **overflow the 4-option ceiling**: N items, one per call. Rule 4 of the block is what resolves it — the full list goes in the message, the options carry the likeliest candidates, "Other" takes the rest. Rule 2 forbids solving it with `multiSelect`.
- **The verbatim phrase in the sensitive-train path needs a complement.** It records a decision "de `<nome>` em `<data>`", and a choice returns only a label — no identity. `## Coding Standards` gives the two ways out: ask the name in a following question, or change the phrase to name the date and the card instead of the person. Pick one and say which in the summary.

**Explicitly NOT in this task:** the block's text (task 1 owns it — an edit there breaks T1 silently). No other skill. And nothing from the spec's second table, which is unusually load-bearing here: the acceptance-criteria loop in `gm-ship` stays as-is because its trigger is mechanical and it says, literally, not to open the PR when a criterion falls — offering "seguir" as a clickable option would turn a hard rule into a menu. The `gm-correcao` cell that points at the deviation protocol stays too; the real point lives in `gm-implement` and task 4 already converted it.

## Verification

- Command(s) that must pass:
  - **T2** — `grep -c AskUserQuestion` returns **at least 1** for `gm-ship` (no `P` points), **3** for `gm-correcao`, **4** for `gm-release`.
  - **T3, scoped to these three files** — the vocabulary grep from the spec's `## Plano de testes`, excluding `description:` frontmatter lines and the block's region, returns zero lines.
  - **T1 still green** — re-run task 1's hash loop; 11 files, one hash.
- Acceptance criteria covered: **CA1** and **CA2** for these nine points, proven by **T4** — read them one by one: right bucket, consequence in every option, context before any identifier.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] The overflow case resolves through rule 4 of the block, not through `multiSelect` or a silent truncation to 4
- [ ] The identity gap in the verbatim phrase is closed, and the summary says how
- [ ] T4 read done point by point — the greps are a net, not the proof

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from the repo root with a clear message ending with the trailer `Card: #5`.
4. Flip the first line of this file to `✅ Status: Complete`.
