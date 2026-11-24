❌ Status: Not Started

# Task 3: Seção `Gabarito` (`prova.secao`) e a concordância com o aproveitamento

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- Card: phase #69 (F3) of epic #66 (see its `<!-- gm:spec-ref -->` comment). Decision #3426: F3 uses F2 **only** through `ctx.carregarSecao('ganho')`, never by import, so the tests do not depend on merge order.
- Sections that bind this task: `### painel/prova.mjs — o gabarito, CA5` (item *Seção `Gabarito`*), `### painel/ganho.mjs` (only the contract of `medirAproveitamento`: key `` `${sessao}|${prompt ?? 'ts:' + ts}` `` and the `Medida` shape), `### brain-mcp/scripts/painel.mjs` (`ctx.lerEventos`, `ctx.carregarSecao`, interface `secao(ctx) → string`), R1 in `## Requisitos & critérios de aceite`, `## Plano de testes` linha CA5.

The code lives in the `claude-brain/` repo (this worktree, `/home/leo/pessoal/claude-brain-69-telemetria-gabarito`) — **its own git repository**; run every git command from inside it. Work happens on `feat/69-telemetria-gabarito` (already checked out by `/gm-implement`).

This is task 3 of 3. Tasks 1-2 are already in the codebase (`prova.mjs` with `amostrar` and `julgar`, fixtures, `painel-prova-teste.mjs`).

## Scope

- Replace the `secao(ctx)` stub in `brain-mcp/scripts/painel/prova.mjs` with the spec's section. It reads every `gabarito/amostra-*.jsonl` under `ctx.dir`, with no period filter. On the judged items it computes:
  - TP/FP/FN/TN, precisão, cobertura and acurácia at the recorded limiar;
  - the table for 0,3 · 0,4 · 0,5 · 0,6 · 0,7;
  - the concordância when `ctx.carregarSecao('ganho')` returns a module exporting `medirAproveitamento`, else the F2 line;
  - the empty-gabarito line.
- Add the `secao` cases to `painel-prova-teste.mjs`. Use a gabarito fixture with known judgments and expected numbers. Use a test `carregarSecao` that returns a module with `medirAproveitamento` (concordância shown, and `lerEventos` called with the `±60000` window) and one that returns `null` (F2 line). Assert the output holds no path and no pergunta of the fixture.
- NOT in scope: `ganho.mjs` or any file of F1/F2, `docs/telemetria.md` (F1), changing a limiar of the Jev (the table only shows).

## Verification

- `node brain-mcp/scripts/painel-prova-teste.mjs` → code 0 with all CA5 cases of `## Plano de testes` (the ones from tasks 1-2 plus these).
- `node -e "import('./brain-mcp/scripts/painel/prova.mjs').then(m => console.log(typeof m.secao, typeof m.amostrar, typeof m.julgar))"` → `function function function` (the interface the F1 agregador imports).
- Acceptance criterion covered: CA5 (closes it; the live part is the G5 of F3).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code loads; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #69`. Put that commit to the human as a choice (*ação irreversível*), never as consent to be typed. Dispatched mode decides it with the verification green.
4. Flip the first line of this file to `✅ Status: Complete`.
