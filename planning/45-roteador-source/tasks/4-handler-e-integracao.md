✅ Status: Complete

# Task 4: o handler do `search_context` chama `rotear`, a linha de boot e os casos de integração

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/45-roteador-source/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente e regras do lote**: [`README.md`](README.md) desta pasta — Node 22, `N22`/`VIVO`, smoke vermelho conhecido (G2-F), nada chama a API do Jev.

Seções que governam esta task: `### brain-mcp/src/tools.ts`, `### brain-mcp/src/index.ts`, o trecho de integração de `### brain-mcp/scripts/roteador.mjs (novo) e package.json` (servidor em processo, banco temporário, stubs, buscador sempre falso), os critérios **A1**, **A3**, **A4b**, **A5** e **A6**, e TD-2 e TD-6. Premissas: P1, P4, P5, P13 e P24 da spec.

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-45-roteador-source` — **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/45-roteador-source` (already checked out by `/gm-implement`).

This is task 4 of 5. Tasks 1–3 (a T0 do golden, `sem-jev.mjs` nos scripts, `src/roteador.ts` e a suíte de unidade) are already in the codebase.

## Scope

- `brain-mcp/src/tools.ts`: o parâmetro opcional `roteador` de `registerTools`, o objeto de filtros novo, a chamada a `rotear` e o rodapé quando `roteado`. `inputSchema`, `text()`, o wrapper de `uso` e as outras tools não mudam.
- `brain-mcp/src/index.ts`: só a linha de boot no stderr. A chamada de `registerTools` não muda.
- `brain-mcp/scripts/roteador.mjs`: os casos de integração do `## Plano de testes` (`desligado-nao-carrega`, `desligado-byte-a-byte`, `desligado-igual-a-sem-chave`, `rodape-quando-roteado`, `ponta-a-ponta-falso`, `query-vazia-nao-consulta`, `superficie-intacta`, `uso-grava-args-como-vieram`).

NOT in scope: `src/config.ts` (não muda, TD-2) · `src/db.ts` e a tabela `uso` (A5: o diff de `db.ts` vem vazio) · README (task 5) · campo novo no `_meta` ou parâmetro novo na tool (levaria à Rota Completa) · o vermelho do smoke (G2-F).

## Verification

- `cd brain-mcp && N22 npm run build && N22 npm run roteador; echo $?` → `0`, com os casos das tasks 3 e 4 e o `nenhum-fetch` com zero chamadas.
- `N22 VIVO npm run eval -- --base origin/dev; echo $?` → `0` com `Nenhum caso mudou de posição.`, e o mesmo com `BRAIN_JEV=roteador BRAIN_JEV_FALSO=sim` na frente (a segunda forma do A1, prova adicional do A8). Se algum caso mudar de posição, **não** tente atribuir a mudança: `PARADA`, nomeando os casos (A1).
- `N22 npm run concorrencia; echo $?` → `0`.
- `N22 VIVO npm run smoke; echo $?` → `1` **só** com `FALHOU: feature_timeline sem documentos` (G2-F), depois de passar pelo `search_context`.
- `git diff --stat origin/dev...HEAD -- brain-mcp/src/db.ts` → vazio.
- Acceptance criteria covered: **A1** (inteiro, com o eval), **A3**, **A4b**, **A5** e **A6** (integração), e o `ponta-a-ponta-falso` do **A7**.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green (o smoke, só com o vermelho do G2-F)
- [ ] Com `roteado === null`, o texto do `search_context` é byte a byte o de hoje
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, files by name, message ending with the trailer `Card: #45` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
