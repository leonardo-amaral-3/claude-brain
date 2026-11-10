❌ Status: Not Started

# Task 4: O portão no `CLAUDE.md`, a doc e o README, e a prova do CA3

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/44-parada-classificada/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the worktree `~/pessoal/claude-brain-44-parada-classificada` — **its own git repository** (the `claude-brain` repo); run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/44-parada-classificada`, already checked out by `/gm-implement`).

This is task 4 of 4. Tasks 1–3 are already in the codebase.

**Precondition — do not start without it (spec, `## Execution`).** Implementation only begins after the branch has been rebased onto `feat/42-filtro-jev`, and that branch must already carry the commit of the Jev client written to the contract of the #42 spec (the card #42 must have its `<!-- gm:spec -->` comment). If either is missing, stop with `PARADA` and say which one. This task does not use the real client. The CA3 commands use `feat/42-filtro-jev` as the merge base, so they only mean something after the rebase.

Premises it leans on (spec, `## Premissas medidas`): "Onde está o contrato da última linha" (the anchors in `docs/esteira-gm.md`) and "O portão de teste do repo não cobre `scripts/`" (why item 3 of `CLAUDE.md` is edited). The line numbers in the spec were measured on `3c3b92c`. After the rebase, locate the anchors by their text (the paragraph **O que o argumento ainda carrega**, `## Uma worktree por card`, the `scripts/` line of the tree in `README.md`, the end of item 3). If siblings #43/#46 changed item 3 first, join the sentences as the spec says.

## Scope

- `CLAUDE.md`: the paragraph at the end of item 3 of `## A esteira`, verbatim from the spec.
- `docs/esteira-gm.md`: the paragraph **A parada classificada** at the end of `## Modo despachado`, verbatim from the spec.
- `README.md`: the `scripts/` line of the tree, verbatim from the spec.
- The CA3 proof. Nothing under `skills/` changes.
- **Out of scope:** any file in `skills/`, `hooks/`, `brain-mcp/`, `sync.*` or `install.*`. Touching one of them is a deviation. Also out of scope: the dispatchers (`d.sh`, `cadeia*.sh`) and the orchestrator's instructions, which live outside the repo. CA4 is not run here: it depends on Leonardo's approval and stays as a PR pending item, with the command ready in `## Verificação pós-deploy`.

## Verification

- Command(s) that must pass:
  - `node scripts/classificar-parada-teste.mjs` (exit `0`);
  - `node scripts/skills-comum.mjs --check` (exit `0`);
  - `git diff --quiet $(git merge-base HEAD feat/42-filtro-jev) HEAD -- skills/` (exit `0`);
  - `git status --porcelain -- skills/` (empty).
- Acceptance criteria covered: CA3, plus the doc side of R1/R3 (the paragraph that tells the reader how to read `escala` and `desligado`).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] The three texts are the spec's, literal

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #44` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
