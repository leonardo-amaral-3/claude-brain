✅ Status: Complete

# Task 4: A chave do A/B no hook

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). The `grupo` field and the `jev = 'sem_filtro_ab'` value are part of the contract read by F2 (#68): never change them without an amendment.
- **Card**: phase F1 of epic #66 is sub-issue **#67**. Commits carry `Card: #67`. The reading of the A/B (Wilson, verdict) is F2's, not this task's.
- **Premises this task leans on**: spec P1; breakdown summary M1.

The code lives in the worktree `/home/leo/pessoal/claude-brain-67-telemetria-saude` — **its own git repository** (branch `feat/67-telemetria-saude`); run every git command from inside it. Never touch the main checkout, the sibling worktrees or the live installation. No `npm ci`/`npm install`.

This is task 4 of 7. Tasks 1–3 (gravador, `jev` event, `contexto` event in the hook) are already in the codebase.

## Scope

- `hooks/brain-contexto.js`: item 8 of spec `### hooks/brain-contexto.js — evento contexto e o A/B (F1)` — the draw only when `usaJev()`, candidates, telemetry on **and** `jev.ligado('contexto')`; `p` from `BRAIN_TELEMETRIA_AB`; SHA-256 of `prompt_id`; `sem_filtro` output exactly as with the Jev off.
- `brain-mcp/scripts/telemetria.mjs`: case `ab` of spec `### brain-mcp/scripts/telemetria.mjs`.
- NOT here: anything that reads `grupo` (painel F1 only counts it, task 6).

## Verification

- Command(s) that must pass: `node brain-mcp/scripts/telemetria.mjs` (all cases so far, `ab` included); `cd brain-mcp && npm run jev`.
- Acceptance criteria covered: CA3 (a chave: sorteio, grupo no evento, sem a variável nada sorteado).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] No unused variables; the draw is inside `try` (failure = no A/B)

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #67` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
