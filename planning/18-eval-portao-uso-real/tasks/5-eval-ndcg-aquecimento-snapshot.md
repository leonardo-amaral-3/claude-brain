❌ Status: Not Started

# Task 5: `eval.mjs` — nDCG@5, aquecimento, rodada invalidável, sobre snapshot

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/18-eval-portao-uso-real/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `brain-mcp/` directory of the `claude-brain/` repository of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

**Onde rodar os comandos: na instalação, nunca no checkout.** Leia `## Execution` da spec — aqui isso é mais do que conveniência: sem o cache do modelo, que só existe na instalação, o aquecimento desta task nunca fecha e toda rodada sai com código `2` por download.

This is task 5 of 7. Tasks 1..4 are already in the codebase — a coluna, o canal `_meta.brain`, o modo somente-consulta e o golden set no formato novo.

## Scope

Duas seções da spec: `### scripts/eval.mjs — a métrica` e `### scripts/eval.mjs — aquecimento e validade`, mais o **snapshot**, que é o primeiro item numerado de `### scripts/eval.mjs — o --base <ref>` e que a spec manda rodar **sempre, com ou sem `--base`**.

O que entra:

- nDCG@5 com relevância binária como métrica do portão; `hit@1`, `hit@5` e `MRR` continuam impressos como secundários.
- Os filtros do caso repassados à busca, e `limit: 5` fixo em todos os casos — a spec explica por que o limite não herda o da chamada original.
- Negativos, e a distinção entre negativo satisfeito e negativo **apodrecido** (`volatil`).
- O laço de aquecimento e as duas regras de invalidação. `_meta.brain` ausente num caso é código `2`, **nunca** `semantica === false` — a spec é explícita nessa distinção.
- A tabela de códigos de saída `0`/`1`/`2`, com o `1` ainda sem uso nesta task (nasce na 6).
- O snapshot por `VACUUM INTO` em diretório de `mkdtemp`, limpo inclusive em erro, e o servidor subindo com `BRAIN_DB` apontando para ele, `BRAIN_CONFIG` da instalação e `BRAIN_SOMENTE_CONSULTA=1`. As duas ressalvas do SQLite estão na spec.

**Fora do escopo desta task:** tudo que a flag `--base` puxa — resolução do checkout, guardas de branch e de frescor, compilação do ref base, as duas rodadas e a comparação. É a task 6. E `README.md`/`CLAUDE.md`, que são a 7.

## Verification

- Command(s) that must pass, na instalação: `npm run concorrencia`; e `npm run eval` real saindo com código `0` sobre o golden set colhido na task 4
- Casos novos em `scripts/concorrencia.mjs` (via `caso(nome, fn)`):
  - nDCG@5 correto sobre tabela de ranks conhecidos → `1, 0.63, 0.5, 0.43, 0.39, 0`
  - semântica caída (servidor sem aquecer) → código `2`, não `1`
  - resultado forjado sem `_meta.brain` → código `2`, distinto de `semantica === false`
  - negativo volátil que passou a ter resultado → código `2`
- Acceptance criteria covered: a metade do CA3 que diz "sai com código `2` e a mensagem diz **não consegui medir**". A metade do portão (código `1` barrando a PR) fecha na task 6.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside `claude-brain/`, message ending with the trailer `Card: #18` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
