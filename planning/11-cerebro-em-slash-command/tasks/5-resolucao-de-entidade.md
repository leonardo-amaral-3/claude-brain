✅ Status: Complete

# Task 5: Resolução de entidade — o argumento vira chave do grafo

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/11-cerebro-em-slash-command/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

Seções que governam esta task: `## Implementation Details` → `precedência da resolução` (passos **1 a 4**, mais as regras de ambiguidade e `daquiRepo`) e `o repo a partir do cwd`. O `## Technical Overview` explica por que **não** se reaproveita `Grafo.resolver()` — leia antes de ceder à tentação de importá-lo.

The code lives in the `claude-brain/` directory of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 5 of 6. Tasks 1–4 já estão no código: o hook já atende slash command pelo caminho léxico.

## Scope

O argumento passa a ser resolvido contra `entidades` antes de cair na busca léxica. Nesta task a injeção é **só da própria entidade resolvida** — os vizinhos do grafo são a task 6.

1. Passos 1 a 4 da precedência, na ordem exata da spec.
2. `daquiRepo` com o terceiro ramo defensivo — a spec explica que sem ele o hook estoura em `brain-workspaces.json` sem `repos` nem `exceto`, e hook que estoura nunca mais injeta.
3. Resolução do repo a partir do `cwd`, incluindo os dois casos que devolvem `null` de propósito (a tabela de traçado na spec lista os cinco formatos).
4. Ambiguidade é **terminal**: cai para o passo 5, nunca para o passo seguinte. A spec dá o alvo real no índice que torna isso concreto.
5. Injeção da entidade resolvida: slot 1, primeiro chunk do `doc_path`. Entidade sem `doc_path` (toda `feature`) não tem o que injetar ainda nesta task — cai para o passo 5; a task 6 é que a faz render vizinhos.

**Fora do escopo**: `arestas`, vizinhos, ordenação por tipo, bypass do `daqui()`/`relevante()` — tudo task 6 · qualquer mudança em `brain-mcp/src/`, que é o que segura a Rota Curta.

## Verification

Todos com `node scripts/injecao.mjs --caso "…" --cwd …`:

- `"/gm-spec #11" --cwd ~/pessoal/claude-brain` → resolve o card do **`claude-brain`**
- `"/gm-spec #11" --cwd ~/pessoal/operations-center` → resolve o card do **`operations-center`**
- `"/gm-spec #11" --cwd ~/pessoal` (raiz, sem repo) → **não injeta**; e em particular **não** cai na `feature:11-fila-de-pedidos-pendentes`
- `"/gm-ship 982-setor-dashboard-inconsistencias" --cwd ~/notoria/processos` → resolve **feature**, não card
- `"/gm-implement processos/planning/reagrupamento-aih-por-dominio" --cwd ~/notoria/processos` → resolve a feature pelo **segmento** do caminho
- `"/gm-spec ##1086" --cwd ~/notoria/processos` → resolve o card 1086
- `"/gm-plan-tasks 11-fila-de-pedidos-pendentes." --cwd ~/pessoal/operations-center` → resolve apesar do ponto final
- `"/gm-card #5" --cwd ~/pessoal/claude-brain` (11 chars) → **injeta** — é o teste da ordem dos guards da task 4
- `brain-workspaces.json` temporário sem `repos` **nem** `exceto` + `--caso "/gm-spec #11"` → não lança
- `npm run injecao -- --dias 3` → taxa sobe frente à task 4
- Acceptance criteria covered: **CA-1** em quase toda a extensão (falta o conteúdo do bloco, que é a task 6)

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] `Grafo.resolver()` **não** foi importado nem copiado
- [ ] `brain-mcp/src/` intacto
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from inside `claude-brain/` with a clear message ending with the trailer `Card: #11`.
4. Flip the first line of this file to `✅ Status: Complete`.
