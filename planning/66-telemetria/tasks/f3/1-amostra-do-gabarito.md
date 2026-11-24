✅ Status: Complete

# Task 1: Amostra do gabarito (`prova.amostrar`), fixtures e o teste

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- Card: phase #69 (F3) of epic #66. Its `<!-- gm:spec-ref -->` comment lists the spec sections this phase covers and what is out of scope (gravador, eventos, agregador → F1 #67; `medirAproveitamento`, seção Ganho → F2 #68).
- Sections that bind this task: `### painel/prova.mjs — o gabarito, CA5` (arquivo de amostra, `amostrar`), `### Contrato do evento` (evento `contexto`, campos `itens[].chunk`/`trecho_sha`/`prob`/`pos`, `limiar`, `jev`, `ws`), `### Privacidade` (a cópia deliberada de texto), `### painel/ganho.mjs` passos 1-2 (regra da *entrada de prompt*, que a F3 reimplementa sem importar da F2), `### brain-mcp/scripts/painel.mjs` (forma do `ctx` e o retorno `{ codigo, linhas }`), `## Plano de testes` linha CA5, `## Coding Standards`.
- Premises measured in the breakdown (2026-11-24, see the `[despacho]` comment of `/gm-plan-tasks` on card #69): M1 `full_text` do candidato é `chunks.text` (`brain-mcp/src/search.ts:170`, `:213`), então o SHA-256 de `chunks.text` é o `trecho_sha` gravado; M2 o índice vivo abre com `node:sqlite` `readOnly` e `chunks × docs.path` acha o chunk pelo SHA; M4 o `painel.mjs` da F1 não existe nesta branch: o teste monta o `ctx` na mão; M5 `--ws` (lacuna, ver Scope).

The code lives in the `claude-brain/` repo (this worktree, `/home/leo/pessoal/claude-brain-69-telemetria-gabarito`) — **its own git repository**; run every git command from inside it. Work happens on `feat/69-telemetria-gabarito` (already checked out by `/gm-implement`).

This is task 1 of 3. No earlier task.

## Scope

- New `brain-mcp/scripts/painel/prova.mjs` exporting `amostrar(ctx, n, semente)` per the spec, plus stubs for `secao(ctx)` and `julgar(ctx, arquivo)` that tasks 3 and 2 fill in. A stub `secao` returns a placeholder line and must not throw.
- The `--ws <nome>` restriction: read it from `ctx.args` (tolerant: absent → no filter). The F1 parser in `painel.mjs` (spec `:281`) does not list `--ws`. Exposing it on the CLI is F1's job, not this task's. Do not touch `painel.mjs`.
- New `brain-mcp/scripts/fixtures/telemetria/prova/`: event JSONL and synthetic transcripts. The chunk database is built by the test in a temp dir with the minimal `docs`/`chunks` schema, never the live index.
- New `brain-mcp/scripts/painel-prova-teste.mjs` (codes 0/1/2 like the repo's scripts), with the `amostrar` cases of the CA5 line. Everything is written under `os.tmpdir()`, never under `~/.claude/brain-telemetria`.
- NOT in scope: `julgar` (task 2), the `Gabarito` section and the concordância (task 3), any file of F1/F2, `brain-mcp/src/`, `package.json`.

## Verification

- `node brain-mcp/scripts/painel-prova-teste.mjs` → code 0. Covers: fixed seed → same items; strata (ceil half ≥ limiar); no repeated (`sessao`, `prompt`, `pos`); no item without pergunta; `pergunta` ≤ 500 and `trecho` ≤ 600; an item whose `trecho_sha` matches no chunk is discarded; the chunk found by path when the id changed; `chunk` null outside the universe; empty universe or `ctx.db` null → code 2; `--ws` filters; the lines hold no path and no pergunta.
- Acceptance criterion covered: the `amostrar` part of CA5.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code loads (`node -e "import('./brain-mcp/scripts/painel/prova.mjs')"`); no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #69`. Put that commit to the human as a choice (*ação irreversível*), never as consent to be typed. Dispatched mode decides it with the verification green.
4. Flip the first line of this file to `✅ Status: Complete`.
