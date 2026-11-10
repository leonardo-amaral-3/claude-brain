❌ Status: Not Started

# Task 2: classificar com Jev falso

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/43-portao-spec-sensivel/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Task index**: [`README.md`](README.md) — stacking on `feat/42-filtro-jev`, environment and the rules of the batch. They bind this task.

The code lives in the `claude-brain` repository — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/43-portao-spec-sensivel`, in the worktree `~/pessoal/claude-brain-43-portao-spec-sensivel`, already checked out by `/gm-implement`).

This is task 2 of 5. Task 1 is already in the codebase: `skills/gm-spec/sensivel.mjs` with the pure functions and the `carregarJev` stub, and `scripts/gm-spec-sensivel-teste.mjs`.

Premises this task leans on (spec, `## Premissas medidas`): "Spec real pode ter dezenas de KB" (the text goes whole, never truncated), "Node e padrão de teste do repo".

## Scope

Add `classificar` to `skills/gm-spec/sensivel.mjs`, exactly as the spec's bullet describes it: the opt-in short-circuit, the single budget timer, the `carregar` race, `cabe`, the four parallel `perguntar` calls, the error mapping (only `error.name`), and the redirection of stdout to stderr while the client runs (and the saved original `process.stdout.write`, which task 3 uses for the final line).

Add to `scripts/gm-spec-sensivel-teste.mjs` every `classificar` row of `## Plano de testes`. Every Jev in them is a fake injected through `carregar`; nothing loads a real module, nothing touches the network. Each timeout case uses `orcamentoMs: 50` and must let the test process end.

**Out of scope:** the CLI, `optInLigado` wiring and `sensibilidade.json` (task 3), markdown (task 4), the real `carregarJev` (task 5).

If you record a decision: `mcp__brain__lembrar` with scope `claude-brain#43` (never the bare number), copied to the card as a `<!-- gm:decisao -->` comment on `leonardo-amaral-3/claude-brain#43`.

## Verification

- Command(s) that must pass: `node scripts/gm-spec-sensivel-teste.mjs` → exit 0 (task 1's rows still green, the Estático row included).
- Acceptance criteria covered: CA1 (Jev states → motives), the `classificar` half of CA4 and CA5, CA10 (`carregar` never called without opt-in), the no-leak and no-truncation guarantees.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside `claude-brain/`, message ending with the trailer `Card: #43` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
