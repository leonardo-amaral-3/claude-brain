❌ Status: Not Started

# Task 3: a seção `Ganho` — taxas, linha de base e o sinal do `uso`

## Context

You are implementing part of a larger feature (phase F2, card #68, of epic #66). Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- Premises this task leans on: P11 (`uso.args` is cut at 500 chars by `tools.ts`), P13 (percentile definition of `scripts/uso.mjs:54`, if a percentile is needed), and the `uso.sessao` column that task 1 added.

The code lives in this worktree (`/home/leo/pessoal/claude-brain-68-telemetria-ganho`, the `claude-brain` repo) — **its own git repository**; run every git command from inside it. Work happens on `feat/68-telemetria-ganho` (already checked out).

This is task 3 of 4. Tasks 1–2 are already in the codebase.

## Scope

Spec: in `### painel/ganho.mjs`, the `Seção Ganho` bullets **except** the A/B comparison — prompts with injection outside `sem_filtro` and the pairing counts; distinct paths shown/opened/cited; aproveitamento rate; % of prompts with at least one used; rebusca rate with the no-block baseline and the warning that it only means something compared; the split by desfecho (`entidade` × `injetado`); the `uso`-based signal (window per event, `search_context`/`read_doc` counts, `read_doc` hitting a shown path with the `JSON.parse`-then-regex fallback, and the `uso sem sessão (servidor anterior à F2)` line when the column is missing or `ctx.db` is null). Also `### painel.mjs` › *Interface de seção* (`secao(ctx) → string`) and R1 (output carries only counts and rates — never a path nor prompt text).

Files: `brain-mcp/scripts/painel/ganho.mjs` (`secao`), `brain-mcp/scripts/painel-ganho-teste.mjs` (new cases), `brain-mcp/scripts/fixtures/telemetria/ganho/` (more fixtures as needed). The test builds `ctx` itself, with `ctx.db` a temp SQLite (`node:sqlite`) holding a `uso` table with and without `sessao`.

NOT in scope: the A/B comparison block (task 4; leave a clear spot for it), `painel.mjs`/`eventos.mjs`/`saude.mjs` (F1).

## Verification

- `node brain-mcp/scripts/painel-ganho-teste.mjs` → code 0, including: expected numbers for the rates and baseline on the fixture; `sem_filtro` events out of the normal rates; the `uso` signal with a known window; the no-column line; and an assertion that the section output contains none of the fixture paths nor prompt texts.
- Acceptance criteria covered: CA2 (the section shows aproveitamento, rebusca with baseline, and how many events were left without a pair).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #68` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
