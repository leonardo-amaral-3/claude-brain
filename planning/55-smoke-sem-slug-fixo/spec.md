# Smoke do brain-mcp prova o feature_timeline sem slug fixo — Spec

> Profundidade: **Rota curta** (G2 em modo despachado, cofre #1632). Um arquivo de teste e um bloco
> de ~30 linhas. Não toca `brain-mcp/src/`, formato em disco nem superfície de tool.

## References
- Card: [#55](https://github.com/leonardo-amaral-3/claude-brain/issues/55) — repo `leonardo-amaral-3/claude-brain`
- Decisões: G1 cofre #1626 · abordagem cofre #1632 · portão cofre #1651 (substitui #1634, que substituiu #1633) · pendência fora do escopo cofre #1648
- Irmão, fora deste escopo: #51 (o T16 do `jev.mjs` depende do conteúdo do índice)
- Destravados por este card: #45 e #46 (as PRs deles mexem em `brain-mcp/src/` e rodam o smoke pela regra 2)

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir `claude-brain/` no workspace; card em voo na worktree `~/pessoal/claude-brain-55-smoke-sem-slug-fixo`)
- Base branch: `dev`
- Feature branch: `feat/55-smoke-sem-slug-fixo`

## Requisitos & critérios de aceite

- **CA1.** Dado o índice vivo atual, quando `npm run smoke` roda, então:
  - imprime o bloco `--- feature_timeline('<slug>') ---` contendo `Documentos:`;
  - o `<slug>` existe em `docs.feature`;
  - chega a `SMOKE OK` e sai `0`.

  A checagem roda, não é pulada.
- **CA2a.** Dado um índice em que o `feature_timeline` não devolve `Documentos:` para o slug que o
  `list_features` listou, quando o smoke roda, então sai `1` com a linha
  `FALHOU: feature_timeline sem documentos para '<slug>', que o list_features listou`.
- **CA2b.** Dado um índice sem nenhuma feature (`docs.feature` nulo em todo doc), quando o smoke
  roda, então sai `1` com a linha
  `FALHOU: feature_timeline: o índice não tem nenhuma feature (o list_features não listou nenhuma), então não há slug para provar a tool`.
  Essa falha vem **antes** da checagem `list_features com poucas features`, que não aparece no log.
- **CA2c.** Dado um `list_features` que responde com erro (um resultado com `isError` ou um erro
  JSON-RPC), quando o smoke roda, então sai `1` com uma linha que começa por
  `FALHOU: feature_timeline: o list_features que daria o slug falhou:`. Nunca sai com a mensagem do
  CA2b.
- **CA3.** Comparado com a base da branch, `brain-mcp/src/` não muda. Em `brain-mcp/`, o único
  arquivo alterado é `brain-mcp/scripts/smoke.mjs`. Nele, só as linhas 76–82 da base (o bloco do
  `feature_timeline`) são substituídas, e as linhas 1–75 e 83–126 da base ficam idênticas.

> **Emenda 2026-11-11 (G4 da PR #58, achados 3 e 6; o texto acima fica como estava).** O G4 achou
> que, quando o regex `/^- (\S+) \[/` não casava, o bloco sempre dizia "índice sem feature", mesmo
> quando a causa era formato mudado ou resposta malformada. A partir desta emenda:
>
> - **CA2b** passa a reconhecer o índice vazio pelo **sentinela** do `list_features`: o texto começa
>   com `Nenhuma feature encontrada` (`src/tools.ts:257`). A mensagem e o exit continuam os mesmos, e
>   `poucas features` continua sem aparecer.
> - **CA2d (novo).** Dado um `list_features` sem erro cujo texto não tem nenhuma linha que case o
>   regex e não começa com o sentinela (inclusive texto vazio ou ausente), quando o smoke roda, então
>   sai `1` com uma linha que começa por
>   `FALHOU: feature_timeline: o list_features respondeu num formato inesperado` e mostra o começo do
>   texto recebido (texto vazio → o resultado inteiro). Nunca sai com a mensagem do CA2b.
> - **CA2c**, achado 6: com `isError` e texto vazio ou ausente, o motivo cai para
>   `JSON.stringify(catalogo.result)`, e a linha não termina mais em `falhou: ` sem causa.
> - O bloco de `## Implementation Details` ganha esses dois ramos, só dentro dele. As duas strings
>   únicas das sabotagens (`.find(Boolean);` e a da chamada `catalogo`) não mudam. O CA3 vale com o
>   bloco maior: cabeça 1–75 e cauda (as 44 linhas finais) idênticas à base.
> - O Plano de testes ganha a prova do CA2d, rodada junto com os passos 0 a 6: (a) o regex sabotado
>   numa cópia ao lado (`\[/` → `\[SABOTADO55/`), com o catálogo real, que não é o sentinela;
>   (b) `catalogoText` forçado a `""`. Os dois saem `1` com a linha do CA2d e sem a do CA2b. E a do
>   achado 6: o nome da tool sabotado (passo 4) mais o texto forçado a `""` sai `1` com o
>   `JSON.stringify` do resultado depois de `falhou: `.

## Premissas medidas

Todas foram medidas em 2026-11-11 nesta sessão, com Node 22.23.4 e o `dist/` da worktree em
`origin/dev` 1e81d49.

- **"Snapshot"** é uma cópia do índice vivo tirada com
  `sqlite3 "file:/home/leo/notoria/claude/brain-mcp/data/brain.db?mode=ro" ".backup /tmp/smoke55/brain.db"`.
- O servidor rodou sempre com `BRAIN_SOMENTE_CONSULTA=1` e
  `BRAIN_CONFIG=/home/leo/notoria/claude/brain-mcp/brain.config.json`, sem
  `TYPESAFE_API_KEY`/`BRAIN_JEV`/`BRAIN_JEV_FALSO`.

| Premissa | Prova | Resultado |
|---|---|---|
| O smoke de `origin/dev` falha só por causa do slug fixo | `node scripts/smoke.mjs` contra o snapshot | `Nenhum doc com feature="motor-lancamentos-automaticos"`, depois `FALHOU: feature_timeline sem documentos`, exit 1. O `search_context('subfaturamento')`, que roda antes, passa |
| O índice vivo não tem o slug fixo | `SELECT COUNT(*) FROM docs WHERE feature='motor-lancamentos-automaticos'` (índice vivo, `mode=ro`) | `0` |
| O índice vivo tem features | `SELECT COUNT(DISTINCT feature) FROM docs WHERE feature IS NOT NULL` | 80 slugs distintos. O `list_features` imprime 96 linhas, porque agrupa por `(feature, repo)` |
| Toda feature listada pelo `list_features` tem doc para o `feature_timeline` | `list_features`: `src/tools.ts:231` (`feature IS NOT NULL`) e `:237-246` (query agrupada sobre `docs`). `feature_timeline`: `src/tools.ts:278-289`, com `WHERE feature = ?` na mesma coluna | O slug listado sempre tem pelo menos 1 doc. O timeline não filtra por repo nem por status |
| A linha do `list_features` tem o formato `- <slug> [<repo ou ?>]…` | `src/tools.ts:258-262` | Confirmado. Repo nulo vira `[?]`, e hoje os 5 primeiros têm `typeof(repo) = null`. Duas respostas não casam o regex: a linha final `Use feature_timeline…` e o `Nenhuma feature encontrada…` |
| Nenhum slug tem espaço ou colchete, então `/^- (\S+) \[/` pega o slug inteiro | `… WHERE feature GLOB '*[ []*' OR feature GLOB '*]*'` e `… WHERE feature <> trim(feature) OR feature=''` | `0` e `0` |
| A primeira linha hoje é uma feature ativa | A query do `list_features` com `LIMIT 1`, contra o snapshot | `118-fabrica-agentica` (68 docs, 2026-11-11) |
| O bloco **exato** desta spec cumpre os CAs | O bloco foi copiado desta spec para `/tmp/smoke55/exato.mjs`, junto com as linhas 1–75 e 83–126 do `smoke.mjs` de `origin/dev` e o `root` apontando para a worktree. As sabotagens dos passos 3, 4 e 5 do Plano de testes foram aplicadas pelo `sed` deles, e cada padrão casa uma linha só | **CA1:** `feature_timeline('118-fabrica-agentica')` + `Documentos:` + `SMOKE OK`, exit 0. **CA2b:** a mensagem do CA2b, exit 1. **CA2a:** `… sem documentos para '118-fabrica-agentica-sabotado-55', que o list_features listou`, exit 1. **CA2c (`isError`):** `… falhou: MCP error -32602: Tool list_features_sabotado_55 not found`, exit 1. **CA2c (JSON-RPC):** `… falhou: {"code":-32601,"message":"Method not found"}`, exit 1 |
| **Numa worktree fria, o smoke estoura o timeout no `recent_activity`** | Código: `src/tools.ts:336` chama `syncer.kickIfStale()`. O `doSync` (`src/githubSync.ts:136-147`) é async sem nenhum `await` e chama o `gh` por `execFileSync` (`:55-60`): o sync inteiro roda síncrono, inclusive em somente-consulta. Depois, o `afterSync` roda `indexer.scan()` (`src/index.ts:37-40`). Dados: o `brain-mcp/data/github/` da worktree nasceu às 10:12:38, na 1ª rodada do protótipo, e o `state.json` só foi gravado às 10:15:24 | Das 5 rodadas do protótipo, a 1ª saiu `1` sem linha `FALHOU`. A linha `timeout em …` não foi guardada, então o mecanismo é inferido do código e dos timestamps. O `syncIntervalMin` da instalação é `30` (`brain.config.json`, bloco `github`). É defeito de `src/` e fica fora do escopo (cofre #1648) |
| O aquecimento evita esse timeout | Com o `state.json` da worktree posto de lado, `node dist/cli.js --github --force` com `BRAIN_DB` num snapshot descartável. Depois, um snapshot novo e o bloco exato | A CLI saiu 0 em 152 s, com `lastSyncIso` de agora. O smoke logo em seguida saiu 0, com `SMOKE OK` de primeira e sem servidor filho vivo depois |
| O smoke grava no índice que lê | `src/tools.ts:55-82`: toda tool grava uma linha em `uso`, inclusive em somente-consulta. Conferido na tabela `uso` do snapshot depois das rodadas | Há linhas de `feature_timeline` e `list_features`. Por isso o portão roda contra snapshot (#1651) |
| O slug variável não contamina o golden set | `scripts/colher-golden.mjs:85` só colhe `tool IN ('search_context','read_doc')` | `list_features` e `feature_timeline` ficam fora da colheita |
| Nada importa o `smoke.mjs` | `grep -rn smoke` no repo, fora de `node_modules` | Só o `brain-mcp/package.json:12` executa o script. O resto é eco ou comentário: `install.sh:174`, `install.ps1:222`, `brain-mcp/README.md`, e comentários em `injecao.mjs`, `concorrencia.mjs` e `colher-golden.mjs`. O `scripts/classificar-parada.mjs:297` fala de outro smoke. Nenhum import |
| A `origin/dev` andou, mas sem mexer no que esta spec usa | `git log 1e81d49..origin/dev` e `git diff --stat 1e81d49 origin/dev -- brain-mcp/` | A ponta é 719c70a (PRs #56 do #51 e #50 do #41). Em `brain-mcp/` só mudou `scripts/jev.mjs`. `src/` e `scripts/smoke.mjs` estão idênticos, então as linhas 76–82 e todas as premissas valem também sobre a ponta atual |
| O slug fixo não aparece em outro lugar | `grep -rn motor-lancamentos-automaticos`, fora de `node_modules`/`dist` | Só em `smoke.mjs:78` e `:81` |

## Technical Overview

O bloco do `feature_timeline` (`smoke.mjs:76-82`) passa a perguntar ao próprio servidor qual feature
existe. Ele faz uma chamada **própria** a `list_features` e usa o slug da primeira linha do catálogo.

São três falhas distintas, cada uma com mensagem própria:
- o `list_features` deu erro;
- o índice não tem feature;
- o timeline não devolveu `Documentos:` para um slug que o catálogo listou.

O bloco do `list_features` mais abaixo (`nFeats < 5`) não muda.

A chamada é própria, e não reaproveitada, por dois motivos: o diff não toca as outras checagens
(CA3), e a mensagem de índice vazio sai antes de `list_features com poucas features` (CA2b).

## Implementation Details

### `brain-mcp/scripts/smoke.mjs`

Substituir **exatamente** as linhas 76–82 de `origin/dev`, de `const tl = await request("tools/call", {`
até `if (!tlText.includes("Documentos:")) fail("feature_timeline sem documentos");` inclusive, por:

```js
// O slug sai do próprio índice (card #55): um slug fixo envelhece com o corpus e deixa a base
// vermelha sem defeito no código. A chamada ao list_features é própria, e não a do bloco de
// baixo, para que um índice sem feature nenhuma falhe AQUI, com a mensagem que diz isso, e não
// como "poucas features".
const catalogo = await request("tools/call", { name: "list_features", arguments: {} });
const catalogoText = catalogo.result?.content?.[0]?.text ?? "";
if (catalogo.error || catalogo.result?.isError) {
  const motivo = catalogo.error ? JSON.stringify(catalogo.error) : catalogoText;
  fail("feature_timeline: o list_features que daria o slug falhou: " + motivo.slice(0, 300));
}
const slug = catalogoText
  .split("\n")
  .map((l) => l.match(/^- (\S+) \[/)?.[1])
  .find(Boolean);
if (!slug) {
  fail(
    "feature_timeline: o índice não tem nenhuma feature (o list_features não listou nenhuma), " +
      "então não há slug para provar a tool"
  );
}

const tl = await request("tools/call", {
  name: "feature_timeline",
  arguments: { feature: slug },
});
const tlText = tl.result?.content?.[0]?.text ?? "";
console.log(`\n--- feature_timeline('${slug}') ---\n` + tlText.slice(0, 900));
if (!tlText.includes("Documentos:")) {
  fail(`feature_timeline sem documentos para '${slug}', que o list_features listou`);
}
```

Regras do bloco:

- Duas strings aparecem **uma única vez** no arquivo: `.find(Boolean);` e
  `const catalogo = await request("tools/call", { name: "list_features"`. As sabotagens do Plano de
  testes as localizam com `sed`, então elas não podem mudar de forma.
- `fail()` (`smoke.mjs:45-49`) já chama `process.exit(1)`. Não vai `return` nem `else` depois dele.
- `list_features` vai sem argumentos, sem `repo` e sem `apenas_ativas`. Assim, um índice só com
  features arquivadas continua provando a tool, porque o timeline não filtra por status.
- Nenhuma variável de ambiente escolhe o slug: seria de novo um slug fixo, só que configurável.

## File Change Summary

- `brain-mcp/scripts/smoke.mjs` — alterado: as linhas 76–82 viram o bloco acima. Nada mais muda.
- `planning/55-smoke-sem-slug-fixo/spec.md` — esta spec, e `tasks/` pelo `/gm-plan-tasks`.

Nenhum outro arquivo muda. O `brain-mcp/README.md:220` ("sobe o servidor por stdio e testa as tools")
continua certo.

## Migrations & compatibilidade

N/A — é um script de teste. Não toca índice, `conversations.json`, decisões nem tool. O
`list_features` e o `feature_timeline` são chamados com argumentos que já aceitam.

## Rollback

`git revert` do commit na `dev`. Nada se instala sozinho: o `sync.sh push` leva `brain-mcp/scripts/`
para a instalação, mas o smoke só roda quando alguém o chama.

## Verificação pós-deploy

N/A como verificação pós-deploy, porque não há deploy: o efeito acontece na PR. A prova são os
passos 0 a 6 do Plano de testes. O efeito de fato aparece quando a próxima PR de `brain-mcp/src/`
(#45 ou #46) rodar o smoke pela regra 2 e passar do bloco do `feature_timeline`.

## Plano de testes

O repo não tem framework de teste para o smoke, e este card não cria um. A prova são os passos
abaixo, **nesta ordem**.

- Cada passo é um comando autocontido, porque cada chamada de shell do agente começa limpa: nenhum
  passo depende de `export` de outro.
- Todos rodam com cwd na raiz da worktree (`/home/leo/pessoal/claude-brain-55-smoke-sem-slug-fixo`)
  e com timeout de shell de 600 s.
- O `dist/` é o de `origin/dev`, porque `src/` não muda. Se `brain-mcp/dist/index.js` faltar, rodar
  `npm run build` em `brain-mcp/` antes.

O snapshot **é** o índice vivo no momento da rodada. Ele é tirado só com leitura (`mode=ro`), e as
rodadas gravam em `uso` dentro dele, nunca no vivo (#1651).

0. **Aquecer o sync do GitHub da worktree** (#1648). Sem isto, a 1ª rodada estoura o timeout no
   `recent_activity`.
   - Comando:
     ```
     mkdir -p /tmp/smoke55 && sqlite3 "file:/home/leo/notoria/claude/brain-mcp/data/brain.db?mode=ro" ".backup /tmp/smoke55/aquecer.db" && cd brain-mcp && PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH env -u TYPESAFE_API_KEY -u BRAIN_JEV -u BRAIN_JEV_FALSO BRAIN_CONFIG=/home/leo/notoria/claude/brain-mcp/brain.config.json BRAIN_DB=/tmp/smoke55/aquecer.db node dist/cli.js --github --force > /tmp/smoke55/aquecer.log 2>&1; echo $?; head -3 data/github/state.json; rm -f /tmp/smoke55/aquecer.db
     ```
   - Esperado: `0`, depois de uns 150 s, e um `lastSyncIso` de agora. O `--force` e a varredura que
     a CLI faz no fim escrevem só no `aquecer.db`, que é descartável.
   - Os passos 1 a 5 rodam em seguida, dentro dos 30 min do `syncIntervalMin`. Se passarem disso,
     repetir este passo.
1. **CA1, o portão verde.**
   - Comando:
     ```
     sqlite3 "file:/home/leo/notoria/claude/brain-mcp/data/brain.db?mode=ro" ".backup /tmp/smoke55/brain.db" && cd brain-mcp && PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH env -u TYPESAFE_API_KEY -u BRAIN_JEV -u BRAIN_JEV_FALSO BRAIN_SOMENTE_CONSULTA=1 BRAIN_CONFIG=/home/leo/notoria/claude/brain-mcp/brain.config.json BRAIN_DB=/tmp/smoke55/brain.db npm run smoke > /tmp/smoke55/ca1.log 2>&1; echo $?
     ```
   - Esperado: `0`. No log aparece `--- feature_timeline('<slug>') ---` seguido de `Documentos:`, e
     `SMOKE OK` no fim.
   - Para conferir que o slug é real:
     ```
     S=$(grep -o "^--- feature_timeline('[^']*')" /tmp/smoke55/ca1.log | sed "s/.*('\(.*\)')/\1/") && echo "$S" && sqlite3 "file:/tmp/smoke55/brain.db?mode=ro" "SELECT COUNT(*) FROM docs WHERE feature='$S'"
     ```
     O resultado é maior que `0`.
   - **Se sair diferente de `0`:**
     - `FALHOU` com uma das mensagens do bloco novo: é defeito deste card. Corrigir e repetir.
     - `FALHOU` vindo de outra checagem (`search_context`, `list_features com poucas features`,
       `vizinhanca`, busca em linguagem natural, `recent_activity`): **PARADA**, com o log. A parada
       cita o `## Fora do escopo` do card: aquela checagem ganha card próprio, e não se mexe nela
       aqui.
     - Sem `FALHOU` (um `timeout em …`): **PARADA**, com o log e o `state.json`. O passo 0 devia ter
       evitado isso.
2. **CA2b, índice sem feature.**
   - Comando:
     ```
     sqlite3 /tmp/smoke55/brain.db ".backup /tmp/smoke55/semfeat.db" && sqlite3 /tmp/smoke55/semfeat.db "UPDATE docs SET feature=NULL" && cd brain-mcp && PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH env -u TYPESAFE_API_KEY -u BRAIN_JEV -u BRAIN_JEV_FALSO BRAIN_SOMENTE_CONSULTA=1 BRAIN_CONFIG=/home/leo/notoria/claude/brain-mcp/brain.config.json BRAIN_DB=/tmp/smoke55/semfeat.db npm run smoke > /tmp/smoke55/ca2b.log 2>&1; echo $?; grep -c "^FALHOU: feature_timeline: o índice não tem nenhuma feature" /tmp/smoke55/ca2b.log; grep -c "poucas features" /tmp/smoke55/ca2b.log
     ```
   - Esperado: `1`, `1`, `0`.
3. **CA2a, timeline sem documentos.** A cópia sabotada fica **ao lado** do original, porque o `root`
   sai do `import.meta.url`.
   - Comando:
     ```
     cd brain-mcp && test "$(grep -c '\.find(Boolean);' scripts/smoke.mjs)" = 1 && sed 's/\.find(Boolean);/.find(Boolean) + "-sabotado-55";/' scripts/smoke.mjs > scripts/smoke-sabotado-55.mjs && PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH env -u TYPESAFE_API_KEY -u BRAIN_JEV -u BRAIN_JEV_FALSO BRAIN_SOMENTE_CONSULTA=1 BRAIN_CONFIG=/home/leo/notoria/claude/brain-mcp/brain.config.json BRAIN_DB=/tmp/smoke55/brain.db node scripts/smoke-sabotado-55.mjs > /tmp/smoke55/ca2a.log 2>&1; echo $?; rm -f scripts/smoke-sabotado-55.mjs; test ! -e scripts/smoke-sabotado-55.mjs && echo limpo; grep "^FALHOU" /tmp/smoke55/ca2a.log
     ```
   - Esperado: `1`, `limpo` e
     `FALHOU: feature_timeline sem documentos para '<slug>-sabotado-55', que o list_features listou`.
4. **CA2c, `list_features` com `isError`.** A mesma técnica, mas sabotando o nome da tool, e só na
   chamada do bloco novo.
   - Comando:
     ```
     cd brain-mcp && test "$(grep -c 'const catalogo = await request("tools/call", { name: "list_features"' scripts/smoke.mjs)" = 1 && sed 's/const catalogo = await request("tools\/call", { name: "list_features"/const catalogo = await request("tools\/call", { name: "list_features_sabotado_55"/' scripts/smoke.mjs > scripts/smoke-sabotado-55.mjs && PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH env -u TYPESAFE_API_KEY -u BRAIN_JEV -u BRAIN_JEV_FALSO BRAIN_SOMENTE_CONSULTA=1 BRAIN_CONFIG=/home/leo/notoria/claude/brain-mcp/brain.config.json BRAIN_DB=/tmp/smoke55/brain.db node scripts/smoke-sabotado-55.mjs > /tmp/smoke55/ca2c1.log 2>&1; echo $?; rm -f scripts/smoke-sabotado-55.mjs; test ! -e scripts/smoke-sabotado-55.mjs && echo limpo; grep "^FALHOU" /tmp/smoke55/ca2c1.log
     ```
   - Esperado: `1`, `limpo` e
     `FALHOU: feature_timeline: o list_features que daria o slug falhou: MCP error -32602: Tool list_features_sabotado_55 not found`.
     Nenhuma linha com `o índice não tem nenhuma feature`.
5. **CA2c, erro JSON-RPC.** Sabotar o método da chamada do bloco novo.
   - Comando:
     ```
     cd brain-mcp && test "$(grep -c 'const catalogo = await request("tools/call"' scripts/smoke.mjs)" = 1 && sed 's/const catalogo = await request("tools\/call"/const catalogo = await request("tools\/call_sabotado_55"/' scripts/smoke.mjs > scripts/smoke-sabotado-55.mjs && PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH env -u TYPESAFE_API_KEY -u BRAIN_JEV -u BRAIN_JEV_FALSO BRAIN_SOMENTE_CONSULTA=1 BRAIN_CONFIG=/home/leo/notoria/claude/brain-mcp/brain.config.json BRAIN_DB=/tmp/smoke55/brain.db node scripts/smoke-sabotado-55.mjs > /tmp/smoke55/ca2c2.log 2>&1; echo $?; rm -f scripts/smoke-sabotado-55.mjs; test ! -e scripts/smoke-sabotado-55.mjs && echo limpo; grep "^FALHOU" /tmp/smoke55/ca2c2.log
     ```
   - Esperado: `1`, `limpo` e
     `FALHOU: feature_timeline: o list_features que daria o slug falhou: {"code":-32601,"message":"Method not found"}`.
6. **CA3, o diff.** A comparação é contra a **base da branch** (`git merge-base origin/dev HEAD`), e
   não contra a ponta da `origin/dev`. A `origin/dev` anda com as PRs de outros cards: em 11/11 já
   trazia o `jev.mjs` do #51, que apareceria como diferença deste card. Os pathspecs usam `:/`, que é
   relativo à raiz do repo, e não ao cwd.
   - Comando:
     ```
     B=$(git merge-base origin/dev HEAD) && git diff --stat $B -- :/brain-mcp/src/; echo "--"; git diff --name-only $B -- :/brain-mcp/; echo "--"; git status --porcelain -- :/brain-mcp/; echo "--"; diff <(git show $B:brain-mcp/scripts/smoke.mjs | sed -n '1,75p') <(sed -n '1,75p' brain-mcp/scripts/smoke.mjs) && echo cabeca-igual; diff <(git show $B:brain-mcp/scripts/smoke.mjs | sed -n '83,$p') <(tail -n 44 brain-mcp/scripts/smoke.mjs) && echo cauda-igual
     ```
   - Esperado:
     - nada antes do 1º `--`;
     - só `brain-mcp/scripts/smoke.mjs` entre o 1º e o 2º `--`;
     - no máximo ` M brain-mcp/scripts/smoke.mjs` entre o 2º e o 3º `--`;
     - `cabeca-igual` e `cauda-igual` no fim.
   - O `git diff` comum do arquivo não serve de prova. Ele casa linhas iguais dentro do bloco
     (`const tlText = …`, `});`) e mostra hunks picados.

Fim: `rm -rf /tmp/smoke55`. O corpo da PR cita o exit e as linhas `FALHOU`/`SMOKE OK` de cada passo.

**Portão da PR (precondição 4 do `/gm-ship`): os passos 0 a 6 verdes.**

A regra 2 do `CLAUDE.md` (`## A esteira`, item 2) dispara com "Mudou `brain-mcp/src/`?". Aqui `src/`
não muda, então ela não se aplica a este card. O smoke entra no portão por ser o próprio objeto da
mudança.

- `npm run eval -- --base origin/dev` **não entra**. Ele mede o ranking do `dist/` de `src/`, e com o
  mesmo `src/` na base e no head a comparação é tautológica.
- `npm run concorrencia` **não entra**. Ele testa lease e escrita de `src/` numa fixture isolada, e
  não importa o `smoke.mjs`.
- As PRs do #45 e do #46 mexem em `src/` e continuam com a regra 2 inteira. Este card só tira delas
  o vermelho do slug fixo.
- O timeout de worktree fria (#1648) continua a pegar essas PRs. O aquecimento do passo 0 serve igual
  para elas até o card próprio do #1648 existir.

## Technical Decisions

- **Slug do índice, não ausência de conteúdo** (#1632). O CA2 exige `Documentos:` para uma feature
  que o índice tem, e isso só se prova com um slug real. Esperar `Nenhum doc` para um slug inventado
  prova que a tool responde, mas não que ela acha documento.
- **Chamada própria ao `list_features`, antes do timeline** (#1632). Reaproveitar o bloco de baixo
  mexeria numa checagem que o CA3 manda deixar como está. E, com 0 features, a falha sairia como
  `poucas features`, e não com a mensagem que o CA2 pede.
- **Primeira linha do catálogo** (#1632). É a feature ativa mais recente, e ela aparece no log, então
  quem lê a falha consegue reproduzi-la. Uma feature aleatória não se reproduz, e a de mais docs não
  traz ganho. Com `apenas_ativas`, um índice só com arquivadas ficaria vermelho mesmo com a tool
  funcionando.
- **Sem `SMOKE_FEATURE`** (#1632): voltaria a ser um slug fixo, só que configurável.
- **Erro do `list_features` com mensagem própria** (CA2c). Sem esse ramo, um erro da tool apareceria
  como "índice sem feature", e mandaria quem lê procurar no lugar errado. O texto do `list_features`
  não é impresso no log, então a mensagem é o único sinal.
- **Sem ramo próprio para erro do `feature_timeline`.** O `tlText` é impresso logo acima do
  `FALHOU`, então o erro da tool já aparece no log. O CA2 só exige que o smoke saia `1`, e ele sai.
- **Portão contra snapshot, com aquecimento, sem eval nem concorrencia** (#1651, #1648).
- **O timeout de worktree fria não é consertado aqui** (#1648). O conserto fica em `src/`: o modo
  somente-consulta não deveria disparar sync nem `scan`, e o `doSync` não deveria bloquear o event
  loop. Mas o card proíbe tocar `src/`. Abrir o card próprio é com o braço direito, porque esta sessão
  não tem mandato para criar card.

## Coding Standards

- Mesmo estilo do `smoke.mjs`: ESM, nenhuma dependência nova e as funções `request()`/`fail()` do
  próprio arquivo. O `console.log` do bloco segue o formato `\n--- <tool>(...) ---\n` + 900 caracteres.
- As mensagens de `fail` ficam em pt-BR e exatamente como no bloco acima, porque os CAs citam o texto.
- Nada além do bloco. As outras checagens que dependem de conteúdo (`search_context('subfaturamento')`,
  `vizinhanca('1072')`, a busca em linguagem natural, a seção GitHub do `recent_activity`) não são
  generalizadas, porque o card as põe fora do escopo. O `jev.mjs` não é tocado (#51).
