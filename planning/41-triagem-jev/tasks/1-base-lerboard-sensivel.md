✅ Status: Complete

# Task 1: Base do script — constantes, `lerBoard`, `sensivel` e o esqueleto do teste

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/41-triagem-jev/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente, pilha, commits e regras do lote**: [`README.md`](README.md) desta pasta. Ele diz como commitar a spec e esta pasta (commit `docs(planning)` próprio, feito por esta task), que o teste não precisa de `npm` e que a instalação viva é só leitura.

Seções da spec que governam esta task: `### Script: skills/gm-triage/jev-triagem.mjs` (o preâmbulo: só módulos `node:` e a lista do que não importa; o bloco de constantes; `semPrefixo` e a descrição de um rótulo; `normalizar`; `lerBoard`; `sensivel`), `### Teste: scripts/gm-triage-jev-teste.mjs` (o molde `afirmar`, o preâmbulo com `envSemJev` e o `fetch` que lança) e `## Coding Standards`. Premissas: as linhas de `## Premissas medidas` sobre o formato do `## Board` (cinco campos, Status fora), os rótulos sem U+FE0F, `node` v26 e o teste como script avulso, e o ponto flutuante; do README, Q1, Q2 e Q4.

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-41-triagem-jev`, **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/41-triagem-jev` (already checked out).

This is task 1 of 5. Nothing of the feature is in the codebase yet; `hooks/jev.js` (from #42) already is.

## Scope

- `skills/gm-triage/jev-triagem.mjs` (**novo**): as constantes exportadas (`USO`, `CAMPOS`, `LIMIAR_PCT`, `PRAZO_MS`, `FOLGA_MS`, `MAX_RESUMO`, `INSTRUCOES`, `DESCRICOES`), `semPrefixo` e a descrição de um rótulo, `normalizar`, `lerBoard` e `sensivel`. Ainda sem `sugerir`, `renderizar`, `principal`, `carregarCliente` nem o bloco de execução.
- `scripts/gm-triage-jev-teste.mjs` (**novo**): o preâmbulo inteiro da spec (`envSemJev` de `<repo>/hooks/jev.js` com a mensagem `FALHOU: …` e o código 1 quando falta; `process.env` saneado; `globalThis.fetch` que lança) e os blocos:
  - R3: `lerBoard` do `CLAUDE.md` do repo, e a mesma fixture com CRLF, com BOM e com "Módulo" em NFD;
  - os padrões de `sensivel`, chamando `sensivel` direto: a lista "casam" e a lista "não casam" da linha de resumo do R2 no `## Plano de testes`. O "falhou, sem `decidir`" dessa linha é da task 2;
  - R2 estático: o arquivo não contém `child_process`, `node:http`, `node:https`, `node:net`, `node:tls` nem `fetch(`.
- O commit `docs(planning)` com `planning/41-triagem-jev/spec.md` e `planning/41-triagem-jev/tasks/`, antes do commit de código (README, `## Commits`).

NOT in scope: `sugerir`/`renderizar` (task 2) · `principal` e `carregarCliente` (task 3) · o bloco de execução e qualquer `spawnSync` (task 4) · `SKILL.md` e `CLAUDE.md` (task 5) · tocar `hooks/jev.js` ou `planning/42-filtro-jev/`.

## Verification

- `node scripts/gm-triage-jev-teste.mjs; echo $?` → `0`, com os blocos acima passando.
- `node -e 'import("./skills/gm-triage/jev-triagem.mjs").then(m => console.log(Object.keys(m).sort().join(",")))'` → lista as constantes, `lerBoard`, `normalizar` e `sensivel`, sem lançar.
- Acceptance criteria covered: **R3** (a leitura do `## Board`; a ponta "opções enviadas ao Jev = `lerBoard`" fecha na task 2) e a guarda do resumo que sustenta o R2 e o recorte sem dado sensível.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Fixtures com ids inventados; nenhum dado nem nome real (repo público)
- [ ] Code runs; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree: first the `docs(planning)` commit, then the code commit, files by name, each message ending with the trailer `Card: #41` and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
