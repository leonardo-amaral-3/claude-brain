# Eval de retrieval como portão, alimentado pelo uso real — Spec

## References
- Card: [#18](https://github.com/leonardo-amaral-3/claude-brain/issues/18) — repo `leonardo-amaral-3/claude-brain`
- PRD: N/A — ferramenta de uma pessoa, sem trade-off de negócio a arbitrar. A Rota Completa aqui se justifica por **formato em disco**, não por produto.
- Decisões desta sessão: `#467` (snapshot vs. baseline) e `#468` (a 1ª consulta de toda rodada sai só com léxico).
- Diário de origem: `2026-09-10 Estratégia eval e quantization brain-mcp`.

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir `claude-brain/` no workspace `pessoal`)
- Base branch: `dev` — **`git fetch` antes de ramificar.** O `dev` local está em `f618b1b`, atrás do `origin/dev` (`74f97a2`); ramificar do local perderia `brain-mcp/scripts/injecao.mjs`. Conferido em 2026-09-11: `brain-mcp/` é idêntico entre `origin/dev` e `main`, então os `file:line` desta spec valem nos dois.
- Feature branch: `feat/18-eval-portao-uso-real`
- **Onde rodar: na instalação, sempre.** Não é preferência, são duas medições de 2026-09-11:
  - O **modelo de embeddings só está cacheado lá**: `node_modules/@huggingface/transformers/.cache/Xenova/multilingual-e5-small` ocupa **477 MB na instalação e não existe no checkout** (o pacote lá tem 12 MB). Como `embeddings.ts:26` liga `allowRemoteModels = true`, um servidor subido do checkout tentaria **baixar 465 MB** na primeira `aquecer()` — o aquecimento do CA3 estouraria o teto de 60 s e toda rodada sairia com código `2`.
  - O índice vivo também só existe lá (`~/notoria/claude/brain-mcp/data/brain.db`, 154 MB). O checkout não tem `data/brain.db` nem `brain.config.json` (ambos no `.gitignore`).
  - Pior ainda para a worktree que o `gm-implement` cria: ela nasce **sem `node_modules/`**, então nem `tsc` teria.
- **E a instalação não é repositório git** (`git rev-parse` lá falha; o `CLAUDE.md` já diz isso). Por isso o `--base` não pode fazer `git archive` no diretório onde roda — tem de alcançar o checkout por caminho explícito. Ver `### scripts/eval.mjs — o --base <ref>`.
- **Consequência para o ciclo de trabalho:** o que o portão mede é o `dist/` da instalação, não o `src/` do checkout. Antes de rodar o portão é preciso `./sync.ps1 push` + `npm run build` na instalação — o fluxo que o `CLAUDE.md` já manda, com o alerta de que "nada avisa quando ele fica velho". Este card faz o eval ser quem avisa (guardas 1 e 2 do `--base`).
- Todo script deste card resolve banco e config por `BRAIN_DB`/`BRAIN_CONFIG`, nunca por caminho fixo.

## Requisitos & critérios de aceite

### CA1 — `npm run uso` deixa de mentir sobre latência e passa a medir meia-busca

> **Dado** a tabela `uso` com chamadas gravadas depois da migração,
> **quando** roda `npm run uso`,
> **então** a coluna rotulada `p50` traz o **percentil 50** e não a média, existe uma coluna `p90`, e a linha do `search_context` traz a **fração de buscas respondidas sem a metade semântica**.

Medido em 2026-09-11 sobre 361 chamadas de `search_context`, é esta a diferença que o relatório esconde hoje: p50 = **148 ms**, média = **484 ms**, p90 = **524 ms**, p99 = **7.665 ms**. O rótulo `ms p50` em `scripts/uso.mjs:20` está sobre um `AVG(ms)` em `scripts/uso.mjs:22`.

**Todo número absoluto desta spec sobre a tabela `uso` é uma fotografia, não um contrato.** A tabela é viva: entre duas medições da mesma sessão de especificação ela foi de 1.012 para 1.031 linhas (361 → 375 `search_context`). O que vale é a **relação** — a média inflada pelo p99, a fração maior que zero —, nunca a igualdade com o número escrito aqui. Nenhum teste e nenhuma verificação deve comparar com um literal.

> **E dado** que as chamadas anteriores à migração têm `semantica` nulo,
> **então** elas não entram no denominador da fração e não fazem o relatório falhar.

### CA2 — existe golden set derivado do uso real, com a cobertura exigida

> **Dado** o `uso` da instalação,
> **quando** roda `npm run colher`,
> **então** `brain-mcp/scripts/golden.json` passa a ter **≥ 60 casos**, cada um com query, os filtros originais da chamada, o alvo e a origem.

A colheita foi medida em 2026-09-11 e rende **75 queries distintas** (77 pares brutos, janela de 90 s, dedup por query) — folga de 15 sobre o mínimo. Nenhum dos 75 alvos apodreceu: todos ainda estão indexados.

