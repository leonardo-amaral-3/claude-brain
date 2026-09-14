❌ Status: Not Started

# Task 7: Declarar o portão — README e `CLAUDE.md`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/18-eval-portao-uso-real/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `brain-mcp/` directory of the `claude-brain/` repository of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

**Onde rodar os comandos: na instalação, nunca no checkout.** Leia `## Execution` da spec.

This is task 7 of 7. Tasks 1..6 are already in the codebase: o portão funciona. Falta ele ser **declarado** — e pela decisão técnica 4 é a declaração, e não um hook, que o põe em vigor.

## Scope

Duas seções de prosa, nenhuma linha de código:

- `brain-mcp/README.md` — a `## Qualidade da busca` **inteira**, e a `## File Change Summary` da spec é explícita sobre o alcance: não é só o primeiro parágrafo. Os parágrafos sobre deriva do golden set e o aviso "vai falhar na sua máquina" contradizem um portão estrito e saem junto. Mais: a linha do `npm run eval` no bloco de comandos passa a dizer nDCG@5, `npm run colher` entra nesse bloco, e `BRAIN_SOMENTE_CONSULTA` entra no parágrafo de variáveis de ambiente.
- `CLAUDE.md` do repo — `### CLAUDE.md do repo — onde o portão é declarado` da spec traz o texto do delta 2 da `## A esteira`, com o comando e a consequência dos dois códigos. Note o que a spec diz sobre o código `2`: não é licença para seguir.

Escreva sabendo da fragilidade que a decisão técnica 4 assume por escrito — é prosa, e nada impede fisicamente a PR. O texto tem de ser inequívoco justamente por isso.

**Fora do escopo desta task:** qualquer arquivo em `src/` ou `scripts/`, e qualquer skill compartilhada — a spec é explícita: **nenhuma skill `gm-*` é editada** por este card.

## Verification

- Command(s) that must pass, na instalação: `npm run smoke` e `npm run eval -- --base origin/dev` saindo com código `0` — a rodada limpa, depois de desfeita a regressão forçada da task 6
- **Emenda 2026-09-14 (task 7):** `--base origin/dev` sai com código `2` nesta branch, porque a `dev` ainda não tem o `_meta.brain`. A verificação passa a ser `npm run smoke` e `npm run eval -- --base 091c5c8`, os dois com código `0`. Nota completa na spec, `### CLAUDE.md do repo — onde o portão é declarado`.
- Acceptance criteria covered: o "e o `/gm-ship` não abre a PR" do CA3, que é onde o portão vira norma executável.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside `claude-brain/`, message ending with the trailer `Card: #18` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
