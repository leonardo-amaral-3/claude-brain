# Escritor único do índice — eleição por lease — Spec

## References
- Card: [#1](https://github.com/leonardo-amaral-3/claude-brain/issues/1) — repo `leonardo-amaral-3/claude-brain`
- PRD: N/A — não é área de produto nova; é defeito de concorrência em módulo existente (`brain-mcp`).
- Decisões registradas nesta sessão: `#365` (mecanismo do lease), `#366` (medições de tempo).

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir `claude-brain/` no workspace `pessoal`)
- Base branch: `dev` — **a branch não existe ainda.** Hoje só há `main` com 2 commits. A primeira
  task DEVE começar por `git checkout main && git pull && git checkout -b dev && git push -u origin dev`,
  conforme a seção `## Branches` do `CLAUDE.md` deste repo. Sem isso não há base de integração.
- Feature branch: `feat/1-escritor-unico-do-indice`
- **Alvo das mudanças é `brain-mcp/src/` no REPO**, não a instalação. Depois do merge, o ciclo é
  `./sync.ps1 push` e então `npm run build` **na instalação** (`~/notoria/claude/brain-mcp/`) —
  é o `dist/` que roda, e nada avisa quando ele fica velho.

## Requisitos & critérios de aceite

Os três critérios abaixo são a versão verificável dos critérios do card. O review de IA, o plano de
testes e a validação em dev leem **daqui**.

### CA1 — Um só processo faz o trabalho pesado; os demais não falham por lock

> **Dado** N ≥ 2 servidores `brain` vivos contra o mesmo `brain.db`,
> **quando** todos completam o boot,
> **então** exatamente **um** deles executa `scan()`, `grafo.reconstruir()`, o backfill de
> embeddings e os syncs de GitHub/git; os demais registram no stderr que são seguidores e não
> executam nenhuma dessas quatro operações,
> **e** a tabela `lider` tem exatamente **uma** linha com `expira_em` no futuro.

> **Dado** o líder no meio de uma reindexação completa (transação única, medida em **9,3 s**),
> **quando** um seguidor atende `search_context` e `lembrar` no mesmo intervalo,
> **então** as duas chamadas concluem **sem erro** — nem `SQLITE_BUSY`, nem
> `database is locked`, nem resposta parcial.
>
> Nota de latência, para o critério não mentir: o `lembrar` do seguidor pode **esperar** o tempo da
> transação em curso (até ~9 s) antes de concluir. O que se exige aqui é que ele **conclua**, não que
> seja rápido. É o `busy_timeout` de 30 s fazendo o trabalho dele. Falhar era o defeito; esperar é o
> preço, e o card pede o primeiro.

Evidência de que o defeito é real e ainda está solto: **durante a redação desta spec**, a primeira
chamada de `lembrar` desta sessão devolveu `database is locked` — e mesmo assim a decisão `#365`
ficou gravada. Ou seja, hoje a falha é **parcial**: a linha entra na tabela, o passo seguinte
(arquivo, arestas, publicação) morre, e a tool reporta erro. É pior que falhar limpo.

**Escopo do "um só escreve"** (decisão TD-2): o líder monopoliza o *trabalho pesado* —
`Indexer.scan()`/`fullReindex()`, `Grafo.reconstruir()`, `preencherEmbeddings`,
`preencherVetoresDeDecisoes`, `GithubSyncer` e `sincronizarGit`. As escritas pequenas
(`INSERT INTO uso` de `tools.ts:42` e a tool `lembrar` de `memoria.ts:205`) continuam saindo de
**qualquer** processo, líder ou seguidor.

### CA2 — O mesmo chunk não é embutido duas vezes

> **Dado** N servidores vivos e chunks com `embedding IS NULL`,
> **quando** o backfill roda,
> **então** apenas o processo líder chama `embedPassagens`, e o laço de `preencherEmbeddings`
> reconfere a liderança **antes de cada lote de 32**; ao perder o lease, para no lote corrente e
> retorna `interrompido: true`.

Limite explícito do que isto garante: a sobreposição possível é de **no máximo um lote (32 chunks)**,
apenas na janela de troca de líder. Reembutir é idempotente — mesmo texto, mesmo vetor —, então a
consequência de um lote sobreposto é CPU desperdiçada, nunca dado errado. Garantia literal de
"nunca duas vezes" foi avaliada e descartada em TD-4.

### CA3 — O líder morrer não para o índice

> **Dado** o processo líder morto **abruptamente** (`taskkill /F`, sem chance de rodar handler),
> **quando** passa o TTL do lease,
> **então** outro processo vivo assume sozinho, sem intervenção humana, e retoma o trabalho pesado
> (scan periódico volta a rodar, backfill pendente continua de onde parou).

> **Dado** o líder encerrado **graciosamente** — o cliente MCP fecha o stdin e o transporte stdio
> termina, que é como uma sessão do Claude Code de fato se despede —,
> **quando** o handler de fechamento roda,
> **então** o lease é liberado na hora e a tomada de posse do próximo acontece no próximo tique de
> promoção (≤ ⅓ do TTL), sem esperar o TTL inteiro.

**Ressalva de plataforma, e ela é load-bearing:** a máquina-alvo é Windows, onde **não existe
`SIGTERM` recebível** — `child.kill()` do processo pai vira `TerminateProcess` e **nenhum handler
Node roda**, nem `SIGTERM`, nem `exit`. Portanto o caminho gracioso **não pode ser a garantia** do
CA3; ele é otimização para o caso comum (fechamento do stdin, que o Node observa). *A garantia é o
TTL*, e é por isso que o primeiro cenário do CA3 — morte abrupta — é o que precisa passar. Os
handlers de `SIGINT`/`exit` entram porque são baratos e ajudam no encerramento por Ctrl+C e na CLI,
não porque se possa contar com eles.

### CA4 — A busca do seguidor não envelhece

> **Dado** um seguidor que nunca escreve no índice,
> **quando** o líder indexa um arquivo novo,
> **então** a busca **léxica** do seguidor acha o arquivo imediatamente (lê o banco a cada consulta)
> **e** a busca **semântica** também — o `VectorIndex` do seguidor detecta a mudança de
> `meta.versao_indice` e recarrega.

