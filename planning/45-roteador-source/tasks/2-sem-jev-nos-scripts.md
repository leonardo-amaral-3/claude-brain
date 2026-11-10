❌ Status: Not Started

# Task 2: `scripts/sem-jev.mjs` e a limpeza do Jev nos filhos (A8)

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/45-roteador-source/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente e regras do lote**: [`README.md`](README.md) desta pasta — Node 22, `N22`/`VIVO`, smoke vermelho conhecido (G2-F), instalação viva só leitura.

Seções que governam esta task: `### brain-mcp/scripts/sem-jev.mjs (novo) e os três scripts que sobem o servidor (A8)` (inteira, com a tabela e a fixture das guardas), o critério **A8**, o item **C6** e TD-11. Premissas: P6, P17, P18 e P19 da spec, e Q5 e Q7 do README.

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-45-roteador-source` — **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/45-roteador-source` (already checked out by `/gm-implement`).

This is task 2 of 5. Task 1 (ambiente provido, portão de entrada, a T0 do golden) is already in the codebase.

## Scope

- `brain-mcp/scripts/sem-jev.mjs` (**novo**): `semJev(raiz)`, com a resolução do C1 para scripts e o `envSemJev` do cliente.
- `brain-mcp/scripts/eval.mjs`, `smoke.mjs` e `concorrencia.mjs`: a chamada e o tratamento "sem cliente" no lugar que a tabela da spec dá a cada um. No `eval.mjs`, **dentro** de `main` (o #46 importa o módulo, P19).
- `brain-mcp/scripts/concorrencia.mjs`: a fixture das guardas (`criarInstalacao` copia `sem-jev.mjs`; `montarGuardas` põe o `jev.js` no `claude-home` dela), sem mudar a expectativa dos quatro casos de guarda.

NOT in scope: `src/` (tasks 3 e 4) · os casos `filhos-sem-jev`, `semJev-limpa` e `semJev-sem-cliente` da suíte, que nascem com o `scripts/roteador.mjs` na task 3 · qualquer outra mudança nos `...process.env` dos spawns · copiar a lógica de `envSemJev` (TD-11: descartado) · o vermelho do smoke (G2-F).

## Verification

- `cd brain-mcp && N22 npm run build && N22 npm run concorrencia; echo $?` → `0`, com os quatro casos de guarda do eval copiado passando sem mudar de expectativa.
- `N22 VIVO npm run eval -- --base origin/dev; echo $?` → `0`, com `Nenhum caso mudou de posição.`.
- `N22 VIVO npm run smoke; echo $?` → `1` **só** com `FALHOU: feature_timeline sem documentos` (G2-F), depois de passar pelo `search_context`. Um `FALHOU: cliente do Jev não encontrado…` é vermelho desta task.
- Acceptance criteria covered: **A8** (a parte de código; a prova na suíte vem na task 3).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green (o smoke, só com o vermelho do G2-F)
- [ ] `eval.mjs` não mexe em `process.env` no carregamento do módulo
- [ ] Code runs; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, files by name, message ending with the trailer `Card: #45` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
