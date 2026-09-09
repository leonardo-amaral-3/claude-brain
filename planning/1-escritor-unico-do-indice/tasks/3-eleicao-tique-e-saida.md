✅ Status: Complete

# Task 3: `index.ts` — eleição no boot, trabalho pesado só do líder, tique de posse e saída graciosa

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/1-escritor-unico-do-indice/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

Seções que mais importam aqui: `## Implementation Details` → **Área 6**, que traz o código do boot, o `setTimeout` reescrito e os três handlers de saída; os critérios **CA1**, **CA2**, **CA3** e **CA4** inteiros; a **ressalva de plataforma** do CA3 (em Windows não existe `SIGTERM` recebível — `child.kill()` do pai vira `TerminateProcess` e **nenhum handler roda**; a garantia é o TTL, o caminho gracioso é otimização); e o escopo de TD-2 — `lembrar` e `INSERT INTO uso` continuam saindo de **qualquer** processo, líder ou seguidor. Barrar o `lembrar` do seguidor seria quebrar a spec.

O código vive em `brain-mcp/`, dentro deste repo (`claude-brain`) — **o repo é o próprio diretório de trabalho**; rode os comandos git da raiz dele. O trabalho acontece na feature branch nomeada no `## Execution` da spec (já criada pelo `/gm-implement`).

This is task 3 of 4. As tasks 1 e 2 já estão no codebase: a classe `Lease` completa (inclusive `iniciarTique`/`pararTique`, ainda **sem chamador** — é você quem lhe dá um), as tabelas `lider`/`meta` com `versaoIndice`/`bumpVersaoIndice`, `BRAIN_DB`, os `BEGIN IMMEDIATE`, o `VectorIndex` que aceita `versaoAtual` e o `preencherEmbeddings` que aceita `aindaSouLider` — os dois hoje rodando com os padrões, porque ninguém os alimenta ainda. `scripts/concorrencia.mjs` tem o runner e três casos unitários.

**Esta é a maior task do card, e ela tem uma costura visível**: eleição no boot + `assumirTrabalhoPesado()` de um lado, tique de promoção/rebaixamento + saída graciosa do outro. Se durante a implementação ela se mostrar grande demais, **corte exatamente aí** pelo protocolo de fatiamento do `/gm-implement` (`3a` e `3b`) em vez de espremer tudo num commit só.

## Scope

Toda a orquestração: é aqui que o card #1 de fato fecha.

Entra, só em `brain-mcp/src/index.ts`:
- Instanciar o `Lease`; passar `() => versaoIndice(db)` ao `VectorIndex`; o callback do `Indexer` passa a fazer `vec.marcarSujo()` **e** `bumpVersaoIndice(db)` — este último **só se `lease.souLider`**, porque o contador é escrita do líder.
- **Boot**: substituir o `try/catch` do scan por eleição. Líder varre e loga `boot (líder)`; seguidor não varre e loga `boot (seguidor)` com o pid do dono.
- **Trabalho de fundo**: extrair o miolo do `setTimeout(…, 500)` numa função `assumirTrabalhoPesado()` **idempotente** (guarda `pesadoAtivo`), preservando a ordem de hoje: `syncer.kickIfStale()` → `vigia.iniciar()` → `grafo.reconstruir()` → `preencherEmbeddings`. Dentro dela, `preencherEmbeddings` recebe `aindaSouLider: () => lease.souLider` e o `.then` também chama `bumpVersaoIndice(db)`. `preencherVetoresDeDecisoes` continua no `aquecer().then(…)`, mas **só se líder**.
- **Tique**: `lease.iniciarTique(aoAssumir, aoPerder)` — `aoAssumir` loga `assumi o índice` e chama `assumirTrabalhoPesado()`; `aoPerder` loga o rebaixamento, chama `vigia.parar()` e zera `pesadoAtivo`. O ciclo parar→iniciar tem de ser reversível: a spec avisa que é exatamente o tipo de coisa que apodrece em silêncio, e por isso o caso de morte abrupta abaixo precisa provar que o novo líder **volta a indexar arquivo novo**.
- **Saída graciosa**: `transport.onclose`, `process.on("exit")` e `SIGINT` liberando o lease, com `try/catch` que nunca impede a saída.
- Uma coisa que **não** pode mudar: o `aquecer()` e a conexão do transporte stdio continuam onde estão, para todo processo. Nenhum seguidor pode responder pior que hoje.

E, em `brain-mcp/scripts/concorrencia.mjs`, os casos abaixo — é esta task que traz ao arnês o helper de spawn do servidor por JSON-RPC/stdio (modele em `scripts/smoke.mjs`) e a fixture com raízes de documento de verdade. Use `BRAIN_LEASE_TTL_MS=3000` para não esperar 60 s pela posse.

**Não** entra: `cli.ts`, `tools.ts` e o parâmetro `forcar` do `reindex` (task 4); qualquer mudança de assinatura em `lease.ts`, `vectors.ts` ou `db.ts` — se precisar de uma, é desvio de spec, então **pare e avise**.

## Verification

- Command(s) that must pass: `npm run build` e `npm run concorrencia` (de dentro de `brain-mcp/`).
- Casos exigidos, todos da tabela do `## Plano de testes`:
  - **`um-so-lider`** (CA1) — 4 servidores contra a mesma fixture: `SELECT COUNT(*) FROM lider` = 1; stderr traz 1× `boot (líder)` e 3× `boot (seguidor)`; **nenhum seguidor imprime `grafo:`**.
  - **`embute-uma-vez`** (CA2) — fixture com chunks sem vetor: só o líder gera embeddings; `COUNT(*) FROM chunks WHERE embedding IS NULL` chega a 0.
  - **`seguidor-nao-envelhece`** (CA4) — o líder indexa arquivo novo; o seguidor acha o termo único por via léxica **e semântica**; `meta.versao_indice` incrementou. O caminho semântico é o que importa: o léxico passaria mesmo com o bug.
  - **`posse-apos-morte-abrupta`** (CA3, **a garantia**) — mata o líder sem chance de handler, espera > TTL: outra `instancia` na tabela, algum sobrevivente logou `assumi o índice`, e **um arquivo novo passa a ser indexado**.
  - **`posse-apos-saida-graciosa`** (CA3) — **fecha o stdin** do líder (não `SIGTERM`: em Windows ele não é recebível): a tabela `lider` fica vazia na hora e o sucessor assume no tique seguinte, sem esperar o TTL.
- Acceptance criteria covered: **CA1** (o 1º cenário, "exatamente um executa o trabalho pesado"; o 2º, do `lembrar` durante o reindex, fecha na task 4), **CA2** inteiro, **CA3** inteiro, **CA4** inteiro.

**Não** rode `npm run smoke` nem `npm run eval` a partir deste repo — exigem o índice real, que não existe aqui. São gate da instalação, no `/gm-ship`.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] `assumirTrabalhoPesado()` é idempotente: chamá-la duas vezes não duplica vigia, grafo nem backfill
- [ ] Rebaixar e repromover o mesmo processo funciona — o vigia volta a vigiar e o índice volta a ser atualizado por ele
- [ ] `lembrar` e o `INSERT INTO uso` continuam funcionando num seguidor (TD-2), sem checagem de lease nenhuma
- [ ] Um seguidor não escreve `meta.versao_indice`
- [ ] Nenhum handler de saída consegue impedir o processo de morrer
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from inside the repo with a clear message ending with the trailer `Card: #1`.
4. Flip the first line of this file to `✅ Status: Complete`.
