✅ Status: Complete

# Task 5: README e o portão final

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/45-roteador-source/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente e regras do lote**: [`README.md`](README.md) desta pasta — Node 22, `N22`/`VIVO`, smoke vermelho conhecido (G2-F).

Seções que governam esta task: `### brain-mcp/README.md` (a lista do que a subseção diz e as duas entradas a mais), `## Plano de testes` (o portão inteiro), `## Rollback` e `## Verificação pós-deploy` (o que o README resume, sem executar). Também `## A esteira` do `CLAUDE.md` do repo, regra 2. Premissas: P9 e P10 da spec (o aviso do B1).

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-45-roteador-source` — **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/45-roteador-source` (already checked out by `/gm-implement`).

This is task 5 of 5. Tasks 1–4 (a T0 do golden, `sem-jev.mjs`, `src/roteador.ts`, o handler e a suíte inteira) are already in the codebase.

## Scope

- `brain-mcp/README.md`: a subseção `### Roteador de source` dentro de `## Qualidade da busca`, depois do parágrafo da tabela `uso`, e `npm run roteador` em `## Comandos`. O parágrafo do Jev que o #42 escreveu é apontado, não repetido.
- `README.md` (raiz): `roteador` na linha dos scripts de `brain-mcp/scripts/`, a mesma que já tem `jev`.
- O portão inteiro do `## Plano de testes`, rodado de novo no estado final.

NOT in scope: código (`src/`, `scripts/`) · o B1 e qualquer comando com a chave (G2-E: sem comando nesta PR) · a verificação pós-deploy (depois do `sync.sh push`, que é do Leonardo) · `sync.sh`/`sync.ps1` (`hooks/` não muda) · o vermelho do smoke (G2-F).

## Verification

Dentro de `brain-mcp/`, todos com `N22` (e `VIVO` em `smoke` e `eval`):
- `npm run build` → `0`;
- `npm run roteador` → `0`;
- `npm run concorrencia` → `0`;
- `npm run eval -- --base origin/dev` → `0` com `Nenhum caso mudou de posição.`, e o mesmo com `BRAIN_JEV=roteador BRAIN_JEV_FALSO=sim` na frente;
- `npm run smoke` → `1` **só** com `FALHOU: feature_timeline sem documentos` (G2-F). Este vermelho não bloqueia o commit desta task, mas **bloqueia a PR** pela regra 2 da esteira: o resumo diz isso, e quem para é o `/gm-ship`.
- `grep -n "Roteador de source" brain-mcp/README.md` e `grep -n "roteador" README.md` acham as entradas.
- Acceptance criteria covered: o portão do grupo A inteiro (A1–A8) no estado final. O grupo B fica fora (depende do aval do Leonardo e do G2-E).

## Completion Checklist

- [ ] Everything in scope written per the spec
- [ ] Verification command(s) green (o smoke, só com o vermelho do G2-F)
- [ ] O README não traz dado nem nome de cliente (repo público)

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first (cada comando do portão com o código de saída, e o G2-F nomeado como o que trava a PR), then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, files by name, message ending with the trailer `Card: #45` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
