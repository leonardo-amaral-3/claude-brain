✅ Status: Complete

# Task 3: Evento `contexto` no hook, em todo desfecho (sem o A/B)

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). The event contract (`### Contrato do evento`) is shared with phases F2 (#68) and F3 (#69): never change it without an amendment.
- **Card**: phase F1 of epic #66 is sub-issue **#67**. Commits carry `Card: #67`.
- **Premises this task leans on**: spec P1, P14; breakdown summary M1, M2, M7, M8.

The code lives in the worktree `/home/leo/pessoal/claude-brain-67-telemetria-saude` — **its own git repository** (branch `feat/67-telemetria-saude`); run every git command from inside it. Never touch the main checkout, the sibling worktrees or the live installation. No `npm ci`/`npm install`.

This is task 3 of 7. Tasks 1–2 (`hooks/telemetria.js`, the `jev` event in `hooks/jev.js`) are already in the codebase.

## Scope

- `hooks/brain-contexto.js`: items 1–7 and 9–12 of spec `### hooks/brain-contexto.js — evento contexto e o A/B (F1)` — the `contexto` event in every outcome, the new return of `filtrarComJev`, `opcoes.telemetria` to `jev.julgar`, `itens` with `pos`/`chunk`/`trecho_sha`/`prob`, `ms_*`, `erro` without `e.message` (`### Privacidade`). **Item 8 (the A/B) is task 4**: leave the call site of `filtrarComJev` ready for it, with no draw.
- The stdout of the hook must not change in any case (CA4; `npm run jev` T11 compares it byte by byte with `origin/dev`).
- `brain-mcp/scripts/telemetria.mjs`: cases `eventos` and `stdout` of spec `### brain-mcp/scripts/telemetria.mjs`, including the `prazo_hook` outcome with a never-resolving test `jev.js` in a temporary copy of the hooks (the fake `lento` does not reach the hook's deadline — the spec explains why).
- NOT here: the A/B (task 4), `poluicao`/`--custo`/`--conferir` (task 5), the painel.

## Verification

- Command(s) that must pass: `node brain-mcp/scripts/telemetria.mjs` (cases `gravador`, `eventos`, `stdout`; code 2 = "não medi" is red, find the cause); `cd brain-mcp && npm run jev` (T11–T16); `cd brain-mcp && npm run injecao -- --desde <d> --ate <d> --base origin/dev --portao jev` with `<d>` per the `Hook sem regressão` row of `## Plano de testes`.
- Acceptance criteria covered: CA1 (gravação do hook), CA4 parte 1, R1, R2.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Hook still CJS without dependency, `require('./telemetria.js')` only inside `try` and after the stdout; no unused variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #67` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
