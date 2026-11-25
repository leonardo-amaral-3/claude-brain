✅ Status: Complete

# Task 1: `contradicao.ts` e os casos de unidade

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/46-freio-contradicao/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `brain-mcp/` directory of the `claude-brain` repository — the worktree `~/pessoal/claude-brain-46-freio-contradicao`, **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/46-freio-contradicao`, already checked out by `/gm-implement`). Do not create another worktree or branch, and do not touch the main checkout.

This is task 1 of 4. Nothing of the feature is in the codebase yet.

Premissas medidas em que esta task se apoia (spec, `## Premissas medidas`): a lista de vizinhas e o `LIMIAR_MESMO_ASSUNTO` não exportado (`memoria.ts:37, 65-109`); o formato do aviso de hoje (`tools.ts:559-566`); a forma do `DecisaoRelacionada` (`memoria.ts:29-35`); o arnês `caso(...)` do `concorrencia.mjs`.

Esta task **não depende do cliente do Jev do #42**: nada aqui importa o módulo do #42 nem o `juizJev.ts`.

## Scope

- `### brain-mcp/src/contradicao.ts (novo)` da spec, inteiro: tipos, constantes, `prazoJulgamentoMs`, `montarPergunta`, `criarJulgarPar`, `julgarContradicoes` e `formatarAviso`.
- `### brain-mcp/src/memoria.ts` da spec, inteiro: o `export` do limiar e o comentário de `decisoesRelacionadas`. Nada mais nesse arquivo.
- Em `brain-mcp/scripts/concorrencia.mjs`, os **8 casos de unidade** do `## Plano de testes`: `contradicao-sem-juiz-nao-julga`, `contradicao-marca-so-acima-do-limiar`, `contradicao-falha-volta-ao-aviso-de-hoje`, `contradicao-prazo-estoura`, `juiz-jev-adaptador`, `aviso-sem-marca-igual-ao-de-hoje`, `aviso-com-marca-muda-so-a-linha-marcada`, `montar-pergunta-e-prazo`. Siga as regras da spec para os casos de unidade (restaurar o `process.env` e remover os listeners no `finally`). O literal do cabeçalho nos casos de aviso é cópia caractere a caractere de `tools.ts:560-561` como está hoje no arquivo (ainda igual a `origin/dev`).

**Fora do escopo:** `tools.ts` (o `lembrar` ainda formata o aviso do jeito antigo; ele passa a usar `formatarAviso` na task 2), `juizJev.ts`, `jev-falso.mjs`, o hook, os casos de servidor e de script, o `contradicao.mjs`, o `package.json` e o `README.md`.

## Ambiente

- Todo `npm`/`node` desta task roda com o Node 22 do mise:
  `export PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH`. O Node v26.12.0 da máquina não compila o `sharp` no `npm ci`. Esse Node 22 tem `node:sqlite` com `readOnly` e `module.register` (medido no planejamento, 2026-11-10). O `ExperimentalWarning` do SQLite que ele imprime no stderr não é falha.
- `brain-mcp/node_modules` é **pré-condição fora desta task**: o braço direito o provê antes do `/gm-implement`. Se faltar, pare com `PARADA` e diga o motivo. **Não rode `npm install` nem `npm ci`.**
- Nenhum passo chama a API do Jev nem manda trecho do cofre para a TypeSafe AI.
- Se gravar decisão com `mcp__brain__lembrar`, o escopo é **`claude-brain#46`**, nunca o número puro.

## Verification

- Command(s) that must pass, de dentro de `brain-mcp/`: `npm run build` e `npm run concorrencia` (os 8 casos novos verdes e nenhum caso antigo vermelho).
- Acceptance criteria covered: R1 (parte de unidade: `contradicao-sem-juiz-nao-julga`, `aviso-sem-marca-igual-ao-de-hoje`), R2 (parte de unidade), R3 (parte de unidade), R6 (forma do par e texto do adaptador).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables
- [ ] `memoria.ts` só tem as duas mudanças da spec (`git diff` confere)

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #46` and then the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
