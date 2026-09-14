❌ Status: Not Started

# Task 2: `scripts/prova-modelo.mjs` — argumentos e parte estática

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/21-modelo-por-estacao/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `claude-brain` repository of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/21-modelo-por-estacao`, in the worktree `claude-brain-21-modelo-por-estacao`, already checked out by `/gm-implement`). Shell: Git Bash, from the root of that worktree.

This is task 2 of 4. Task 1 is already in the codebase: the 12 `model:` lines and the section `## Qual modelo roda cada estação` in `docs/esteira-gm.md`.

## Scope

The new file `scripts/prova-modelo.mjs`, covering from `### 3. scripts/prova-modelo.mjs (novo)` of the spec:

- **Uso**, **Argumentos e códigos de saída**, **Constantes** and **Leitura de arquivo** — all of it, including `--viva` as a recognized argument;
- **Parte estática**, items 1 to 5, with the exact failure messages;
- the top comment in the style the spec's `## Coding Standards` points at, with the usage and the whys that belong to this half (why the live part demands a green static part). The whys of the live part are written by task 3, together with the code they explain.

**Out of scope:** the **Parte viva** (task 3). Until task 3 lands, `--viva` must not print or return anything that reads as a live proof. No `package.json` at the root, no dependency, nothing under `~/.claude`, no edit to skills or the doc (that is task 1's contract; if the script disagrees with them, the script is what is wrong — or it is a deviation).

Running the script **without** `--repo` against this machine is expected to fail right now: the installation in `~/.claude/skills` has no `model:` until the push of task 4. That red is correct and is not something to fix here.

## Verification

From `## Plano de testes` of the spec, run as written there:

- **T6** — every case on its own copy, with `CLAUDE_CONFIG_DIR` pointing at the copy (the real installation is never read): the unmutated base exits `0`, each mutation exits `1` with the FALHA the spec lists beside it, and the CRLF case exits `0`.
- **T12** — `--repo` with no value and an unknown argument both exit `2` with the `uso:` line.

- Acceptance criteria covered: **CA1** — the checker that proves it (the run against the real installation, T1, happens in task 4, after the push).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables (`node --check scripts/prova-modelo.mjs`)

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the `claude-brain` worktree, message ending with the trailer `Card: #21` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
