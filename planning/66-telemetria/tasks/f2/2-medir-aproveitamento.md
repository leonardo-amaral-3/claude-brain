✅ Status: Complete

# Task 2: `medirAproveitamento` — o aproveitamento por evento, lido do transcript

## Context

You are implementing part of a larger feature (phase F2, card #68, of epic #66). Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- Premises this task leans on: P6 and P16 of the spec's `## Premissas medidas`, re-checked in the breakdown (2026-11-24) on a live transcript: `user` entries carry `promptId`, `isSidechain`, `timestamp`, `sessionId`; a slash command shows `<command-name>` in a non-meta entry plus an `isMeta: true` entry with the same `promptId`; `tool_use` blocks have `id`, `name`, `input`. The `prompt_id` (payload) = `promptId` (transcript) equality is **not** measured — hence the `horario` fallback.

The code lives in this worktree (`/home/leo/pessoal/claude-brain-68-telemetria-ganho`, the `claude-brain` repo) — **its own git repository**; run every git command from inside it. Work happens on `feat/68-telemetria-ganho` (already checked out).

This is task 2 of 4. Task 1 is already in the codebase.

## Scope

Spec sections: `### Contrato do evento` (the reading side: event `contexto` fields and examples), `### Privacidade`, and in `### painel/ganho.mjs — CA2 e a leitura do A/B (F2)` the export `medirAproveitamento(eventos, ctx)`, its key and `Medida`, which events enter, and the algorithm steps 1–8. The `ctx` fields used are the ones the spec defines for the panel (`ctx.projetos`); the test builds its own `ctx` — it does **not** depend on F1's `painel.mjs`/`eventos.mjs`, which are not in this branch.

Files:
- `brain-mcp/scripts/painel/ganho.mjs` — new; this task creates it with `medirAproveitamento` (a stub `secao` that returns a placeholder is fine; task 3 fills it).
- `brain-mcp/scripts/fixtures/telemetria/ganho/` — new: event JSONL and synthetic transcripts under a fake `projects/<dir>/<sessao>.jsonl` tree, fictitious paths only.
- `brain-mcp/scripts/painel-ganho-teste.mjs` — new; this task writes the CA2 per-event cases listed in the `CA2` row of `## Plano de testes` (slash command + `isMeta`, `<local-command-…>` ignored, same path in two items counted once, basename in the prompt not cited, opened by `Read`, opened by `read_doc`, cited by path, cited by basename ≥ 12, short basename not counting, Windows `\` path, sidechain ignored, window stopping at the next prompt, rebusca ≥ 50% and not, pair by `promptId`, by `horario`, `sem_par`, `sem_transcript`, and the contract key). Code 0/1/2 like `injecao.mjs`.

NOT in scope: the `Ganho` section text and rates (task 3), the A/B comparison (task 4), anything F1/F3 own. Never write to `~/.claude/brain-telemetria`; never read live transcripts in the test.

## Verification

- `node brain-mcp/scripts/painel-ganho-teste.mjs` → code 0
- Acceptance criteria covered: CA2, the per-path classification (aberto/citado), rebusca and pairing (`promptId`/`horario`/`sem_par`/`sem_transcript`), plus the `medirAproveitamento` contract F3 consumes.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #68` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
