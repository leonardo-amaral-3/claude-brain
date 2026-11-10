✅ Status: Complete

# Task 2: Jev falso, `classificar` e `executar`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/44-parada-classificada/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the worktree `~/pessoal/claude-brain-44-parada-classificada` — **its own git repository** (the `claude-brain` repo); run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/44-parada-classificada`, already checked out by `/gm-implement`).

This is task 2 of 4. Task 1 is already in the codebase.

**Precondition — do not start without it (spec, `## Execution`).** Implementation only begins after the branch has been rebased onto `feat/42-filtro-jev`, and that branch must already carry the commit of the Jev client written to the contract of the #42 spec (the card #42 must have its `<!-- gm:spec -->` comment). If either is missing, stop with `PARADA` and say which one. This task does not use the real client: every scenario injects `deps.cliente = criarJevFalso(...)`, and the default client is wired only in task 3.

Premises it leans on: the expected client shape in the spec's `### Premissa NÃO provada` section (`ligado()` + `escolher({ pergunta, texto, opcoes, signal })`). The fake implements exactly that shape. Adapting to the real #42 shape is task 3's job, not this one's.

## Scope

- `scripts/jev-falso.mjs` (new): `criarJevFalso` with the keyword table and every `defeito`, as in `## Implementation Details`.
- `scripts/classificar-parada.mjs`: add `classificar` (steps 1–5, the three result shapes with fixed key order, the time cap with `AbortController`, a single call and no retry) and `executar`. `deps.cliente` has no default yet. Leave a clear point for task 3 to fill, and do not import any #42 module.
- `scripts/classificar-parada-teste.mjs`: add C1, C2, C3, C4, C5, C6, the `classificar`/`executar` parts of C7 (variants (a), (b) and (c) → `porque: "lista-divergente"`, `chamadas === 0`) and of C8 (exit codes, empty `saida` on error, key order, `erro` equal to the `aviso` for C7(a)).
- **Out of scope:** `rodarCli`, the entrypoint, `daFormaDo42`, the default `cliente` and C9 (task 3), and the docs (task 4).

## Verification

- Command(s) that must pass: `node scripts/classificar-parada-teste.mjs` (exit `0`, with C1–C8 complete) and `node scripts/skills-comum.mjs --check` (exit `0`).
- Acceptance criteria covered: CA1 (whole), CA2 (the in-process half: error, exception, timeout with aborted `signal`, `ligado-lanca`, off without `escolher` and without reading the table), R2 and R3.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code runs; no unused imports/variables; the suite leaves no timer holding the process (it must exit on its own)

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #44` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
