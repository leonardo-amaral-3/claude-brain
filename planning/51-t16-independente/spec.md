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

## Requisitos & critérios de aceite

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

## File Change Summary
- `brain-mcp/scripts/jev.mjs` — alterado: `aprovadosDoT16` e `roteiroDoT16`, o caso sintético antes do pré-voo, que imprime `jev: T16 escolha sintetica OK (sem indice)`, e o T16 usando a regra nova com `k` aprovados.
- `planning/51-t16-independente/spec.md` — criado (esta spec).

Nada em `hooks/`, `brain-mcp/scripts/injecao.mjs`, `brain-mcp/src/`, `brain-mcp/package.json`, `skills/` ou docs.

## Migrations & compatibilidade
N/A. É um script de teste. Não muda formato em disco, índice, contrato do cliente do Jev nem superfície das tools. Sem colisão, o T16 faz o mesmo que hoje (CA3, item 4).

## Rollback
`git revert` do commit da task na `dev`. O efeito é voltar ao T16 que sai 2 com colisão. Nada é instalado: o `jev.mjs` só roda do repo.

## Verificação pós-deploy
N/A como verificação bloqueante do G5: não muda dado nem formato em disco, e nada vai para a instalação (o `jev.mjs` não entra no `sync.sh`). A conferência de fato é o próprio portão: `npm run jev` saindo 0 na worktree, contra o índice vivo, registrado na PR.

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

## Technical Decisions

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
- Seguir o estilo do arquivo: ESM, `confere(cond, "Tnn …")`, mensagens sem acento nos literais de
  `confere`/`naoMedi` (como os de hoje), comentários curtos em pt-BR sem acento.
- Nada além do especificado: não refatorar T11-T15, não mexer no `PROMPT_DE_PROVA`, não tocar
  `hooks/`.
- O commit inclui só `brain-mcp/scripts/jev.mjs`, com os arquivos por nome, nunca `git add -A`.
  Mensagem `fix(jev): …(#51)` com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` no fim.
