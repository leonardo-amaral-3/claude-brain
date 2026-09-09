❌ Status: Not Started

# Task 7: A varredura — T1 a T4 no repo inteiro

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/5-perguntas-e-aprovacao-por-escolha/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The files live in the **root of this repo** (`claude-brain`) — the skills are not inside a module subfolder, so every git command runs from the repo root. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 7 of 7. Tasks 1–6 are already in the codebase: the block exists in the 11 skills, `docs/esteira-gm.md` carries the long version, and all 43 decision points have been converted, six sessions apart.

**Six sessions apart is the problem you exist to solve.** Each of tasks 2–6 ran its greps against its own slice only. Nobody has run the vocabulary sweep across the whole surface, nobody has re-checked that the block survived five rounds of neighbouring edits byte-intact, and nobody has read the 43 points in one sitting — which is the only way to see whether the 22 option sets speak the same language as each other.

## Scope

Run the four repo-level tests of the spec's `## Plano de testes` over everything, and **fix what they catch**:

1. **T1** — re-hash the block across the 11 skills. One hash, eleven files, `gm-tech-spec` still without it, still in the same position in all of them. A stray edit inside the block during tasks 2–6 breaks this silently; if it broke, restore the divergent copies from the canonical one rather than editing all eleven by hand.
2. **T2** — the per-skill counts from the spec, and their sum: **22** own-option points across the eleven.
3. **T3** — the vocabulary grep over **all** of `skills/gm-*/SKILL.md` and `docs/esteira-gm.md`, discarding `description:` frontmatter lines, `gm-tech-spec` entirely and the block's own region. **Zero lines.** Anything it returns is either a point the table missed or a leftover from a slice — convert it under the block's rules, or, if it belongs in the spec's "deliberadamente fora" list, say so in the summary instead of converting it. Do not silence the grep by narrowing the pattern.
4. **T4** — the full directed read of all 43 points, end to end, in the order the esteira runs them. This is the spec's designated **proof** of CA1, and the one thing no earlier task could do: cross-skill coherence. Does *aprovar · ajustar · rejeitar* read the same in `gm-triage` and in `gm-spec`? Do the four `X` points describe their physical consequence with the same concreteness? Does any of the 22 own-option sets open by citing an identifier before saying what is at stake?

Fixes land in this task's commit. **Finding nothing is a legitimate outcome** — report it as a result, not as a reason to go looking for something to change.

**Explicitly NOT in this task:** new points, new rules, new scope. `README.md`, `templates/` and `brain-mcp/` stay untouched, as `## Coding Standards` requires. And **not** `./sync.ps1 push` — the spec's `## Verificação pós-deploy` puts the push and the re-run of T1–T3 against `~/.claude/skills/` in the release, and the T5 dogfood in 🧪 Validação em Dev. Neither belongs to a task.

## Verification

- Command(s) that must pass: **T1**, **T2** (per-skill floors and the sum of 22) and **T3** (zero lines) over the whole surface, plus the **T4** read of all 43 points.
- Acceptance criteria covered: **CA1** and **CA2**, complete. **CA3** is not covered here and cannot be — it is proven by T5, the dogfood of a real card through the *installed* skills, after the release.

## Completion Checklist

- [ ] T1, T2 and T3 green across the whole repo, not a slice
- [ ] T4 read done end to end, in esteira order, with cross-skill coherence checked
- [ ] Everything the sweep caught is either fixed or explained in the summary
- [ ] No new scope: `README.md`, `templates/` and `brain-mcp/` untouched; no `sync push`

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from the repo root with a clear message ending with the trailer `Card: #5`. If the sweep found nothing to fix, say that in the summary and skip the commit — an empty commit records nothing.
4. Flip the first line of this file to `✅ Status: Complete`.