CA4 não está no card. Ele existe porque o próprio conserto o cria: hoje todo processo varre, então
todo processo enxerga tudo; ao calar os seguidores, o cache em memória de `VectorIndex`
(`vectors.ts:44-65`, recarregado só via `marcarSujo()`) passaria a servir um índice vetorial
congelado no boot. Sem CA4 a correção do card #1 introduz um defeito pior que ele.

## Technical Overview

Eleição de **escritor único por lease** gravado no próprio `brain.db`.

Uma tabela `lider` de uma linha guarda quem detém o direito de escrever pesado, identificado por um
**UUID por instância de processo** (não pelo pid — pid é reciclado pelo SO e um pid reaproveitado
renovaria o lease de um processo morto). O lease vence em `TTL_MS`; o dono renova por timer. Quem
não é dono é seguidor: serve buscas, escreve `uso`/`lembrar`, e tenta tomar o lease a cada tique —
o que dá a tomada de posse do CA3 de graça, sem watchdog nem daemon.

**Enquadramento que sustenta o desenho: o lease é otimização, não é o mecanismo de correção.** Quem
garante que duas escritas não se corrompem continua sendo o SQLite. O lease existe para eliminar
*trabalho duplicado* (N varreduras, N reconstruções de grafo, N cálculos do mesmo vetor, N chamadas
`gh issue list`) e as tempestades de lock que vinham disso. Por isso uma sobreposição rara de
escritores na janela de troca é aceitável e não precisa de fencing: ela degrada para o comportamento
de hoje, que já é seguro quanto a dados.

Três correções acompanham a eleição, porque sem elas o lease sozinho não fecha o CA1:

1. **`BEGIN` → `BEGIN IMMEDIATE`** nos três pontos de transação. `BEGIN` puro é *deferred*: abre com
   um snapshot de leitura e só tenta a trava de escrita no primeiro `INSERT`/`DELETE`. Se a
   transação **leu antes de escrever** e outra conexão commitou nesse meio-tempo, o SQLite devolve
   `SQLITE_BUSY_SNAPSHOT` **sem invocar o busy handler** — porque esperar não resolveria: o snapshot
   já está velho e a transação precisa ser refeita do zero. `BEGIN IMMEDIATE` pega a trava de
   escrita na abertura, que é exatamente onde o `busy_timeout` funciona.

   **Onde isso morde de verdade, conferido statement a statement:** só em `Indexer.scan()`. Depois
   do `BEGIN` (`indexer.ts:206`) ele entra em `indexFile` → `removeDoc`, que faz
   `SELECT id FROM docs WHERE path = ?` **antes** dos `DELETE` — é o padrão ler-depois-escrever que
   produz `BUSY_SNAPSHOT`. Já `Grafo.reconstruir()` (`grafo.ts:93`) abre com `DELETE FROM arestas` e
   `preencherEmbeddings` (`vectors.ts:140`) abre com `UPDATE`: ambas pegam a trava de escrita no
   primeiro statement, onde o `busy_timeout` já se aplica hoje. Nesses dois o `IMMEDIATE` é
   uniformidade e seguro barato, não conserto. A spec o aplica nos três para que ninguém precise
   refazer esta análise ao acrescentar um `SELECT` no começo de uma delas.
2. **`busy_timeout` 5.000 → 30.000 ms.** Medido: a reindexação completa é uma transação única de
   **9,3 s** — quase o dobro do timeout atual. Com 5 s, escrita concorrente durante um reindex falha
   *por construção*, não por azar. 30 s cobre a operação mais longa com folga de 3×.
3. **`meta.versao_indice`**, um contador que o líder incrementa a cada mudança de conteúdo e que o
   `VectorIndex` consulta para saber se seu cache expirou (CA4).

### Números medidos nesta sessão (2026-09-09, cópia do `brain.db` vivo)

Índice: 5.757 docs · 13.208 chunks · 4.171 entidades · 7.809 arestas · 359 decisões · `brain.db` 137 MB.

| Operação | Tempo | Forma |
|---|---|---|
| `Indexer.scan()` em regime | ~900 ms | 51 roots, 5.767 arquivos; transação pequena |
| `Grafo.reconstruir()` | ~650 ms | `DELETE` + reinserção de ~12 mil linhas, transação única |
| `Indexer.fullReindex()` | **9,3 s** | `clearAll` + 5.767 arquivos, **transação única** |
| Carga completa do `VectorIndex` | ~210 ms | 13.271 vetores × 384 dims saindo de BLOB |
| Consulta semântica com cache quente | 11,3 ms | força bruta sobre os 13.271 |

O `fullReindex` também **zera os embeddings**: termina com os 13.241 chunks em `embedding IS NULL`,
porque `indexFile` reinsere chunks sem a coluna. É isso que torna a tempestade de backfill grande o
bastante para N processos se atropelarem nela (ver `## Fora do escopo`).

Estes números fixam o TTL: `TTL_MS = 60_000` está acima da operação síncrona mais longa (9,3 s) por
uma margem de 6×. Isso importa porque **`scan()` e `reconstruir()` são síncronos e travam o event
loop** — o líder não consegue renovar o lease enquanto trabalha.

## Implementation Details

### Área 1 — `brain-mcp/src/lease.ts` (arquivo NOVO)

Módulo único, sem dependência nova, no estilo dos demais (classe exportada, comentário de topo
explicando o porquê, nomes em pt-BR como `grafo.ts`/`vigia.ts`).

```ts
// ATENÇÃO: `Number(x) || 60_000` estaria ERRADO — BRAIN_LEASE_TTL_MS=0 é o desligamento a quente
// descrito em `## Rollback`, e 0 é falsy, então o padrão comeria o valor. Tem de ser undefined-check.
const bruto = process.env.BRAIN_LEASE_TTL_MS;
export const TTL_MS = bruto === undefined || Number.isNaN(Number(bruto)) ? 60_000 : Number(bruto);
export const TIQUE_MS = Math.max(1_000, Math.floor(TTL_MS / 3) || 1_000);

export interface DonoLease {
  instancia: string;
  pid: number;
  host: string;
  inicio: number;
  expiraEm: number;
}

