❌ Status: Not Started

# Task 1: A convenção — o bloco canônico nas 11 skills e a seção longa em `docs/`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/5-perguntas-e-aprovacao-por-escolha/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The files live in the **root of this repo** (`claude-brain`) — the skills are not inside a module subfolder, so every git command runs from the repo root. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 1 of 7. Nothing from this feature is in the codebase yet.

**You are writing the text that the other six tasks copy from.** Tasks 2–6 convert the 43 decision points to the two default sets defined here; they do not re-derive the convention. Whatever ambiguity you leave in the block, you leave in all of them.

## Scope

Two things, one commit:

1. **The block** — `## Como perguntar e como aprovar`, the five rules described in the spec's `## Technical Overview`, inserted **byte-identical** into each of the 11 skills that has an interaction point: right after the mission prose, before the first other `##` section. `skills/gm-tech-spec/SKILL.md` gets **nothing** — the spec's `## Technical Decisions` says why.
2. **`docs/esteira-gm.md`** — the long, human-facing version of the convention as a new section neighbouring `## A regra que sustenta tudo`, plus the realignment of the five lines listed in that file's row of the spec's `## File Change Summary`. Same commit: an anchor that contradicts what it anchors verifies nothing.

Honour the tool's hard limits and the language rule in `## Coding Standards` — instructions in English, everything a human reads in pt-BR.

**Explicitly NOT in this task:** none of the 43 decision points. No `SKILL.md` line changes beyond inserting the block. The two `=` realignments, the four `R` rules, the `gm-plan-tasks` closing line and the task template all belong to tasks 2–6.

**Leave the block greppable at both ends.** T3 excludes the block's region from its sweep, and every later task depends on that exclusion being mechanical: the heading opens it and the next `## ` closes it, with no `##` inside.

## Verification

- Command(s) that must pass:
  - **T1** — one hash, eleven skills, same position:
    ```bash
    for f in skills/gm-*/SKILL.md; do
      awk '/^## Como perguntar e como aprovar/{p=1;print;next} p&&/^## /{exit} p' "$f" \
        | tr -d '\r' | sha256sum | tr -d '\n'; echo "  $f"
    done | sort | uniq -c -w 64
    ```
    Expect exactly two groups: **11** files sharing one hash, and `gm-tech-spec` alone with the hash of empty input. Then confirm by eye that in all 11 the block sits after the mission prose and before the first other `##`.
  - **T2 floor** — `grep -c AskUserQuestion skills/gm-*/SKILL.md` returns ≥ 1 for each of the 11 (the mention inside the block) and 0 for `gm-tech-spec`.
  - **T3, scoped to the doc you rewrote** — the vocabulary grep from the spec's `## Plano de testes` over `docs/esteira-gm.md` alone returns zero lines. Do **not** run it over `skills/` yet: the 43 points still carry the old wording by design, and it will not go green before task 7.
- Acceptance criteria covered: **CA1** for the 21 `A`+`X` points, whose mechanism this block *is* (they delegate to it rather than spelling it out — spec's `## Technical Decisions`, row "Padrão no bloco, exceções à mão"); **CA2**, whose rule 1 is written here.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] `gm-tech-spec` untouched; `README.md`, `templates/` and `brain-mcp/` untouched

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from the repo root with a clear message ending with the trailer `Card: #5`.
4. Flip the first line of this file to `✅ Status: Complete`.
