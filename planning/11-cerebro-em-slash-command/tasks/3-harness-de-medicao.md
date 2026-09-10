✅ Status: Complete

# Task 3: O harness de medição — `injecao.mjs` e a linha de base

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/11-cerebro-em-slash-command/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

Seção que governa esta task: `## Implementation Details` → `brain-mcp/scripts/injecao.mjs`. Leia-a inteira antes de escrever uma linha: ela fixa as flags, o filtro de corpus, de onde vem o `dist/`, a semântica do `fail()` e a proibição de commitar corpus.

The code lives in the `claude-brain/` directory of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 3 of 6. Tasks 1 e 2 já estão no código.

## Scope

Construir o instrumento **antes** da mudança que ele mede. Nesta task o hook ainda é o da task 1 — sem comportamento novo —, e é isso que faz o número que sair daqui ser a **linha de base** honesta contra a qual a task 6 compara.

1. `brain-mcp/scripts/injecao.mjs`, seguindo o padrão dos vizinhos `smoke.mjs`/`eval.mjs`/`uso.mjs` (`.mjs` solto, `fail()` com `process.exit(1)`, sem runner de teste — o repo não tem nenhum e esta task não introduz um).
2. `brain-mcp/package.json` ganha o script `injecao`.
3. Rodar e **registrar o número da linha de base no resumo para o usuário** — é ele que a task 6 vai citar.

Dois pontos onde é fácil errar, ambos decididos na spec: o script **executa o hook de verdade por `spawn`**, nunca reimplementa a lógica dele; e slash command chega ao transcript **já expandido**, então a linha crua precisa ser reconstituída — descartar esses eventos jogaria fora 45% da população que o CA-2 mede.

**Fora do escopo**: qualquer mudança em `hooks/brain-contexto.js` · commitar corpus de prompts (o repo é público e os prompts são de sessões reais da Notória).

## Verification

- `npm run injecao -- --dias 3` → imprime total, taxa e a repartição por motivo; a taxa deve sair na ordem de **~29%**, e os buckets `slash` e `curto` devem dominar as perdas
- `node scripts/injecao.mjs --caso "ok"` → nenhuma saída
- `node scripts/injecao.mjs --caso "<uma pergunta longa sobre o indexador>" --cwd ~/pessoal/claude-brain` → imprime bloco injetado
- `node scripts/injecao.mjs --caso "/gm-spec #11" --cwd ~/pessoal/claude-brain` → **nenhuma saída** (o hook ainda desiste em slash command; é isto que a task 4 muda)
- Com `BRAIN_WORKSPACES` apontando para arquivo inexistente → `fail()` com mensagem clara, **não** taxa zero
- `git status` → nenhum arquivo de corpus versionado
- Acceptance criteria covered: nenhum fecha aqui; esta task constrói o instrumento que fecha **CA-1** e **CA-2** nas tasks 4–6

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] O script faz `spawn` do hook real; nenhuma cópia da lógica dele no `.mjs`
- [ ] A taxa de base medida está anotada no resumo para o usuário
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from inside `claude-brain/` with a clear message ending with the trailer `Card: #11`.
4. Flip the first line of this file to `✅ Status: Complete`.
