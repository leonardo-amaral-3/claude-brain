✅ Status: Complete

# Task 5: Isolamento dos testes, custo (CA4) e conferência

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Card**: phase F1 of epic #66 is sub-issue **#67**. Commits carry `Card: #67`.
- **Premises this task leans on**: spec P6, P10, P15, P16; breakdown summary M8, M9.

The code lives in the worktree `/home/leo/pessoal/claude-brain-67-telemetria-saude` — **its own git repository** (branch `feat/67-telemetria-saude`); run every git command from inside it. Never touch the main checkout, the sibling worktrees or the live installation. No `npm ci`/`npm install`.

This is task 5 of 7. Tasks 1–4 (gravador, `jev` event, `contexto` event, A/B) are already in the codebase.

## Scope

- The one-by-one sweep of spec `### Isolamento dos testes (F1)`: `scripts/gm-spec-sensivel-teste.mjs`, `scripts/skills-comum-teste.mjs`, `scripts/classificar-parada-teste.mjs`, `brain-mcp/scripts/embeddings-falso.mjs` — change a child env only where the child can load `jev.js` or `brain-contexto.js` and inherit `BRAIN_TELEMETRIA*` (summary M9 has what was seen; confirm it, do not assume it); `scripts/prova-modelo.mjs` gets only the header line.
- `brain-mcp/scripts/telemetria.mjs`: case `poluicao`, mode `--custo` and mode `--conferir --dias N` of spec `### brain-mcp/scripts/telemetria.mjs`. `poluicao` must check the default `dirTelemetria` without writing to it itself; `--conferir` prints counts only (R1).
- NOT here: the painel (task 6), docs (task 7).

## Verification

- Command(s) that must pass: `node brain-mcp/scripts/telemetria.mjs` (all cases, `poluicao` included); `node brain-mcp/scripts/telemetria.mjs --custo` (both median differences ≤ 20 ms — record the numbers in the summary, they go to the PR); `node brain-mcp/scripts/telemetria.mjs --conferir --dias 1` runs and exits 0 or 2 with a reason (no live events exist yet, P8); every script touched by the sweep still passes (`node scripts/gm-spec-sensivel-teste.mjs`, `node scripts/skills-comum-teste.mjs`, `node scripts/classificar-parada-teste.mjs`).
- Acceptance criteria covered: CA4 parte 2, R4.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] `ls ~/.claude/brain-telemetria` after the whole run: still absent (or no line with a test `sessao`)
- [ ] No unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #67` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
