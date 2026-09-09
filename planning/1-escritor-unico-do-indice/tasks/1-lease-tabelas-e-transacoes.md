❌ Status: Not Started

# Task 1: Fundação — a classe `Lease`, as tabelas, as transações e o arnês de teste

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/1-escritor-unico-do-indice/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

Seções que mais importam aqui: `## Implementation Details` → **Área 1** (o esqueleto da classe `Lease`, os três SQLs e a semântica de `changes`), **Área 2** (`db.ts`), **Área 3** (`config.ts`), **Área 5** (as duas linhas de `BEGIN IMMEDIATE`) e **Área 9** (o arnês); mais `## Technical Decisions` TD-1, TD-3, TD-7 e TD-8 — são elas que explicam por que o lease mora no SQLite, por que a identidade é UUID e não pid, e por que `BEGIN IMMEDIATE` entra nesta spec. `## Coding Standards` vale integralmente (pt-BR, comentário de topo com o **porquê**, `.unref?.()` em todo timer).

O código vive em `brain-mcp/`, dentro deste repo (`claude-brain`) — **o repo é o próprio diretório de trabalho**; rode os comandos git da raiz dele. O trabalho acontece na feature branch nomeada no `## Execution` da spec (já criada pelo `/gm-implement`).

⚠️ **Antes de começar, confira a base.** O `## Execution` da spec registra que a branch `dev` **não existia** quando a spec foi escrita — só `main`. A criação da `dev` e o checkout da feature branch são responsabilidade do `/gm-implement`, não desta task; se você abriu esta task e ainda está na `main`, **pare e avise**, em vez de commitar na branch errada.

This is task 1 of 4. É a primeira: o codebase está como a spec o descreve no `## Technical Overview`.

## Scope

Tudo que estabelece o mecanismo sem ainda mudar o comportamento do servidor. Ao fim desta task o servidor roda exatamente como hoje — N processos, todos escrevendo — porque ninguém consulta o lease ainda. É de propósito: a orquestração é a task 3.

Entra:
- `brain-mcp/src/lease.ts` (**novo**) — `TTL_MS`, `TIQUE_MS`, `DonoLease`, a classe `Lease` inteira, incluindo `iniciarTique`/`pararTique` (que só ganham chamador na task 3).
- `brain-mcp/src/db.ts` — as tabelas `lider` e `meta`; `busy_timeout` 5000 → 30000 com o comentário citando a medição; `versaoIndice` e `bumpVersaoIndice`. **`clearAll` não pode passar a apagar `lider` nem `meta`** — a task 4 tem um caso que prova isso.
- `brain-mcp/src/config.ts` — `dbPath` passa a respeitar `BRAIN_DB`, com padrão idêntico ao de hoje.
- `brain-mcp/src/indexer.ts`, `brain-mcp/src/grafo.ts`, `brain-mcp/src/vectors.ts` — **uma linha em cada**: `BEGIN` → `BEGIN IMMEDIATE`. Preserve o `BEGIN` **fora** do `try` nos três; a spec explica na Área 5 por que inverter isso mascararia o erro original.
- `brain-mcp/scripts/concorrencia.mjs` (**novo**) — o arnês, no estilo de `scripts/smoke.mjs`: cria fixture descartável (diretório temporário, `brain.config.json` próprio, `BRAIN_DB` próprio), roda os casos, imprime nome e resultado de cada um e sai com código ≠ 0 se algum falhar. Mais o caso `lease-expirado-e-tomado`.
- `brain-mcp/package.json` — o script `"concorrencia"`.

**Não** entra: `index.ts` (nenhuma linha), `cli.ts`, `tools.ts`, o resto de `vectors.ts` além da linha do `BEGIN` (o `versaoAtual` do construtor e o `aindaSouLider` são a task 2), README.

Sobre o arnês: aqui ele só precisa do que os casos unitários exigem — abrir uma fixture, importar de `../dist/`, contar sucesso e falha. O helper de spawn do servidor por JSON-RPC/stdio nasce na task 3, quando houver servidor para exercitar. Não construa infraestrutura para casos que ainda não existem, mas deixe o runner pronto para receber casos novos: as tasks 2, 3 e 4 acrescentam os seus neste mesmo arquivo.

## Verification

- Command(s) that must pass: `npm run build` e `npm run concorrencia` (ambos de dentro de `brain-mcp/`).
- Caso exigido, da tabela do `## Plano de testes`: **`lease-expirado-e-tomado`** — duas instâncias de `Lease` sobre o mesmo db: a 2ª só ganha depois do TTL; `forcar: true` ganha na hora; `renovar()` da 1ª devolve `false` depois de perdido. Use `BRAIN_LEASE_TTL_MS` baixo para não esperar 60 s.
- Acceptance criteria covered: nenhum CA fecha inteiro aqui. Esta task entrega o mecanismo que o CA1 e o CA3 vão usar, e fecha sozinha a metade residual do CA1 que TD-7 descreve (`busy_timeout` de 30 s + `BEGIN IMMEDIATE`, sem os quais nem o lease faz o `lembrar` do seguidor sobreviver a um reindex).

**Não** rode `npm run smoke` nem `npm run eval` a partir deste repo: eles exigem o índice real e **este repo não tem `brain-mcp/data/`**. São gate da instalação, no `/gm-ship`.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] `BRAIN_LEASE_TTL_MS=0` produz TTL 0 (o desligamento a quente do `## Rollback`), e **não** 60 s — a armadilha do `||` que a spec marca em maiúsculas na Área 1
- [ ] O timer de `iniciarTique` tem `.unref?.()`
- [ ] `clearAll` continua sem tocar em `lider` e `meta`
- [ ] O `BEGIN IMMEDIATE` está fora do `try` nos três arquivos, como estava o `BEGIN`
- [ ] Comentário de topo de `lease.ts` diz que o lease é **otimização** e que o SQLite segue sendo a autoridade de correção
- [ ] Um banco antigo (sem as tabelas novas) abre com este código sem passo manual
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from inside the repo with a clear message ending with the trailer `Card: #1`.
4. Flip the first line of this file to `✅ Status: Complete`.
