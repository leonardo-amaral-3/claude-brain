✅ Status: Complete

# Task 6: Vizinhos do grafo — o bloco que a feature existe para entregar

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/11-cerebro-em-slash-command/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

Seções que governam esta task: `## Implementation Details` → `o que a entidade resolvida injeta` e `o texto do cabeçalho`; `## Requisitos & critérios de aceite` (CA-1 e CA-2); `## Verificação pós-deploy`.

The code lives in the `claude-brain/` directory of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 6 of 6. Tasks 1–5 já estão no código: o argumento já resolve entidade e ela já é injetada sozinha.

## Scope

A entidade passa a vir acompanhada dos vizinhos do grafo. É a task que decide se a feature entrega valor ou só barulho.

1. Vizinhos pelas `arestas` nos dois sentidos, com o descarte de quem não tem `doc_path`.
2. **O bypass do `daqui()` e do `relevante()`.** A spec dedica o trecho mais longo desta seção a explicar por quê, com os números medidos. Se você aplicar o `daqui()` aos vizinhos, o caso do CA-1 devolve **só o vizinho falso** e a feature entrega o oposto do que promete — e é exatamente isso que o primeiro teste abaixo detecta.
3. Ordenação por diversidade antes de profundidade, com a lista de prioridade e o `ORDER BY` dentro do grupo, ambos literais na spec. A spec também diz quais dois tipos ficam **fora** da lista e por quê.
4. Teto de 5 no bloco inteiro, entidade sem `doc_path`, e o caso do bloco que ficaria vazio.
5. Cabeçalho próprio do caminho de grafo, mantendo a frase final que aponta `search_context`/`read_doc`.

**Fora do escopo**: qualquer mudança em `brain-mcp/src/` · o card do `Grafo.resolver()` e o card do `daqui()` que esconde decisão no workspace `pessoal` — ambos registrados como Triagem à parte na spec.

## Verification

- `node scripts/injecao.mjs --caso "/gm-spec #11" --cwd ~/pessoal/claude-brain` → o bloco traz **as duas decisões** (#426 e #427). Se vier só o card #422, o `daqui()` vazou para o caminho de entidade
- `--caso "/gm-implement 982-setor-dashboard-inconsistencias" --cwd ~/notoria/processos` → traz spec, decisão e card, com **no máximo 1–2 tasks** — não 4 tasks empilhadas
- Mesma chamada 3× seguidas → saída **byte a byte idêntica** (teste do `ORDER BY`)
- Índice sem grafo (`arestas` vazia) → cai na busca léxica ou não injeta; **nunca** cabeçalho sozinho
- `npm run injecao -- --dias 3 --base <commit da task 3>` → taxa depois **≥ 60%** e **≥ 2×** a taxa antes
- Acceptance criteria covered: **CA-1** (completo) e **CA-2** (completo)

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Vizinhos não passam por `daqui()` nem por `relevante()`
- [ ] `brain-mcp/src/` intacto
- [ ] `./sync.sh push` levado para a instalação, e o hook exercitado numa sessão interativa real
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from inside `claude-brain/` with a clear message ending with the trailer `Card: #11`.
4. Flip the first line of this file to `✅ Status: Complete`.

> Depois desta task o card está pronto para `/gm-ship`. A **Verificação pós-deploy** da spec (re-medir a taxa e a razão `Bash : mcp__brain__*` sete dias após o merge, e publicar no card) fica pendente e é o que libera a passagem para ✅ Produção — não é bloqueante para o merge.
