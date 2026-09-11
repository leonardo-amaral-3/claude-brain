✅ Status: Complete

# Task 1: Migração da coluna `semantica` e o canal `_meta.brain`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/18-eval-portao-uso-real/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `brain-mcp/` directory of the `claude-brain/` repository of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

**Onde rodar os comandos: na instalação, nunca no checkout.** Leia `## Execution` da spec antes de rodar qualquer coisa — são duas medições, não preferência: o cache do modelo de embeddings (477 MB) e o `brain.db` só existem lá, e a worktree nasce sem `node_modules`. O ciclo é `./sync.ps1 push` no checkout, `npm run build` na instalação, e então o comando.

This is task 1 of 7. Nothing from this card is in the codebase yet.

## Scope

As duas primeiras peças da `## Technical Overview` da spec, que são uma só coisa: a coluna nova e quem a escreve.

- `src/db.ts` — a migração descrita em `### Migração (src/db.ts)`. Respeite o ponto de inserção que a spec ancora (depois da linha 148, antes do `return db;` — dentro do template literal é texto, não código) e a guarda de concorrência.
- `src/tools.ts` — `### Canal de diagnóstico (src/tools.ts)`: o segundo parâmetro de `text()`, o `_meta.brain` no retorno do `search_context`, o caminho do `Nenhum resultado…` carregando o diagnóstico, e o `registerTool` gravando a coluna.

A spec nomeia explicitamente duas alternativas **proibidas** (regex no rodapé, variável de módulo entre handler e wrapper) e a única saída que legitimamente não carrega `_meta.brain`. Leia essa seção inteira antes de editar.

**Fora do escopo desta task:** `scripts/uso.mjs` (task 3, é quem *lê* a coluna), `BRAIN_SOMENTE_CONSULTA` (task 2), qualquer script de eval ou colheita, e `README.md`/`CLAUDE.md` (task 7). Nada em `src/search.ts` — a spec registra que o `diag` já existe e já é devolvido.

## Verification

- Command(s) that must pass, na instalação: `npm run concorrencia` e `npm run smoke`
- Casos novos em `scripts/concorrencia.mjs` (via `caso(nome, fn)`, sem tocar o runner — os encaixes estão no fim do `## Plano de testes` da spec):
  - banco pré-migração (fixture com `uso` sem a coluna) abre, migra e segue
  - busca que não casa nada → linha com `vazio = 1` e `semantica` **preenchida**, não `NULL`
  - `Query vazia` → `semantica` `NULL`
- Acceptance criteria covered: infraestrutura de CA1 (a coluna e o sinal) e a metade de CA3 que depende de `_meta.brain` existir. Os critérios fecham nas tasks 3, 5 e 6.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside `claude-brain/`, message ending with the trailer `Card: #18` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