> **E** o conjunto cobre, com pelo menos um caso cada: `source: code`, `repo: operations-center`, e **dois** casos negativos que devem voltar vazio — um estrutural e um de assunto ausente.

`repo: operations-center` sai da colheita (23 alvos). **`source: code` não sai**: a telemetria tem zero `read_doc` sobre código, e sempre terá — em modo bypass o modelo lê código com `cat`, não com a tool. Esse caso e os negativos são escritos à mão.

> **E** a colheita falha ruidosamente se render menos de 60 casos ou se algum alvo não estiver mais indexado, e **nunca** apaga casos marcados `origem: "manual"`.

### CA3 — o portão barra a PR quando o nDCG@5 cai

> **Dado** uma mudança em `brain-mcp/src/` que piora o ranking (regressão forçada),
> **quando** roda `npm run eval -- --base origin/dev`,
> **então** imprime o nDCG@5 do base e do head sobre o **mesmo golden set e o mesmo snapshot de índice**, sai com código `1`, e o `/gm-ship` não abre a PR.

> **E dado** que a busca semântica não respondeu em algum caso,
> **então** a rodada sai com código `2` e a mensagem diz **"não consegui medir"** — nunca "regrediu".

A prova do CA3 é uma rodada com regressão forçada, registrada na PR: basta inverter a ordenação final de `Buscador.buscar` (`src/search.ts:301`) num commit descartável e mostrar o `exit 1`.

## Technical Overview

Quatro peças, nesta ordem de dependência:

1. **A tabela `uso` ganha `semantica`**, alimentada por um canal explícito no valor de retorno da tool. É a primeira migração de schema do repositório.
2. **`uso.mjs` passa a calcular percentis** e a fração de meia-busca.
3. **`colher-golden.mjs`** transforma pares `search_context`→`read_doc` da tabela `uso` em casos de golden set.
4. **`eval.mjs` vira portão**: nDCG@5, aquecimento obrigatório, rodada invalidável, e `--base <ref>` comparando dois servidores contra um snapshot congelado do índice.

As três decisões que governam o desenho:

- **O snapshot é o que torna a comparação honesta.** O índice é vivo — 6.276 documentos, oito servidores indexando, diário e cards novos a cada sessão. Base e head medidos em momentos diferentes contra o índice vivo mediriam deriva de índice e a chamariam de regressão de ranking.
- **Eliminado o ruído da semântica, o eval é determinístico** — SQL, RRF e o modelo fp32 são todos determinísticos, e o `sort` do V8 é estável. É isso, e só isso, que autoriza um portão **estrito** (qualquer queda barra) em vez de uma faixa de tolerância.
- **O portão é declarado, não mecânico.** Vive no `CLAUDE.md` deste repo, e quem o executa é a precondição 4 do `gm-ship` ("Run the full relevant suite… a PR never opens on red"). Nenhuma skill compartilhada é editada.

## Implementation Details

### Modo somente-consulta (`src/index.ts`)

Sem isto, os dois servidores do `--base` disputariam o lease do snapshot e cada um começaria a varrer, reconstruir grafo e gerar embeddings — trabalho de minutos que deixaria base e head vendo índices **diferentes**, destruindo a comparação. E um servidor compilado do ref **antigo** escrevendo no índice é o risco que a decisão `#467` recusa.

Não existe modo "nunca liderar" hoje: `BRAIN_LEASE_TTL_MS=0` faz o oposto — todo lease nasce vencido e **todo** processo se elege líder (`src/lease.ts:24-29`).

Nova variável `BRAIN_SOMENTE_CONSULTA=1`:

- `src/index.ts:44` — não chama `lease.tentarAdquirir()`; cai direto no ramo do seguidor.
- `src/index.ts:177` — não chama `assumirTrabalhoPesado()`.
- `src/index.ts:179` — não chama `lease.iniciarTique()`.
- `src/index.ts:166` — **`aquecer()` continua rodando.** O eval precisa da metade semântica; é só o trabalho pesado que some.
- `src/tools.ts` — a tool `reindex` responde recusa explícita neste modo, em vez de promover o processo.

### Canal de diagnóstico (`src/tools.ts`)

Hoje o `registerTool` (`src/tools.ts:40`) só enxerga `resp?.content?.[0]?.text` (`src/tools.ts:49`), e o `diag` do `Buscador` (`src/search.ts:306`) morre dentro do handler.

O handler do `search_context` passa a devolver, junto do `content`, um `_meta.brain = { semantica, lexicais, vetoriais, colapsados }`. **Verificado em 2026-09-11:** no SDK instalado, `ResultSchema` e `RequestMetaSchema` são `z.looseObject` (`node_modules/@modelcontextprotocol/sdk/dist/esm/types.js:100` e `:45`), então chaves próprias sob `_meta` sobrevivem à ida e à volta.

