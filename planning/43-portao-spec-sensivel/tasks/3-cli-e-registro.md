✅ Status: Complete

# Task 3: CLI e registro

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/43-portao-spec-sensivel/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Task index**: [`README.md`](README.md) — stacking on `feat/42-filtro-jev`, environment and the rules of the batch. They bind this task.

The code lives in the `claude-brain` repository — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/43-portao-spec-sensivel`, in the worktree `~/pessoal/claude-brain-43-portao-spec-sensivel`, already checked out by `/gm-implement`).

This is task 3 of 5. Tasks 1–2 are already in the codebase: every function of `skills/gm-spec/sensivel.mjs` except the CLI (and `carregarJev` is still the stub), and their rows in `scripts/gm-spec-sensivel-teste.mjs`.

Premises this task leans on (spec, `## Premissas medidas`): "`sensibilidade.json` não entra no índice como doc", "A sessão sabe onde a skill está instalada", "Node e padrão de teste do repo".

## Scope

Add to `skills/gm-spec/sensivel.mjs` the **Registro `sensibilidade.json`** and the **CLI** of the spec: entry-point detection, argument validation and exit code 2, reading and hashing the `spec.md`, the happy path in the order the spec gives (classify, decide, read the record, merge, write the record, then print), the single JSON line, and the exit through the write callback.

Add to `scripts/gm-spec-sensivel-teste.mjs` every **CLI** row of `## Plano de testes`, each running the script as a child process in a temp dir with the isolated `env` the plan specifies. The fixture spec is innocuous text: no client data and no client name (the repo is public).

**Out of scope:** markdown (task 4), the real `carregarJev` (task 5). With the stub, the CLI rows see `cliente: null` — that is the expected state here.

If you record a decision: `mcp__brain__lembrar` with scope `claude-brain#43` (never the bare number), copied to the card as a `<!-- gm:decisao -->` comment on `leonardo-amaral-3/claude-brain#43`.

## Verification

- Command(s) that must pass: `node scripts/gm-spec-sensivel-teste.mjs` → exit 0 (all rows of tasks 1–3).
- Acceptance criteria covered: CA2 (the `linha` and the `sha256` in the output), the script half of CA4, CA5 (usage → 2) and CA9 (the record and the union across runs), CA10 (opt-in file on and off).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside `claude-brain/`, message ending with the trailer `Card: #43` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
