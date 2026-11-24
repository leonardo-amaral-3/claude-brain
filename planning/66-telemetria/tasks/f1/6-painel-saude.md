❌ Status: Not Started

# Task 6: O painel — agregador, leitor do diário e a seção Saúde

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). The section interface, the `ctx` and the `--amostrar`/`--julgar` hand-off are the contract that F2 (#68, `ganho.mjs`) and F3 (#69, `prova.mjs`) build against in parallel: implement them exactly, never adapt them to what is on `dev`.
- **Card**: phase F1 of epic #66 is sub-issue **#67**. Commits carry `Card: #67`.
- **Premises this task leans on**: spec P13; breakdown summary M4, M6.

The code lives in the worktree `/home/leo/pessoal/claude-brain-67-telemetria-saude` — **its own git repository** (branch `feat/67-telemetria-saude`); run every git command from inside it. Never touch the main checkout, the sibling worktrees or the live installation. No `npm ci`/`npm install`.

This is task 6 of 7. Tasks 1–5 (gravador, events, A/B, isolation and cost) are already in the codebase; this task only reads the diary format, through fixtures.

## Scope

- `brain-mcp/scripts/painel/eventos.mjs`, `brain-mcp/scripts/painel.mjs` (spec `### brain-mcp/scripts/painel.mjs e painel/eventos.mjs`) and `brain-mcp/scripts/painel/saude.mjs` (spec `### painel/saude.mjs — CA1`).
- `brain-mcp/scripts/fixtures/telemetria/saude/` (JSONL fixtures built from the `Exemplos` of `### Contrato do evento`, fictitious paths) and `brain-mcp/scripts/painel-teste.mjs` covering every item of the `CA1` row of `## Plano de testes`.
- `brain-mcp/package.json`: the `painel` script.
- NOT here: `ganho.mjs`, `prova.mjs` (other phases; the tests use throwaway sections in a temporary `secoesDir`), docs.

## Verification

- Command(s) that must pass: `node brain-mcp/scripts/painel-teste.mjs`; `cd brain-mcp && npm run painel -- --dias 1` exits 2 with the "nothing to read / `BRAIN_TELEMETRIA=1`" line (live diary absent, P8) and does not create the directory.
- Acceptance criteria covered: CA1, R1 (output without path or prompt text).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] `node:sqlite` opened read-only; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #67` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
