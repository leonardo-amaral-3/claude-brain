❌ Status: Not Started

# Task 4: a leitura do A/B com e sem o filtro do Jev

## Context

You are implementing part of a larger feature (phase F2, card #68, of epic #66). Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- Decision that binds it: the A/B reading (prompt as the unit, intention-to-treat primary, per-protocol secondary, Wilson 95%, `inconclusivo` under 30 per group or with overlapping intervals) — `### Technical Decisions` of the spec, and the vault decision of 2026-11-24 "o A/B do Jev sorteia pelo SHA-256 do prompt_id".
- The `grupo` field and the `jev` enum are written by F1; here they are only read, from fixtures that follow `### Contrato do evento`.

The code lives in this worktree (`/home/leo/pessoal/claude-brain-68-telemetria-ganho`, the `claude-brain` repo) — **its own git repository**; run every git command from inside it. Work happens on `feat/68-telemetria-ganho` (already checked out).

This is task 4 of 4. Tasks 1–3 are already in the codebase.

## Scope

Spec: in `### painel/ganho.mjs`, the **Comparação A/B** bullet and *Por que o `sem_filtro` sai da conta normal*; CA3 (reading side). Per group: prompts, mean shown and mean used per prompt, % of prompts with at least one used (main metric) and % with rebusca, each with Wilson 95% over prompts; ITT primary and per-protocol secondary (how many left `com_filtro`); the verdict; `A/B desligado no período` with no grouped event.

Files: `brain-mcp/scripts/painel/ganho.mjs` (the A/B block inside `secao`), `brain-mcp/scripts/painel-ganho-teste.mjs` (the `CA3 (leitura)` row cases of `## Plano de testes`), fixtures under `brain-mcp/scripts/fixtures/telemetria/ganho/` (generated programmatically in the test is fine for the ≥ 30-prompt groups).

NOT in scope: the A/B key itself (sorting, skipping the Jev, writing `grupo`) — that is F1's hook. No change to Jev threshold or rule.

## Verification

- `node brain-mcp/scripts/painel-ganho-teste.mjs` → code 0, with: known groups → expected means, Wilson bounds and verdict; `jev_reprovou_tudo` counting in `com_filtro`; `com_filtro` with `jev ≠ 'ok'` inside ITT and out of per-protocol; a group under 30 → `inconclusivo`; `sem_filtro` out of the normal rate; no group → `A/B desligado no período`; output still free of paths and prompt text.
- Final pass of the whole F2 suite (from `brain-mcp/`): `npm run build`, `node scripts/uso-sessao.mjs`, `npm run concorrencia`, `npm run smoke` and `npm run eval -- --base origin/dev` with `BRAIN_DB`/`BRAIN_CONFIG` of the live install (read-only); code 1 or 2 is red.
- Acceptance criteria covered: CA3 (reading; closes the epic's CA3).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #68` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
