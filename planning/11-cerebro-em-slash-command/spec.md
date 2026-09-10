# Entregar o contexto do cérebro nos turnos abertos por slash command — Spec

## References
- Card: [#11](https://github.com/leonardo-amaral-3/claude-brain/issues/11) — repo `leonardo-amaral-3/claude-brain`
- PRD: N/A — ferramenta interna de uma pessoa, sem trade-off de produto. Rota Curta.
- Decisões que esta spec assume: **#426** (o hook dispara para slash command e recebe a linha crua),
  **#427** (taxa de injeção medida: 29,3%, e onde ela se perde), **#422** (diagnóstico de consumo).

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir: a raiz do repo)
- Base branch: `dev`
- Feature branch: `feat/11-cerebro-em-slash-command`
- **Rodar em `git worktree` próprio**, nomeado pela convenção deste repo
  (`<workspace>/<repo>-<n>-<slug>`, como em `gm-implement/SKILL.md:108`):
  **`../claude-brain-11-cerebro-em-slash-command`**. A árvore principal está com
  `feat/5-perguntas-e-aprovacao-por-escolha` em voo — decisão **#380** proíbe compartilhar árvore.
- **PRIMEIRO passo da implementação: `git fetch && git rebase origin/dev`.** A `feat/5` alterou
  `sync.sh` e `sync.ps1` em **234 linhas** (task 9, marcador de origem) e toca **exatamente as
  duas regiões** que o CA-3 quer editar. Todas as referências de linha desta spec são contra
  **`dev`**; se a `feat/5` mergear antes, reconferir por conteúdo (abaixo) antes de editar.
- Depois de mexer em `hooks/` ou `sync.*`: `./sync.sh push` para a instalação. Não há `npm run build`
  a fazer — **`brain-mcp/src/` não muda nesta feature**, e é isso que mantém a Rota Curta.

## Requisitos & critérios de aceite

### CA-1 — o turno de slash command recebe o cérebro sem gastar tool call
- **Dado** o índice com a entidade `card:claude-brain#11` e o hook instalado em `~/.claude/hooks/`
- **Quando** o usuário digita `/gm-spec #11` com `cwd` em `~/pessoal/claude-brain`
- **Então** o hook escreve em stdout um JSON com
  `hookSpecificOutput.additionalContext` contendo o título do card #11, e o turno registra no
  transcript um evento `type: "attachment"` com `attachment.type === "hook_additional_context"`
  — **sem nenhuma chamada de ferramenta no turno**.
- **Também vale para**: `/gm-implement <pasta-de-planning>` (resolve feature — o bloco traz a
  spec, o card e **pelo menos uma** task, não as cinco: o teto é 5 no total) e
  `/gm-explore <texto ≥12 chars>` (cai na busca léxica sobre o argumento).
- **O que este CA NÃO prova**: que o modelo pare de usar `grep`. `additionalContext` entra antes
  do primeiro turno do assistente por construção, então "sem tool call antes dele" é vacuamente
  verdadeiro. O efeito no comportamento é o que a Verificação pós-deploy mede, e só ela.

### CA-2 — a taxa de injeção medida sobe de ~29% para ≥ 60%
- **Dado** o corpus dos prompts humanos dos transcripts locais (`~/.claude/projects`) em `cwd` de
  workspace real, na janela declarada na chamada
- **Quando** roda `npm run injecao -- --dias 3` em `brain-mcp/`
- **Então** o script imprime, **sobre o mesmo corpus**, a taxa do hook **antes** e a do hook
  **depois**, mais a repartição por motivo; e a taxa depois é **≥ 60%** e **pelo menos o dobro**
  da taxa antes.
- **Por que antes-e-depois no mesmo corpus, e não contra um número fixo**: a janela de 3 dias
  muda todo dia, e um limiar fixo mediria a mistura de trabalho da semana, não a mudança. O
  número de referência medido em 2026-09-10 (827 prompts, 601 transcripts) fica como ordem de
  grandeza esperada, não como gabarito:
  `slash 373 (45,1%) · curto <12 168 (20,3%) · filtro de relevância 44 (5,3%) · injetados 242 (29,3%)`
  → protótipo: **63,5%**.

### CA-3 — `brain-contexto.js` versionado e coberto pela sincronia
- **Dado** `hooks/brain-contexto.js` commitado e o nome acrescentado às listas de
  `sync.sh` e `sync.ps1`
- **Quando** roda `./sync.sh status`
- **Então** `brain-contexto.js` **não** aparece na lista de fora de sincronia, **e** um hook que
  exista só em `~/.claude/hooks` e não no repo é reportado numa seção de órfãos (como já acontece
  com as skills).
- **Recorte explícito**: o critério é sobre `brain-contexto.js` e a seção de órfãos — **não** sobre
  a saída inteira do `status` ficar vazia. Hoje ela lista 27 arquivos por causa de trabalho paralelo
  em outras branches, e isso não é desta feature.
- **O `sync.sh status` sozinho NÃO fecha este CA**, e a razão tem card aberto: o **#3** — `soma()`
  (`sync.sh:62`) compara bytes sem normalizar fim de linha, e como o repo é LF por `.gitattributes`
  e a instalação nasce CRLF pelo `install.ps1`, arquivo idêntico aparece "fora de sincronia" para
  sempre. Medido em 2026-09-09: 3 dos 7 acusados eram falso positivo puro.
  **Portão real deste CA**, como fixado na decisão **#390**:
  ```sh
  diff --strip-trailing-cr <(git show HEAD:hooks/brain-contexto.js) ~/.claude/hooks/brain-contexto.js
  ```
  Sai vazio → o arquivo versionado e o que roda são o mesmo. O `sync.sh status` entra como
  segundo sinal, não como juiz. **O #3 não é consertado aqui** — é card próprio, já aberto.

## Technical Overview

Um comportamento muda: o hook `UserPromptSubmit` deixa de desistir quando o prompt começa com `/`
e passa a **resolver o argumento do comando contra o grafo do índice**.

