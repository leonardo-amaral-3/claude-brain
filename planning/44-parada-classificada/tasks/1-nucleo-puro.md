❌ Status: Not Started

# Task 1: Núcleo puro do classificador (lista, entrada e guarda da tabela)

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/44-parada-classificada/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the worktree `~/pessoal/claude-brain-44-parada-classificada` — **its own git repository** (the `claude-brain` repo); run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/44-parada-classificada`, already checked out by `/gm-implement`).

This is task 1 of 4. No earlier task exists.

**Precondition — do not start without it (spec, `## Execution`).** Implementation only begins after the branch has been rebased onto `feat/42-filtro-jev`, and that branch must already carry the commit of the Jev client written to the contract of the #42 spec (the card #42 must have its `<!-- gm:spec -->` comment). If either is missing, stop with `PARADA` and say which one. This task does not use the real client: everything here is proven without it.

Premises it leans on (spec, `## Premissas medidas`): "As linhas para são seis, com este texto exato" (re-measured at the start of `/gm-plan-tasks` on 2026-11-10, same six lines) and "Os scripts da raiz rodam com `node` puro, sem `package.json`". Re-measure the first one after the rebase: the #42 branch may have touched `skills/_comum/convencoes.md`. If it no longer yields exactly those six lines, that is a deviation.

## Scope

- `scripts/classificar-parada.mjs` (new): the header comment, the constants `LIMIAR`, `TEMPO_MS`, `PERGUNTA`, `CATEGORIAS` and `DESLIGADO`, and the pure functions `lerEntrada`, `linhasParaDaTabela` and `divergenciaDaLista`, exactly as in `## Implementation Details`.
- `scripts/classificar-parada-teste.mjs` (new): the suite skeleton (the mold of `scripts/skills-comum-teste.mjs`, as the spec says), with the parts of C7 and C8 that only touch these functions. For C7, `linhasParaDaTabela` on the real file returns exactly the six `linha`, `divergenciaDaLista` on it returns `null`, and the renamed-cell variant (a) and the extra-`**para**`-line variant (b) return a non-null message that starts with `lista divergente:` and names both cells. For C8, `lerEntrada` handles multi-line input with `\r\n` and trailing blank lines, `PROXIMO:` as last line, empty input and `PARADA:` with no reason.
- **Out of scope:** `classificar`, `executar`, `rodarCli`, the entrypoint, `daFormaDo42` and any import of the #42 module (tasks 2 and 3), `scripts/jev-falso.mjs` (task 2), and the docs (task 4). Nothing in `skills/`, `hooks/` or `brain-mcp/`.

## Verification

- Command(s) that must pass: `node scripts/classificar-parada-teste.mjs` (exit `0`) and `node scripts/skills-comum.mjs --check` (exit `0`).
- Acceptance criteria covered: R1 (the fixed list and its guard against the table, partially: the escalation side of the guard comes in task 2) and the input side of R2.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code runs; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #44` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
