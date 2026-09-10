✅ Status: Complete

# Task 4: Ação humana disputa o lease — CLI, tool `reindex` e README

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/1-escritor-unico-do-indice/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

Seções que mais importam aqui: `## Implementation Details` → **Área 7** (CLI: `adquirirComEspera` de 10 s, `--force`, a mensagem de recusa, `liberar()` ao fim) e **Área 8** (a tool `reindex`); **TD-5**, que é o porquê das duas: CLI e `reindex` são a mesma coisa — ação humana explícita de reindexação —, e por isso **recusam com aviso em vez de roubar**, com escapatória consciente. E o 2º cenário do **CA1**, que é o defeito original do card na sua forma mais literal: o `lembrar` de um seguidor durante uma reindexação do líder tem de **concluir**, mesmo que espere ~9 s por isso.

O código vive em `brain-mcp/`, dentro deste repo (`claude-brain`) — **o repo é o próprio diretório de trabalho**; rode os comandos git da raiz dele. O trabalho acontece na feature branch nomeada no `## Execution` da spec (já criada pelo `/gm-implement`).

This is task 4 of 4, a última. As tasks 1–3 já estão no codebase: o `Lease` completo, as tabelas, `BRAIN_DB`, os `BEGIN IMMEDIATE`, o `VectorIndex` por versão, o `preencherEmbeddings` com recheque, e o `index.ts` inteiro elegendo líder, promovendo, rebaixando e liberando o lease na saída. O `scripts/concorrencia.mjs` já tem o runner, a fixture com raízes e o helper de spawn de servidor por JSON-RPC/stdio — os seus dois casos entram nele.

## Scope

Fechar os dois caminhos de escrita pesada que ainda ignoram o lease.

Entra:
- `brain-mcp/src/cli.ts` — disputa o lease **antes de qualquer escrita** (ou seja, antes do `new Indexer`), com `adquirirComEspera` tentando a cada 1 s por 10 s; `--force` toma a liderança; a recusa imprime pid, host e hora de expiração do dono e sai com código 1. O bloco `--embed` passa `aindaSouLider: () => lease.souLider`. Ao fim do script, `lease.liberar()` — inclusive nos caminhos que saem por erro.
- `brain-mcp/src/tools.ts` — `registerTools` passa a receber o `lease`; a tool `reindex` ganha `forcar: z.boolean().optional()`. Sem lease e sem `forcar`, **não escreve nada** e devolve texto dizendo quem detém o índice e que `forcar: true` resolve — **resposta, não erro de protocolo**. Com lease, executa como hoje e mantém a liderança. O `INSERT INTO uso` de `tools.ts` **não muda**: segue em todo processo.
- `brain-mcp/src/index.ts` — só a linha que passa o `lease` para `registerTools`.
- `brain-mcp/README.md` — seção curta: escritor único, o que a CLI faz quando há sessões abertas, `--force`.
- `brain-mcp/scripts/concorrencia.mjs` — os dois casos abaixo.

**Não** entra: mudar o comportamento do `reindex` quando o processo **é** líder (é o de hoje); mexer no `INSERT INTO uso` ou no `lembrar`; o `/mapear` do `brain-mcp` e a verificação pós-deploy, que são do `/gm-ship` e do `/gm-release`.

Consequência a aceitar de olhos abertos, e a spec a registra: entre a saída da CLI e o tique do próximo servidor não há líder e ninguém varre. É janela curta e autocorrigida — não invente watchdog para ela.

## Verification

- Command(s) that must pass: `npm run build` e `npm run concorrencia` (de dentro de `brain-mcp/`) — a suíte **inteira**, os casos das quatro tasks, verde.
- Casos exigidos, da tabela do `## Plano de testes`:
  - **`seguidor-escreve-durante-reindex`** (CA1, o defeito original) — dispara `reindex {forcar: true}` no líder e, no mesmo instante, `search_context` + `lembrar` num seguidor: as duas chamadas do seguidor **retornam resultado**, sem `SQLITE_BUSY` e sem `database is locked`. Lembre do que o critério diz e do que ele não diz: exige-se que **concluam**, não que sejam rápidas — esperar o `busy_timeout` é o preço aceito.
  - **`reindex-nao-derruba-lider`** (CA3) — `fullReindex` no líder: depois do `clearAll`, ele continua dono do lease. É a prova de que `clearAll` não toca em `lider` nem em `meta`.
- Acceptance criteria covered: **CA1** completo (com o 2º cenário, que era o que faltava). Ao fim desta task os quatro CAs estão cobertos por teste.

**Não** rode `npm run smoke` nem `npm run eval` a partir deste repo — exigem o índice real e este repo não tem `brain-mcp/data/`. Eles rodam na **instalação**, no `/gm-ship`, e o `eval` exige o baseline de hit@1/hit@5/MRR medido **antes** do deploy: o `CLAUDE.md` deste repo é explícito em que mudança em `brain-mcp/src/` fecha com o índice provado, não com o `tsc` verde.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green — a suíte inteira, não só os casos novos
- [ ] A CLI libera o lease em todos os caminhos de saída, inclusive nos que saem por erro
- [ ] A recusa da CLI é acionável: diz pid, host, expiração e a saída (`--force`)
- [ ] A recusa do `reindex` é resposta de texto, não erro de protocolo, e **não escreveu nada** antes de recusar
- [ ] `--force` e `forcar: true` de fato tomam a liderança
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from inside the repo with a clear message ending with the trailer `Card: #1`.
4. Flip the first line of this file to `✅ Status: Complete`.