export class Lease {
  private readonly instancia: string;   // randomUUID() — identidade do PROCESSO, não o pid
  private lider = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(private db: Db) {}

  get souLider(): boolean;
  tentarAdquirir(forcar?: boolean): boolean;
  renovar(): boolean;        // false = perdi o lease
  liberar(): void;           // idempotente; seguro em handler de exit
  dono(): DonoLease | null;  // para mensagem de erro da CLI e diagnóstico
  iniciarTique(aoAssumir: () => void, aoPerder: () => void): void;
  pararTique(): void;
}
```

Aquisição — **um statement só**, portanto atômico em autocommit, sem `BEGIN`:

```sql
INSERT INTO lider (id, instancia, pid, host, inicio, expira_em)
VALUES (1, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  instancia = excluded.instancia, pid = excluded.pid, host = excluded.host,
  inicio = excluded.inicio, expira_em = excluded.expira_em
WHERE lider.expira_em < ?1_agora OR lider.instancia = excluded.instancia
```

`run().changes === 1` → ganhou (inserção nova, lease vencido tomado, ou renovação do próprio).
`changes === 0` → há líder vivo. Com `forcar = true`, o `WHERE` do `DO UPDATE` é omitido.

Renovação: `UPDATE lider SET expira_em = ? WHERE id = 1 AND instancia = ?` — `changes === 0`
significa que outro tomou o lease; o processo se rebaixa a seguidor.

Liberação: `DELETE FROM lider WHERE id = 1 AND instancia = ?` — condicionada à instância para nunca
apagar o lease de outro.

`iniciarTique` cria **um** `setInterval(TIQUE_MS)` com `.unref?.()` (padrão já usado em
`vigia.ts:73`) que faz as duas coisas conforme o papel: líder renova (e chama `aoPerder` se
perdeu), seguidor tenta adquirir (e chama `aoAssumir` se ganhou).

### Área 2 — `brain-mcp/src/db.ts`

- `busy_timeout` (linha 11): `5000` → `30000`, com o comentário trocado para citar a medição de 9,3 s.
- Duas tabelas novas no `db.exec` de criação (aditivas, `IF NOT EXISTS`, no mesmo bloco):

**Emenda 2026-09-09 (task 3) — o `busy_timeout` não cobre o `journal_mode`, e isso derrubava servidor
no boot.** `openDb` passa a ligar o WAL por um helper `ligarWal(db)` com retry curto (até 20
tentativas de 25 ms, só para `errcode === 5`), e o `busy_timeout` passa a ser definido **antes** dele.

*Como apareceu:* o caso `um-so-lider` desta task pegou servidores **morrendo no boot** com
`database is locked` e stack em `openDb`. Medido em 2026-09-09: **12 mortes em 192 aberturas
simultâneas** de um banco novo. Um processo que morre no boot por lock é exatamente o que o **CA1**
proíbe — a task não podia fechar com isso de pé.

*Por que a spec errou o diagnóstico:* a Technical Overview trata `busy_timeout = 30_000` como o
antídoto geral para contenção. Não é. `PRAGMA journal_mode = WAL` precisa de trava exclusiva e o
SQLite **não invoca o busy handler nesse caminho** — devolve `SQLITE_BUSY` imediatamente. Por isso a
ordem dos dois PRAGMAs, sozinha, não resolve: apenas estreita a janela (medido — voltou a falhar 1
vez em 10 rodadas da suíte). Só o retry fecha: **0 falhas em 512 aberturas**, com a suíte verde em 8
rodadas seguidas.

*Escopo do retry, de propósito estreito:* o journal mode é persistente no arquivo, então a disputa só
existe nas primeiras aberturas de um banco recém-criado; depois o PRAGMA é no-op e nunca reentra no
laço. E só `errcode === 5` é retentado — qualquer outro erro sobe na hora, para não transformar um
defeito real em espera silenciosa.

*Regressão:* caso `abrir-em-paralelo-nao-quebra` em `scripts/concorrencia.mjs` (5 rodadas × 10
aberturas simultâneas de banco novo). Conferido que ele reprova contra o código anterior à emenda.

```sql
CREATE TABLE IF NOT EXISTS lider (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  instancia TEXT NOT NULL,
  pid INTEGER NOT NULL,
  host TEXT NOT NULL,
  inicio INTEGER NOT NULL,
  expira_em INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
```

- Duas funções exportadas ao lado de `removeDoc`/`clearAll`:

```ts
export function versaoIndice(db: Db): string;      // SELECT valor FROM meta WHERE chave='versao_indice'; '' se ausente
export function bumpVersaoIndice(db: Db): void;    // INSERT ... ON CONFLICT DO UPDATE SET valor = CAST(valor AS INTEGER) + 1
```

- **`clearAll` NÃO pode apagar `lider` nem `meta`.** Ele hoje lista as tabelas explicitamente
  (`chunks_fts`, `chunks`, `docs`, `files`), então basta não acrescentar as novas — mas o teste do
  CA3 deve provar que um `fullReindex` não derruba a liderança de quem o executa.

### Área 3 — `brain-mcp/src/config.ts`

```ts
export const dbPath = process.env.BRAIN_DB || join(packageRoot, "data", "brain.db");
```

Uma linha, valor padrão idêntico ao de hoje. Existe para o teste de concorrência poder rodar contra
um banco descartável em vez do índice vivo de 137 MB — hoje `dbPath` é constante e **não há como
testar concorrência sem sujar o índice real**. `BRAIN_CONFIG` já segue exatamente este padrão
(`config.ts:86`).

### Área 4 — `brain-mcp/src/vectors.ts`

- `VectorIndex` ganha um segundo parâmetro opcional no construtor:
  `constructor(private db: Db, private versaoAtual: () => string = () => "")`.
- `garantirCarregado()` passa a comparar a versão antes de decidir que o cache serve:

```ts
private ultimaVersao = "";
private garantirCarregado(): void {
  const v = this.versaoAtual();
  if (this.carregado && !this.sujo && v === this.ultimaVersao) return;
  // …carga igual à de hoje…
  this.ultimaVersao = v;
}
```

  Custo, medido e não estimado: a **checagem** é um `SELECT` numa tabela de uma linha por consulta
  (desprezível); a **recarga**, quando a versão muda, custa **~210 ms** para os 13.271 vetores, e
  uma consulta com cache quente custa 11,3 ms. Ou seja, a primeira consulta após uma mudança de
  índice vai de ~11 ms para ~220 ms. **Isso não é custo novo:** é exatamente o que todo processo já
  paga hoje via `marcarSujo()` a cada varredura própria. A mudança apenas faz o seguidor pagar pela
  varredura do líder em vez de pela sua. Frequência inalterada, latência inalterada.
- `preencherEmbeddings` ganha `opts.aindaSouLider?: () => boolean`; no topo do `while`, se a função
  existe e devolve `false`, sai do laço. O retorno ganha `interrompido: boolean`.

  **Emenda 2026-09-09 (task 2):** `preencherEmbeddings` ganha um segundo opt, **`embutir?: (textos:
  string[]) => Promise<Float32Array[]>`**, com padrão `embedPassagens` — nenhum chamador de produção
  passa. Motivo: o caso `para-ao-perder-o-lease` do `## Plano de testes` exige que o **1º lote
  complete** para provar que o recheque de liderança vem *antes* do 2º, e o `embedPassagens` real
  carrega o modelo `Xenova/multilingual-e5-small`. O cache do modelo vive no `node_modules` da
  **instalação**, não no do repo: rodar de verdade custaria download de ~120 MB na primeira execução
  e ~15 s por rodada, numa suíte que roda a cada task. ESM não permite substituir o binding exportado
  de fora, então a costura tem de estar na assinatura. *Descartados:* stub por cópia do
  `dist/vectors.js` para junto de um `embeddings.js` falso (esperteza que depende do layout do build)
  e hook de `module.register` em processo filho (maquinário maior para o mesmo efeito).
- `db.exec("BEGIN")` → `db.exec("BEGIN IMMEDIATE")` (linha 140).

### Área 5 — `brain-mcp/src/indexer.ts` e `brain-mcp/src/grafo.ts`

Uma linha em cada: `db.exec("BEGIN")` → `db.exec("BEGIN IMMEDIATE")` (`indexer.ts:206`,
`grafo.ts:93`). O `ROLLBACK` do `catch` continua correto: `BEGIN IMMEDIATE` que falha lança **antes**
de abrir transação, então o `catch` não é alcançado com transação inexistente — o `BEGIN` está fora
do `try` nos dois arquivos (e também em `vectors.ts:140`), e **isso deve ser preservado**. Inverter
essa ordem produziria um `ROLLBACK` sobre transação inexistente, que mascara o erro original.

Em `indexer.ts` há ainda um detalhe a **não** quebrar: `this.aoMudar()` é chamado na linha 227,
**depois** do `COMMIT` da 221. É isso que permite ao callback novo escrever `meta.versao_indice` sem
aninhar escrita dentro da transação da varredura.

### Área 6 — `brain-mcp/src/index.ts` (a orquestração)

O corpo do arquivo passa a ter dois caminhos. O que **não** muda: abrir db, montar tools, conectar o
transporte stdio, `aquecer()` o modelo de embeddings. Nenhum seguidor pode responder pior que hoje.

```ts
const lease = new Lease(db);
const vec = new VectorIndex(db, () => versaoIndice(db));
const indexer = new Indexer(db, config, () => {
  vec.marcarSujo();
  if (lease.souLider) bumpVersaoIndice(db);   // só o líder escreve o contador
});
```

**Boot** — substitui o `try/catch` de `index.ts:31-36`:

```ts
if (lease.tentarAdquirir()) {
  try { const s = indexer.scan(); log(`boot (líder): …`); }
  catch (err) { log("indexação no boot falhou (servindo índice existente):", err); }
} else {
  const d = lease.dono();
  log(`boot (seguidor): índice mantido pelo pid ${d?.pid} — esta sessão só consulta`);
}
```

**Trabalho de fundo** — o `setTimeout(…, 500)` de `index.ts:70-110` é refatorado numa função
`assumirTrabalhoPesado()` **idempotente** (guarda `let pesadoAtivo = false`), que faz na ordem de
hoje: `syncer.kickIfStale()` → `vigia.iniciar()` → `grafo.reconstruir()` → `preencherEmbeddings`.
Duas mudanças dentro dela:

- `preencherEmbeddings(db, { limite: 2000, aindaSouLider: () => lease.souLider })`, e no `.then`,
  além de `vec.marcarSujo()`, chamar `bumpVersaoIndice(db)`.
- `preencherVetoresDeDecisoes` continua no `aquecer().then(…)`, mas **só se `lease.souLider`**.

O `setTimeout` passa a ser:

```ts
setTimeout(() => {
  aquecer().then(async () => { /* … + preencherVetoresDeDecisoes só se líder … */ });
  if (lease.souLider) assumirTrabalhoPesado();
  lease.iniciarTique(
    () => { log("assumi o índice (líder anterior sumiu)"); assumirTrabalhoPesado(); },
    () => { log("perdi a liderança do índice; virei seguidor"); vigia.parar(); pesadoAtivo = false; }
  );
}, 500);
```

**Saída graciosa** — para o CA3 não custar o TTL inteiro no caso comum. O gatilho **principal em
Windows** é o fim do transporte stdio (o cliente fecha o stdin), não sinal:

```ts
const sair = () => { try { lease.liberar(); } catch { /* saindo mesmo assim */ } };
transport.onclose = sair;              // caminho real de despedida de uma sessão MCP
process.on("exit", sair);              // fim normal do processo
process.on("SIGINT", () => { sair(); process.exit(0); });   // Ctrl+C; em Windows, o único sinal útil
```

`lease.liberar()` é um `DELETE` síncrono — legítimo num handler de `exit`, onde só código síncrono
roda. **Nenhum destes caminhos é a garantia do CA3** (ver a ressalva de plataforma no critério): num
`TerminateProcess` nada disso executa, e quem responde é o TTL.

**Rebaixamento tem de ser reversível.** `aoPerder` chama `vigia.parar()` e zera `pesadoAtivo`; um
`aoAssumir` posterior chama `vigia.iniciar()` de novo. `Vigia.parar()` já zera `this.watchers` e
`iniciar()` reatribui `timerPeriodico`, então o ciclo parar→iniciar é seguro — mas é justamente o
tipo de coisa que apodrece em silêncio, então o teste `posse-apos-morte-abrupta` deve exercer o
ciclo completo e provar que o novo líder volta a indexar arquivo novo.

### Área 7 — `brain-mcp/src/cli.ts`

Antes de qualquer escrita (ou seja, antes da linha 17 `new Indexer`), a CLI disputa o lease:

```ts
const forcar = process.argv.includes("--force");
const lease = new Lease(db);
if (!(await adquirirComEspera(lease, forcar, 10_000))) {
  const d = lease.dono();
  console.error(
    `O índice está sob o servidor pid ${d?.pid} (${d?.host}), lease até ${new Date(d!.expiraEm).toLocaleTimeString()}.\n` +
    `Feche as sessões do Claude Code, ou rode de novo com --force para tomar a liderança.`
  );
  process.exit(1);
}
```

`adquirirComEspera` tenta a cada 1 s durante 10 s — cobre o caso comum de um líder que está de saída.
A chamada de `preencherEmbeddings` da CLI (bloco `--embed`) também passa a receber
`aindaSouLider: () => lease.souLider`, pelo mesmo motivo do servidor: se um `--force` de outro
processo tomar a liderança no meio, a CLI para no lote corrente em vez de brigar.

Ao fim do script, `lease.liberar()`. Consequência a aceitar conscientemente: entre a saída da CLI e
o tique do próximo servidor (≤ ⅓ do TTL) **não há líder**, e portanto ninguém varre. É janela curta e
autocorrigida — preferível a deixar um lease órfão de processo já morto segurando o índice.

**Costura de teste (task 4), no mesmo espírito do `embutir` da Área 4:** os 10 s saem de
`BRAIN_CLI_ESPERA_MS`, com 10 s de padrão e o mesmo undefined-check do TTL (`Number(x) || 10_000`
comeria o `0`). Sem ela o caso `cli-disputa-o-lease` pagaria 10 s a cada rodada da suíte só para ver
a recusa. Não muda decisão nenhuma — o comportamento padrão continua sendo tentar a cada 1 s por
10 s —, e de quebra dá um escape em script: `BRAIN_CLI_ESPERA_MS=0` recusa na primeira tentativa.

### Área 8 — `brain-mcp/src/tools.ts` (tool `reindex`)

A tool `reindex` (linha 364) é o mesmo tipo de ação humana explícita que a CLI, e hoje chama
`syncer.syncNow()` + `scan()` + `grafo.reconstruir()` de qualquer processo. Passa a seguir a mesma
regra, com a mesma escapatória:

- Ganha o parâmetro `forcar: z.boolean().optional()`, descrito como "tomar a liderança do índice de
  outro processo".
- Se não conseguir o lease e `forcar` não vier, **não escreve nada** e devolve texto explicando quem
  detém o índice (pid e host) e que `forcar: true` resolve. Não é erro de protocolo — é resposta.
- Se conseguir, executa como hoje e mantém a liderança (o processo virou líder de fato).

`registerTools` passa a receber o `lease` como parâmetro. O `INSERT INTO uso` de `tools.ts:42`
**não muda** — segue em todo processo, dentro do `try/catch` que já o impede de derrubar a tool.

**Emenda 2026-09-09 (task 4) — quem toma o lease pelo `reindex` tem de assumir o TRABALHO, não só o
título.** A frase acima — "mantém a liderança (o processo virou líder de fato)" — era otimista:
virar líder **por fora do tique não liga nada**. Em `index.ts` o trabalho pesado só arranca em dois
lugares: no boot (`if (lease.souLider) assumirTrabalhoPesado()`) e no `aoAssumir` do tique — e o
tique só chama `aoAssumir` quando um **seguidor** adquire o lease dentro dele
(`else if (this.tentarAdquirir())`). Um seguidor promovido pelo `reindex` passa a cair no ramo
`if (this.lider) renovar()` para sempre: renova o lease indefinidamente e **nunca** liga vigia nem
backfill — enquanto o líder anterior, esse sim, notou a perda e desligou o dele. Resultado: ninguém
vigia arquivo, ninguém preenche vetor, e o índice congela até alguém reiniciar uma sessão. É o CA4
desfeito pela porta dos fundos, e por uma linha que esta feature introduz.

Isto **não** é a janela curta que a Área 7 aceita de olhos abertos. Aquela é autocorrigida — a CLI
*libera* o lease e o próximo tique promove alguém. Esta não fecha sozinha: o lease fica de pé,
segurado por um líder que não faz o trabalho de líder.

Portanto `registerTools` recebe **também** `aoAssumirLideranca: () => void`, e `index.ts` passa
`assumirTrabalhoPesado` — que já nasceu idempotente (guarda `pesadoAtivo`), de modo que chamá-la num
processo que já era líder não duplica vigia, grafo nem backfill. O `reindex` a chama **depois** de
adquirir o lease e **antes** de varrer. Consequência para o escopo declarado da task 4: `index.ts`
muda em **duas** linhas, não em uma.

### Área 9 — `brain-mcp/scripts/concorrencia.mjs` (arquivo NOVO) + `package.json`

Teste de concorrência no estilo de `smoke.mjs` (spawn de `dist/index.js`, JSON-RPC por stdio, sem
framework — o repo não tem test runner e esta spec não introduz um). Roda **isolado**, via
`BRAIN_CONFIG` + `BRAIN_DB` apontando para uma fixture temporária, e `BRAIN_LEASE_TTL_MS=3000` para
não esperar 60 s pela tomada de posse.

`package.json`: `"concorrencia": "node scripts/concorrencia.mjs"`.

**Emenda 2026-09-09 (task 3):** os casos que sobem servidor de verdade obtêm embeddings de um
**stub injetado por hook de resolução ESM** (`node --import scripts/embeddings-falso-hook.mjs`, que
redireciona `dist/embeddings.js` para um módulo falso de ~35 linhas). Nenhum código de produção
muda; o stub vive só em `scripts/`.

*Motivo:* `embute-uma-vez` (CA2) e `seguidor-nao-envelhece` (CA4) exigem que um servidor **spawnado**
gere embeddings — `Buscador` só toma o caminho semântico quando `jaPronto()` é true (`search.ts:272`).
O modelo real `Xenova/multilingual-e5-small` tem **470 MB** (`model.onnx`, medido) e está cacheado só
no `node_modules` da *instalação*; como `embeddings.ts:26` mantém `allowRemoteModels = true`, cada
servidor spawnado baixaria 470 MB e pagaria ~15 s, numa suíte que roda a cada task e num repo público
que outra pessoa clona.

*Isto reverte parcialmente a emenda anterior desta mesma data*, que descartou "hook de
`module.register` em processo filho". Aquele descarte vale onde vale: no teste de **unidade**, onde
existe assinatura para costurar (`opts.embutir`) e o hook seria maquinário maior para o mesmo efeito.
Aqui não há assinatura — a fronteira de processo é justamente o que está sob teste —, então o hook
deixa de ser maquinário excedente e passa a ser o único ponto de costura.

*O que o stub NÃO enfraquece:* os vetores falsos são one-hot determinísticos, então o seguidor só
acha o chunk novo **se** o `VectorIndex` dele recarregou — exatamente a propriedade do CA4. E o teste
afirma sobre a **ausência** do rodapé `(busca semântica indisponível…)` de `tools.ts:108`, de modo que
uma consulta que caiu para só-léxico reprova em vez de passar em silêncio. A *qualidade* da busca
continua onde a spec já a pôs: `npm run eval` contra o índice real, no ship.

## File Change Summary

| Arquivo | Mudança |
|---|---|
| `brain-mcp/src/lease.ts` | **novo** — classe `Lease`: aquisição atômica, renovação, liberação, tique de promoção |
| `brain-mcp/src/db.ts` | tabelas `lider` e `meta`; `busy_timeout` 5s→30s; `versaoIndice`/`bumpVersaoIndice`; `ligarWal()` com retry (emenda task 3) |
| `brain-mcp/src/config.ts` | `dbPath` respeita `BRAIN_DB` (padrão inalterado) |
| `brain-mcp/src/vectors.ts` | `VectorIndex` invalida cache por `meta.versao_indice`; `preencherEmbeddings` reconfere liderança por lote; `BEGIN IMMEDIATE` |
| `brain-mcp/src/indexer.ts` | `BEGIN` → `BEGIN IMMEDIATE` (linha 206) |
| `brain-mcp/src/grafo.ts` | `BEGIN` → `BEGIN IMMEDIATE` (linha 93) |
| `brain-mcp/src/index.ts` | eleição no boot; `assumirTrabalhoPesado()` idempotente; tique de promoção/rebaixamento; handlers de saída liberam o lease; passa `assumirTrabalhoPesado` ao `registerTools` (emenda task 4) |
| `brain-mcp/src/cli.ts` | disputa o lease com espera de 10 s; `--force`; libera ao fim (inclusive saindo por erro); espera configurável por `BRAIN_CLI_ESPERA_MS` |
| `brain-mcp/src/tools.ts` | tool `reindex` exige lease, com parâmetro `forcar`; ao ser promovida, dispara o trabalho pesado (emenda task 4) |
| `brain-mcp/scripts/concorrencia.mjs` | **novo** — teste dos 4 critérios com N servidores reais; casos da CLI e do `reindex` (task 4) |
| `brain-mcp/scripts/embeddings-falso.mjs` | **novo** (emenda task 3) — stub determinístico do modelo, só para teste |
| `brain-mcp/scripts/embeddings-falso-hook.mjs` | **novo** (emenda task 3) — hook ESM que injeta o stub no servidor spawnado |
| `brain-mcp/package.json` | script `concorrencia` |
| `brain-mcp/README.md` | seção curta: escritor único, o que a CLI faz quando há sessões abertas, `--force` |
| `docs/` ou `claude/mapas/` | atualizar o mapa do `brain-mcp` com o novo módulo (via `/mapear` no ship) |

## Migrations & compatibilidade

**Migration:** duas tabelas novas (`lider`, `meta`), criadas por `CREATE TABLE IF NOT EXISTS` no
`openDb` que já roda em todo boot. **Aditiva, não destrutiva, sem backfill**: nenhuma tabela ou
coluna existente muda de forma, nenhum dado é reescrito. Um banco antigo abre com o código novo e
ganha as tabelas vazias; a primeira aquisição de lease as popula.

**Compatibilidade para trás:** o código novo lê um `brain.db` antigo sem nenhum passo manual. O
caminho inverso também é seguro: o código **antigo** abrindo um banco novo simplesmente ignora
`lider` e `meta`.

**Janela de risco — é a única real, e é a da instalação.** Depois de `sync push` + `npm run build`,
os servidores **já em execução continuam rodando o `dist/` velho** até serem reiniciados. Durante
essa janela convivem processos que respeitam o lease e processos que não respeitam. O
comportamento resultante é **exatamente o de hoje** — contenção, sem corrupção —, porque o lease é
otimização e o SQLite continua sendo a autoridade de correção. Mitigação: fechar as sessões do
Claude Code antes do `npm run build`; a verificação pós-deploy abaixo confirma o resultado.

**Sem `sqlite-vec`, sem dependência nova, sem mudança no formato dos embeddings** — portanto a
Rota Completa aqui se justifica pelo *estado novo em disco* (as duas tabelas), não por migração de
formato.

## Rollback

`git revert` do merge na `main` + `./sync.ps1 push` + `npm run build` na instalação + reiniciar as
sessões. As tabelas `lider` e `meta` **ficam no banco e viram inertes** — o código antigo não as
consulta e nada as lê. Não há dado a restaurar, não há `DOWN` migration a escrever, e o índice em si
nunca é reescrito por esta mudança.

Se o problema aparecer sem tempo para revert, há um desligamento a quente sem deploy:
`BRAIN_LEASE_TTL_MS=0` faz todo lease nascer vencido, de modo que todo processo se elege líder — o
comportamento de hoje, de volta, por variável de ambiente.

## Verificação pós-deploy

Obrigatória (a mudança governa quem escreve no índice — o dado do produto). Depois do
`npm run build` na instalação e de reabrir **pelo menos 3** sessões do Claude Code:

1. **Um só líder, e ele está vivo:**
   ```sh
   node -e "const {DatabaseSync}=require('node:sqlite');
   const db=new DatabaseSync('C:/Users/lokin/notoria/claude/brain-mcp/data/brain.db',{readOnly:true});
   const l=db.prepare('SELECT * FROM lider').all();
   console.log(l, 'linhas:', l.length, '| vivo:', l[0] && l[0].expira_em > Date.now());"
   ```
   **Esperado:** exatamente 1 linha, `expira_em` no futuro, `pid` correspondendo a um `node.exe`
   vivo (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"`).

2. **Os seguidores calaram:** nos logs MCP das sessões, `N-1` linhas `boot (seguidor)` para 1 linha
   `boot (líder)`. Nenhum seguidor imprime `grafo:` nem `embeddings:`.

3. **A busca não regrediu:** `npm run eval` na instalação, comparado ao hit@1/hit@5/MRR de antes da
   mudança (medir **antes** do deploy e anexar os dois números ao card). Este é o gate que o
   `CLAUDE.md` deste repo exige: *"toda mudança em `brain-mcp/src/` fecha com o índice provado, não
   com o `tsc` verde"*.

4. **O seguidor enxerga o que o líder indexou (CA4):** criar um arquivo `.md` novo numa root de
   documento, esperar ~5 s (debounce de 1,5 s do vigia + ~900 ms de varredura + folga), e buscar por
   um termo único dele **de uma sessão seguidora** — tem de aparecer, tanto por palavra-chave quanto
   por pergunta em linguagem natural. **O caminho semântico é o que importa aqui**: o léxico passaria
   mesmo com o bug, porque lê o banco direto; só a busca semântica exercita a invalidação de cache.

5. **Matar o líder e ver a posse trocar (CA3):** `taskkill /F /PID <pid do líder>`, esperar 60 s,
   reexecutar a consulta do passo 1 — `instancia` tem de ser **outra**, e o log de alguma sessão
   sobrevivente tem de mostrar `assumi o índice`.

## Plano de testes

Sem framework: `scripts/concorrencia.mjs`, no estilo de `smoke.mjs`, rodando contra fixture
descartável (`BRAIN_CONFIG` + `BRAIN_DB` + `BRAIN_LEASE_TTL_MS=3000`). Um caso por critério.

| Critério | Caso em `scripts/concorrencia.mjs` | Prova |
|---|---|---|
| CA1 | `um-so-lider` — sobe 4 servidores contra a mesma fixture, espera o boot dos 4 | `SELECT COUNT(*) FROM lider` = 1; stderr traz 1× `boot (líder)` e 3× `boot (seguidor)`; nenhum seguidor imprime `grafo:` |
| CA1 | `seguidor-escreve-durante-reindex` — dispara `reindex {forcar:true}` no líder e, no mesmo instante, `search_context` + `lembrar` num seguidor | as duas chamadas do seguidor retornam resultado, sem `SQLITE_BUSY`/`database is locked` |
| CA2 | `embute-uma-vez` — fixture com chunks sem vetor; conta as chamadas de embedding por processo | só o líder gera embeddings; `SELECT COUNT(*) FROM chunks WHERE embedding IS NULL` chega a 0 |
| CA2 | `para-ao-perder-o-lease` — teste de unidade de `preencherEmbeddings` com `aindaSouLider` devolvendo `false` no 2º lote | retorna `interrompido: true` e no máximo 32 chunks embutidos |
| CA3 | `posse-apos-morte-abrupta` — `SIGKILL` no líder, espera > TTL | outra `instancia` em `lider`; algum sobrevivente logou `assumi o índice`; um arquivo novo passa a ser indexado |
| CA3 | `posse-apos-saida-graciosa` — **fecha o stdin** do líder (não `SIGTERM`: em Windows ele não é recebível) | `lider` fica vazia imediatamente; sucessor assume no tique seguinte, **sem** esperar o TTL |
| CA3 | `reindex-nao-derruba-lider` — `fullReindex` no líder | após o `clearAll`, o líder continua dono do lease (prova que `clearAll` não toca em `lider`/`meta`) |
| TD-5 | `reindex-recusa-e-forca` — seguidor chama `reindex`, depois de novo com `forcar: true` | a recusa é **texto** (não erro de protocolo), cita o pid do dono e não escreve em `docs` nem em `lider`; com `forcar` o processo vira líder **e assume o trabalho pesado** (emenda task 4) |
| TD-5 | `cli-disputa-o-lease` — CLI com o índice ocupado, com espera, e saindo por erro | recusa acionável (pid, host, expiração, `--force`) sem varrer nada; a espera **repete** até o lease ser liberado; `liberar()` acontece inclusive no caminho que estoura |
| CA4 | `seguidor-nao-envelhece` — líder indexa arquivo novo; seguidor busca por termo único | acha por via léxica **e** semântica; `meta.versao_indice` incrementou |
| — | `lease-expirado-e-tomado` — teste de unidade de `Lease`: duas instâncias sobre o mesmo db | a 2ª só ganha depois do TTL; `forcar: true` ganha na hora; `renovar()` da 1ª devolve `false` depois |
| regressão | `npm run smoke` | o servidor ainda responde `initialize` + `tools/list` + `tools/call` |
| regressão | `npm run eval` (`scripts/golden.json`) | hit@1/hit@5/MRR **não caem** frente ao baseline medido antes da mudança |

`npm run smoke` e `npm run eval` continuam rodando contra o índice real da instalação, como hoje —
`concorrencia.mjs` é o único que exige isolamento, e é por isso que `BRAIN_DB` existe.

## Technical Decisions

**TD-1 — Lease no próprio SQLite, não lockfile nem daemon.** O lease não acrescenta dependência,
morre junto com o banco (não existe lockfile órfão a limpar) e a aquisição é um statement único,
portanto atômica sem transação explícita. *Descartados:* lockfile com heartbeat — `rename`/`unlink`
no Windows são mais traiçoeiros que um `UPDATE ... WHERE`, e exigiria política própria de órfão;
daemon indexador dedicado — empurra o problema para "quem sobe o daemon", cria processos órfãos no
Windows e exige política de morte e de upgrade após `npm run build`, mudança muito maior que o card
pede. Registrado em `#365`.

**TD-2 — "Um só escreve" vale para o trabalho pesado, não para toda escrita.** `lembrar` e `uso`
continuam saindo de qualquer processo. Barrar `lembrar` num seguidor quebraria a **Regra 2** do
workspace (*"decidiu algo? `lembrar` naquele momento"*) — uma sessão que não pode registrar decisão
é pior que uma sessão lenta. E são `INSERT`s de milissegundos: perto de uma transação de 9,3 s, são
ruído. *Descartado:* fila em disco das escritas do seguidor com caminho de volta para devolver o id
da decisão — muita máquina para dois `INSERT`s pequenos, e transforma uma tool hoje síncrona e
confiável numa fonte nova de latência e falha.

**TD-3 — Identidade do líder é um UUID de instância, não o pid.** O SO recicla pid. Um processo
novo que herdasse o pid de um líder morto renovaria um lease que não é dele, e dois escritores
coexistiriam sem que nada percebesse. `pid` e `host` ficam na tabela **só para diagnóstico** — são o
que a CLI mostra ao recusar.

**TD-4 — Sobreposição de até um lote de 32 chunks é aceitável.** *Descartada* a reserva exata por
coluna nova (`embedding_claim`): exige migração num banco vivo de 137 MB e um passe de reparo para
claims órfãos de processo morto — máquina permanente para uma janela rara. *Descartada* também a
reserva por sentinela (BLOB vazio): contaminaria `WHERE embedding IS NOT NULL` em quatro lugares
(viraria `length(embedding) > 0`) e um processo morto no meio deixaria o chunk reservado **para
sempre**, invisível à busca semântica — bug silencioso. O recheque por lote dá 95% da garantia por
5% do custo, e reembutir é idempotente.

**TD-5 — CLI e tool `reindex` disputam o lease e recusam com aviso, em vez de roubar.** Roubar
silenciosamente colocaria a ação humana em corrida com o `grafo.reconstruir()` do líder. Recusar com
o pid do dono e uma escapatória explícita (`--force` / `forcar: true`) mantém a ação possível e
consciente. Vale para os dois porque são a mesma coisa: ação humana explícita de reindexação.

**TD-6 — Invalidação de cache por contador na consulta, não por timer.** O `SELECT` numa tabela de
uma linha custa microssegundos e deixa o seguidor tão fresco quanto o líder. *Descartado:* recarregar
o `VectorIndex` a cada N segundos — introduz uma janela de defasagem que só existiria em seguidores,
ou seja, um comportamento de busca que depende de qual sessão você abriu primeiro. Inaceitável num
índice compartilhado.

**TD-7 — `BEGIN IMMEDIATE` e `busy_timeout` de 30 s entram nesta spec, não em card separado.** Sem
os dois, o CA1 não fecha nem com o lease: `lembrar` de um seguidor durante os 9,3 s de um reindex
continuaria falhando. São a mesma falha do card, na sua forma residual.

**TD-8 — `BRAIN_DB` existe para o teste, e isso é motivo suficiente.** Hoje `dbPath` é constante, o
que torna o teste de concorrência ou impossível ou destrutivo contra o índice vivo. `BRAIN_CONFIG`
já estabeleceu o padrão. O valor padrão não muda, então nenhuma instalação percebe.

## Coding Standards

- **TypeScript estrito, ESM, `node:sqlite` síncrono.** Sem dependência nova — o `package.json` só
  ganha um script.
- **Nomes em pt-BR** no código novo, como o resto do módulo (`grafo.ts`, `vigia.ts`, `memoria.ts`):
  `Lease`, `tentarAdquirir`, `renovar`, `liberar`, `souLider`, `dono`.
- **Comentário de topo explicando o PORQUÊ**, no estilo de `vigia.ts:1-9` e `vectors.ts:1-5`: o de
  `lease.ts` deve dizer que o lease é otimização e que o SQLite continua sendo a autoridade de
  correção — é o enquadramento que impede alguém de "endurecer" o lease depois sem necessidade.
- **Timers sempre com `.unref?.()`** (`vigia.ts:73` e `:81`) — um timer que segura o processo vivo
  trava o encerramento da sessão.
- **Log em `console.error`** com prefixo `[brain]`, como todo o resto.
- **Nada além do especificado.** Em particular: não trocar o índice vetorial por ANN, não mexer no
  chunking, não "aproveitar para" consertar o descarte de embeddings do `fullReindex` (ver abaixo).

## Fora do escopo

- **`fullReindex` descarta os 13.241 embeddings.** Descoberto na medição desta sessão: `clearAll` +
  `indexFile` reinserem chunks sem a coluna `embedding`, então todo reindex completo joga fora o
  vetor de tudo e obriga a recalcular. É defeito real e é o que torna a tempestade de backfill
  grande — mas é **outra causa** (perda de trabalho), não concorrência, e o conserto (casar chunk
  velho com novo por hash do texto) é uma mudança de indexação com risco próprio. **Merece card
  próprio**, aberto depois deste. Registrado em `#366`.
- **Trocar o índice vetorial por ANN.** `vectors.ts:1-5` já declara o gatilho (≈100k chunks); com
  13.208 estamos longe.
- **Tirar o `INSERT INTO uso` do caminho da consulta.** Foi oferecido e recusado nesta sessão: é uma
  escrita minúscula em autocommit, e mudá-la exigiria mexer em `scripts/uso.mjs` e no formato do
  relatório sem ganho mensurável depois que as transações grandes forem serializadas.
- **Reduzir o tamanho da transação do `fullReindex`** (hoje 9,3 s numa só). Quebrá-la em pedaços
  aliviaria a trava, mas trocaria atomicidade por latência: um reindex interrompido no meio deixaria
  o índice parcial. Com `busy_timeout` de 30 s o problema deixa de morder; se voltar a morder quando
  o workspace crescer, aí é card próprio com a decisão de atomicidade em cima da mesa.
