✅ Status: Complete

# Task 2: `BRAIN_SOMENTE_CONSULTA` — o servidor que só consulta

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/18-eval-portao-uso-real/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `brain-mcp/` directory of the `claude-brain/` repository of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

**Onde rodar os comandos: na instalação, nunca no checkout.** Leia `## Execution` da spec. O ciclo é `./sync.ps1 push` no checkout, `npm run build` na instalação, e então o comando.

This is task 2 of 7. Task 1 is already in the codebase.

## Scope

`### Modo somente-consulta (src/index.ts)` da spec, inteira. A spec abre essa seção explicando **por que** a flag existe — sem ela os dois servidores do `--base` reindexam o snapshot por baixo da comparação — e registra que `BRAIN_LEASE_TTL_MS=0` faz o oposto do que se precisa aqui. Essa é a justificativa da decisão técnica 8; leia antes de editar.

- `src/index.ts` — os quatro pontos que a spec ancora por linha: pular eleição, pular trabalho pesado, pular o tique, e **manter `aquecer()`**. O `aquecer()` que fica não é descuido: o eval precisa da metade semântica.
- `src/tools.ts` — a tool `reindex` responde recusa explícita neste modo, em vez de promover o processo.

**Fora do escopo desta task:** qualquer script (`scripts/`), a coluna `semantica` (task 1, já feita), e `README.md`/`CLAUDE.md` — inclusive a menção a `BRAIN_SOMENTE_CONSULTA` no parágrafo de variáveis de ambiente, que é da task 7.

## Verification

- Command(s) that must pass, na instalação: `npm run concorrencia` e `npm run smoke`
- Caso novo em `scripts/concorrencia.mjs` (via `caso(nome, fn)`): com a flag ligada, a tabela `lider` fica vazia e nenhum arquivo é indexado; e o `reindex` recusa em vez de promover. O `ttl-zero-desliga-o-lease` (`concorrencia.mjs:322-347`) já existente é o caso que **prova** a afirmação em que esta flag se apoia — não o altere, use-o como referência de forma.
- Acceptance criteria covered: nenhum critério fecha aqui. É a infraestrutura sem a qual o `--base` do CA3 não fecha (decisão técnica 8) e a linha `modo somente-consulta não varre` do plano de testes.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside `claude-brain/`, message ending with the trailer `Card: #18` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
