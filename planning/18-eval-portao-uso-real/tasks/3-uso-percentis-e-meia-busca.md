✅ Status: Complete

# Task 3: `uso.mjs` — percentil de verdade e a fração de meia-busca

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/18-eval-portao-uso-real/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `brain-mcp/` directory of the `claude-brain/` repository of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

**Onde rodar os comandos: na instalação, nunca no checkout.** Leia `## Execution` da spec. O ciclo é `./sync.ps1 push` no checkout, `npm run build` na instalação, e então o comando. `scripts/uso.mjs` não passa pelo `dist/`, mas o banco que ele lê só existe lá.

This is task 3 of 7. Tasks 1..2 are already in the codebase.

## Scope

`### scripts/uso.mjs` da spec, inteira: banco por `BRAIN_DB` com fallback, percentis calculados sobre o vetor ordenado em memória, cabeçalho novo, e a coluna `só-léxico`.

Dois pontos da spec que são armadilha e estão escritos lá com o porquê: o denominador tem de ser `COUNT(semantica)` e não `COUNT(semantica IS NOT NULL)` (o segundo não descarta nada e dilui a fração, violando o próprio CA1), e o `—` quando o denominador é nulo.

Leia também o aviso do CA1 sobre os números absolutos: **todo número desta spec sobre a tabela `uso` é fotografia, não contrato.** Nenhum teste e nenhuma verificação compara com um literal — o que vale é a relação.

**Fora do escopo desta task:** a coluna `semantica` em si (task 1, já feita), `colher-golden.mjs`, `eval.mjs`, e `README.md`/`CLAUDE.md`.

## Verification

- Command(s) that must pass, na instalação: `npm run concorrencia`; e `npm run uso` rodando contra o banco da instalação sem quebrar, imprimindo a coluna `só-léxico`
- Casos novos em `scripts/concorrencia.mjs` (via `caso(nome, fn)`):
  - percentil bate com o vetor ordenado, sobre fixture com `uso` semeado — com contagem **ímpar**, **par** e **só-`NULL`** na coluna `semantica`
  - relatório não quebra com banco pré-migração (fixture cujo `uso` não tem a coluna → abre, migra, imprime)
- Acceptance criteria covered: **CA1 inteiro** (p50 real, coluna p90, fração de meia-busca, e as linhas `NULL` fora do denominador).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside `claude-brain/`, message ending with the trailer `Card: #18` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