O mesmo canal serve aos dois consumidores, e é por isso que ele existe:
- o `registerTool` lê `_meta.brain.semantica` e grava a coluna;
- o **`eval.mjs` lê a mesma chave do resultado JSON-RPC** para decidir se a rodada é válida.

**O caminho do resultado vazio carrega o `_meta` igual ao do resultado cheio — esta é a parte que é fácil errar e que quebraria dois critérios de uma vez.** Hoje todos os returns passam pelo helper `text()` (`src/tools.ts:16-18`), que emite só `{ content }`, e o `Nenhum resultado…` (`src/tools.ts:102-107`) sai por ali mesmo tendo o `diag` em escopo desde `src/tools.ts:91`. Deixar como está significaria:

- **os casos negativos ficariam sem diagnóstico** — eles são, por definição, os que voltam vazios; o eval receberia `_meta.brain === undefined`, não conseguiria distinguir de `semantica === false`, e a regra de invalidação do CA3 não teria como decidir;
- **a coluna `semantica` ficaria `NULL` justamente nas linhas `vazio = 1`** — que são parte da população cuja fração o CA1 manda medir.

Portanto: `text()` ganha um segundo parâmetro opcional de diagnóstico, e a saída de `Nenhum resultado…` o usa. A única saída que legitimamente **não** carrega `_meta.brain` é `Query vazia` (`src/tools.ts:90`), que retorna antes de qualquer busca — ali não há o que diagnosticar, e a coluna fica `NULL` com razão. Correspondentemente, o `eval.mjs` trata `_meta.brain` ausente num caso do golden set como **código `2`**, nunca como `semantica === false`.

**Não** usar regex no rodapé (`src/tools.ts:117`): aquilo é prosa destinada ao modelo, e reescrevê-la faria a telemetria mentir em silêncio, sem teste que acusasse. Também **não** usar variável de módulo entre handler e wrapper: os handlers são `async` e duas buscas simultâneas gravariam o sinal de uma na linha da outra.

### Migração (`src/db.ts`)

O schema hoje é só `CREATE TABLE IF NOT EXISTS`, num único `db.exec(\`…\`)` que abre em `src/db.ts:49` e **fecha em `src/db.ts:148`** — não há máquina de migração. Tabela nova é aditiva de graça (foi assim que a `lider` entrou, em `src/db.ts:134`, dentro desse mesmo bloco); **coluna nova não é**: um banco vivo com mais de mil linhas nunca ganharia a coluna sozinho.

**O ponto de inserção é depois da linha 148 e antes do `return db;` da 149** — dentro do template literal não é código, é texto. (`src/db.ts:127` é a linha do `idx_uso_ts`, no meio da string: instrução ancorada ali cairia dentro do SQL.)

Em `openDb`, nesse ponto:

```
PRAGMA table_info(uso)  →  se não há coluna `semantica`:
ALTER TABLE uso ADD COLUMN semantica INTEGER
```

`ALTER TABLE` sob concorrência: há oito servidores subindo contra o mesmo arquivo. O `busy_timeout = 30000` (`src/db.ts:46`) serializa, e o perdedor recebe `duplicate column name`. Esse erro específico é engolido e o `PRAGMA` reconferido; qualquer outro sobe. Mesmo espírito do retry de WAL em `ligarWal` (`src/db.ts:24-36`).

`semantica` é `INTEGER` anulável: `1` semântica respondeu, `0` saiu só com léxico, `NULL` para as 1.012 linhas velhas e para as tools que não são `search_context`.

### `scripts/uso.mjs`

- O banco passa a vir de `process.env.BRAIN_DB` (fallback no caminho atual), para o relatório rodar do checkout apontando para a instalação.
- Percentis em SQL, não: o volume é pequeno (1.012 linhas) e `node:sqlite` já traz tudo para a memória. Ordenar o vetor de `ms` por tool e indexar em `floor(p * (n-1))` — exatamente o que esta sessão usou para medir, e o que reproduz os números do CA1.
- Cabeçalho passa a `tool · chamadas · vazias · p50 · p90 · só-léxico · resp média`.
- `só-léxico` = `SUM(semantica = 0) * 1.0 / NULLIF(COUNT(semantica), 0)`, em %, e `—` quando o denominador é nulo.

  **Tem de ser `COUNT(semantica)`, não `COUNT(semantica IS NOT NULL)`.** O segundo conta *todas* as linhas: `semantica IS NOT NULL` devolve 0 ou 1 e nunca `NULL`, então o `COUNT` nunca descarta nada e as 1.012 linhas velhas entrariam no denominador — diluindo a fração e violando o próprio CA1.

### `scripts/colher-golden.mjs` (novo)

Pareamento, exatamente como medido nesta sessão:

