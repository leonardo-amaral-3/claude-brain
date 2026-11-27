❌ Status: Not Started
Onda: 1
Depende de: —
Toca: `brain-mcp/scripts/jev.mjs`

# Task 1: T4 do jev.mjs limpa a pasta temporaria e usa os imports do topo

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/74-jev-t4-tmp/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `claude-brain/` directory of the workspace (in this front, the worktree `claude-brain-74-jev-t4-tmp/`) — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 1 of 1. As tasks de `Depende de:` já estão no código; outras desta onda correm ao mesmo tempo em outras worktrees e não estão aqui.

Premissas em que esta task se apoia (spec, `## Premissas medidas`): o T4 vaza uma `jev-teste-*` por rodada; `confere` sai por `process.exit(1)`; `try/finally` nao limpa sob `process.exit`; `process.on("exit", rmSync)` limpa nos tres caminhos; os imports do topo (linhas 13 e 15) ja trazem tudo que o T4 reimporta.

## Scope

- Só o bloco `// ---- T4: roteiro e variacoes do falso` de `brain-mcp/scripts/jev.mjs`, conforme `## Implementation Details` da spec.
- NÃO toca: as linhas de import do topo, os outros casos (T17, parte hook), o código 2 da parte viva (#72), interrupção por sinal, nem o vazamento da `jev-t17-*` — tudo em `## Fora do escopo`.
- Nenhum gancho de falha injetável é criado; as provas do R2 são manuais e revertidas antes do commit.

## Verification

- Command(s) that must pass, de `brain-mcp/`, seguindo o `## Plano de testes` da spec:
  - `npm run jev` e `BRAIN_WORKSPACES=/nao/existe.json npm run jev` saem 0, com as mesmas linhas `jev: … OK`, e a lista de nomes `jev-teste-*`, `jev-hook-*` e `jev-t17-*` em `tmpdir()` é idêntica antes e depois (R1, R4).
  - As três provas manuais do R2 (confere do T4 falhando → 1; `throw` no T4 → 1; `if` do T17 forçado → 2 `NÃO MEDI`), cada uma com a lista inalterada, cada uma revertida; guardar as três saídas para o corpo da PR (R2).
  - `grep -nE "await import\(['\"](node:)?(fs|os)['\"]\)" brain-mcp/scripts/jev.mjs` vazio, e `git diff` de `jev.mjs` sem hunk nas linhas 13 e 15 (R3).
- Acceptance criteria covered: R1, R2, R3, R4.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Flip the first line of this file to `✅ Status: Complete` — **before** the commit, so the `✅` goes in it.
4. Commit from inside the repo, message ending with the trailer `Card: #74` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
