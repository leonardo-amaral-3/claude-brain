❌ Status: Not Started

# Task 5: Fronteira com o cliente do #42

> **DEPENDS ON #42.** Do not start until the card `leonardo-amaral-3/claude-brain#42` has its
> `<!-- gm:spec -->` comment published and this branch has been rebased onto `feat/42-filtro-jev`
> (cofre #1387). If the comment is missing, stop: `PARADA: task 5 do #43 aguarda o gm:spec do #42`.

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/43-portao-spec-sensivel/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Task index**: [`README.md`](README.md) — stacking on `feat/42-filtro-jev`, environment and the rules of the batch. They bind this task.
- **The #42 contract**: the published `gm:spec` on card #42 and the client-contract section of `planning/42-*/spec.md` (in the base branch, or in the worktree `~/pessoal/claude-brain-42-filtro-jev`). Read it; do not edit it.

The code lives in the `claude-brain` repository — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/43-portao-spec-sensivel`, in the worktree `~/pessoal/claude-brain-43-portao-spec-sensivel`, already checked out by `/gm-implement`, now rebased onto `feat/42-filtro-jev`).

This is task 5 of 5 — the one that closes the card. Tasks 1–4 are already in the codebase: `skills/gm-spec/sensivel.mjs` complete with `carregarJev` as the stub that returns `null`, the test script, and the markdown.

Premises this task leans on (spec, `## Premissas medidas`): "O contrato do #42 ainda não existe" — measured false at planning time; **measure it again here** (`gh issue view 42 -R leonardo-amaral-3/claude-brain --json comments`, and read the contract section), since the whole task rests on it. "Não existe cliente, chave nem menção ao Jev hoje" holds for this machine: with no client installed, the tests still see `cliente: null`.

## Scope

Replace the stub of `carregarJev` with the adapter of `### Fronteira com o cliente do #42`: resolution by the path the contract declares (R1), the mapping of the probability (R2), no reading of flag or key (R3), `cabe` per the declared size limit (R4), and the per-call budget when the contract accepts one. Check the contract against R1–R4 **before** writing code: a contract that does not meet them, or that truncates without saying so, is a deviation → STOP (`PARADA`), per `## Execution` and the section itself. A per-call budget the contract does not accept is not a deviation: write it down for the PR body (cofre #1406).

`carregarJev` stays the only function that knows the client, keeps the "never throws" guarantee, and keeps the Estático row green (`import(` only inside it). Nothing in the test script loads the real client or calls the API.

**Out of scope:** any change to the #42 client, its flag or its key; opt-in, rule, CLI or markdown (tasks 1–4); calling the Jev API (no key, and no authorization to send spec text to TypeSafe AI: CA8 stays in `## Verificação pós-deploy`, pending Leonardo's approval).

If you record a decision: `mcp__brain__lembrar` with scope `claude-brain#43` (never the bare number), copied to the card as a `<!-- gm:decisao -->` comment on `leonardo-amaral-3/claude-brain#43`.

## Verification

- Command(s) that must pass — the full gate of the card (spec, `## Plano de testes`, last paragraph):
  - `node scripts/gm-spec-sensivel-teste.mjs` → exit 0 (every row).
  - `node scripts/skills-comum.mjs --check` → exit 0 (`CLAUDE.md`, `## A esteira` item 3 — the final check of every change in `skills/`).
- Acceptance criteria covered: CA6 (one client only, via `carregarJev`); criterion 3 of the card ("usa o cliente do #42"); the resolution the G4 checks through the `cliente` field of the output.

## Completion Checklist

- [ ] The #42 contract checked against R1–R4 before coding (deviation → stop)
- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables
- [ ] Limitations for the PR body written down (per-call budget, if not accepted)

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside `claude-brain/`, message ending with the trailer `Card: #43` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