1. Lê de `BRAIN_DB` as linhas de `uso` com `tool IN ('search_context','read_doc')`, ordenadas por `ts`.
2. Para cada `search_context` com `vazio = 0`, procura o **primeiro** `read_doc` dentro de **90 s**. Sem `read_doc` na janela, o caso é descartado.
3. Dedup por query normalizada (trim + lowercase); vence a primeira ocorrência.
4. Valida que o alvo ainda existe em `docs`; alvo ausente vira aviso e o caso é descartado.
5. Emite `{ q, filtros, esperado, tipo, estilo, origem }`.

A janela de 90 s é escolha medida, não palpite: 30 s → 71 pares, 60 s → 73, **90 s → 77**, 120 s → 79, 300 s → 90. Depois de 90 s a curva vira captura de pares de sessões diferentes, porque a tabela `uso` **não tem coluna de sessão** e o pareamento é puramente temporal.

`esperado` é o caminho do alvo reduzido aos **dois últimos segmentos**, como o `eval.mjs` já compara (`scripts/eval.mjs:54`, `norm(p).includes(a)`) — caminho absoluto de máquina não entra no arquivo versionado.

`estilo`: `natural` quando a query tem `?` ou mais de 5 palavras; `keywords` caso contrário. Preserva o filtro de CLI que já existe (`node scripts/eval.mjs natural`, `scripts/eval.mjs:12-13`).

**Preservação:** o script lê o `golden.json` atual, mantém intactos todos os casos com `origem: "manual"` e substitui apenas os `origem: "uso:*"`. Os 10 casos de hoje são remarcados `manual` na primeira execução.

**Sem realimentação:** nenhum script do repo chama `read_doc` — conferido em 2026-09-11: o `smoke.mjs` só o cita na lista de tools esperadas (`scripts/smoke.mjs:63`), e o `injecao.mjs` não o menciona. Como o passo 2 exige o **par**, uma busca sintética não pode virar caso mesmo quando cai no banco vivo. Além disso o eval roda sempre contra snapshot, e as linhas de `uso` dele morrem junto.

### `scripts/golden.json` — formato novo

```json
{
  "q": "por que a AIH consolidada aparece duas vezes na tela de gestão de AIHs?",
  "filtros": { "source": null, "repo": null, "feature": null, "doc_type": null },
  "esperado": ["cards/1072", "1072-gestao-aihs-linha-fragmento"],
  "tipo": "positivo",
  "estilo": "natural",
  "origem": "manual"
}
```

Os filtros importam: **47 das 75** queries colhidas usavam algum filtro (`repo` em 106 das 361 chamadas, `source` em 61). Um golden set que jogasse os filtros fora mediria uma busca que ninguém faz.

Casos negativos:

```json
{ "q": "arquitetura core session bridge IPC canais renderer ChatScreen",
  "filtros": { "source": "mapa", "repo": "operations-center" },
  "esperado": [], "tipo": "negativo", "volatil": false, "origem": "manual",
  "nota": "vazio por construção do config: toda raiz `mapa` tem repo null, então a combinação nunca casa" }
```

O segundo negativo é de **assunto ausente** e leva `"volatil": true`. Quando ele deixar de ser vazio, o eval sai com código `2` ("caso apodreceu, recolha de novo"), não com `1` — mesma distinção do CA3 para a semântica.

