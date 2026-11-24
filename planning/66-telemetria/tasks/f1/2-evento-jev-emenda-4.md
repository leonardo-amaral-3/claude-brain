✅ Status: Complete

# Task 2: Evento `jev` no `hooks/jev.js` (Emenda 4 do contrato do #42)

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). The event contract (`### Contrato do evento`) is shared with phases F2 (#68) and F3 (#69): never change it without an amendment.
- **Contract being amended**: `planning/42-filtro-jev/spec.md` § *Contrato do cliente do Jev (estável)* — the guarantees there (nothing on stdout/stderr, never throws, resolves within `timeoutMs` + 50 ms) must still hold.
- **Card**: phase F1 of epic #66 is sub-issue **#67**. Commits carry `Card: #67`.
- **Premises this task leans on**: spec P2, P3, P9, P10; breakdown summary M2, M5.

The code lives in the worktree `/home/leo/pessoal/claude-brain-67-telemetria-saude` — **its own git repository** (branch `feat/67-telemetria-saude`); run every git command from inside it. Never touch the main checkout, the sibling worktrees or the live installation. No `npm ci`/`npm install`.

This is task 2 of 7. Task 1 (`hooks/telemetria.js`, the `telemetria.mjs` skeleton) is already in the codebase.

## Scope

- `hooks/jev.js`: everything in spec `### Emenda 4 do contrato do Jev (F1)` › *Implementação* — the `jev` event per call (table `Evento jev` of `### Contrato do evento`, `sessao`/`prompt` per `### De onde vêm a sessão e o prompt`), `opcoes.telemetria`, `envSemJev` dropping `BRAIN_TELEMETRIA*`, `usage` from the adapter feeding `tokens`, the CLI passing `telemetria`, and the header blocks *Ambiente*, *Funções* and *Garantias* (spec `### Docs e sincronia`).
- `planning/42-filtro-jev/spec.md`: the Emenda 4 text, verbatim from the spec, after Emenda 3 (`:328`).
- `brain-mcp/scripts/jev.mjs`: the new case of the `Contrato do Jev intacto` row of `## Plano de testes` (with a temporary `BRAIN_TELEMETRIA_DIR` and the fake: one line per `julgar`/`decidir`, result identical to without telemetry; `desligado` writes nothing; `envSemJev` drops `BRAIN_TELEMETRIA` and `BRAIN_TELEMETRIA_DIR`). T1–T16 keep passing.
- NOT here: `brain-contexto.js` (it passes `opcoes.telemetria` in task 3), `roteador.ts`/`juizJev.ts` (no change, per the spec), the scripts of the isolation sweep (task 5).

## Verification

- Command(s) that must pass: `cd brain-mcp && npm run jev`; `node scripts/classificar-parada-teste.mjs` (required by `CLAUDE.md` when `hooks/jev.js` changes); `node scripts/gm-triage-jev-teste.mjs`; `node brain-mcp/scripts/telemetria.mjs` still 0.
- Acceptance criteria covered: CA1 (gravação do lado do Jev), R2, R4 (Emenda 4c).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] `node -e "require('./hooks/jev.js')"` prints nothing; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #67` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
