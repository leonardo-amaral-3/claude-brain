❌ Status: Not Started

# Task 2: `vectors.ts` — cache que expira por versão, backfill que reconfere a liderança

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/1-escritor-unico-do-indice/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

Seções que mais importam aqui: `## Implementation Details` → **Área 4** (o código de `garantirCarregado`, a assinatura nova do construtor, o `aindaSouLider`), o critério **CA2** e o critério **CA4** — em especial o parágrafo do CA4 que explica por que esta task existe: ao calar os seguidores, o cache em memória do `VectorIndex` passaria a servir um índice vetorial congelado no boot, e a correção do card criaria um defeito pior que ele. Leia também TD-4 (por que sobreposição de um lote é aceitável e a reserva exata foi descartada) e TD-6 (por que a invalidação é por contador na consulta, não por timer).

O código vive em `brain-mcp/`, dentro deste repo (`claude-brain`) — **o repo é o próprio diretório de trabalho**; rode os comandos git da raiz dele. O trabalho acontece na feature branch nomeada no `## Execution` da spec (já criada pelo `/gm-implement`).

This is task 2 of 4. A task 1 já está no codebase: existe a classe `Lease`, existem as tabelas `lider` e `meta` com `versaoIndice`/`bumpVersaoIndice`, o `busy_timeout` é 30 s, os três `BEGIN` são `IMMEDIATE` (inclusive o de `vectors.ts`, que **não** é assunto seu), e `scripts/concorrencia.mjs` existe com o runner e o caso `lease-expirado-e-tomado`.

## Scope

As duas mudanças de `vectors.ts` que preparam o arquivo para viver num mundo com líder e seguidores. Nenhum chamador muda: os dois parâmetros novos são opcionais e o comportamento com os padrões é o de hoje, então o servidor continua rodando igual até a task 3 ligar os fios.

Entra:
- `brain-mcp/src/vectors.ts`:
  - `VectorIndex` ganha o segundo parâmetro de construtor `versaoAtual: () => string = () => ""`, e `garantirCarregado()` passa a comparar a versão antes de aceitar o cache (a spec traz o corpo exato).
  - `preencherEmbeddings` ganha `opts.aindaSouLider?: () => boolean`, checado **no topo do `while`** — antes de gastar o lote, não depois —, e o retorno ganha `interrompido: boolean`.
- `brain-mcp/scripts/concorrencia.mjs` — dois casos novos (abaixo), acrescentados ao runner que já existe.

**Não** entra: `index.ts` (quem passa `() => versaoIndice(db)` e `aindaSouLider` de verdade é a task 3), `cli.ts`, `tools.ts`, `db.ts`, `lease.ts`.

Cuidado com o que **não** pode mudar: `cobertura()` e o cache de 30 s dele; `marcarSujo()`, que continua sendo caminho válido de invalidação (a versão é um segundo gatilho, não um substituto); e a idempotência de `preencherEmbeddings` — ele segue retomável, sair no meio nunca pode deixar chunk pela metade.

## Verification

- Command(s) that must pass: `npm run build` e `npm run concorrencia` (de dentro de `brain-mcp/`).
- Casos exigidos:
  - **`para-ao-perder-o-lease`** (da tabela do `## Plano de testes`, CA2) — unidade de `preencherEmbeddings` com `aindaSouLider` devolvendo `false` no 2º lote: retorna `interrompido: true` e no máximo 32 chunks embutidos.
  - **invalidação por versão** — a metade unitária do `seguidor-nao-envelhece`: um `VectorIndex` construído com `() => versaoIndice(db)` que já carregou; outra conexão insere chunk com vetor e chama `bumpVersaoIndice`; a busca seguinte do primeiro enxerga o chunk novo **sem** ninguém ter chamado `marcarSujo()`. É este caso que prova o CA4 no nível da unidade; a prova de ponta a ponta, com dois servidores, é da task 3.
- Acceptance criteria covered: **CA2** (a metade "reconfere a liderança antes de cada lote"; a metade "só o líder chama `embedPassagens`" fecha na task 3) e **CA4** no nível da unidade.

**Não** rode `npm run smoke` nem `npm run eval` a partir deste repo — exigem o índice real, que não existe aqui. São gate da instalação, no `/gm-ship`.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Os dois parâmetros novos são opcionais e o comportamento sem eles é idêntico ao de hoje
- [ ] O recheque de liderança acontece **antes** de gerar o lote, e a saída é limpa: nada de lote pela metade no banco
- [ ] A checagem de versão é um `SELECT` por consulta, não uma recarga por consulta — recarregar só quando a versão mudou
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from inside the repo with a clear message ending with the trailer `Card: #1`.
4. Flip the first line of this file to `✅ Status: Complete`.
