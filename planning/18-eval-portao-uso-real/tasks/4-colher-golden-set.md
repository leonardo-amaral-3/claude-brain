❌ Status: Not Started

# Task 4: `colher-golden.mjs` e o golden set derivado do uso real

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/18-eval-portao-uso-real/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `brain-mcp/` directory of the `claude-brain/` repository of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

**Onde rodar os comandos: na instalação, nunca no checkout.** Leia `## Execution` da spec. A colheita lê a tabela `uso` e revalida os alvos contra `docs` — as duas coisas só existem no banco da instalação.

This is task 4 of 7. Tasks 1..3 are already in the codebase.

## Scope

`### scripts/colher-golden.mjs (novo)` e `### scripts/golden.json — formato novo` da spec, mais o script `colher` no `package.json`.

Esta task não termina no código: ela **entrega o golden set**. Isso quer dizer rodar a colheita de verdade contra a instalação e, além do que ela produz, escrever à mão os casos que a spec diz que não saem do uso — os `source: code` (que apontam para o próprio `brain-mcp`, e a spec explica por quê) e os **dois** negativos, um estrutural e um de assunto ausente com `"volatil": true`.

Três pontos da spec com o porquê escrito lá, e que é caro descobrir sozinho: a janela de 90 s é escolha medida (a curva e a razão estão na spec), os filtros originais entram no caso porque 47 das 75 queries usavam algum, e `esperado` guarda só os **dois últimos segmentos** do caminho — caminho absoluto de máquina não entra em arquivo versionado.

A regra de preservação é critério de aceite, não detalhe: casos `origem: "manual"` sobrevivem intactos a toda recolheita, e os 10 casos de hoje são remarcados `manual` na primeira execução.

**Fora do escopo desta task:** `eval.mjs` (tasks 5 e 6) — inclusive a leitura do formato novo, que é lá. E `README.md`/`CLAUDE.md`, inclusive a entrada de `npm run colher` no bloco de comandos, que é da task 7.

## Verification

- Command(s) that must pass, na instalação: `npm run concorrencia`; e `npm run colher` real, rendendo **≥ 60 casos** com a cobertura que o CA2 exige
- Casos novos em `scripts/concorrencia.mjs` (via `caso(nome, fn)`), sobre fixture de `uso` semeada: par válido dentro da janela, par a 91 s (descartado), query repetida (dedup, vence a primeira), alvo fora de `docs` (descartado com aviso); e `colher` rodado duas vezes deixando os casos `manual` idênticos.
- A asserção de cobertura mora **dentro do próprio `colher`** (≥ 60, ≥ 1 `source: code`, ≥ 1 `repo: operations-center`, 2 negativos) e faz o script falhar ruidosamente — não é verificação manual.
- Acceptance criteria covered: **CA2 inteiro**.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside `claude-brain/`, message ending with the trailer `Card: #18` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
