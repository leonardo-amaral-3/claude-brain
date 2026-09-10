❌ Status: Not Started

# Task 4: Slash command deixa de ser descartado e entra pelo caminho léxico

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/11-cerebro-em-slash-command/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

Seções que governam esta task: `## Implementation Details` → `a ordem dos guards` e `parse do argumento e lista de candidatos`, mais os passos **5 e 6** da subseção `precedência da resolução`.

The code lives in the `claude-brain/` directory of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 4 of 6. Tasks 1–3 já estão no código; o `npm run injecao` da task 3 é a sua ferramenta de conferência.

## Scope

O hook passa a atender slash command, **mas ainda sem resolver entidade** — só pelo caminho léxico já existente, agora alimentado pelo argumento em vez da linha inteira. Os passos 1–4 da precedência são da task 5.

1. **Antes de tudo, o guard de `h.source`.** A spec manda conferi-lo numa sessão **interativa** de verdade antes de mexer no resto, e diz exatamente como. É o único passo desta feature que exige o usuário na cadeira, e ele decide se a feature funciona ou morre em silêncio — não pule, não presuma, não conclua a partir do modo headless.
2. Sai o guard de slash command; os guards são reordenados conforme a spec.
3. Parse do argumento e construção da lista de candidatos.
4. Passos 5 e 6 da precedência. **Preste atenção ao ponto do `tokensDe(arg)`**: herdar `tokensDe(prompt)` faz o passo 5 nunca injetar, e o teste abaixo é o que expõe isso.

**Fora do escopo**: resolução de entidade e vizinhos do grafo (tasks 5 e 6) · o guard de `<12` chars para prompt normal, que a spec decidiu **não** mexer.

## Verification

- `node scripts/injecao.mjs --caso "/gm-explore como funciona o indexador de chunks" --cwd ~/pessoal/claude-brain` → **injeta** (é o teste do `tokensDe(arg)`; com `tokensDe(prompt)` sai vazio)
- `--caso "/clear"` → nenhuma saída (comando sem argumento)
- `--caso "ok"` → nenhuma saída (prompt curto normal segue intocado)
- `--caso "<pergunta longa qualquer>"` → continua injetando como antes (regressão do caminho normal)
- `npm run injecao -- --dias 3` → a taxa **sobe** frente à linha de base anotada na task 3
- O valor observado de `h.source` numa sessão interativa está registrado em comentário no hook
- Acceptance criteria covered: **CA-1** parcialmente (o bullet do `/gm-explore`)

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] `h.source` conferido em sessão interativa e o valor anotado em comentário
- [ ] Hook segue falhando em silêncio; erro só sob `BRAIN_HOOK_DEBUG=1`
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from inside `claude-brain/` with a clear message ending with the trailer `Card: #11`.
4. Flip the first line of this file to `✅ Status: Complete`.
