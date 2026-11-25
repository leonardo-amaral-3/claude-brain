✅ Status: Complete

# Task 1 (a T0 da spec): troca o negativo volátil que apodreceu no golden

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/45-roteador-source/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente e regras do lote**: [`README.md`](README.md) desta pasta — Node 22, `N22`/`VIVO`, instalação viva só leitura, smoke vermelho conhecido (G2-F), escopo do `lembrar`.

Seções que governam esta task: `## Execution` (o rebase, o **portão de entrada** e o **Ambiente**), `### brain-mcp/scripts/golden.json (task T0, condicional)` e TD-8. Premissas: P7, P8 e P23 da spec, e Q1, Q2, Q4 e Q6 do README.

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-45-roteador-source` — **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/45-roteador-source` (already checked out by `/gm-implement`, already containing the tip of `feat/42-filtro-jev`, Q1).

This is task 1 of 5. Nothing of the feature is in the codebase yet. A spec e estas tasks ainda não estão commitadas.

**Esta task é autocontida:** o commit dela não leva nada que dependa do cliente do Jev nem do roteador, porque o #46 empilha sobre ele. O portão de entrada roda aqui só porque o `## Execution` o põe antes de qualquer implementação; ele não acrescenta nada ao commit.

## Scope

1. **Ambiente**: os passos 1–3 do `## Execution` › *Ambiente*, dentro de `brain-mcp/` (`npm ci`, cópia do cache do modelo, `npm run build`). Falha aqui → `PARADA: ambiente`, com a saída.
2. **Portão de entrada**: conferir C1–C6 de `## Implementation Details` › *O que o #45 usa do contrato do #42* lendo `hooks/jev.js`, e rodar `N22 npm run jev`. Os códigos `0`/`2`/`1` têm o tratamento que o `## Execution` dá. Nunca escrever um segundo cliente nem mexer no `jev.js`.
3. **A decisão da T0**: com o head igual à base (nenhum código do #45), rodar `N22 VIVO npm run eval -- --base origin/dev`.
   - Saída com `[apodreceu]` no caso `"GetIndicadoresController getFalhasPorSetor limitMetricItems"` → a T0 existe: trocar o caso pelo da spec, no mesmo lugar da lista, e conferir no índice vivo (`readOnly`) que `extractor` tem `0` docs. Mais que `0` → `PARADA` (escolher outro repo é decisão nova).
   - Caso ausente, ou eval `0` sem esse `[apodreceu]` → a T0 não existe. Registre isso e não toque no golden.
   - Eval `2` por outro motivo, ou `1` → `PARADA`, com a saída.
4. **Commits** (dois, nesta ordem):
   - `docs(planning): spec e tasks do #45`, com `planning/45-roteador-source/` inteira (o `## Execution` manda a spec no primeiro commit);
   - só se a T0 existir: `test(eval): troca o negativo volátil que apodreceu`, **só** com `brain-mcp/scripts/golden.json`.
   O hash do segundo (ou o do primeiro, se a T0 não existir) vai no resumo: é a base do #46 (cofre #1457).

NOT in scope: qualquer arquivo de `brain-mcp/src/` ou dos scripts `eval`/`smoke`/`concorrencia` (tasks 2–4) · o `smoke.mjs` e o vermelho dele (G2-F; ver o README; ele **não bloqueia** este commit, só a PR) · a segunda forma do eval do A1 (com `BRAIN_JEV=roteador`), que só prova algo depois da task 2 · recolher o golden (#22).

## Verification

- `N22 npm run jev; echo $?` → `0` (portão de entrada).
- Depois da troca: `N22 VIVO npm run eval -- --base origin/dev; echo $?` → `0`, com `Nenhum caso mudou de posição.`, como na P8. (Se a T0 não existir, o mesmo comando já deu `0` no passo 3.)
- `git show --stat HEAD` do commit da T0 → só `brain-mcp/scripts/golden.json`.
- Acceptance criteria covered: pré-condição do **A1** (TD-8: sem a T0, o A1 é inalcançável).

## Completion Checklist

- [ ] Ambiente provido; `brain-mcp/node_modules` não versionado (confira o `git status`)
- [ ] C1–C6 conferidos no `hooks/jev.js` e `npm run jev` com `0`
- [ ] T0 decidida pela saída do eval, e aplicada ou registrada como inexistente
- [ ] Eval com código `0`
- [ ] Os commits como no Scope, com o hash para o #46 no resumo

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first (os códigos de saída do `jev` e do eval, e a linha do `[apodreceu]` se houve), then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, files by name, messages ending with the trailer `Card: #45` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
