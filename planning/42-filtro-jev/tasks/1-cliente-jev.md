❌ Status: Not Started

# Task 1: O cliente do Jev — `hooks/jev.js` e a parte cliente do `jev.mjs`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/42-filtro-jev/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente e regras do lote**: [`README.md`](README.md) desta pasta — Node 22, `node_modules` já provido, só cliente falso, instalação viva só leitura.

Seções que governam esta task: `### Contrato do cliente do Jev (estável)` (inteira), `### hooks/jev.js — adaptador (interno; premissa A1)` e, de `### brain-mcp/scripts/jev.mjs`, o preâmbulo e a *Parte cliente*. Os casos T1–T10 estão na tabela do `## Plano de testes`. Premissas: P7 da spec e Q1 do README (o prazo é `AbortController` + `setTimeout`, nunca `AbortSignal.timeout`).

O contrato é lido pelos irmãos #41, #43, #44, #45 e #46: nomes, valores, motivos, ordem de decisão e formato da CLI saem **exatamente** como na spec. Qualquer item que pareça precisar mudar é emenda → PARADA.

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-42-filtro-jev` — **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/42-filtro-jev` (already checked out).

This is task 1 of 4. Nothing of the feature is in the codebase yet.

## Scope

- `hooks/jev.js` (**novo**, CommonJS sem dependência): o cabeçalho com o contrato, os tipos JSDoc, as constantes, `ligado`, `envSemJev`, `decidir`, `julgar`, o cliente falso (`sim`/`nao`/`indisponivel`/`lento`/roteiro), o adaptador real e a CLI.
- `brain-mcp/scripts/jev.mjs` (**novo**): o preâmbulo (env saneado, `fetch` global que lança, carga do cliente pela ordem de resolução do contrato, `fail` no padrão do `smoke.mjs`) e T1–T10, com `fetch` espião injetado por `opcoes.fetch`.
- `brain-mcp/package.json`: o script `"jev": "node scripts/jev.mjs"`.

NOT in scope: `hooks/brain-contexto.js` e T11–T16 (task 2) · `injecao.mjs` (task 3) · sync e docs (task 4) · qualquer coisa em `brain-mcp/src/` · chamar a API de verdade ou pôr chave em arquivo.

## Verification

- `cd brain-mcp && PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH npm run jev; echo $?` → `0`, com T1–T10 passando. A parte hook ainda não existe: o script termina depois de T10.
- `echo '{"op":"julgar","uso":"contexto","pergunta":"x","trechos":[{"id":"a","texto":"b"}]}' | env -u BRAIN_JEV node hooks/jev.js` → `{"ok":true,"resultado":[{"estado":"indisponivel","motivo":"desligado"}]}`.
- `grep -n "AbortSignal.timeout" hooks/jev.js` → nada.
- Acceptance criteria covered: **CA2** (inteiro), **CA4** (cliente: `fetch` só com uso + chave + falso indefinido; espião zero), a parte cliente do **CA3** (sem chave, `indisponivel`, `lento`/timeout).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Nenhuma função lança nem escreve em stdout/stderr, e carregar o módulo também não escreve (fora a CLI, que escreve só a linha do envelope)
- [ ] Code runs; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, files by name, message ending with the trailer `Card: #42` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