Essa distinção não é teórica: **2 das 7** buscas vazias da telemetria já deixaram de ser vazias (medido em 2026-09-11 — o card #1 e o PRD do operations-center agora respondem). Um negativo escolhido sem essa regra quebraria o portão no primeiro dia.

Os casos `source: code`, escritos à mão, apontam para o **próprio `brain-mcp`** — `src/search.ts` (timeout do embed e RRF), `src/lease.ts` (eleição). Isso os mantém estáveis e, de quebra, não acrescenta nenhum detalhe de cliente ao repositório público.

### `scripts/eval.mjs` — a métrica

**nDCG@5 com relevância binária.** Um caso tem um alvo (ou um conjunto de alvos aceitáveis — só 1 das 75 queries tinha mais de um); o ganho é 1 no primeiro resultado que casa, 0 nos demais. Logo `IDCG@5 = 1/log2(2) = 1` e:

- **positivo:** `nDCG@5 = 1 / log2(rank + 1)` se o alvo está no top-5 (`rank` 1-based), senão `0`.
- **negativo:** `1` se a resposta é vazia, `0` caso contrário.
- **métrica do portão:** média aritmética sobre todos os casos.

Com um único alvo relevante, isso é um MRR com desconto logarítmico — dito aqui para ninguém se surpreender depois. `hit@1`, `hit@5` e `MRR` continuam impressos como secundários: são legíveis e o histórico existe. O que **deixa** de ser portão é o `hit@5`, e é exatamente por isso que este card existe — em 2026-09-10 ele marcava 10/10, saturado, sem margem para acusar regressão (`scripts/eval.mjs:69`).

### `scripts/eval.mjs` — aquecimento e validade

Medido em 2026-09-11 (decisão `#468`): o modelo fica pronto entre **+0,4 s e +5,7 s** do boot, e o eval hoje dispara logo após o `initialize`. A primeira consulta sai só com léxico e devolve um **1º lugar diferente** — o doc de planning em vez do card #1072. Com 75 casos a ~150 ms, boa parte da rodada pode terminar antes de o modelo existir.

1. Depois do `initialize`, dispara uma query descartável a cada 500 ms, até `_meta.brain.semantica === true`, com teto de 60 s. Estourou o teto → código `2`.
2. Durante a medição, qualquer caso com `semantica === false` **invalida a rodada** → código `2`, nomeando o caso.
3. `limit: 5` fixo em todos os casos, inclusive nos cujo uso original pediu outro limite: a métrica é @5 e `colapsar` (definida em `src/search.ts:229`, chamada em `src/search.ts:303`) se comporta em função do limite pedido.

Códigos de saída — é o que torna o portão legível por máquina:

| código | significado |
|---|---|
| `0` | não caiu (ou, sem `--base`, apenas relatório) |
| `1` | **regrediu**: nDCG@5 do head abaixo do base |
| `2` | **não consegui medir**: semântica caiu, caso apodrecido, base não compilou, checkout não resolvido, branch da instalação ≠ branch do checkout, ou `dist/` mais velho que `src/` |

Código `2` **nunca** é licença para seguir. É a diferença entre "o ranking piorou" e "a medição não aconteceu", e as duas barram a PR — mas só a primeira é assunto de código.

### `scripts/eval.mjs` — o `--base <ref>`

**Resolver o checkout primeiro.** O eval roda na instalação, que não é git. O caminho do repositório vem, nesta ordem: flag `--repo <path>` → `BRAIN_REPO` → a linha `worktree=` de `~/.claude/brain-sync-origem.txt` (escrita pelo `sync push`; `sync.sh:53-62`). Nenhum dos três resolvendo para um diretório git → código `2`, dizendo qual usar. O marcador é o elo natural porque é o único lugar da máquina que registra de qual pasta a instalação veio.

**Duas guardas contra medir a coisa errada**, ambas antes de qualquer trabalho:

1. **Branch.** `branch=` do marcador ≠ branch atual do checkout → código `2`. É o que impede o portão de comparar `origin/dev` contra um `dist/` que foi sincronizado de outra branch.
2. **Frescor do build.** `dist/index.js` da instalação mais velho que o `src/*.ts` mais recente dela → código `2`, mandando rodar `npm run build`. É o "nada avisa quando ele fica velho" do `CLAUDE.md`, virando aviso.

Só então:

1. **Snapshot.** `VACUUM INTO '<tmp>/snapshot.db'` a partir do banco de `BRAIN_DB`. `VACUUM INTO` dá cópia consistente **incluindo o conteúdo do WAL** num arquivo único — copiar `brain.db` + `-wal` + `-shm` à mão não garante isso. Roda **sempre**, com ou sem `--base`: é o que impede a rodada de escrever `uso` sintético no índice vivo e de disputar o lease dele.

   Comprovado em 2026-09-11 no Node v24.18.0 (SQLite 3.53.1 embutido): `DatabaseSync.exec("VACUUM INTO '<path>'")` funciona sobre banco em WAL e o snapshot reabre `readOnly`. Duas ressalvas que o script tem de respeitar: **o SQLite falha se o arquivo de destino já existir** — o caminho temporário precisa ser garantidamente novo (`mkdtemp`, não caminho fixo) e limpo em erro; e a cópia é de ~155 MB (154 MB + ~6 MB de WAL), **uma vez por rodada de `eval`**, não uma por servidor.
2. **Compilação do base.** `git -C <checkout> archive <ref> -- brain-mcp/src brain-mcp/tsconfig.json | tar -x -C <instalação>/.eval-base`, depois `tsc -p <instalação>/.eval-base/brain-mcp/tsconfig.json --outDir <instalação>/dist-base`, com o `tsc` da instalação. Falha de compilação → código `2`.

   Os dois detalhes de caminho são obrigatórios, e cada um evita um modo de falha concreto:

   - **Extrair dentro da instalação, não em `tmpdir`.** O `tsc` resolve `node_modules` subindo a partir do `tsconfig.json`. Num temporário não há `node_modules` ancestral, e a compilação morre sem achar `node:sqlite` nem `@types/node`. Extraído em `<instalação>/.eval-base/brain-mcp/`, a subida chega em `<instalação>/node_modules`.
   - **Usar `-p <tsconfig>` e não `--rootDir`/`--outDir` soltos.** Passar arquivos ou `rootDir` na linha de comando faz o `tsc` **ignorar o `tsconfig.json` inteiro**, e o build cairia para os padrões (`ES5`/CommonJS) — `import.meta` e o *top-level await* de `src/index.ts:91` não compilam assim. Com `-p`, o `--outDir` da linha de comando apenas sobrescreve aquela opção. De quebra, compila-se o `tsconfig.json` **do ref base**, que é o honesto quando o base tinha outras opções.

   O `dist-base/` fica dentro da `brain-mcp/` da instalação pelo mesmo motivo: o Node resolve o `node_modules` dela — inclusive o cache do modelo — e `packageRoot` (`src/config.ts:46`) continua apontando para o lugar certo.
3. **Duas rodadas**, base e head, cada uma com `BRAIN_DB=<tmp>/snapshot.db`, `BRAIN_CONFIG=<config da instalação>` e `BRAIN_SOMENTE_CONSULTA=1`. Head é `dist/`, base é `dist-base/`.
4. **Comparação.** Barra quando `nDCG@5(head) < nDCG@5(base) - 1e-9`. O épsilon é só contra ruído de ponto flutuante; não é faixa de tolerância, e não deve virar uma.
5. Imprime a tabela base/head, o delta, e **os casos que mudaram de posição** — sem isso o número diz que caiu e não diz onde.
6. Apaga `dist-base/`, `.eval-base/` e o snapshot ao sair, inclusive em erro.

### `CLAUDE.md` do repo — onde o portão é declarado

Na seção `## A esteira`, o delta 2 deste repo ("Toda mudança em `brain-mcp/src/` fecha com o índice provado, não com o `tsc` verde") passa a nomear o comando e a consequência:

> Mudou `brain-mcp/src/`? A suíte relevante para a precondição 4 do `/gm-ship` inclui
> `npm run eval -- --base origin/dev`. Código `1` é **vermelho**: a PR não abre. Código `2` não é
> licença para seguir — é medição que não aconteceu, e a PR também não abre.

## File Change Summary

| arquivo | o que muda |
|---|---|
| `brain-mcp/src/db.ts` | primeira migração do repo: `ALTER TABLE uso ADD COLUMN semantica`, com guarda de concorrência |
| `brain-mcp/src/tools.ts` | `_meta.brain` no retorno do `search_context`; `registerTool` grava `semantica`; `reindex` recusa em modo somente-consulta |
| `brain-mcp/src/index.ts` | `BRAIN_SOMENTE_CONSULTA`: pula eleição, trabalho pesado e tique — mantém `aquecer()` |
| `brain-mcp/scripts/uso.mjs` | p50/p90 de verdade, coluna só-léxico, banco por `BRAIN_DB` |
| `brain-mcp/scripts/colher-golden.mjs` | **novo** — pareia `uso` e emite o golden set |
| `brain-mcp/scripts/eval.mjs` | nDCG@5, aquecimento, rodada invalidável, snapshot, `--base`, resolução do checkout, guardas de branch/frescor, filtros e negativos |
| `brain-mcp/scripts/golden.json` | formato novo; 10 casos remarcados `manual` + ~75 colhidos + casos `code` e negativos |
| `brain-mcp/package.json` | script `colher` |
| `brain-mcp/README.md` | `## Qualidade da busca` **inteira (151-170**, até o `## Comandos` da 171) reescrita — não só o primeiro parágrafo: 157-169 falam de deriva do golden set e do "vai falhar na sua máquina", e contradiriam o portão. Mais: `:179` (`npm run eval # … hit@1 / hit@5 / MRR`) vira nDCG@5, `npm run colher` entra no bloco de comandos (174-185), e `BRAIN_SOMENTE_CONSULTA` entra no parágrafo de variáveis (187-189), que hoje só lista `BRAIN_CONFIG`, `BRAIN_DB`, `BRAIN_LEASE_TTL_MS` e `BRAIN_CLI_ESPERA_MS` |
| `.gitignore` | `brain-mcp/dist-base/` — o `dist-base/` nasce na instalação, que não é git, mas a linha protege quem tenha um checkout completo |
| `CLAUDE.md` | declara o portão na `## A esteira` |

Sem mudança: `src/search.ts` (o `diag` já existe e já é devolvido), `src/lease.ts`, `src/vectors.ts`.

## Migrations & compatibilidade

Uma migração, aditiva e não destrutiva: `ALTER TABLE uso ADD COLUMN semantica INTEGER`.

- **Janela de risco:** a primeira abertura do banco por um servidor com o código novo. Oito servidores podem tentar ao mesmo tempo; o `busy_timeout` serializa e o perdedor engole `duplicate column name`.
- **Compatibilidade para trás:** um servidor **antigo** abrindo um banco **já migrado** funciona — os `INSERT` dele nomeiam colunas explicitamente (`src/tools.ts:51`), e a coluna nova é anulável. É o que permite os oito servidores conviverem durante a troca, sem parar ninguém.
- **Backfill:** nenhum, de propósito. As linhas antigas ficam `NULL` e a fração do CA1 passa a valer daqui para a frente. Inventar valor para elas seria inventar medição.

## Rollback

`git revert` do merge e `npm run build` na instalação. A coluna `semantica` **fica** no banco — é anulável, ninguém a lê depois do revert, e removê-la exigiria reconstruir a tabela por nada.

O golden set volta ao formato antigo junto com o revert; nenhum dado vivo depende dele.

Nada aqui roda em produção de cliente: o "deploy" é `./sync.ps1 push` + `npm run build` na instalação.

## Verificação pós-deploy

**Obrigatória e bloqueante.** O workspace não tem segundo humano no G2 (`CLAUDE.md`, delta 1), e esta mudança altera schema de um banco vivo — é aqui que o contrapeso cai.

Depois do `sync` + `build` na instalação, e depois de **reiniciar ao menos uma sessão** para gerar chamadas novas:

1. **A coluna existe:** `PRAGMA table_info(uso)` lista `semantica`.
2. **Nada foi perdido:** anote `SELECT COUNT(*) FROM uso` **antes** do build e confira que o depois é ≥ o antes. Comparar com um literal não serve — a tabela cresce sozinha enquanto a verificação acontece.
3. **As linhas novas têm o sinal:** `SELECT tool, semantica, COUNT(*) FROM uso WHERE ts > <migração> GROUP BY 1,2` mostra `search_context` com `0`/`1` e as demais tools com `NULL`.
   **E inclui as vazias:** `SELECT COUNT(*) FROM uso WHERE ts > <migração> AND vazio = 1 AND semantica IS NULL` tem de dar **0** fora de `Query vazia` — é a prova de que o caminho do resultado vazio carrega o `_meta`.
4. **O relatório não quebra com o misto:** `npm run uso` roda e imprime a coluna só-léxico sem dividir por zero.
5. **A meia-busca aparece:** a fração só-léxico é **> 0** — se der 0 % com sessões reais, o sinal não está sendo gravado, porque sabemos que a primeira consulta de toda sessão cai no léxico.

## Plano de testes

| critério | o que prova | onde |
|---|---|---|
| CA1 | percentil bate com o vetor ordenado; fração ignora `NULL` | caso novo em `scripts/concorrencia.mjs` sobre fixture com `uso` semeado (ímpar, par e só-`NULL`) |
| CA1 | relatório não quebra com banco pré-migração | mesma fixture, `uso` sem a coluna → abre, migra, imprime |
| CA1 | **busca vazia grava `semantica`, não `NULL`** | fixture cuja query não casa nada → linha com `vazio = 1` e `semantica` preenchida; e `Query vazia` → `semantica NULL` |
| CA3 | resposta sem `_meta.brain` invalida | resultado forjado sem o campo → código `2`, distinto de `semantica === false` |
| CA2 | pareamento em 90 s, dedup, alvo apodrecido descartado | fixture de `uso` com par válido, par a 91 s, query repetida e alvo fora de `docs` |
| CA2 | `origem: "manual"` sobrevive à recolheita | roda `colher` duas vezes; casos manuais idênticos |
| CA2 | cobertura exigida | asserção no próprio `colher`: ≥60, ≥1 `code`, ≥1 `operations-center`, 2 negativos |
| CA3 | nDCG@5 correto | tabela de ranks conhecidos → `1, 0.63, 0.5, 0.43, 0.39, 0` |
| CA3 | semântica caída invalida | servidor sem aquecer → código `2`, não `1` |
| CA3 | negativo volátil apodrecido → código `2` | fixture onde o negativo passa a ter resultado |
| CA3 | **regressão forçada barra** | `--base` contra commit descartável com a ordenação invertida em `src/search.ts:301` → código `1` |
| CA3 | guarda de branch | marcador com `branch=X`, checkout em `Y` → código `2`, sem compilar nada |
| CA3 | guarda de frescor | `touch` num `src/*.ts` da instalação deixando `dist/` velho → código `2` |
| CA3 | checkout não resolvido | sem `--repo`, sem `BRAIN_REPO` e sem marcador → código `2` nomeando as três saídas |
| regressão | o servidor ainda responde | `npm run smoke` |
| regressão | modo somente-consulta não varre | caso em `concorrencia.mjs`: com a flag, `lider` fica vazia e nenhum arquivo é indexado |

O repo não tem runner de teste e este card não introduz um: os casos entram em `scripts/concorrencia.mjs`, que já é o arnês de fixture descartável — mesmo padrão que a task 3 do card #1 estabeleceu. Os encaixes, conferidos em 2026-09-11: registro de casos em `concorrencia.mjs:77-78` (`const casos = []` / `caso(nome, fn)`), `criarFixture` em `:102`, `BRAIN_DB`/`BRAIN_CONFIG` da fixture em `:63-64`, laço do runner em `:1208`. Caso novo entra declarando `caso("nome", async () => {…})`, sem tocar o runner.

Vale notar que o `ttl-zero-desliga-o-lease` (`concorrencia.mjs:322-347`) já **prova** a afirmação em que o modo somente-consulta se apoia: com `BRAIN_LEASE_TTL_MS=0`, dois processos adquirem o lease (`ra === true && rb === true`). É por isso que a flag nova é necessária e não redundante.

## Technical Decisions

1. **Golden set versionado no repo público**, como hoje. Descartados: mantê-lo fora do git (nenhuma query de cliente publicada, mas o portão morreria para quem clona) e redigi-lo (custo por caso, e deixaria de ser "o que o uso real mostrou", que é a premissa do card). **Consequência assumida:** ~75 queries de trabalho real da Notoria passam a ser públicas. Os casos novos escritos à mão apontam para o próprio `brain-mcp` justamente para não aumentar essa superfície.
2. **`--base` compara por snapshot + dois servidores** (decisão `#467`). Descartados: `baseline.json` versionado (confunde deriva de índice com regressão) e dois servidores no índice vivo (o servidor do ref base disputa o lease de produção). Fixture de corpus congelado é incompatível com um golden set colhido do índice vivo, e a spec do card #1 já designou "`npm run eval` contra o índice real" como o lugar da prova.
3. **Aquecer e abortar, com portão estrito** (decisão `#468`). Descartadas as duas formas de tolerância: a faixa engole regressão menor que ela, e o eval é determinístico depois que o ruído da semântica sai — não há o que uma faixa protegesse.
4. **O portão é declarado no `CLAUDE.md`**, executado pela precondição 4 do `gm-ship`. Descartados: hook de `pre-push` versionado (mais mecânico, mas o card ganharia o problema de calar o hook em mudança só de docs) e ensinar o `gm-ship` a ler portões (alcance na esteira da Notoria, e o card viraria dois assuntos). **Fragilidade assumida:** é prosa, e nada impede fisicamente a PR.
5. **Coluna nova em `uso`**, com a primeira máquina de migração do repo. Descartada a tabela `uso_diag` (aditiva de graça, como a `lider`, mas espalharia o que se sabe de uma chamada por dois lugares e exigiria JOIN no relatório).
6. **Canal no valor de retorno (`_meta.brain`)**. Descartada a regex no rodapé — é o padrão que o `vazio` já usa (`src/tools.ts:58`), mas o rodapé é prosa para o modelo e reescrevê-lo faria a telemetria mentir sem teste que acusasse. Descartada a variável de módulo: handlers `async` se atropelam.
7. **Dois negativos, com regra de apodrecimento.** Descartado só o estável (nenhuma mudança de BM25 ou de vetor jamais o faria falhar) e só o de assunto ausente (um documento novo derrubaria o portão e quem shipasse acharia que quebrou o ranking).
8. **`BRAIN_SOMENTE_CONSULTA` é infraestrutura deste card, não escopo extra.** Sem ele o snapshot é reindexado por baixo da comparação e o `--base` não fecha.
9. **O portão roda na instalação e alcança o git do checkout**, não o contrário. Descartado rodar do checkout: o cache do modelo (477 MB) só existe na instalação, e sem ele o aquecimento do CA3 nunca fecha — a rodada sairia com código `2` por download, não por ranking. Descartado também exigir que o desenvolvedor passe o caminho do repo à mão toda vez: o `worktree=` do `brain-sync-origem.txt` já registra esse elo, e a flag `--repo` fica como escape para quem não tem o marcador.
10. **As duas guardas (branch e frescor do build) são parte do portão, não conveniência.** Sem elas o `--base` compara `origin/dev` contra um `dist/` que pode ser de outra branch ou anterior à última edição — e devolveria "não caiu" com toda a confiança, que é a pior falha possível num portão.

## Coding Standards

- Scripts em `.mjs` solto, sem runner, com `fail()` + `process.exit` — padrão de `smoke.mjs:45-48` e vizinhos.
- Comentário no topo de cada script dizendo **por que ele existe**, não o que ele faz; é a convenção visível em `eval.mjs:1-4`, `uso.mjs:1-2` e `embeddings-falso.mjs:1-13`.
- Caminho de banco e config **sempre** por `BRAIN_DB`/`BRAIN_CONFIG` com fallback — nunca literal.
- Nada além do especificado. Em particular, **fora deste card**: investigar o p99 de 7,6 s do `search_context`, trocar o índice vetorial por ANN, quantizar para `q8` e re-embutir com breadcrumb. Os dois últimos são os que este portão existe para julgar — implementá-los aqui seria o réu escrevendo a sentença.