A chave é que a query útil de um slash command **não é o nome do comando, é o argumento**. Buscar
`"/gm-spec #11"` por texto devolve lixo (os tokens viram `gm`, `spec`, `11`). Mas `#11` é uma chave
do grafo: `card:claude-brain#11`. Resolver a entidade e injetar ela mais os vizinhos das `arestas`
entrega exatamente o que `/gm-spec` e `/gm-implement` precisam — a spec, as tasks, as decisões.

`brain-mcp/src/` **não muda**. O hook já abre o `db`; passa a consultar `entidades` e `arestas` por
SQL direto. Medido: 200 lookups por `chave` exata em 2 ms, 100 vizinhanças em 12 ms — o caminho de
entidade é **mais barato** que a busca FTS de hoje, porque nem chega a rodar o FTS.

**Ressalva de custo, para o número acima não ser lido como maior do que é**: os 2 ms valem para
os passos 1 e 2, que batem no índice único de `chave`. Os passos 3 e 4 usam `LIKE 'card:%#'||n`,
com **curinga à esquerda** — não usam índice nenhum. E o laço do repo faz
`WHERE tipo='card' AND repo=?`, e **não existe índice em `repo`** (`entidades` tem só
`sqlite_autoindex_entidades_1` e `idx_ent_tipo`). São varreduras sobre 3.965 linhas, uma vez por
prompt no pior caso — ainda barato em absoluto, mas não é o mesmo "grátis" dos passos 1 e 2, e é
por isso que a precedência coloca os caminhos indexados na frente.

**Não reaproveitar `Grafo.resolver()`** (`brain-mcp/src/grafo.ts:385`): o regex dele é `/(\d{3,5})/`
e **não casa números de 1–2 dígitos**. Para `#11` ele cai no ramo `LIKE '%11%'` e devolve 10 paths
de migration — verificado nesta sessão. Como todos os cards deste repo são de 1 a 2 dígitos, usar
`resolver()` quebraria justamente o caso do card #11. Consertar `resolver()` mexeria em
`brain-mcp/src/` e viraria Rota Completa: fica **fora do escopo**. O defeito é real e atinge
também a tool `mcp__brain__vizinhanca` — **card de Triagem ainda a criar**, não criado por esta
sessão (skill `gm-*` não se auto-invoca).

## Implementation Details

### `hooks/brain-contexto.js` — a ordem dos guards

Hoje (`:55-56`), nesta ordem:

```js
if (prompt.length < 12) return fim();
if (prompt.startsWith('/')) return fim();
```

Passa a ser: **o ramo de slash command roda ANTES do guard de tamanho**, e o guard de tamanho
passa a valer só para prompt que não é slash command.

**Antes disso, conferir o guard de `h.source` (`:52`)**, que é `if (h.source && h.source !== 'user')`.
Medido nesta sessão em modo headless (`claude -p '/pingteste #11'`): o payload do
`UserPromptSubmit` **não traz campo `source` nenhum**, então o guard passa. Mas isso foi medido
no headless, **não numa sessão interativa** — e se o harness marcar o turno de slash command com
um `source` próprio, o guard mata a feature inteira depois de todo o resto estar certo.
**Primeira coisa da implementação**: um `console.error(JSON.stringify(h))` sob `BRAIN_HOOK_DEBUG=1`,
digitar um `/gm-*` numa sessão interativa de verdade, ler o `source`. Se vier diferente de `user`
e de ausente, relaxar o guard para aceitá-lo, e registrar o valor observado num comentário.

Por quê, medido: `"/gm-card #5"` tem 11 caracteres. Com o guard de tamanho na frente, 6 prompts
reais do recorte (`/gm-spec #5`, `/gm-card #5`, `/gm-spec #2`, `/gm-card #2`, `/gm-spec #1`,
`/gm-spec #8`) seriam descartados em silêncio — e são todos da esteira **deste** repo.

O guard de `<12` **continua existindo para prompt normal e não muda**: medido, dos 168 prompts
curtos do recorte, **zero** resolvem card ou feature. São `ok`, `sim`, `continua`. Mexer nele
compra nada — hipótese levantada e descartada na medição.

### `hooks/brain-contexto.js` — parse do argumento e lista de candidatos

```js
const m = prompt.match(/^(\/\S+)\s*([\s\S]*)$/);
const arg = (m && m[2] || '').trim();
if (!arg) return fim();          // /clear, /gm-release, /diario — não há o que resolver
```

- **Sem argumento → não injeta nada.** Medido: 82 dos 373 slash commands (22%), dos quais 62 são
  `/clear` — injetar ali é desperdício puro, o contexto é descartado no turno seguinte.
