✅ Status: Complete

# Task 3: `src/roteador.ts` e a suíte `npm run roteador`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/45-roteador-source/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente e regras do lote**: [`README.md`](README.md) desta pasta — Node 22, `N22`, nada chama a API do Jev.

Seções que governam esta task: `### O que o #45 usa do contrato do #42` (C1–C6), `### brain-mcp/src/roteador.ts (novo)` (inteira), `### brain-mcp/scripts/roteador.mjs (novo) e package.json` (a ordem de abertura, o Jev falso, o buscador falso e o `nenhum-fetch`), `## Coding Standards` e TD-1, TD-3, TD-4, TD-5, TD-7, TD-9 e TD-10. Premissas: P4, P13, P18, P20 e P21 da spec, e Q3 do README.

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-45-roteador-source` — **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/45-roteador-source` (already checked out by `/gm-implement`).

This is task 3 of 5. Tasks 1–2 (a T0 do golden e `scripts/sem-jev.mjs` nos três scripts) are already in the codebase.

## Scope

- `brain-mcp/src/roteador.ts` (**novo**): tudo o que a seção dele lista (tipos, constantes, `roteadorLigado`, `estadoDoRoteador`, `opcoesDoRoteador`, `caminhoDoJev`, `paraEscolha`, `criarEscolherFonteJev`/`escolherFonteJev`, `rotear`). Ninguém o importa ainda.
- `brain-mcp/scripts/roteador.mjs` (**novo**): a abertura na ordem fixa da spec e os casos do `## Plano de testes` que **não** sobem servidor em processo:
  - A1: `desligado-nao-consulta`, `ligado-pela-lista`;
  - A2: todos (`abaixo-do-limiar` … `qualquer`, `timeout` e as constantes, `filtro-vazio-cai-para-sem-filtro`);
  - A3: `no-limiar-aplica`, `estado-e-opcoes` (com `estado-pequeno`);
  - A4: `source-explicito-nao-consulta`;
  - A6: `filtros-intactos`;
  - A7: `sem-http-proprio`, `resolve-a-worktree`, `adaptador`, `cliente-da-worktree`;
  - A8: `filhos-sem-jev`, `semJev-limpa`, `semJev-sem-cliente`;
  - e o `nenhum-fetch` no fim.
- `brain-mcp/package.json`: o script `"roteador"`.

NOT in scope: `src/tools.ts` e `src/index.ts` (task 4) · os casos de integração, com `McpServer` + `InMemoryTransport` (`desligado-nao-carrega`, `desligado-byte-a-byte`, `desligado-igual-a-sem-chave`, `rodape-quando-roteado`, `ponta-a-ponta-falso`, `query-vazia-nao-consulta`, `superficie-intacta`, `uso-grava-args-como-vieram`), que dependem do handler da task 4 · README (task 5) · `hooks/jev.js` (não muda; divergência é PARADA) · pôr `TYPESAFE_API_KEY` em qualquer lugar.

O `sem-http-proprio` já lê `src/tools.ts` nesta task, e ele tem de passar como está.

## Verification

- `cd brain-mcp && N22 npm run build; echo $?` → `0` (tsc `strict`, sem import ou variável sem uso).
- `N22 npm run roteador; echo $?` → `0`, com `ok` em cada caso do Scope e `nenhum-fetch` com zero chamadas.
- O eval não roda nesta task: `src/roteador.ts` ainda não é importado por ninguém, e o servidor não muda. Ele volta na task 4, com o handler ligado.
- Acceptance criteria covered: **A2** (inteiro); as partes de unidade de **A1**, **A3**, **A4** e **A6**; **A7** (inteiro); a prova na suíte do **A8**. A2 inclui o sistema externo lento na borda (`timeout` com o Jev falso que nunca resolve; `lento` do cliente falso no `cliente-da-worktree`).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Nenhum comentário de `src/roteador.ts` casa a regex do `sem-http-proprio`
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, files by name, message ending with the trailer `Card: #45` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
