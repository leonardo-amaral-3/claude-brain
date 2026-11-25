# T16 do jev.mjs independente do conteúdo do índice — Spec

## References
- Card: [#51](https://github.com/leonardo-amaral-3/claude-brain/issues/51) — repo `leonardo-amaral-3/claude-brain`
- G1: comentário do card, cofre #1577. Evidência e causa: cofre #1573. Profundidade: cofre #1583. Mandato "assuma": cofre #1379.
- Origem do defeito: [#42](https://github.com/leonardo-amaral-3/claude-brain/issues/42), PR [#48](https://github.com/leonardo-amaral-3/claude-brain/pull/48) (merge 69e71ce na `dev`). Contrato do cliente do Jev: `planning/42-filtro-jev/spec.md`, § "Contrato do cliente do Jev (estável)". **Esse contrato não muda.**
- PRD: não há

## Execution
- Repo: `leonardo-amaral-3/claude-brain`. Working dir: **só** a worktree `/home/leo/pessoal/claude-brain-51-t16-independente`.
- Base branch: `dev`. A branch saiu de `origin/dev` 69e71ce; em 11/11 a `origin/dev` já está em 1e81d49 (merge do #44, PR #47), que não toca `hooks/` nem `brain-mcp/scripts/jev.mjs` (`git diff --stat 69e71ce origin/dev`). Não precisa de rebase para implementar. O T11, o T14 e o T15 comparam com `git show origin/dev:hooks/...`, e o `hooks/` é o mesmo nas duas.
- Feature branch: `fix/51-t16-independente` (já existe).
- Profundidade: **Rota curta**. Uma task só.
- Ambiente: `brain-mcp/node_modules` já instalado e `dist/` compilado na worktree. Node 22 (`PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH`). Não rodar `npm ci`/`install`.
- Nunca: chamar a API do Jev, usar `TYPESAFE_API_KEY`, mandar corpus à TypeSafe AI, mexer em `hooks/`, `brain-mcp/scripts/injecao.mjs`, `brain-mcp/src/`, no checkout principal, nas worktrees dos irmãos ou na instalação viva (`~/.claude`, `/home/leo/notoria/claude/brain-mcp`). Nada de `sync.sh push`.
- Regra 2 de `## A esteira` (smoke + eval) **não se aplica**: nada em `brain-mcp/src/`. A regra 3 (skills) também não.

> **Emenda 2026-11-24 (Execution).** Worktree `/home/leo/pessoal/claude-brain-51-t16-sem-indice`, branch
> nova `fix/51-t16-sem-indice` criada com `git switch -c` a partir de `origin/dev` a88e7a8 (a PR #56 já
> está nela). PR para a `dev`. A `fix/51-t16-independente` e a worktree dela ficam como estão. Node:
> o do PATH (26.12.0) serve; o 22.23.5 também (medido). Nada de `npm ci`/`install`; dependência nova → PARADA.

## Requisitos & critérios de aceite

> **Emenda 2026-11-24 (decisão do braço direito no modo despachado, cofre #3443, escopo `claude-brain#51`;
> achado no cofre #3440).** Onde o resto desta spec disser outra coisa, vale esta nota.
> Em 24/11 o CA1 falhou com o índice vivo: nenhum candidato de 6 em diante escapava da colisão de
> caminho com os cinco primeiros, e o T16 saía `NÃO MEDI`, exit 2, também na `origin/dev` a88e7a8. O
> defeito de fundo é o mesmo do card: o T16 depende do conteúdo do índice vivo. A correção é a
> direção dada pelo Leonardo: **a parte hook do `jev.mjs` (T11-T16) não lê mais o índice vivo.** O
> próprio teste monta um índice de prova na pasta temporária e roda o hook da worktree e o de
> `origin/dev`, inalterados, contra ele. Desenho em `### Emenda 2026-11-24 — índice de prova`, abaixo.
> Os critérios passam a ser:
>
> **CA1' — `npm run jev` mede tudo e sai 0 com qualquer índice ou sem índice.**
> - Dado o checkout da branch, com `brain-mcp/node_modules` e sem `BRAIN_JEV`, `TYPESAFE_API_KEY` nem `BRAIN_JEV_FALSO` no ambiente,
> - quando se roda `cd brain-mcp && npm run jev` (a) com o `~/.claude/brain-workspaces.json` desta máquina e (b) com `BRAIN_WORKSPACES=/nao/existe.json`,
> - então as duas rodadas saem `0`, com as três linhas `jev: T1-T10 OK …`, `jev: T16 escolha sintetica OK (sem indice)` e `jev: T11-T16 OK (parte hook; cliente falso, indice de prova, sem rede)`, nessa ordem.
>
> **CA2' — O T16 mede a colisão dos dois lados do corte dentro do hook real.**
> - Dado o índice de prova, em que a busca do `PROMPT_DE_PROVA` devolve 12 resultados, 10 vão ao Jev e o 6º repete o caminho do 5º,
> - quando o T16 aprova pelo falso só o que `aprovadosDoT16` devolve,
> - então os aprovados são as posições **7, 8, 9 e 10**, o bloco traz **exatamente** esses quatro caminhos, nessa ordem, e o cabeçalho traz `4 de 10 candidatos passaram; abaixo, os 4 primeiros`.
>
> **CA3** (caso sintético da escolha) não muda.
>
> **CA4 — O `NÃO MEDI` da parte hook só sobra para ambiente.** Exit 2 só quando falta o `node:sqlite`
> ou o `git show origin/dev:hooks/…`, ou quando o índice de prova deixa de servir ao hook (as
> pré-condições do T11, do T15 e do T16 em `### Emenda 2026-11-24`). Nenhum `NÃO MEDI` depende do
> conteúdo do índice vivo, que o script não abre mais.
>
> **Emenda 2026-11-24 (G4, achado 1; decisão do Leonardo).** As pré-condições do T11, do T15 e do
> T16 saem do `NÃO MEDI` e viram `FALHOU`, exit **1**. Com o índice de prova fixo, elas só caem quando
> um hook muda (o da worktree ou o de `origin/dev`), e isso não é ambiente. Exit 2 fica só para a
> falta do `node:sqlite` ou do `git show origin/dev:hooks/…`.

**CA1 — O T16 mede com o índice vivo de hoje.**
- Dado o índice vivo de 11/11/2026, em que os candidatos 8, 9 e 10 do `PROMPT_DE_PROVA` repetem os caminhos do 1, do 2 e do 3,
- quando se roda `cd brain-mcp && npm run jev` sem `BRAIN_JEV`, `TYPESAFE_API_KEY` nem `BRAIN_JEV_FALSO` no ambiente,
- então ele sai `0`, a última linha é `jev: T11-T16 OK (parte hook; cliente falso, sem rede)` e o T16 rodou de fato (não saiu pelo `naoMedi`).

**CA2 — O T16 aprova só quem escapa da colisão e confere exatamente esses.**
- Dado `enviados` (os candidatos que chegam ao Jev, lidos das linhas de debug, n ≥ 6),
- quando o T16 monta o roteiro do falso,
- então ele aprova só os candidatos de 6 em diante que `aprovadosDoT16` devolve (regra em `## Implementation Details`), e confere que:
  - os caminhos do bloco são **exatamente** os desses aprovados, na ordem do ranking;
  - o cabeçalho traz `` `${k} de ${n} candidatos passaram; abaixo, os ${Math.min(k, 5)} primeiros` ``, com `k` = quantidade de aprovados.

**CA3 — A escolha é provada sem o índice.**
- Dada uma lista sintética com colisão dos dois lados do corte,
- quando se roda `npm run jev` **sem índice** (ou com qualquer índice),
- então o caso sintético roda antes do pré-voo do índice e confere os aprovados esperados. Ele também passa o roteiro gerado pelo `jev.julgar` real, com o falso, e confere que só os aprovados ficam com probabilidade ≥ 0.5.
- O `NÃO MEDI` do T16 só sobra quando `aprovadosDoT16` devolve vazio, isto é, quando nenhum candidato de 6 em diante escapa da colisão.

## Premissas medidas

Medidas em 2026-11-11 na worktree (HEAD 69e71ce), com Node v22.23.4 e o índice vivo só para leitura.

| Premissa | Como foi provada | Resultado |
|---|---|---|
| O defeito reproduz na base | `cd brain-mcp && npm run jev` sem `BRAIN_JEV`/`TYPESAFE_API_KEY`/`BRAIN_JEV_FALSO` no env | `T1-T10 OK`, depois `NÃO MEDI: troque o prompt de prova: um candidato de 6 em diante repete o caminho de um dos cinco primeiros`, exit **2**. T11-T15 passaram antes, porque o T16 é o último e `confere` sai 1 no primeiro vermelho |
| Os 10 candidatos do `PROMPT_DE_PROVA` hoje | hook da worktree com `BRAIN_JEV=contexto BRAIN_JEV_FALSO=sim BRAIN_HOOK_DEBUG=1`, linhas `[brain-contexto] jev <pos> <p> <path>` (sonda em `/tmp/sonda51/sonda.mjs`) | 1 `…/github/docs/claude-brain/cards/42.md` · 2 `…/prs/48.md` · 3 `…/planning/11-cerebro-em-slash-command/spec.md` · 4 `…/cards/11.md` · 5 `…/hooks/brain-contexto.js` · 6 `…/brain-mcp/scripts/injecao.mjs` · 7 `…/hooks/brain-briefing.js` · **8 = 1 · 9 = 2 · 10 = 3** |
| A regra nova mede com esse índice | protótipo de `aprovadosDoT16` + roteiro + hook da worktree (`/tmp/sonda51/prova.mjs`) | aprovados = posições **6 e 7**. O bloco traz exatamente `injecao.mjs` e `brain-briefing.js`, nessa ordem, e o cabeçalho é `2 de 10 candidatos passaram; abaixo, os 2 primeiros` |
| O id do trecho é o caminho, igual entre trechos do mesmo arquivo | `hooks/brain-contexto.js:278` (`id: String(r.path)`) | dois trechos do mesmo arquivo têm o mesmo `trechoId` |
| O falso casa por substring do caminho normalizado | `hooks/jev.js:207-210` (`normalizarCaminho(contexto.trechoId).includes(normalizarCaminho(quando.trechoId))`), `hooks/jev.js:163` (minúsculas, `\`→`/`), e a primeira regra que casa vence (`hooks/jev.js:218`) | aprovar um caminho aprova todo trecho cujo caminho o contém |
| `norm` do jev.mjs = `normalizarCaminho` do jev.js | `brain-mcp/scripts/jev.mjs:362` × `hooks/jev.js:163` | mesma transformação |
| O bloco filtrado corta em 5 e vão no máximo 10 ao Jev | `hooks/brain-contexto.js:234` (`LIMITE_FINAL = 5`), `:237` (`LIMITE_JEV = 10`), `:484` | k ≤ n − 5 ≤ 5. O `Math.min(k, 5)` só espelha a fórmula do hook (`:499-502`) |
| `jev.julgar` aceita env e roteiro por opções, sem rede | `hooks/jev.js:104-106` (`envDe`), `:453-463` (ramo do falso); uso igual no T4 (`brain-mcp/scripts/jev.mjs:158,171`) | o caso sintético roda o falso real sem índice e sem rede. `MAX_TRECHOS = 16` (`hooks/jev.js:85`) comporta a lista de 11 |
| Onde o `NÃO MEDI` de hoje mora | `brain-mcp/scripts/jev.mjs:517-536` | o `if (aprovados.some(...)) naoMedi(...)` da linha 524-526 aborta por **qualquer** colisão |

> **Emenda 2026-11-11 (implementacao, decisao do braco direito, cofre escopo `claude-brain#51`):**
> (1) A sanidade do lote roda com `--base 3c3b92c` (primeiro pai do merge 69e71ce, a `dev` de antes do #42):
> `cd brain-mcp && node scripts/injecao.mjs --desde 2026-11-03 --ate 2026-11-09 --base 3c3b92c --portao jev`
> sai 0 ("Portao do #42 OK"). Com `--base origin/dev` o exit 2 ("o hook e igual ao base") e por desenho,
> porque o #51 nao toca `hooks/`; onde esta spec e a task dizem `--base origin/dev` nessa sanidade, vale `3c3b92c`.
> (2) A premissa medida dos 10 candidatos fica datada: no indice de 11/11, em re-medicao feita na
> implementacao, os aprovados da regra nova sao as posicoes **6, 7 e 8** (k = 3), e nao 6 e 7. A regra nao muda.

> **Emenda 2026-11-11 (G4 da PR #56, `/gm-correcao`, decisoes do braco direito no cofre #1629, escopo `claude-brain#51`):**
> Onde o resto desta spec disser outra coisa, vale esta nota.
> (1) **Colisao num sentido so** (achado 3). Substitui "substring nos dois sentidos" no CA2, no
> comentario e no codigo de `aprovadosDoT16` e na decisao "Colisao nos dois sentidos com os cinco
> primeiros". O `regraCasa` casa o id que CONTEM o `trechoId` da regra, entao so fica de fora o
> candidato de 6 em diante cujo caminho esta contido no de um dos cinco primeiros (igual incluso).
> Com um sentido so, a segunda exclusao ("contido no de quem ficou de fora") deixa de ter efeito: quem
> contem um excluido e um dos cinco. A funcao vira
> `enviados.slice(5).filter((c) => !cinco.some((b) => b.caminho.includes(c.caminho)))`, e o conjunto
> continua fechado (um excluido nao contem nenhum aprovado, senao o dos cinco que o contem tambem
> conteria). No caso sintetico, o 8 (`/r/b.md/g.md`, contem o 2) e o 9 (`g.md`, contido no 8) passam a
> ser aprovados; o 6 (repete o 5) e o 10 (contido no 3) seguem fora. Esperado: **7, 8, 9 e 11**, nos
> itens 2 e 5. No indice de 11/11 os aprovados seguem 6, 7 e 8.
> (2) **Esperados limitados a 5** (achado 1): `esperados = aprovados.slice(0, 5).map(...)`, como o
> cabecalho e o `jev.passaram.slice(0, LIMITE_FINAL)` do hook.
> (3) **Todo veredito `ok`** (achado 4): o caso sintetico ganha um 5o `confere`,
> `vs.length === lista.length && vs.every((v) => v.estado === "ok")`, antes da checagem dos aprovados.
> (4) **T16 sonda de novo e repete uma vez** (achado 6). Sai do "Fora do escopo": o T16 sonda logo antes
> da propria rodada e repete sonda + rodada uma vez se divergir, no molde do T13. As duas checagens
> (caminhos e cabecalho) viram um `confere` so, com o detalhe da ultima tentativa. A sondagem antes do
> T12 fica como pre-condicao (n >= 6).
> (5) **Ordem so com 2+ caminhos** (achado 2, refutado em parte). Com k = 1, ou com aprovados que
> dividem um caminho, o T16 continua valendo e prova "so esses"; "na ordem do ranking" so se aplica com
> 2 ou mais caminhos distintos, e a mensagem do T16 diz isso. **Sem** `NAO MEDI` para menos de 2.
> (6) Limpeza (achados 7 e 8): o caso sintetico grava o roteiro na `pastaTemporaria`, criada antes
> dele (sem `pastaSintetica` nem segundo handler de `exit`), e a fabrica `c` fica `{ posicao, caminho }`.
> (7) Achado 5 (o falso casar por substring e o id do trecho nao ser unico) virou o card #57: muda o
> formato do roteiro, que e contrato estavel do #42.

**Emenda 2026-11-24: premissas do índice de prova.** Medidas em 2026-11-24 na worktree
`claude-brain-51-t16-sem-indice` (HEAD a88e7a8 = `origin/dev` depois de `git fetch`), protótipo em
`/tmp/sonda51b/prova.mjs`.

| Premissa | Como foi provada | Resultado |
|---|---|---|
| O defeito reproduz na base de hoje | `cd brain-mcp && npm run jev` (Node 26.12.0, índice vivo) | `T1-T10 OK`, `T16 escolha sintetica OK (sem indice)`, depois `NÃO MEDI: troque o prompt de prova: nenhum candidato de 6 em diante escapa da colisao de caminho com os cinco primeiros`, exit **2** |
| O hook acha o `dist/` pelo caminho do `.db`, e o `.db` pela config de `BRAIN_WORKSPACES` | `hooks/brain-contexto.js:371-378` (`cfg.doCwd`, `existsSync(ws.db)`, `dist = dirname(db)/../dist`, `import(url('db.js'))`, `import(url('search.js'))`); `hooks/brain-config.js:25` (`ARQUIVO = process.env.BRAIN_WORKSPACES \|\| …`) | um `workspaces.json` próprio, um `.db` qualquer e um `dist/` ao lado bastam para o hook rodar inteiro sem a instalação. É esse o ponto de troca; o hook não muda |
| Do `dist/` o hook usa só `openDb`, `Buscador`, `tokensDe` e `normalizar` | `hooks/brain-contexto.js:377-378`, `:451`, `:466-469` | o `dist/` falso exporta esses quatro, e mais nada |
| O caminho de entidade usa só `entidades`, `arestas`, `docs` e `chunks`, por SQL | `hooks/brain-contexto.js:89`, `:122`, `:153-156`, `:162-165`, `:170-174`, `:202-213` | um `.db` com as quatro tabelas e só as colunas que essas consultas leem resolve `/gm-spec #42` |
| `node:sqlite` existe nos Node desta máquina e o brain-mcp já o usa | `brain-mcp/src/db.ts:1` (`import { DatabaseSync } from "node:sqlite"`); `node -e "require('node:sqlite')"` no 26.12.0 e no 22.23.5 | carrega nos dois. No 22.23.5 escreve `ExperimentalWarning` na stderr, o que não afeta as linhas `[brain-contexto] jev …` |
| O hook de hoje e o de `origin/dev` rodam contra o índice de prova | protótipo: T11 (flag desligada, as duas stdouts iguais e o bloco com `busca lexica automatica`), sondagem (10 linhas `jev` de 12 resultados), T12 (stdout vazia), T14 lento (igual, 2030 ms), T15 (`/gm-spec #42` resolve `card:repo-teste#42`, igual nos dois) e T16 (roteiro aprovando 7..10) | tudo como esperado no Node 26.12.0 e no 22.23.5. T16: `4 de 10 candidatos passaram; abaixo, os 4 primeiros`, com os caminhos `docs/f.md`, `g.md`, `h.md`, `i.md`, nessa ordem |
| O código desta emenda roda como está escrito | os três blocos `js` de `### Emenda 2026-11-24 — índice de prova` aplicados, com os itens 1-8, numa cópia de `hooks/` + `brain-mcp/scripts/` em `/tmp/prova51c` (git com `origin/dev` = a88e7a8, `node_modules` por link) | `npm run jev` → exit **0** com a config desta máquina, exit **0** com `BRAIN_WORKSPACES=/nao/existe.json`, exit **0** no Node 22.23.5. O grep do CA4 não acha nada. Sabotagem (a) `esperados.slice(1)` → `FALHOU: T16 so os candidatos 7,8,9,10 de 10, na ordem do ranking`, exit 1. Sabotagem (b) 6º nome `"e2"` → `NÃO MEDI: o indice de prova nao serve mais: aprovados 6,7,8,9,10 de 10, esperados 7,8,9,10`, exit 2 |
| O `jev.mjs` vira independente do índice vivo | `grep -n "cfgDoHook\|conf\.\|CWD_DE_PROVA" brain-mcp/scripts/jev.mjs` | os únicos pontos que leem a config viva são o pré-voo (`:426-435`), o `CWD_DE_PROVA` (`:455`) e o env do `rodarHook`, que herda o `BRAIN_WORKSPACES` de quem roda. Os três mudam na emenda |

## Technical Overview

O falso casa a regra pelo caminho, e o caminho é o id de todos os trechos de um arquivo. Por isso
o T16 não consegue aprovar um candidato de 6 em diante que repete o arquivo de um dos cinco
primeiros. Hoje ele desiste da medição inteira por uma colisão dessas. A correção tira esses
candidatos dos aprovados em vez de abortar.

A regra fica numa função pura, `aprovadosDoT16`, e é provada por um caso sintético que roda antes
do pré-voo do índice e passa pelo `jev.julgar` real com o falso. O T16 vivo continua igual no
resto: mesmo prompt, mesma leitura do bloco, e a mesma conferência de ordem e de cabeçalho, agora
com `k` no lugar de `n − 5`.

Sem colisão, `aprovadosDoT16` devolve `enviados.slice(5)` inteiro, que é o comportamento de hoje.

## Implementation Details

### `brain-mcp/scripts/jev.mjs` — função `aprovadosDoT16`

Definir logo depois de `naoMedi` (hoje `:355-358`) e **antes** de `const repo = join(root, "..")`
(`:360`), na parte hook, com este código e este comentário:

```js
// Escolha dos aprovados do T16 (#51). O roteiro do falso casa por substring do caminho normalizado
// (regraCasa do hooks/jev.js), e o hook usa o caminho como id: aprovar um caminho aprova todo
// trecho cujo caminho o contem. Fica de fora (1) todo candidato de 6 em diante cujo caminho colide,
// por substring nos dois sentidos, com o de um dos cinco primeiros, e (2) todo candidato de 6 em
// diante cujo caminho esta contido no de um que ficou de fora, porque a regra dele aprovaria aquele.
// Devolve os aprovados na ordem do ranking; vazio = nao ha como provar a ordem com este prompt.
function aprovadosDoT16(enviados) {
  const colide = (a, b) => a.includes(b) || b.includes(a);
  const cinco = enviados.slice(0, 5);
  const resto = enviados.slice(5);
  const fora = [...cinco, ...resto.filter((c) => cinco.some((b) => colide(c.caminho, b.caminho)))];
  return resto.filter((c) => !fora.includes(c) && !fora.some((x) => x.caminho.includes(c.caminho)));
}

// Roteiro do falso que aprova (0.95) so os caminhos dados; o resto cai no padrao (0.05).
const roteiroDoT16 = (aprovados) => ({
  regras: aprovados.map((a) => ({ quando: { trechoId: a.caminho }, responde: { probabilidade: 0.95 } })),
  padrao: { probabilidade: 0.05 },
});
```

`aprovadosDoT16` recebe os objetos `{ posicao, probabilidade, caminho }` de `candidatosEnviados`
(`:451-452`) e devolve um subarray deles, sem copiar nem reordenar. `caminho` já vem normalizado
por `norm`.

### `brain-mcp/scripts/jev.mjs` — caso sintético (CA3)

Logo depois das duas definições acima, e ainda antes de `const repo`, um bloco `{ … }` com
`await`. É top-level await, que o arquivo já usa. `c`, `lista`, `limpa`, `pastaSintetica`,
`roteiroSintetico` e `vs` são `const` **dentro** do bloco. O bloco fecha com
`console.log("jev: T16 escolha sintetica OK (sem indice)");`, a única linha nova de saída. É ela
que prova, na rodada sem índice, que o caso rodou antes do pré-voo (CA3).

1. Lista de 11 candidatos, construída por `const c = (posicao, caminho) => ({ posicao, probabilidade: 0.95, caminho });`:

   | pos | caminho | por quê | esperado |
   |---|---|---|---|
   | 1 | `/r/a.md` | | (os cinco) |
   | 2 | `/r/b.md` | | |
   | 3 | `/r/c.md` | | |
   | 4 | `/r/d.md` | | |
   | 5 | `/r/e.md` | | |
   | 6 | `/r/e.md` | mesmo arquivo do 5º, do outro lado do corte | fora |
   | 7 | `/r/f.md` | não colide | **aprovado** |
   | 8 | `/r/b.md/g.md` | contém o caminho do 2º | fora |
   | 9 | `g.md` | não colide com os cinco, mas está contido no 8º, que ficou fora | fora |
   | 10 | `/r/c` | contido no caminho do 3º | fora |
   | 11 | `/r/f.md` | repete o 7º; nenhum dos dois colide com os cinco | **aprovado** |

2. `confere(igual(aprovadosDoT16(lista).map((x) => x.posicao), [7, 11]), "T16 escolha sintetica: so 7 e 11 escapam da colisao")`.
3. `confere(aprovadosDoT16(lista.slice(0, 6).concat([c(7, "/r/a.md"), c(8, "/r/b.md")])).length === 0, "T16 escolha sintetica: tudo colide = nenhum aprovado")`.
4. Sem colisão, a regra é a de hoje: com `const limpa = ["/r/a.md", "/r/b.md", "/r/c.md", "/r/d.md", "/r/e.md", "/r/f.md", "/r/g.md"].map((p, i) => c(i + 1, p))`, `confere(igual(aprovadosDoT16(limpa), limpa.slice(5)), "T16 escolha sintetica: sem colisao aprova 6..n")`.
5. O falso real confirma que o roteiro aprova exatamente esses.
   - `const pastaSintetica = mkdtempSync(join(tmpdir(), "jev-t16-"));`, seguido logo de `process.on("exit", () => rmSync(pastaSintetica, { recursive: true, force: true }));`. Use o mesmo padrão da `pastaTemporaria` (`:377-378`). **Não** use `try/finally`: o `confere` sai com `process.exit(1)` (`:21-24`, `:39-41`), e o `finally` não roda nesse caminho.
   - `const roteiroSintetico = join(pastaSintetica, "roteiro-t16-sintetico.json");` e `writeFileSync(roteiroSintetico, JSON.stringify(roteiroDoT16(aprovadosDoT16(lista))));`.
   - Chamar `const vs = await jev.julgar("p", lista.map((x) => ({ id: x.caminho, texto: "t" })), { uso: "contexto", env: { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: roteiroSintetico } });`.
   - Conferir `confere(igual(lista.filter((_, i) => vs[i].estado === "ok" && vs[i].probabilidade >= 0.5).map((x) => x.posicao), [7, 11]), "T16 escolha sintetica: o falso aprova so 7 e 11")`.
   - O limiar `0.5` é o `LIMIAR_JEV` do hook (`hooks/brain-contexto.js:238`). Escrever como literal, com um comentário curto que aponta para lá.

`mkdtempSync`, `rmSync`, `writeFileSync`, `tmpdir` e `join` já estão importados no topo do arquivo
(usados em `:377-378` e `:394-395`). Conferir os imports na implementação e não duplicar.

### `brain-mcp/scripts/jev.mjs` — T16 vivo (CA1, CA2)

O bloco de hoje (`:517-536`) passa a ser exatamente isto:

```js
// ---- T16: o Jev aprova so os candidatos de 6 em diante que escapam da colisao = so esses, na ordem do ranking --
{
  const n = enviados.length;
  const aprovados = aprovadosDoT16(enviados);
  if (!aprovados.length) {
    naoMedi("troque o prompt de prova: nenhum candidato de 6 em diante escapa da colisao de caminho com os cinco primeiros");
  }
  const k = aprovados.length;
  const roteiro = join(pastaTemporaria, "roteiro-t16.json");
  writeFileSync(roteiro, JSON.stringify(roteiroDoT16(aprovados)));
  const r = await rodarHook(hookDaWorktree, PROMPT_DE_PROVA, { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: roteiro });
  const esperados = aprovados.map((a) => a.caminho);
  const posicoes = aprovados.map((a) => a.posicao).join(",");
  confere(igual(caminhosDoBloco(r.stdout), esperados), `T16 so os candidatos ${posicoes} de ${n}, na ordem do ranking`);
  confere(
    textoDoBloco(r.stdout).includes(`${k} de ${n} candidatos passaram; abaixo, os ${Math.min(k, 5)} primeiros`),
    `T16 cabecalho ${k} de ${n}`
  );
}
```

Fora `aprovadosDoT16`, `roteiroDoT16`, o caso sintético e este bloco, só muda a linha 2 do cabeçalho. Ela ganha a menção ao caso sintético: `// Parte cliente: T1-T10. Parte hook: T11-T16 (hooks/brain-contexto.js contra o de origin/dev); a escolha do T16 tem caso sintetico sem indice.` O `console.log` final (`:538`) fica como está.

### Emenda 2026-11-24 — índice de prova

Vale sobre as três subseções acima onde elas disserem outra coisa. `aprovadosDoT16`, `roteiroDoT16`
e o caso sintético (CA3) ficam **como estão na `origin/dev` a88e7a8**. Linhas citadas são as da a88e7a8.
Tudo em `brain-mcp/scripts/jev.mjs`, mais uma linha no `brain-mcp/README.md`.

**1. Cabeçalho do arquivo (`:2-6`).** A linha 2 vira
`// Parte cliente: T1-T10. Parte hook: T11-T16 (hooks/brain-contexto.js contra o de origin/dev, os dois sobre um indice de prova montado aqui, nunca o vivo); a escolha do T16 tem caso sintetico.`
As linhas 5-6 viram `//                         2 se nao deu para medir ("NAO MEDI: <motivo>"): Node sem node:sqlite, sem` /
`//                         origin/dev, ou indice de prova que nao serve mais ao hook. Dois nao e verde.`

**2. Sai o pré-voo do índice vivo (`:426-435`)**, com o comentário dele: `cfgDoHook`, `conf`,
`distDoIndice` e o laço do `dist/`. Dois comentários que citam o pré-voo mudam: o do caso sintético (`:383`) vira `// Caso sintetico da escolha (#51): roda antes da parte hook, sem indice e sem rede.`, e o da pasta temporária (`:378-379`) vira `// Pasta temporaria com a referencia (hook e config de origin/dev), o indice de prova e os roteiros` / `// (o sintetico do T16 inclusive, por isso vem antes dele); apagada na saida.` Sai também o `const CWD_DE_PROVA = join(homedir(), "pessoal", "claude-brain");` (`:455`).

**3. Entra o índice de prova**, logo depois de `const PROMPT_DE_ENTIDADE = "/gm-spec #42";` (`:457`) e
antes de `function rodarHook`. Exatamente este código e este comentário:

```js
// Indice de prova (#51, emenda 2026-11-24). A parte hook nunca le o indice vivo: ele muda, e o T16
// ja saiu do ar duas vezes por isso. O hook acha o .db pela config de BRAIN_WORKSPACES e importa o
// dist/ de dirname(db)/../dist; aqui os tres sao do teste, e o hook (worktree e origin/dev) roda
// inalterado sobre eles.
// - dist/search.js: o Buscador devolve 12 resultados fixos para o PROMPT_DE_PROVA (10 vao ao Jev,
//   pelo LIMITE_JEV do hook) e nenhum para outro prompt. O 6o repete o caminho do 5o (dois trechos
//   do mesmo arquivo), a colisao que o T16 tem de excluir. tokensDe e normalizar sao as de
//   src/search.ts sem as stopwords: o piso de relevancia nao esta em teste, e todo trecho traz o
//   prompt inteiro.
// - data/brain.db (node:sqlite): so as quatro tabelas que o caminho de entidade le, com o card 42
//   do repo-teste e um vizinho, para o T15.
let DatabaseSync;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  naoMedi(`node:sqlite indisponivel no Node ${process.version}: o indice de prova precisa dele`);
}
const indiceDeProva = join(pastaTemporaria, "indice");
const prefixoDeProva = join(pastaTemporaria, "ws");
const CWD_DE_PROVA = join(prefixoDeProva, "repo-teste");
const workspacesDeProva = join(pastaTemporaria, "workspaces.json");
// O doCwd do brain-config.js compara o cwd ja com '/' contra o prefixo como veio: no Windows o
// prefixo e o db vao gravados com '/', como a config viva os teria depois do expandir.
const comBarra = (p) => p.split("\\").join("/");
{
  mkdirSync(join(indiceDeProva, "data"), { recursive: true });
  mkdirSync(join(indiceDeProva, "dist"));
  mkdirSync(CWD_DE_PROVA, { recursive: true });
  const doc = (nome) => join(CWD_DE_PROVA, "docs", `${nome}.md`);
  const resultados = ["a", "b", "c", "d", "e", "e", "f", "g", "h", "i", "j", "k"].map((nome, i) => ({
    path: doc(nome),
    source: "docs",
    repo: "repo-teste",
    feature: null,
    doc_type: "doc",
    status: null,
    data: "2026-11-24",
    breadcrumb: `Trecho ${i + 1}`,
    full_text: `${PROMPT_DE_PROVA} (trecho ${i + 1})`,
    snip: `trecho ${i + 1}`,
  }));
  writeFileSync(join(indiceDeProva, "package.json"), JSON.stringify({ type: "module" }));
  writeFileSync(
    join(indiceDeProva, "dist", "db.js"),
    'import { DatabaseSync } from "node:sqlite";\nexport const openDb = (p) => new DatabaseSync(p, { readOnly: true });\n'
  );
  writeFileSync(
    join(indiceDeProva, "dist", "search.js"),
    [
      `const RESULTADOS = ${JSON.stringify(resultados)};`,
      `const PROMPT = ${JSON.stringify(PROMPT_DE_PROVA)};`,
      'export const normalizar = (s) => s.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();',
      "export const tokensDe = (q) => [...q.matchAll(/[\\p{L}\\p{N}_]+/gu)].map((m) => normalizar(m[0])).filter((t) => t.length >= 2);",
      "export class Buscador { async buscar(alvo) { return { resultados: alvo === PROMPT ? RESULTADOS : [] }; } }",
      "",
    ].join("\n")
  );
  const dbDeProva = join(indiceDeProva, "data", "brain.db");
  const db = new DatabaseSync(dbDeProva);
  db.exec(`CREATE TABLE entidades (id INTEGER PRIMARY KEY, tipo TEXT, chave TEXT, titulo TEXT, repo TEXT, status TEXT, data TEXT, doc_path TEXT);
    CREATE TABLE arestas (de INTEGER, para INTEGER);
    CREATE TABLE docs (id INTEGER PRIMARY KEY, path TEXT UNIQUE, doc_type TEXT);
    CREATE TABLE chunks (doc_id INTEGER, ord INTEGER, text TEXT);`);
  const card = join(CWD_DE_PROVA, "cards", "42.md");
  const pr = join(CWD_DE_PROVA, "prs", "48.md");
  const entidade = db.prepare("INSERT INTO entidades VALUES (?, ?, ?, ?, 'repo-teste', ?, ?, ?)");
  entidade.run(1, "card", "card:repo-teste#42", "Card 42", "OPEN", "2026-11-01", card);
  entidade.run(2, "pr", "pr:repo-teste#48", "PR 48", "MERGED", "2026-11-02", pr);
  db.exec("INSERT INTO arestas VALUES (1, 2)");
  const documento = db.prepare("INSERT INTO docs VALUES (?, ?, 'doc')");
  documento.run(1, card);
  documento.run(2, pr);
  db.exec("INSERT INTO chunks VALUES (1, 0, 'corpo do card 42'), (2, 0, 'corpo da pr 48')");
  db.close();
  writeFileSync(
    workspacesDeProva,
    JSON.stringify({ db: comBarra(dbDeProva), workspaces: [{ nome: "teste", prefixo: comBarra(prefixoDeProva), repos: ["repo-teste"] }] })
  );
}
```

**4. `rodarHook` (`:460-478`).** A linha do ambiente vira
`const ambiente = { ...jev.envSemJev(process.env), ...env, BRAIN_WORKSPACES: workspacesDeProva };`, com o
comentário `// BRAIN_WORKSPACES por ultimo: nenhum env de quem roda (nem um caso) tira o hook do indice de prova.`
na linha de cima. O resto da função não muda (o `cwd: CWD_DE_PROVA` do `stdin` passa a ser o do índice de prova).

**5. Saem as repetições por índice que muda.** O índice de prova não muda durante a rodada, e
repetir um teste determinístico só esconderia um vermelho intermitente.
- `parIgual` (`:480-492`) vira, com este comentário:
  ```js
  // Referencia e worktree em seguida, sobre o mesmo indice de prova: deterministico, sem repeticao.
  async function parIgual(prompt, envDaWorktree) {
    const referencia = await rodarHook(hookDeReferencia, prompt, {});
    const worktree = await rodarHook(hookDaWorktree, prompt, envDaWorktree);
    return { igual: semCr(referencia.stdout) === semCr(worktree.stdout), referencia, worktree };
  }
  ```
- T13 (`:532-546`) passa a ser exatamente:
  ```js
  // ---- T13: o Jev aprova tudo = os mesmos caminhos de T11, na mesma ordem, com o cabecalho novo --
  {
    const sem = await rodarHook(hookDaWorktree, PROMPT_DE_PROVA, {});
    const com = await rodarHook(hookDaWorktree, PROMPT_DE_PROVA, { ...FALSO_SIM, BRAIN_HOOK_DEBUG: "1" });
    const n = candidatosEnviados(com.stderr).length;
    const cabecalho = `filtrada pelo Jev: ${n} de ${n} candidatos passaram; abaixo, os 5 primeiros`;
    const ok = igual(caminhosDoBloco(sem.stdout), caminhosDoBloco(com.stdout)) && textoDoBloco(com.stdout).includes(cabecalho);
    confere(ok, `T13 falso sim: mesmos caminhos e cabecalho novo (n=${n})`);
  }
  ```
- T16: ver o item 7.

**6. Mensagens das pré-condições.** Mesmo lugar e mesmo `naoMedi`, só o texto muda:
- T11 (`:516`): `"o indice de prova nao serve mais: com a flag desligada o hook de origin/dev nao injeta pelo caminho de texto"`.
- sondagem (`:524`): `` `o indice de prova nao serve mais: so ${enviados.length} candidatos chegam ao Jev (T16 precisa de 6 ou mais)` ``.
- T15 (`:568`): `"o indice de prova nao serve mais: com a flag desligada o bloco de entidade esta vazio ou nao veio do grafo"`.

**7. T16 (`:574-605`)** passa a ser exatamente isto, sobre os `enviados` da sondagem (`:522-523`):

```js
// ---- T16: o Jev aprova so os candidatos de 6 em diante que escapam da colisao = so esses, na ordem do ranking --
{
  const n = enviados.length;
  const aprovados = aprovadosDoT16(enviados);
  const posicoes = aprovados.map((a) => a.posicao).join(",");
  // O indice de prova poe o 6o no caminho do 5o: a regra tem de tirar ele, e so ele.
  if (posicoes !== "7,8,9,10") naoMedi(`o indice de prova nao serve mais: aprovados ${posicoes || "nenhum"} de ${n}, esperados 7,8,9,10`);
  const k = aprovados.length;
  const roteiro = join(pastaTemporaria, "roteiro-t16.json");
  writeFileSync(roteiro, JSON.stringify(roteiroDoT16(aprovados)));
  const r = await rodarHook(hookDaWorktree, PROMPT_DE_PROVA, { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: roteiro });
  // O hook mostra so os LIMITE_FINAL primeiros que passaram (hooks/brain-contexto.js:484), como o cabecalho.
  const esperados = aprovados.slice(0, 5).map((a) => a.caminho);
  confere(igual(caminhosDoBloco(r.stdout), esperados), `T16 so os candidatos ${posicoes} de ${n}, na ordem do ranking`);
  confere(
    textoDoBloco(r.stdout).includes(`${k} de ${n} candidatos passaram; abaixo, os ${Math.min(k, 5)} primeiros`),
    `T16 cabecalho ${k} de ${n}`
  );
}
```

**8. Última linha (`:607`)**: `console.log("jev: T11-T16 OK (parte hook; cliente falso, indice de prova, sem rede)");`.

**9. Imports.** Nenhum novo no topo: o `node:sqlite` entra pelo `import()` do item 3, para o Node sem
ele cair em `NÃO MEDI` e não num erro de carga antes do T1. Depois de tirar o pré-voo, conferir que
`existsSync`, `dirname` e `homedir` continuam usados (`caminhoDoCliente`, `root`, `claudeHome`) e não
deixar import morto.

**10. `brain-mcp/README.md:282`** vira
`npm run jev                # cliente do Jev e filtro do hook (T1-T16), com o cliente falso e um índice de prova montado pelo teste: sem rede e sem o índice vivo`.

## File Change Summary
- `brain-mcp/scripts/jev.mjs` — alterado: `aprovadosDoT16` e `roteiroDoT16`, o caso sintético antes do pré-voo, que imprime `jev: T16 escolha sintetica OK (sem indice)`, e o T16 usando a regra nova com `k` aprovados.
- `planning/51-t16-independente/spec.md` — criado (esta spec).

Nada em `hooks/`, `brain-mcp/scripts/injecao.mjs`, `brain-mcp/src/`, `brain-mcp/package.json`, `skills/` ou docs.

> **Emenda 2026-11-24.** Na branch `fix/51-t16-sem-indice`:
> - `brain-mcp/scripts/jev.mjs` — alterado: cabeçalho; sai o pré-voo do índice vivo e o `CWD_DE_PROVA` em `~/pessoal`; entra o índice de prova; `rodarHook` fixa o `BRAIN_WORKSPACES`; saem as repetições de `parIgual`, T13 e T16; textos das pré-condições; T16 sobre os `enviados` da sondagem com `7,8,9,10` esperados; última linha.
> - `brain-mcp/README.md` — a linha do `npm run jev` (`:282`).
> - `planning/51-t16-independente/spec.md` — esta emenda.
>
> Continua nada em `hooks/`, `brain-mcp/scripts/injecao.mjs`, `brain-mcp/src/`, `brain-mcp/package.json` ou `skills/`.

## Migrations & compatibilidade
N/A. É um script de teste. Não muda formato em disco, índice, contrato do cliente do Jev nem superfície das tools. Sem colisão, o T16 faz o mesmo que hoje (CA3, item 4).

> **Emenda 2026-11-24.** Continua N/A. O índice de prova é escrito só na pasta temporária do teste,
> apagada na saída. O índice vivo deixa de ser aberto pelo `jev.mjs`.

## Rollback
`git revert` do commit da task na `dev`. O efeito é voltar ao T16 que sai 2 com colisão. Nada é instalado: o `jev.mjs` só roda do repo.

> **Emenda 2026-11-24.** `git revert` do commit da emenda volta ao T16 sobre o índice vivo, que hoje
> sai 2. Nada é instalado.

## Verificação pós-deploy
N/A como verificação bloqueante do G5: não muda dado nem formato em disco, e nada vai para a instalação (o `jev.mjs` não entra no `sync.sh`). A conferência de fato é o próprio portão: `npm run jev` saindo 0 na worktree, contra o índice vivo, registrado na PR.

> **Emenda 2026-11-24.** Continua N/A como bloqueante. A conferência é o portão nas duas rodadas do
> CA1' (com a config desta máquina e com `BRAIN_WORKSPACES=/nao/existe.json`), as duas com exit 0,
> registradas na PR.

## Plano de testes

Tudo em `brain-mcp/scripts/jev.mjs`. Rodar com `cd brain-mcp && npm run jev`, Node 22, sem `BRAIN_JEV`, `TYPESAFE_API_KEY` nem `BRAIN_JEV_FALSO` no env.

| Critério | Caso | Prova |
|---|---|---|
| CA1 | T16 vivo | exit `0` e a última linha `jev: T11-T16 OK …`. Ela só sai depois do T16, e o `naoMedi` do T16 sai 2, então exit 0 prova que o T16 mediu. Com o índice de 11/11: aprovados 6 e 7, k = 2 |
| CA2 | T16 vivo | `T16 so os candidatos … na ordem do ranking` e `T16 cabecalho k de n`. Para ver que mede: trocar temporariamente `esperados` por `esperados.slice(1)` deve dar exit 1. Isso vale para qualquer `k ≥ 1`, ao contrário de `reverse()`, que com `k = 1` não muda nada. É conferência manual do implementador, **não** commitada |
| CA3 | T16 escolha sintética (4 `confere`) | roda antes do pré-voo. Rodando `BRAIN_WORKSPACES=/nao/existe.json node scripts/jev.mjs` dentro de `brain-mcp/`, a stdout traz `jev: T16 escolha sintetica OK (sem indice)`. Só depois vem o exit `2` no `NÃO MEDI: sem lista de workspaces utilizavel …` do pré-voo. A linha de OK é a prova de que a escolha passou sem índice. Medido na base em 11/11: `T1-T10 OK` e exit 2 nesse `NÃO MEDI`. A frase "o `NÃO MEDI` só sobra quando `aprovadosDoT16` devolve vazio" é verificada **lendo o código**: é o `if (!aprovados.length)` do T16 vivo, e o item 3 prova só que a função devolve vazio. Conferência manual, não commitada |
| regressão | T1-T15 | inalterados, continuam passando |

Portão do `/gm-ship`: `npm run jev` exit 0. Os portões de `src/` (smoke + eval) e de `skills/`
não se aplicam (`## Execution`). O `injecao.mjs --portao jev` não é tocado, mas rodá-lo continua
valendo como sanidade do lote. Se sair diferente de 0, é fora do escopo e vira `PARADA`.

> **Emenda 2026-11-24: plano de testes.** Vale sobre a tabela acima.
>
> | Critério | Caso | Prova |
> |---|---|---|
> | CA1' | as duas rodadas | `cd brain-mcp && npm run jev 2>&1 | grep -E '^(jev:\|FALHOU\|NÃO MEDI)'; echo ${PIPESTATUS[0]}` e o mesmo com `BRAIN_WORKSPACES=/nao/existe.json` na frente, sem `BRAIN_JEV`, `TYPESAFE_API_KEY` nem `BRAIN_JEV_FALSO` no env: as duas `0`, cada uma com as três linhas OK do CA1' e nessa ordem, coladas na PR |
> | CA2' | T16 | passa com `7,8,9,10` e `4 de 10`. Para ver que mede, conferência manual **não** commitada: (a) `esperados.slice(1)` → exit 1; (b) trocar o 6º nome da lista de resultados de `"e"` para `"e2"` → exit 2 no `NÃO MEDI … aprovados 6,7,8,9,10 de 10`, prova de que a colisão do índice de prova é o que tira o 6 |
> | CA3 | caso sintético | inalterado: a linha `jev: T16 escolha sintetica OK (sem indice)` sai antes da parte hook |
> | CA4 | leitura do código | `grep -n "brain-workspaces\|cfgDoHook\|carregar()\|homedir(), \"pessoal\"" brain-mcp/scripts/jev.mjs` não acha nada; os `naoMedi` da parte hook são só os dos itens 3, 6 e 7 da emenda e o do `git show` (`:449`) |
> | regressão | T1-T15 | passam nas duas rodadas do CA1' |
>
> Node: o do PATH (26.12.0). Rodar também com o 22.23.5
> (`PATH=/home/leo/.local/share/mise/installs/node/22.23.5/bin:$PATH`) uma vez, a rodada (a), e
> registrar na PR: o `ExperimentalWarning` do `node:sqlite` na stderr não é falha.
> Portão do `/gm-ship`: as duas rodadas do CA1' com exit 0. Os de `src/` e de `skills/` seguem sem se
> aplicar, e o `node scripts/classificar-parada-teste.mjs` também não (nada em `hooks/jev.js`).

## Technical Decisions

- **Emenda 2026-11-24: índice de prova montado pelo teste, e não o índice vivo** (cofre #3443). O
  hook já acha o `dist/` pelo caminho do `.db` e o `.db` pela config de `BRAIN_WORKSPACES`: esse é o
  ponto de troca, e o hook não muda. Descartados: trocar o `PROMPT_DE_PROVA` (volta a quebrar quando
  o índice mudar; descartado pelo Leonardo, cofre #3440); indexar arquivos sintéticos com o indexador
  real (pede `dist/` compilado e o transformer, lento, e esbarra no `sharp` do Node 26); usar o `dist/`
  real da instalação com um `.db` pequeno (depende do caminho da instalação, que sem `BRAIN_WORKSPACES`
  não se acha, e falharia em outra máquina); aceitar candidatos injetados no hook ou mudar o id do
  trecho (mexe no contrato do #42 por um teste; é o card #57); manter T11-T15 no índice vivo e só o
  T16 no de prova (sem índice o script sairia 2 ou pularia casos com exit 0, e o CA1' pede tudo medido
  sem índice).
- **Emenda 2026-11-24: T11-T15 também vão para o índice de prova.** Eles comparam o hook da worktree
  com o de `origin/dev`; a comparação vale igual sobre qualquer índice, e sobre um fixo deixa de
  precisar de repetição. **O que deixa de ser coberto pelo `npm run jev`** (achado 3 do revisor
  independente): a identidade byte a byte sobre o corpus real, e os ramos que o índice de prova não
  exercita — `daqui` por repo (fontes `github`/`git`) e por `exceto`, as stopwords do `tokensDe`, os
  passos 1, 3 e 4 da entidade, a diversidade por tipo e o rank de spec dos vizinhos. Sobre o corpus
  real, quem mede é o `injecao.mjs --portao jev`, que continua lendo o índice vivo, não é tocado e só
  mede PR que muda `hooks/brain-contexto.js` (com o hook igual ao da base ele sai 2 por desenho,
  `injecao.mjs:458`). Esta emenda não muda o status dele na esteira.
- **Emenda 2026-11-24: `dist/` falso, e não o real.** O que está em teste é o filtro do Jev no hook
  (quem passa, a ordem, o cabeçalho), não a busca. O `Buscador` falso devolve a lista fixa e o
  `tokensDe` falso não tem stopwords; como todo trecho traz o prompt inteiro, o piso de relevância
  passa com qualquer tokenização razoável.
- **Emenda 2026-11-24: `node:sqlite`, e não `better-sqlite3`.** É o que o `src/db.ts` já usa, vem com
  o Node e não pede dependência. Carregado por `import()` para o Node sem ele dar `NÃO MEDI`, e não um
  erro antes do T1.
- **Emenda 2026-11-24 (G4, achado 1): a decisão abaixo caiu.** As pré-condições do índice de prova
  saem `FALHOU`, exit 1, com a mensagem dizendo que o índice é fixo e o hook mudou. O revisor
  sabotou o hook numa cópia (`filtrarComJev` devolvendo `null`; `LIMITE_JEV = 9`) e os dois deram
  `NÃO MEDI`, exit 2: um hook quebrado passava como "não deu para medir", o que o CA4 promete não
  fazer. O Leonardo decidiu corrigir antes do merge. Descartado: só reescrever a mensagem e manter o
  exit 2. Os dois casos aceitos do fim do item abaixo continuam valendo.
- ~~**Emenda 2026-11-24: pré-condições do índice de prova continuam `NÃO MEDI`, não `FALHOU`.**~~ (caiu, ver acima) Se o
  hook de `origin/dev` deixar de injetar do índice de prova, ou o `LIMITE_JEV` mudar e os aprovados
  deixarem de ser `7,8,9,10`, quem tem de mudar é o índice de prova, não o hook: é "não deu para
  medir", e exit 2 segue sem abrir PR. O `LIMITE_FINAL` também fica amarrado (o T13 espera "os 5
  primeiros"). Dois casos aceitos, que saem com o motivo menos preciso (achados 4 e 9): um hook futuro
  que importe do `dist/` um nome que o falso não exporta falha na carga, fica com stdout vazia e o T11
  sai `FALHOU … igual` (exit 1), e não `NÃO MEDI`; e um `NODE_OPTIONS` de quem roda vaza para o hook
  pelo `envSemJev` e pode derrubá-lo com a mensagem "o indice de prova nao serve mais". Nos dois, o
  `BRAIN_HOOK_DEBUG=1` na sonda mostra a causa. Não se mexe no `envSemJev` (contrato do #42).
- **Emenda 2026-11-24: saem as repetições.** Elas existiam porque o índice vivo muda durante a
  rodada. Sobre um índice fixo, repetir só esconderia um vermelho intermitente.
- **Emenda 2026-11-24: revisão de IA independente** (contexto limpo, só o caminho desta spec, sem
  blocker). Cada achado e o que foi feito com ele:
  - (1) no Windows o `doCwd` não casaria o prefixo com `\`: confirmado em `hooks/brain-config.js:55-56`. O
    prefixo e o `db` vão gravados com `/` (`comBarra`, item 3).
  - (2) `## Coding Standards` contradizia a emenda: ganhou bloco de emenda com os três arquivos.
  - (3) cobertura perdida descrita pela metade: a decisão "T11-T15 também vão para o índice de prova"
    lista agora os ramos não cobertos e o alcance real do `injecao --portao jev`.
  - (4) `dist/` falso desatualizado vira `FALHOU`, e (9) `NODE_OPTIONS` vazando para o hook: aceitos e
    documentados na decisão das pré-condições, sem mexer no `envSemJev`.
  - (5) o portão não provava as três linhas: o plano faz `grep` e cola as linhas na PR.
  - (6) comentários que citavam o pré-voo: entram no item 2.
  - (7) o T13 sem código exato: ganhou o bloco.
  - (8) linhas citadas: alinhadas.
  - (10) `LIMITE_FINAL` também amarrado: dito na decisão.
  O código revisado (com `comBarra` e o bloco do T13) foi aplicado de novo em `/tmp/prova51c`: as
  duas rodadas do CA1' saíram 0 com as três linhas na ordem.

- **Excluir os candidatos que colidem, em vez de abortar.** Descartados: trocar o
  `PROMPT_DE_PROVA` (o índice volta a mudar e o problema volta) e mudar o id do trecho no hook
  para incluir posição ou chunk (mexe no contrato do #42 por causa de um teste). As duas
  alternativas já tinham sido descartadas no G1, cofre #1577.
- **A segunda exclusão (contido no caminho de quem ficou de fora) torna o conjunto fechado.** Seja
  `A` o resultado e `F` o conjunto `fora`. Nenhum `x ∈ F` contém um `a ∈ A`, por construção. Logo
  o falso não aprova ninguém de `F`. Um candidato `c` de 6 em diante que não está em `F`, mas foi
  tirado pelo passo 2, tem algum `x ∈ F` que o contém. Se `c` contivesse um `a ∈ A`, então `x`
  conteria `a`, o que contradiz a construção. Portanto o falso aprova exatamente `A`, e o bloco
  esperado é `A` na ordem do ranking. Com caminhos absolutos isso quase nunca dispara, mas custa
  uma linha e o item 5 do caso sintético prova contra o falso real.
- **Colisão nos dois sentidos com os cinco primeiros**, igual à guarda de hoje (`:524`). É mais
  conservador do que o estritamente necessário: um candidato cujo caminho só *contém* o de um dos
  cinco não aprovaria aquele. Mesmo assim, fica de fora porque o card pede "não colide" e porque
  manter a guarda de hoje evita discutir um caso que não aparece com caminhos reais.
- **Caso sintético antes do pré-voo**, e não num arquivo de teste novo. O CA3 pede a prova "sem o
  índice", e o pré-voo (`:367-374`) sai 2 sem índice. Um arquivo novo pediria um script novo no
  `package.json` e outro portão para lembrar.
- **Cabeçalho com `Math.min(k, 5)`**, espelhando `hooks/brain-contexto.js:499-502`. Com
  `LIMITE_JEV = 10` dá sempre `k`, mas se o limite mudar o teste não fica errado sozinho.
- **Fora do escopo, e registrado:** repetir o T16 quando o índice muda entre a sondagem (`:465`) e a
  rodada do T16. O T13 tem esse laço e o T16 nunca teve. O card não pede, e o risco de corrida é o
  mesmo de antes deste card. Se aparecer como vermelho intermitente, vira card próprio.
- **Revisão de IA independente antes do G2 (11/11, contexto limpo, só o caminho desta spec):** não
  achou blocker. Cada achado e o que foi feito com ele:
  - (1) o `try/finally` não limpa a pasta quando o `confere` sai com `process.exit`. Trocado por
    `process.on("exit")`.
  - (2) o exit 2 sem índice não prova que o caso sintético rodou. O caso agora imprime
    `jev: T16 escolha sintetica OK (sem indice)`.
  - (3) havia um placeholder `<roteiro>`. Agora é `roteiroSintetico`, e as `const` ficam dentro do
    bloco.
  - (4) a mensagem do `naoMedi` não cobria o passo 2. Reescrita.
  - (5) linhas citadas erradas. Corrigidas para `:394-395` e `hooks/jev.js:453`.
  - (6) "duas exceções" contraditório. Reescrito.
  - (7) a sabotagem com `reverse()` falha com `k = 1`. Trocada por `slice(1)`.
  - (8) o ramo do `NÃO MEDI` não tem teste automático. Declarado como verificado lendo o código.

## Coding Standards

> **Emenda 2026-11-24.** O commit da emenda inclui, por nome, `brain-mcp/scripts/jev.mjs`,
> `brain-mcp/README.md` e `planning/51-t16-independente/spec.md`, nunca `git add -A`. As mudanças em
> `parIgual`, T11, T13, T15 e T16 descritas em `### Emenda 2026-11-24 — índice de prova` são o
> escopo; o "não refatorar T11-T15" abaixo vale para tudo o que não está lá. Mensagem
> `fix(jev): …(#51)`.
- Seguir o estilo do arquivo: ESM, `confere(cond, "Tnn …")`, mensagens sem acento nos literais de
  `confere`/`naoMedi` (como os de hoje), comentários curtos em pt-BR sem acento.
- Nada além do especificado: não refatorar T11-T15, não mexer no `PROMPT_DE_PROVA`, não tocar
  `hooks/`.
- O commit inclui só `brain-mcp/scripts/jev.mjs`, com os arquivos por nome, nunca `git add -A`.
  Mensagem `fix(jev): …(#51)` com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` no fim.