- `primeiro` = primeiro token do argumento, sem aspas nas pontas e **sem pontuação final**
  (`/`, `\`, `.`, `,`, `;`, `:`), removida em laço. Medido no corpus: existe
  `/gm-plan-tasks 11-fila-de-pedidos-pendentes.`, com ponto no fim.
- **A resolução roda sobre uma LISTA de candidatos, não sobre um token só**: o token inteiro,
  seguido de cada segmento de caminho **do mais fundo para o mais raso**, deduplicado,
  separador `/` **e** `\`. Exemplo:
  `processos/planning/reagrupamento-aih-por-dominio` →
  `["processos/planning/reagrupamento-aih-por-dominio", "reagrupamento-aih-por-dominio",
  "planning", "processos"]`.

**Isto não é detalhe: caminho é a forma MAIS COMUM de argumento.** Medido sobre os 291 slash
commands com argumento: **caminho 136 (47%)**, número puro 77, slug com número 51, slug sem
número 25, outro 2. Tratando só o token inteiro, os 136 caminhos caem todos na busca léxica.
Com a lista de candidatos, os acertos de feature saltam de **42 para 179** e a busca léxica
encolhe de **154 para 18** — mesma taxa total de injeção, contexto muito mais preciso.

### `hooks/brain-contexto.js` — precedência da resolução

Parar no **primeiro** que casar:

1. **Slug exato de feature** — para **cada candidato**, na ordem da lista:
   `SELECT … FROM entidades WHERE tipo='feature' AND chave = 'feature:'||<candidato>`.
   O primeiro que casar ganha.
2. **Número → card, desambiguado pelo repo do `cwd`** — `<n>` é o primeiro candidato que casa
   `/^#*(\d{1,5})\b/`. Note `#*`, não `#?`: o corpus tem `/gm-spec ##1086`.
   Resolver o repo (abaixo) e buscar `chave = 'card:'||<repo>||'#'||<n>`.
3. **Número → card único no workspace** — `chave LIKE 'card:%#'||<n>`, filtrado por `daquiRepo`
   (abaixo). Só vale se sobrar **exatamente 1**.
4. **Número → feature `<n>-*` única** — `chave LIKE 'feature:'||<n>||'-%'`, **filtrado pelo mesmo
   `daquiRepo`** (`entidades.repo` está preenchido em 59/59 features). Só vale se sobrar 1.
5. **Texto** — se `arg.length >= 12`, busca léxica normal **sobre o argumento**, não sobre a linha
   inteira (o nome do comando só adiciona ruído). **O filtro `relevante()` do hook (`:85-91`)
   precisa ser construído com `tokensDe(arg)`, não `tokensDe(prompt)`** — com a linha inteira, os
   tokens `gm` e `explore` de `/gm-explore como funciona o indexador` não aparecem em resultado
   nenhum, `n / toks.length >= 0.5` reprova tudo e o passo 5 nunca injeta.
6. **Nada** — não injeta.

**Ambiguidade (passos 3 e 4 com 2+ candidatos) cai para o passo 5, NÃO para o passo seguinte.**
A lista é ordenada mas o empate é terminal: passo 3 ambíguo **não** tenta o passo 4. Por que isso
importa, com alvo real no índice: `feature:11-fila-de-pedidos-pendentes` existe (é do
`operations-center`). Se o passo 3 ambíguo caísse no passo 4, `/gm-spec #11` dentro do
`claude-brain` injetaria uma feature sobre fila de pedidos — resposta confiante e errada, que é
pior do que não injetar.

**O número 11 é o caso patológico e está no índice**: existe como card em **três** repos —
`processos-criticas`, `operations-center` e `claude-brain`. Filtrado para o workspace `pessoal`
sobram 2 → ambíguo → passo 5 → `#11` tem 2 chars → **não injeta**. É o comportamento correto, e é
por isso que o passo 2 (repo do `cwd`) é o que carrega a feature, não o passo 3.

**O filtro de workspace dos passos 3 e 4 é defensivo**, porque as duas chaves são opcionais e
mutuamente exclusivas no `brain-workspaces.json`:

```js
const daquiRepo = (repo) =>
  Array.isArray(ws.repos)  ? ws.repos.includes(repo)
: Array.isArray(ws.exceto) ? !ws.exceto.includes(repo)
: true;   // workspace sem nenhuma das duas: nao filtra, nao explode
```

Sem o terceiro ramo, um `brain-workspaces.json` sem `repos` **nem** `exceto` faz
`ws.repos.includes` estourar — e hook que estoura falha em silêncio e nunca mais injeta nada.

**Feature antes de card, e é medido**: `/gm-ship 982-setor-dashboard-inconsistencias` casa os dois
(o número prefixa o slug). Pela feature os vizinhos são a spec + as 5 tasks + o card + 2 decisões
(9, todos do assunto); pelo card são 30, incluindo 9 sessões de diário e 3 cards só mencionados de
passagem.

**Resultado medido da precedência completa**, sobre os 373 slash commands do corpus:
`feature 179 · card pelo repo 81 · card único 8 · ambíguo 0 · texto 18 · sem argumento 82 · nada 5`.
Dos 291 com argumento, **286 (98,3%) resolvem alguma coisa**.

**Argumento ambíguo (passo 3 com 2+ candidatos): não adivinhar.** Cai para o passo 5, e se o
argumento tiver menos de 12 chars, não injeta. Medido: o caso não ocorreu nenhuma vez em 3 dias —
mas ele existe (o número 11 é card nos dois repos do workspace `pessoal`, assim como 1, 2 e 8).
Caminho frio: simplicidade ganha de esperteza.

### `hooks/brain-contexto.js` — o repo a partir do `cwd`

Não usar `ws.repos`: o workspace `notoria` não tem essa chave, tem `exceto`. Derivar do caminho:

```js
// segmentos do cwd abaixo do prefixo do workspace, do mais fundo para o mais raso;
// o primeiro que existir como repo no indice ganha
const segs = barras(cwd).slice(barras(ws.prefixo).length).split('/').filter(Boolean);
for (let i = segs.length - 1; i >= 0; i--)
  if (db.prepare("SELECT 1 FROM entidades WHERE tipo='card' AND repo=? LIMIT 1").get(segs[i]))
    return segs[i];
```

Traçado à mão nos três formatos de `cwd` que ocorrem:

| `cwd` | segmentos (fundo → raso) | resultado |
|---|---|---|
| `~/pessoal/claude-brain` | `claude-brain` | `claude-brain` ✓ |
| `~/notoria/processos/modulo-processos` | `modulo-processos`, `processos` | `modulo-processos` ✓ |
| `~/pessoal/operations-center/.claude-worktrees/feat-31-x` | `feat-31-x`, `.claude-worktrees`, `operations-center` | `operations-center` ✓ |
| `~/notoria/processos` | `processos` | **null** — `processos` não é repo com card no índice; cai no passo 3 |
| `~/pessoal` (raiz do workspace) | (vazio) | **null** — cai no passo 3 |

Os dois `null` são o comportamento certo, não uma falha: sem repo, quem decide é a unicidade do
número no workspace, e se ele for ambíguo não se adivinha. Medido: resolve o repo em 84 de 94
casos (89%); os 10 restantes foram todos cobertos pelo passo 3.

### `hooks/brain-contexto.js` — o que a entidade resolvida injeta

Mesmo teto de hoje: **5 resultados, 220 chars de trecho cada**. Medido no protótipo: 1.708–1.901
chars de saída, a mesma ordem de grandeza do caminho léxico atual.

- **Teto de 5 é do bloco inteiro**, entidade incluída: entidade com `doc_path` ocupa o slot 1 e
  sobram 4 para vizinhos; entidade sem `doc_path` não ocupa slot e sobram 5.
- **Slot 1 é a própria entidade**, com o primeiro chunk do `doc_path` como trecho
  (`SELECT c.text FROM chunks c JOIN docs d ON d.id = c.doc_id WHERE d.path = ? ORDER BY c.ord LIMIT 1`),
  colapsado em espaço único e cortado em 220 chars.
- **Se a entidade não tem `doc_path`** (é o caso de toda `feature`), ela **não ocupa slot** — vira
  só o cabeçalho, e os 5 slots vão todos para os vizinhos. Sem isto, o slot 1 sai com `null` no
  lugar do caminho e trecho vazio — foi o que o protótipo mostrou.
- **Vizinhos**: união das `arestas` nos dois sentidos, **descartando quem não tem `doc_path`**
  (sem documento não há trecho a injetar).
- **Se, depois de tudo, o bloco ficaria vazio** — entidade sem `doc_path` e nenhum vizinho com
  documento, que é o caso de um índice sem grafo construído — **cair para o passo 5** (busca
  léxica sobre o argumento, se tiver ≥12 chars) em vez de emitir cabeçalho sem conteúdo.
- **O caminho de entidade NÃO passa pelo `daqui()` (`hook:74-79`) nem pelo `relevante()`
  (`:85-91`).** Este é o ponto que decide se a feature entrega alguma coisa:
  - `daqui()` testa `POR_PATH.has(r.source)`, mas **`entidades` não tem coluna `source`**
    (`db.ts:45-54`) — daria `undefined`, cairia no ramo do repo, e ali **`decisao` tem
    `repo NULL` em 415/415 e `sessao` em 388/388**. O filtro apagaria toda decisão e toda sessão.
    Medido no alvo do próprio CA-1: `card:claude-brain#11` tem 3 vizinhos — 2 decisões e o card
    #422 (o falso positivo). Com `daqui()`, **sobra só o falso**.
  - A procedência do vizinho já está estabelecida pela **aresta explícita** a partir de uma
    entidade que o usuário nomeou no argumento. Não é resultado de busca aberta, e não precisa do
    filtro que existe para busca aberta.
  - `relevante()` mataria a entidade pelo mesmo motivo de sempre: `tokensDe("11")` é `["11"]`.
- **Ordenação — diversidade antes de profundidade.** Agrupar por `tipo`, ordenar os grupos por
  **`doc > decisao > pr > card > arquivo > sessao`**, e pegar **1 de cada grupo por rodada** até
  encher. Sem isso, uma feature com 5 tasks enche os slots de task e derruba o card.
  - **`feature` e `commit` ficam fora da lista de propósito**: têm `doc_path NULL` em 59/59 e
    585/585, então o descarte da linha acima já os elimina. Deixá-los na ordem seria código morto
    sugerindo um comportamento que não existe.
  - **Dentro de cada grupo, `ORDER BY data DESC, chave ASC`** — determinístico. Sem `ORDER BY`
    explícito, qual das 5 tasks da feature 982 aparece é sorteio.
  - O princípio é o de `search.ts:229-255` (`colapsar`), mas **o mecanismo não é**: lá o
    agrupamento é por documento e a deduplicação é por texto do chunk, e não existe noção de
    `tipo`. Inspiração, não implementação a copiar.

**Limitação conhecida, aceita**: o grafo liga `#422` do corpo do card #11 (que era a *decisão* 422)
ao *card* 422 de `modulo-processos`. Vizinho falso, no máximo 1 slot dos 5. É comportamento
pré-existente do grafo, não desta feature.

### `hooks/brain-contexto.js` — o texto do cabeçalho

O cabeçalho de hoje diz "busca lexica automatica sobre este prompt". No caminho de entidade isso
é falso — foi resolução de chave no grafo. Emitir cabeçalho próprio dizendo que veio do grafo, que
entidade foi resolvida, e mantendo a mesma frase final que aponta `search_context`/`read_doc` para
aprofundar. Continua valendo: falha em silêncio, `BRAIN_HOOK_DEBUG=1` mostra o erro no stderr.

### `sync.sh` e `sync.ps1`

**Referências contra `dev`** (não contra a árvore de trabalho — a `feat/5` mudou os dois
arquivos). Como a `feat/5` pode mergear antes, **casar por conteúdo, e usar a linha só como
atalho**:

| Arquivo | Linha em `dev` | Âncora de conteúdo (é esta que manda) |
|---|---|---|
| `sync.sh` | `:37` | `pares+=("$REPO/hooks::$CLAUDE_HOME/hooks::brain-config.js …` |
| `sync.sh` | `:82-88` | bloco `if [ -d "$CLAUDE_HOME/skills" ]; then` … `Skills em ~/.claude/skills fora do repo:` |
| `sync.sh` | `:58` | filtro de ignorados: `! -name '*.bak' ! -name '*.orig' ! -name '*.tmp' ! -name '.DS_Store'` |
| `sync.ps1` | `:70` | `arquivos = @('brain-config.js', 'brain-briefing.js', …)` |
| `sync.ps1` | `:120-141` | `$novas = @()` … `foreach ($n in $novas)` |
| `sync.ps1` | `:86` | `$IGNORAR = '\.(bak\|orig\|tmp\|swp)$\|(^\|\\)\.DS_Store$'` |

1. Acrescentar `brain-contexto.js` à lista fixa de hooks (`sync.sh:37`, `sync.ps1:70`).
2. **Relatar hook órfão**: espelhar para `hooks/` o que o bloco de `skills/` já faz — listar o que
   existe em `~/.claude/hooks` e não no repo.
3. **O relato de órfão tem de honrar o filtro de ignorados**, e ele hoje **não cobre o caso real**:
   a instalação tem `obsidian-diario.js.bak` (filtrado) **e `obsidian-diario.js.pre-detach`
   (NÃO filtrado)** — `.pre-detach` não está nem em `! -name '*.tmp'` nem em `$IGNORAR`.
   Sem tratar isso, a seção nova nasce com um falso positivo permanente e o CA-3 vira ruído que
   se aprende a ignorar. **Regra**: o relato de órfão só considera `*.js` que não estejam na lista
   fixa do par — o que exclui `.bak`, `.pre-detach` e qualquer sufixo futuro sem precisar
   enumerá-los.

O item 2 é a causa raiz do card: a lista é fixa e não há relato de órfão, então um hook que só
existe na instalação é **invisível ao `status`**. Foi assim que `brain-contexto.js` ficou dois dias
fora do git sem ninguém notar. Sem o item 2, o próximo hook novo some do mesmo jeito.

### `install.sh` e `install.ps1`

Acrescentar a terceira entrada ao array `desejados`. **São duas linguagens e duas chaves
diferentes — não é o mesmo trecho nos dois arquivos.**

`install.sh:115-118` (JavaScript dentro do heredoc `<<'JS'`; chave `statusMessage`):

```js
{ evento: 'UserPromptSubmit', arquivo: 'brain-contexto.js', timeout: 10,
  statusMessage: 'Perguntando ao cerebro...' },
```

`install.ps1:138-141` (hashtable PowerShell; a chave é **`status`**, e é `install.ps1:166`
— `if ($d.status) { $novo['statusMessage'] = $d.status }` — que a converte):

```powershell
@{ evento = 'UserPromptSubmit'; arquivo = 'brain-contexto.js'; timeout = 10; status = 'Perguntando ao cerebro...' }
```

Copiar o trecho JS para o `.ps1` dá erro de parse, e usar `statusMessage` na hashtable faz o
hook ser registrado **sem** `statusMessage`, em silêncio.

Hoje os dois instaladores ligam só `SessionStart` e `SessionEnd`. Os dois **copiam** a pasta
`hooks/` inteira, então depois do commit o arquivo chegaria na máquina — mas **nunca seria ligado
no `settings.json`**, e o hook não rodaria. Quem clonasse o repo não teria a feature.
A comparação por nome de arquivo que os dois já fazem torna a adição idempotente.

### `brain-mcp/scripts/injecao.mjs` — o script que prova o CA-2

Segue o padrão dos vizinhos (`smoke.mjs`, `eval.mjs`, `uso.mjs`): `.mjs` solto, `fail()` que sai
com código 1, sem runner de teste — o repo não tem nenhum, e não é este card que introduz um.

- `node scripts/injecao.mjs [--dias N | --desde YYYY-MM-DD --ate YYYY-MM-DD] [--base <ref>]
  [--caso "<prompt>" --cwd <path>]`. **`--dias` default 3.** `--desde/--ate` fixam datas
  absolutas e são o que torna uma medição **repetível meses depois** — `--dias` é janela móvel.
- Varre `~/.claude/projects/**/*.jsonl` na janela e extrai os prompts humanos: eventos
  `type: "user"`, sem `isMeta`, com conteúdo de texto, descartando os que começam com `<` ou
  `Caveat:`. **Slash command chega ao transcript já expandido** (`<command-name>` + `<command-args>`
  + corpo da skill); reconstituir a linha crua como `<command-name> + ' ' + <command-args>`, que é
  o que o harness manda ao hook (decisão **#426**) — **não descartar esses eventos**, eles são
  45% da população que o CA-2 mede.
- **Filtro de `cwd`**: só entram os que `brain-config.doCwd(cwd)` resolve **e** cujo caminho
  existe em disco. Isso descarta os fixtures `repo-fantoche` e os scratchpads em
  `AppData/Local/Temp` — não porque sejam do operations-center (que **é** repo do workspace
  `pessoal` e resolveria), mas porque **moram fora do prefixo de qualquer workspace**. A regra é
  a do `doCwd`, não uma lista de nomes.
- **O `dist/` que o hook importa é o da INSTALAÇÃO**, não o do repo: o hook o deriva de
  `dirname(ws.db) + '/../dist'`, e `ws.db` vem do `brain-workspaces.json`. Rodar
  `npm run injecao` dentro de `brain-mcp/` no repo **não** usa o `dist/` do repo, e não deve —
  é o mesmo `dist/` que o hook de verdade usa em produção. Se ele não existir ou estiver velho,
  `fail()` dizendo isso.
- **Executa o hook DE VERDADE**, um `spawn` por prompt, com o JSON do `UserPromptSubmit` na
  stdin (`{ prompt, cwd }`) e leitura da stdout — exatamente como `smoke.mjs` sobe o servidor
  real em vez de importar as funções. **Não reimplementar a lógica do hook dentro do script**:
  lógica duplicada passa a mentir no dia em que o hook mudar, e é justamente esse script que
  deveria pegar a mudança. Injetou = stdout não-vazia com `hookSpecificOutput`.
- **Mede ANTES e DEPOIS sobre o MESMO corpus**, e é isto que torna o número comparável: roda cada
  prompt duas vezes, uma contra o hook da branch e outra contra o hook de referência, extraído com
  `git show <ref>:hooks/brain-contexto.js` para um arquivo temporário.
  `--base <ref>` escolhe a referência, **default `dev`**. Na execução que fecha o CA-2 a `dev`
  ainda não tem o arquivo — nesse caso o "antes" é o hook da instalação (`~/.claude/hooks/`).
  Depois do merge, `--base <commit anterior ao merge>` mantém a comparação honesta; sem `--base`,
  pós-merge, "antes" e "depois" viram o mesmo hook e só a taxa absoluta significa algo.
  Sem esta mecânica o "29,3%" é de uma janela e o novo número é de outra: o corpus de 3 dias
  muda todo dia.
- Imprime: total, taxa **antes**, taxa **depois**, e a repartição por motivo
  (`semArg`, `entidade`, `texto`, `curto`, `relevancia`, `semWs`).
- **`fail()` só no modo de aferição** (`--dias`/`--desde` sem `--caso`), e só quando há `--base`
  para comparar: taxa depois `< 60%` **ou** menor que o dobro da taxa antes → exit 1.
  **`--caso` nunca faz `fail()`** — imprime e sai 0; é ferramenta de inspeção.
  **A verificação pós-deploy (`--dias 7`, sem `--base`) é relatório e também não faz `fail()`** —
  senão um número que só se quer registrar derruba o comando.
- **Teto aritmético, para o 60% não parecer arbitrário**: da linha de base, os buckets são
  `242 injetados + 373 slash + 168 curtos + 44 relevância = 827`. Curto e relevância estão fora
  do escopo (decisões 5 e 6), e 82 dos slash não têm argumento. O máximo recuperável é
  `242 + (373 − 82) = 533`, ou seja **64,4%**. O protótipo mediu **63,5%** — quase no teto.
  Os 60% são o teto menos ~4 pontos de folga, não um número redondo escolhido a esmo.
- Com `--caso`, roda um prompt só e imprime o bloco injetado — é o que fecha o CA-1 na mão.
- **Nunca commitar o corpus.** Os prompts são de sessões reais da Notoria e **este repo é
  público**. O script lê os transcripts da máquina em tempo de execução.
- Depende de `~/.claude/hooks/brain-config.js` e de `~/.claude/brain-workspaces.json` estarem
  instalados (é o que o hook usa para achar o índice). Sem eles, `fail()` com mensagem clara em
  vez de taxa zero — taxa zero por falta de config é indistinguível de regressão.

### `templates/settings.hooks.json`

É o caminho de instalação **manual** documentado no próprio arquivo ("use a mao so se preferir")
e hoje traz só `SessionStart` e `SessionEnd`. Acrescentar o bloco `UserPromptSubmit` apontando
para `node <CLAUDE_HOME>/hooks/brain-contexto.js`, `timeout` 10,
`statusMessage` `"Perguntando ao cérebro..."` — mesmo formato dos outros dois.

Sem isso o template passa a discordar dos dois instaladores: **exatamente a classe de deriva que
o CA-3 diz fechar**, reaberta noutro arquivo.

### `README.md` e `docs/`

- `README.md:311` diz `hooks/ 4 arquivos` → **5**, e a árvore logo abaixo **nomeia cada hook
  um por um**: entra uma quinta linha para `brain-contexto.js`, não só a contagem.
- `README.md:14` (tabela) descreve os hooks como `SessionStart` + `SessionEnd`; `README.md:5`
  resume o conjunto como "começar situada e terminar registrada" — as duas frases ficam falsas
  com um hook que roda no meio do turno. Reescrever as duas.
- `docs/workspace-e-obsidian.md` — a tabela "Quem escreve onde" cita o `SessionEnd`, mas é sobre
  **quem escreve no cofre**, e `brain-contexto.js` só lê. **Não mexer nela.** Conferido nesta
  sessão para que ninguém "conserte" por simetria.

## File Change Summary

| Arquivo | O que muda |
|---|---|
| `hooks/brain-contexto.js` | **Novo no repo** (hoje só existe na instalação) — entra já com o ramo de slash command, a resolução de entidade e a nova ordem dos guards |
| `sync.sh` | `brain-contexto.js` na lista (`dev:37`); relato de hook órfão espelhando o das skills (`dev:82-88`), restrito a `*.js` fora da lista fixa |
| `sync.ps1` | O mesmo, em `dev:70` e `dev:120-141` |
| `install.sh` | Terceira entrada em `desejados` (`:115-118`), chave `statusMessage` |
| `install.ps1` | Terceira entrada em `$desejados` (`:138-141`), chave **`status`** — sintaxe PowerShell, não JS |
| `templates/settings.hooks.json` | Bloco `UserPromptSubmit` — é o caminho de instalação manual e hoje só tem os outros dois |
| `brain-mcp/scripts/injecao.mjs` | **Novo** — replay do corpus local e caso avulso; prova CA-1 e CA-2 |
| `brain-mcp/package.json` | Script `"injecao": "node scripts/injecao.mjs"` |
| `README.md` | `:311` contagem 4 → 5 **e** quinta linha na árvore (`:312-315` nomeia cada hook); reescrever `:5` e `:14`, que descrevem os hooks como só de início e fim de sessão |
| `planning/11-cerebro-em-slash-command/spec.md` | **Novo** — esta spec |

Não muda: `brain-mcp/src/**` (é o que segura a Rota Curta), `hooks/brain-config.js`,
`hooks/brain-briefing.js`, os hooks de diário, as skills, e
`docs/workspace-e-obsidian.md` (a tabela dela é sobre quem **escreve** no cofre; este hook só lê).

## Migrations & compatibilidade

N/A quanto a dado — nada muda no formato em disco. O índice, o `brain-workspaces.json` e o schema
do SQLite ficam intactos; o hook só **lê** `entidades` e `arestas`, que já existem e já são
populadas pelo `--grafo`.

Compatibilidade que importa: o hook precisa do grafo **construído**. Índice sem `arestas` (instalação
nova que nunca rodou `npm run grafo`) simplesmente não resolve vizinho — o passo 1–4 devolve a
entidade sozinha e, se nem ela existir, cai no passo 5. Degradação silenciosa e correta, que é o
contrato de um hook de contexto.

## Rollback

Reverter é tirar o hook do `settings.json` (ou o commit inteiro) e rodar `./sync.sh push`. Sem
estado próprio a desfazer: o hook não grava dado nenhum do domínio, só lê e imprime em stdout.

**Ressalva honesta, porque a versão anterior desta seção dizia "não escreve nada" e isso é
falso**: `openDb` (`db.ts:7-11`) roda `PRAGMA journal_mode = WAL` e `CREATE TABLE IF NOT EXISTS`
**a cada abertura** — são escritas, com `busy_timeout = 5000`. Um hook que dispara a cada prompt
pode, com um reindex segurando o lock de escrita, bloquear até 5 s contra um `timeout` de 10 s do
hook. Não corrompe nada (é o mesmo caminho que os hooks atuais já usam há dias), mas **é latência
no caminho do prompt do usuário**, e agora ele roda em 45% mais turnos. Se aparecer, a saída é
abrir o db em modo somente-leitura no hook — fora do escopo até que se meça.

Fora isso, o risco é baixo: "produção" aqui é a máquina do autor, e a pior falha de um hook de
contexto é não injetar, porque ele já falha em silêncio por construção.

## Verificação pós-deploy

**Obrigatória, e é ela que fecha a pergunta original do card.** Sete dias depois do merge:

```
node brain-mcp/scripts/injecao.mjs --dias 7     # taxa de injeção real na janela pós-mudança
```

e a re-medição da razão que motivou o card — chamadas de `Bash` contra `mcp__brain__*` nos
transcripts da mesma janela, contra a referência **31:1** de 2026-09-10. Publicar as duas no card
#11 como comentário.

**Qual gate ela trava, para não sobrar dúvida**: **não** bloqueia o merge — o delta 1 do
`CLAUDE.md` do workspace só torna a verificação pós-deploy bloqueante em mudança de dado, e esta
não é. O que ela bloqueia é a **passagem para ✅ Produção**: sem esse número o card fecharia sem
responder a pergunta que o abriu. "Obrigatória" acima é neste sentido, e só neste.

## Plano de testes

Não há runner de teste no repo; a prova é o `injecao.mjs` mais duas conferências na mão.

| Critério | O que prova | Como |
|---|---|---|
| CA-1 | Slash command com card resolve e injeta | `node scripts/injecao.mjs --caso "/gm-spec #11" --cwd ~/pessoal/claude-brain` imprime bloco com o título do card #11 |
| CA-1 | Slash command com feature resolve | idem com `--caso "/gm-implement 982-setor-dashboard-inconsistencias" --cwd ~/notoria/processos` → traz spec + tasks + card |
| CA-1 | Chega mesmo ao modelo, sem tool call | `claude -p '/gm-spec #11'` numa sessão real; conferir no `.jsonl` o `attachment.type === "hook_additional_context"` no turno, e nenhuma tool call antes dele |
| CA-1 | **Argumento caminho** (47% do corpus) | `--caso "/gm-implement processos/planning/reagrupamento-aih-por-dominio" --cwd ~/notoria/processos` resolve `feature:reagrupamento-aih-por-dominio` — se só o token inteiro for testado, cai na busca léxica |
| CA-1 | Pontuação final | `--caso "/gm-plan-tasks 11-fila-de-pedidos-pendentes." --cwd ~/pessoal/operations-center` resolve a feature apesar do ponto |
| CA-1 | Hash duplicado | `--caso "/gm-spec ##1086" --cwd ~/notoria/processos` resolve o card 1086 |
| CA-1 | Comando sem argumento não injeta | `--caso "/clear"` → nenhuma saída |
| CA-1 | Ordem dos guards | `--caso "/gm-card #5" --cwd ~/pessoal/claude-brain` (11 chars) injeta — se o guard de tamanho vier antes, sai vazio |
| CA-1 | Entidade sem doc nem vizinho não emite bloco vazio | apontar o hook para um índice sem grafo (`arestas` vazia) e conferir que cai na busca léxica ou não injeta, nunca cabeçalho sozinho |
| CA-1 | Workspace sem `repos` nem `exceto` não estoura | `brain-workspaces.json` temporário sem as duas chaves + `--caso "/gm-spec #11"` → não lança, injeta ou não injeta em silêncio |
| CA-1 | **Vizinho decisão sobrevive** (o blocker do `daqui()`) | `--caso "/gm-spec #11" --cwd ~/pessoal/claude-brain` traz as **duas decisões** (#426, #427). Se vier só o card #422, o `daqui()` foi aplicado e a feature está morta |
| CA-1 | **Feature antes de card** | `--caso "/gm-ship 982-setor-dashboard-inconsistencias" --cwd ~/notoria/processos` resolve `feature:`, não `card:` — conferir no cabeçalho qual entidade foi resolvida |
| CA-1 | **Ambiguidade não adivinha** | `--caso "/gm-spec #11" --cwd ~/pessoal` (raiz, sem repo): #11 é card em 2 repos do workspace → **não injeta**. Não pode cair na `feature:11-fila-de-pedidos-pendentes` |
| CA-1 | **Repo vem do cwd** | mesmo `#11` com `--cwd ~/pessoal/claude-brain` → card do `claude-brain`; com `--cwd ~/pessoal/operations-center` → card do `operations-center` |
| CA-1 | **Diversidade antes de profundidade** | na feature 982 (1 card + 1 spec + 5 tasks + 2 decisões) o bloco traz spec, decisão, card e **no máximo 1–2 tasks** — não 4 tasks |
| CA-1 | **Ordem determinística** | rodar o mesmo `--caso` 3× e comparar byte a byte |
| CA-1 | Passo 5 usa `tokensDe(arg)` | `--caso "/gm-explore como funciona o indexador de chunks" --cwd ~/pessoal/claude-brain` injeta — com `tokensDe(prompt)`, `gm`/`explore` reprovam tudo e sai vazio |
| CA-1 | Prompt curto normal continua sem injetar | `--caso "ok"` → nenhuma saída |
| CA-1 | Regressão do caminho normal | `--caso "<pergunta longa qualquer>"` continua injetando como hoje |
| CA-2 | A taxa sobe | `npm run injecao -- --dias 3`: depois ≥ 60% **e** ≥ 2× a taxa antes, no mesmo corpus |
| CA-3 | **Versionado == instalado** (portão real, imune ao #3) | `diff --strip-trailing-cr <(git show HEAD:hooks/brain-contexto.js) ~/.claude/hooks/brain-contexto.js` sai vazio |
| CA-3 | Sincronia cobre o arquivo (segundo sinal) | `./sync.sh status` não lista `brain-contexto.js` — se listar, conferir antes se não é o falso positivo CRLF do card #3 |
| CA-3 | Órfão é reportado | criar `~/.claude/hooks/zz-teste.js`, rodar `./sync.sh status`, ver o nome na seção de órfãos, apagar |
| CA-3 | **Órfão não vira ruído** | com `obsidian-diario.js.bak` e `obsidian-diario.js.pre-detach` presentes na instalação (estão hoje), a seção de órfãos **não** os lista |
| CA-3 | Paridade `sh`/`ps1` | `./sync.sh status` e `pwsh ./sync.ps1 status` reportam o mesmo conjunto |

## Technical Decisions

1. **Entidade + vizinhos do grafo** (não só o card, nem busca pelo título). O lookup é indexado e
   praticamente grátis (200 em 2 ms), e o que `/gm-spec` quer é a spec e as decisões — ligação
   real, não semelhança de texto.
2. **Rota Curta mantida, spec escrita em profundidade Lite.** O campo Rota do board fica Curta
   (sem PRD, sem tech-spec) porque `brain-mcp/src/` não muda. Mas há ~6 regras que o implementador
   não pode inventar — precedência, desambiguação, ordem dos guards, ambiguidade, sem-argumento,
   bypass do `relevante()` — e um parágrafo não as carrega.
3. **CA-2 partido em dois.** Replay determinístico no PR (verificável na hora) + re-medição da razão
   7 dias depois (responde a pergunta do card). A redação original só era verificável depois de dias
   de uso, o que travaria a esteira.
4. **`sync.sh` conserta a causa, não só o sintoma.** Só acrescentar o nome na lista resolveria este
   arquivo e deixaria o buraco aberto; o relato de órfão custa ~5 linhas e fecha a classe.
5. **Guard de `<12` chars fica como está.** Hipótese de torná-lo sensível a entidade levantada e
   **descartada na medição**: dos 168 prompts curtos, zero resolvem qualquer coisa.
6. **Filtro de relevância fica como está.** Custa 44 de 827 (5,3%) — pequeno demais para justificar
   mexer no que hoje impede injeção de ruído. Fora do escopo, deliberadamente.
7. **`Grafo.resolver()` não é reaproveitado nem consertado aqui.** O regex `{3,5}` quebra para
   cards de 1–2 dígitos; consertar mexeria em `brain-mcp/src/` e viraria Rota Completa. Vira card
   próprio em Triagem.
8. **Corpus do replay nunca é commitado.** O repo é público e os prompts são de sessões reais da
   Notoria. O script lê os transcripts locais em tempo de execução.
9. **Resolução por lista de candidatos, não por token único.** Descoberto na crítica: caminho é
   47% dos argumentos, e testar só o token inteiro jogaria 136 dos 291 na busca léxica. Com os
   segmentos de caminho como candidatos, feature vai de 42 para 179 e a busca léxica cai de 154
   para 18.
10. **O `injecao.mjs` executa o hook de verdade (`spawn`), não uma cópia da lógica.** É o padrão
    do `smoke.mjs`, que sobe o servidor real. Cópia da lógica deixa de pegar exatamente a
    regressão que o script existe para pegar.
11. **CA-2 mede antes-e-depois no mesmo corpus.** Limiar fixo contra janela móvel mediria a
    mistura de trabalho da semana, não o efeito da mudança.
12. **Vizinho de entidade não passa pelo `daqui()`.** Medido: `decisao` e `sessao` têm `repo NULL`
    em 415/415 e 388/388, e `entidades` não tem coluna `source` — o filtro apagaria tudo que dá
    valor à feature. A procedência vem da aresta explícita, não do caminho do arquivo.
    **Achado colateral, fora do escopo**: como as 411 decisões moram todas em
    `~/notoria/claude/decisoes/`, o `daqui()` do caminho léxico faz um turno do workspace
    `pessoal` **nunca** ver decisão nenhuma. É bug anterior a este card, com causa própria —
    **card de Triagem a criar**.
13. **Números de linha de `sync.*` são contra `dev`, com âncora de conteúdo junto.** A primeira
    versão desta spec citou linhas da árvore de trabalho da `feat/5` e errou todas. A âncora de
    conteúdo é o que sobrevive ao rebase; a linha é atalho.

### Correções da revisão de 2026-09-10

A primeira versão desta spec foi aprovada e publicada com **defeitos S1**, achados por uma
crítica adversarial independente e confirmados um a um contra o índice vivo e o `git show dev:`.
Registrados aqui porque a spec é viva e o histórico não deve virar mentira:

1. Todas as referências de linha de `sync.sh`/`sync.ps1` vinham da árvore da `feat/5`, não da
   `dev` declarada em `## Execution`. Corrigidas e reforçadas com âncora de conteúdo.
2. O `daqui()` não estava tratado, e aplicá-lo teria reduzido o caso do CA-1 ao único vizinho
   falso. Agora é explícito que o caminho de entidade não passa por ele.
3. O passo 4 não tinha filtro de workspace e `feature:11-fila-de-pedidos-pendentes` existe:
   `/gm-spec #11` no `claude-brain` teria injetado uma feature da Notória.
4. `feature` e `commit` estavam na ordem de prioridade e têm `doc_path NULL` em 100% das linhas.
5. Faltava `ORDER BY` dentro do grupo: qual task aparecia era sorteio.
6. O passo 5 herdaria `tokensDe(prompt)` e nunca injetaria.
7. `templates/settings.hooks.json` estava fora do File Change Summary.
8. O trecho de `desejados` era JS e quebraria o `install.ps1`, cuja chave é `status`.
9. O Rollback afirmava que o hook "não escreve nada"; `openDb` escreve (`WAL` + `CREATE TABLE`).
10. O relato de órfão nasceria com falso positivo permanente (`obsidian-diario.js.pre-detach`).
11. `## Verificação pós-deploy` dizia "obrigatória" e "não bloqueante" em parágrafos vizinhos.
12. O worktree sugerido não seguia a convenção do repo e quebrava a resolução de repo pelo `cwd`.

## Coding Standards

- Português nos comentários e nas mensagens, sem acento nos arquivos `.js` de hook — é a convenção
  já estabelecida nos quatro hooks existentes (`brain-briefing.js`, `brain-config.js`, os de diário).
- O comentário explica **por que**, não o que — e quando houver número medido, ele entra no
  comentário. É o padrão do arquivo atual (a nota sobre `setInterval` e o libuv, a nota sobre o piso
  de relevância) e o que dá a este repo a sua legibilidade.
- Hook **falha sempre em silêncio**; erro só sai no stderr sob `BRAIN_HOOK_DEBUG=1`.
- CommonJS no hook (`require`), `import()` dinâmico para atravessar até o `dist/` que é ESM — como
  já é hoje. Nada de dependência nova: só `node:sqlite`, `node:fs`, `node:path`.
- `.mjs` com `fail()` e `process.exit(1)` nos scripts, seguindo `smoke.mjs`.
- Nada além do especificado. Achado fora do escopo vira card em Triagem, não conserto de carona.
