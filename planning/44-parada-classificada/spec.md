# Classificar o motivo da PARADA numa lista fixa, com probabilidade — Spec

> Profundidade **Lite** (decisão #1390): a rota Curta do card se confirma, mas a saída do
> classificador é um contrato novo que a orquestradora lê, e ele precisa estar fechado aqui.

## References
- Card: [#44](https://github.com/leonardo-amaral-3/claude-brain/issues/44) — repo `leonardo-amaral-3/claude-brain`
- Depende de: [#42](https://github.com/leonardo-amaral-3/claude-brain/issues/42), dono do cliente do Jev e da flag
- Irmão que pede o mesmo cliente: [#41](https://github.com/leonardo-amaral-3/claude-brain/issues/41)
  (rascunho de spec em `~/pessoal/claude-brain-41-triagem-jev/planning/41-triagem-jev/spec.md`,
  "O que o #41 exige do cliente do #42", J1–J4). A forma esperada abaixo segue a dele de propósito.
- Decisões: #1373 (assuma), #1380 (G1), #1383 (branch e costura), #1390 (profundidade)
- PRD: não há

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir `claude-brain/` no workspace `pessoal`)
- Feature branch: `feat/44-parada-classificada`
- Worktree: `~/pessoal/claude-brain-44-parada-classificada`
- Base branch: `dev`. A branch saiu de `origin/dev` (`3c3b92c`), e a spec e as tasks são
  commitadas nela já agora.
- **Empilhada no #42.** A implementação **só começa** quando as duas coisas existirem: o
  comentário `<!-- gm:spec -->` no card #42 e, na branch `feat/42-filtro-jev`, o commit do cliente
  do Jev com o contrato daquela spec. Hoje (2026-11-10) não existe nenhuma das duas: a branch está
  só local, em `3c3b92c`, sem commit além da base. Quando existirem, a sequência é esta:
  1. `git rebase feat/42-filtro-jev` na branch do card. Os commits de planning vão junto.
  2. A PR do #44 abre com base `feat/42-filtro-jev`, para o G4 revisar só o diff do #44.
  3. A PR do #44 **não** é mergeada em `feat/42-filtro-jev`. Depois que a PR do #42 entra na
     `dev`, a do #44 é retargetada para `dev` (`gh pr edit <n> --base dev`) e só então vai a merge
     (merge é do Leonardo). Assim, o merge do #44 é um commit na `dev`, e é sobre ele que valem
     `## Rollback` e `## Verificação pós-deploy`.

## Requisitos & critérios de aceite

**R1 — Lista fixa.** São oito categorias, com ids estáveis, e é por eles que a orquestradora casa a
política dela. Seis são as linhas cuja coluna *Despachado* começa com `**para**` na tabela do
`## Modo despachado` de `skills/_comum/convencoes.md`. As outras duas são `gate-aberto` e `outro`.
A tabela completa está em `Implementation Details`.

**R2 — Saída.** Quando sai com código `0`, o classificador escreve **uma** linha JSON no stdout,
com as chaves nesta ordem: `estado`, `categoria`, `probabilidade`, `escala`, `porque`. Com código
`1` ou `2`, o stdout fica vazio.

**R3 — Escalada obrigatória (`escala: true`).** Acontece sempre que:
- a categoria é reservada ao humano (`producao`, `escolha-de-produto`) → `porque: "reservada"`;
- a categoria é `outro` → `porque: "outro"`;
- a probabilidade é menor que o limiar (`0.8`) → `porque: "abaixo-do-limiar"`;
- o cliente falhou ou lançou exceção → `porque: "erro"`;
- o tempo se esgotou → `porque: "tempo"`;
- a resposta é inválida → `porque: "resposta-invalida"`;
- a lista do script diverge da tabela → `porque: "lista-divergente"`.

Nos outros casos, `escala: false` e `porque: null`.

> **Emenda 1 (2026-11-10), origem: achado 1 do G4 da PR #47 (cofre #1549).** Com `BRAIN_JEV_FALSO`
> definida no ambiente que a CLI lê (mesmo vazia; é a regra do cliente do #42 para o falso), toda
> saída `classificada` sai `escala: true, porque: "falso"`, e `"falso"` entra no conjunto fechado de
> `porque` acima. A categoria e a probabilidade seguem como o falso as deu, para o smoke offline
> continuar legível; nenhum outro campo entra na saída. Antes, um `BRAIN_JEV_FALSO` esquecido no
> ambiente da orquestradora fazia a resposta fabricada sair como classificação real, e uma parada de
> merge saía `escala: false`. A prova é o C9: com `BRAIN_JEV_FALSO=sim` e um motivo de merge, a CLI
> sai `escala: true, porque: "falso"`.

Critérios (canônicos; o plano de testes, o review de IA e a validação em dev leem daqui):

- **CA1: categorias e regra de escalada.**
  - *Dado* o Jev falso, *quando* cada um dos oito motivos de teste passa pelo classificador,
    *então* cada categoria da lista sai pelo menos uma vez, com `estado: "classificada"`.
  - *Dado* uma categoria reservada (`producao`, `escolha-de-produto`) ou `outro`, *então* sai
    `escala: true` tanto com probabilidade `0.3` quanto com `0.99`.
  - *Dado* uma categoria não reservada, *então* com `0.79` sai
    `escala: true, porque: "abaixo-do-limiar"`, e com `0.8` sai `escala: false, porque: null`.
- **CA2: Jev com defeito e Jev desligado.**
  - *Dado* o Jev ligado com erro, com exceção ou sem resposta dentro do tempo, *então* sai
    `estado: "sem-classificacao"`, `escala: true` e `porque` igual a `"erro"` ou `"tempo"`, com no
    máximo uma chamada a `escolher` (nenhuma nova tentativa). O processo termina mesmo que o cliente ignore o cancelamento.
  - *Dado* o cliente dizendo que está desligado (flag ausente ou sem chave), *então* sai
    `estado: "desligado"` e `escala: null`, **sem nenhuma chamada a `escolher`** e sem ler a tabela,
    e o processo sai com código `0`.
  - Há teste para os dois casos. Com o cliente de verdade, um ambiente limpo e `HOME` temporário, a
    CLI responde `desligado`. Que o desligado não faz chamada de rede é critério do #42 ("nada sai da
    máquina por acidente") e é provado lá.
- **CA3: nada muda de formato.** A linha `PARADA:` e os três blocos comuns das skills continuam
  iguais. Na branch do card, depois do rebase:
  - `git diff --quiet $(git merge-base HEAD feat/42-filtro-jev) HEAD -- skills/` sai `0`;
  - `git status --porcelain -- skills/` sai vazio;
  - `node scripts/skills-comum.mjs --check` sai `0`.

  Uma sessão despachada fecha igual a hoje, porque nenhuma skill é tocada.
- **CA4: depende do aval do Leonardo** (chave do Jev e autorização de mandar os motivos à TypeSafe
  AI), não roda na PR e não bloqueia o G4. Classificar as `PARADA` reais das pastas de despacho,
  comparar com a leitura do Leonardo e medir a latência. Fica nas pendências da PR, com o comando
  pronto em `## Verificação pós-deploy`.

## Premissas medidas

Todas medidas em 2026-11-10, na worktree `feat/44-parada-classificada` (`3c3b92c`, igual a `origin/dev`).

- **As linhas para são seis, com este texto exato.** Rodei `awk` sobre a região `## Modo despachado`
  de `skills/_comum/convencoes.md`, células 1 e 3 de cada linha de tabela, filtrando "célula 3
  começa com `**para**`". A mesma regra de `linhasParaDaTabela` foi reexecutada pelo revisor
  independente, com o mesmo resultado byte a byte. As seis linhas:
  - `Segundo revisor de spec sensível`
  - `Alvo ambíguo: repo, card, pasta, PR`
  - `Escolha de produto que card, spec, argumento e decisões registradas não respondem`
  - `Desvio da spec, decisão que caiu, emenda`
  - ``Teste vermelho, ambiente quebrado, `CLAUDE.md` que não declara o que a skill exige``
  - ``Merge, `main`, tag, release, deploy, produção, instalação viva, apagar``

  Nenhuma célula da tabela tem `|` dentro (`convencoes.md:106-121`).
- **Onde está o contrato da última linha.** Em `skills/_comum/convencoes.md:70-75` e
  `docs/esteira-gm.md:276-278`. A tabela está em `skills/_comum/convencoes.md:106-121`, e o
  `## Modo despachado` de `docs/esteira-gm.md` (linhas 296-325) é só prosa, sem tabela.
- **O despachante só mostra a última linha.** A última linha do
  `~/pessoal/claude/despachos-claude-brain-44/d.sh` é
  `echo "… $(jq -r .result $D/saida-$E.json | tail -1)"`. O `tail -1` não pula linha em branco no
  fim; o `lerEntrada` daqui pula.
- **Há corpus para o CA4.** As 63 pastas `despachos-*` de `~/pessoal/claude` e `~/notoria/claude`
  têm 19 arquivos `saida-*.json` cuja última linha não vazia do `.result` começa com `PARADA:`.
  Contei com `jq`, `sed` e `tail -1`, e nada foi enviado a lugar nenhum.
- **Os scripts da raiz rodam com `node` puro, sem `package.json`.** Conferi com `ls` que não há
  `package.json` na raiz. O molde de teste é `scripts/skills-comum-teste.mjs`: `afirmar()` e
  `process.exit(0|1)`. O precedente do repo para sair de CLI é `process.exitCode`
  (`scripts/prova-modelo.mjs:448-449`), e aqui ele não basta (ver `Technical Decisions`). Node da
  máquina: `v26.12.0`.
- **Linha de base verde.** `node scripts/skills-comum.mjs --check` sai `0` ("11 skills × 3 blocos
  iguais à fonte"). `node scripts/prova-modelo.mjs` (estática) sai `0` ("estática: 12 ok"); ele lê
  `## Qual modelo roda cada estação` de `docs/esteira-gm.md`, seção que este card não toca.
- **O portão de teste do repo não cobre `scripts/`.** O `CLAUDE.md:92` diz "a suíte da área tocada
  (itens 2 e 3 de `## A esteira`)", e os itens 2 e 3 (`CLAUDE.md:69-82`) só declaram `brain-mcp/src/`
  e `skills/`. Por isso este card edita o item 3.
- **O #42 ainda não tem spec nem cliente.** `gh issue view 42 --json comments` não mostra nenhum
  `<!-- gm:spec -->`, e o status no board é `📋 Backlog`. No `git worktree list`,
  `claude-brain-42-filtro-jev` está em `3c3b92c [feat/42-filtro-jev]`, sem planning do #42, e não há
  branch `feat/42-*` em `origin`.

### Premissa NÃO provada (até o #42 ter spec): a forma do cliente do Jev

O #44 **não cria cliente**: não faz HTTP, não lê chave, não lê flag. Ele espera que o #42 entregue,
num módulo do repo que um `.mjs` de `scripts/` importe por caminho relativo, um cliente com estas
duas capacidades (a mesma forma que o #41 pede, J1–J3):

```
ligado(): boolean | Promise<boolean>
  // sem rede; false quando a flag está ausente ou a chave falta
escolher({ pergunta: string, texto: string, opcoes: string[], signal: AbortSignal })
  : Promise<{ opcao: string /* uma das opcoes */, probabilidade: number /* 0..1 */ }>
  // rejeita em erro de rede, HTTP, chave ou tempo esgotado do próprio cliente
```

O #44 manda **oito** opções. O rascunho do #41 fala em "2 a 6" porque é o que ele precisa, e o #42
tem de aceitar pelo menos oito. O caminho do módulo, o nome dos exports, os nomes das variáveis de
flag e de chave e os arquivos de onde o cliente os lê são os que a spec do #42 fixar.

Regra para quando a spec do #42 existir. O implementador a aplica sem decidir nada:

- **Mesma informação, outra forma.** São os casos de nomes de campo diferentes, de `ligado()`
  embutido no `escolher` (um "desligado" que se distingue, devolvido sem rede), de probabilidade
  por opção (toma-se a maior; no empate, a primeira na ordem de `CATEGORIAS`), de `signal`
  ignorado ou de flag por consumidor com um nome definido para o #44. Adapta-se dentro de
  `scripts/classificar-parada.mjs`, na função `daFormaDo42()`, sem HTTP, chave nem flag. Não é
  desvio.
- **Falta informação.** São os casos de um cliente que não escolhe em lista (só sim/não), que não
  sabe dizer sem rede se está ligado, que aceita menos de oito opções, ou que tem flag por
  consumidor sem uma para o #44. Isso é **emenda desta spec**, e a sessão para (`PARADA`). Não se
  improvisa um-contra-todos, não se corta a lista e não se trata "indisponível" como "desligado".

> **Emenda 2 (2026-11-10), origem: achado 3 do G4 da PR #47 (cofre #1549).** Na regra "mesma
> informação, outra forma", a probabilidade por opção deixa de mandar: o `daFormaDo42()` devolve a
> `escolha` do Jev com a `confianca` dele. O maior valor por opção (no empate, a primeira na ordem
> de `CATEGORIAS`) só vale quando a resposta não traz uma `escolha` que seja uma das opções. Antes,
> um empate ou quase empate trocava a reservada que o Jev escolheu (`producao`) por uma não
> reservada que vem antes na ordem, e a parada saía `escala: false`. A prova é o C9: empate com
> `escolha` igual a `producao` → sai `producao`, que escala.

## Technical Overview

`scripts/classificar-parada.mjs` é um script de linha de comando que roda do checkout do repo, como
`skills-comum.mjs` e `prova-modelo.mjs`, e não é instalado em `~/.claude`. O despachante manda a
saída da sessão pelo stdin. O script:
1. pega a última linha e exige `PARADA:`;
2. pergunta ao cliente se o Jev está ligado; se não estiver, responde `desligado`;
3. confere se a lista ainda bate com a tabela da fonte; se divergir, escala sem chamar o Jev;
4. pergunta ao Jev qual das oito categorias descreve o motivo, com um teto de tempo próprio;
5. aplica a regra de escalada e escreve uma linha JSON.

O cliente entra por uma costura injetável (`deps.cliente`). O padrão é o do #42, e o teste injeta o
Jev falso de `scripts/jev-falso.mjs`. O que a orquestradora faz com `escala: false` fica fora do
repo, nas instruções dela.

## Implementation Details

### `scripts/classificar-parada.mjs` (novo, ESM)

O cabeçalho de comentário segue o molde de `scripts/prova-modelo.mjs`: o que o script faz, o uso, os
códigos de saída e os porquês. Os porquês são três: a lista fica no script, com guarda contra a
tabela; a entrada vem do stdin, e não de argumento; e a falha fecha (fail-closed).

**Exports (exatos):**

```js
export const LIMIAR = 0.8;
export const TEMPO_MS = 5000;
export const PERGUNTA =
  "Uma sessão automática da esteira parou e escreveu o motivo abaixo. Qual categoria descreve esse motivo?";
export const CATEGORIAS = [ /* tabela abaixo, nesta ordem */ ];
export const DESLIGADO = Object.freeze({ estado: "desligado", categoria: null, probabilidade: null, escala: null, porque: null });
export function lerEntrada(texto) { /* → { motivo } | { erro } */ }
export function linhasParaDaTabela(markdown) { /* → string[] */ }
export function divergenciaDaLista(markdown) { /* → null | string */ }
export async function classificar(motivo, deps = {}) { /* → { resultado, aviso } */ }
export async function executar(textoEntrada, deps = {}) { /* → { codigo, saida, erro } */ }
export async function rodarCli(argv, deps = {}) { /* lê stdin, escreve, sai */ }
```

**`CATEGORIAS`**: cada item é `{ id, linha, texto, sempre }`.
- `linha` é a 1ª célula **exata** da tabela (com crases), ou `null` para as duas extras.
- `texto` é o que vai ao Jev.
- `sempre` é `"reservada"`, `"outro"` ou `null`.

| id | `linha` | `texto` enviado ao Jev | `sempre` |
|---|---|---|---|
| `segundo-revisor` | `Segundo revisor de spec sensível` | `linha` sem crases | `null` |
| `alvo-ambiguo` | `Alvo ambíguo: repo, card, pasta, PR` | `linha` sem crases | `null` |
| `escolha-de-produto` | `Escolha de produto que card, spec, argumento e decisões registradas não respondem` | `linha` sem crases | `"reservada"` |
| `desvio-de-spec` | `Desvio da spec, decisão que caiu, emenda` | `linha` sem crases | `null` |
| `teste-vermelho` | ``Teste vermelho, ambiente quebrado, `CLAUDE.md` que não declara o que a skill exige`` | `linha` sem crases | `null` |
| `producao` | ``Merge, `main`, tag, release, deploy, produção, instalação viva, apagar`` | `linha` sem crases | `"reservada"` |
| `gate-aberto` | `null` | `Gate ou etapa que espera a resposta de um humano, deixada aberta porque a sessão não recebeu a frente para decidir` | `null` |
| `outro` | `null` | `Nenhuma das outras categorias` | `"outro"` |

"Sem crases" quer dizer `linha.replaceAll("`", "")`.

**`lerEntrada(texto)`** segue estes passos:
1. Troca `\r\n` por `\n`.
2. Entrada vazia ou só com espaço → `{ erro: "entrada vazia" }`.
3. Pega a última linha que tem algo além de espaço. Se ela não casar `/^PARADA:\s*(.*)$/` →
   `{ erro: "a última linha não é PARADA:" }`.
4. Grupo vazio depois de aparado → `{ erro: "PARADA sem motivo" }`. Senão, `{ motivo }`, aparado.

**`linhasParaDaTabela(markdown)`** segue estes passos:
1. Troca `\r\n` por `\n`.
2. Acha a linha exatamente igual a `## Modo despachado`. A região vai até a próxima linha que começa
   com `## `, ou até o fim. Sem esse cabeçalho, devolve `[]`.
3. Em cada linha da região que começa com `|`, calcula
   `células = linha.split("|").slice(1, -1).map(s => s.trim())`. Se `células[2]` começa com
   `**para**`, guarda `células[0]`.

**`divergenciaDaLista(markdown)`** compara `linhasParaDaTabela(markdown)` com as `linha` não nulas
de `CATEGORIAS` como conjunto: mesmo tamanho e mesmos elementos. Se baterem, devolve `null`. Se
não, devolve uma linha de texto:
`lista divergente: na tabela e não no script: [<a>, …]; no script e não na tabela: [<b>, …]`, com
`JSON.stringify` em cada lista.

**`classificar(motivo, deps)`**

`deps = { cliente, lerConvencoes, tempoMs = TEMPO_MS, limiar = LIMIAR }`.
- `cliente` padrão: `daFormaDo42(<módulo do #42>)`, com import estático por caminho relativo a
  `scripts/`.
- `lerConvencoes` padrão: `readFileSync` de `../skills/_comum/convencoes.md` relativo ao próprio
  script (`fileURLToPath(import.meta.url)`), em UTF-8.

Devolve `{ resultado, aviso }`. `aviso` é `""`, a não ser no passo 2. Passos, nesta ordem:

1. **Ligado?** `await cliente.ligado()`. Se for falso → `{ resultado: DESLIGADO, aviso: "" }`. Isso
   acontece sem chamar `escolher` e sem ler a tabela. Se lançar ou rejeitar →
   `sem-classificacao, porque: "erro"`.
2. **Guarda da lista**, com `d = divergenciaDaLista(lerConvencoes())`. Se `lerConvencoes` lançar, `d`
   vira `"lista divergente: não li skills/_comum/convencoes.md: <mensagem>"`. Se `d` não for `null`
   → `sem-classificacao, porque: "lista-divergente"`, com `aviso: d`, **sem chamar `escolher`**.
3. **Pergunta ao Jev.** Cria um `AbortController`.
   `r = await Promise.race([chamada, estouro])`:
   - `chamada` é `Promise.resolve().then(() => cliente.escolher({ pergunta: PERGUNTA, texto: motivo, opcoes, signal }))`,
     e esse invólucro transforma até exceção síncrona em rejeição;
   - `opcoes = CATEGORIAS.map(c => c.texto)`;
   - `estouro` resolve um marcador `TEMPO` depois de `tempoMs`.

   No `finally`, `clearTimeout` do timer e `controller.abort()`. Se `chamada` rejeitar →
   `sem-classificacao, porque: "erro"`. Se der `TEMPO` → `sem-classificacao, porque: "tempo"`. É uma
   chamada só, sem nova tentativa.
4. **Resposta inválida.** Se `r` não for objeto não nulo, se `r.opcao` não estiver em `opcoes`, ou se
   `r.probabilidade` não for `number` finito em `[0, 1]` → `sem-classificacao,
   porque: "resposta-invalida"`.
5. **Escalada.** `c = CATEGORIAS.find(c => c.texto === r.opcao)`.
   - Se `c.sempre` → `escala: true, porque: c.sempre`.
   - Se não, e `r.probabilidade < limiar` → `escala: true, porque: "abaixo-do-limiar"`.
   - Nos outros casos → `escala: false, porque: null`.

**Os três formatos do resultado.** O objeto é sempre montado com as chaves nesta ordem, então o
`JSON.stringify` sai sempre igual:

```json
{"estado":"classificada","categoria":"teste-vermelho","probabilidade":0.91,"escala":false,"porque":null}
{"estado":"sem-classificacao","categoria":null,"probabilidade":null,"escala":true,"porque":"tempo"}
{"estado":"desligado","categoria":null,"probabilidade":null,"escala":null,"porque":null}
```

`probabilidade` sai como o Jev devolveu, sem arredondar.

**`executar(textoEntrada, deps)`**. Se `lerEntrada` der erro → `{ codigo: 2, saida: "", erro }`.
Senão, faz `{ resultado, aviso } = await classificar(motivo, deps)` e devolve
`{ codigo: 0, saida: JSON.stringify(resultado), erro: aviso }`.

**`rodarCli(argv, deps)`**, nesta ordem:
1. `argv.length > 0` → uso no stderr e código `2`, **antes** de ler o stdin. O script não tem
   opções.
2. `process.stdin.isTTY` → uso no stderr e código `2`.
3. Lê o stdin inteiro com `for await (const pedaço of process.stdin)` e decodifica em UTF-8.
4. `executar`.
5. Escreve `saida + "\n"` no stdout se `saida` não for vazia, e `erro + "\n"` no stderr se `erro`
   não for vazio. Depois chama `process.exit(codigo)` **no callback da última escrita**
   (`process.stdout.write(s, () => process.stderr.write(e, () => process.exit(codigo)))`, pulando a
   escrita vazia).

Exceção não prevista vira código `1`, com a mensagem no stderr e stdout vazio.

**Entrypoint.** O arquivo chama `rodarCli(process.argv.slice(2))` só quando
`realpathSync(process.argv[1])` é igual a `realpathSync(fileURLToPath(import.meta.url))`. No
`win32`, os dois lados são comparados em minúsculas.

**Códigos de saída:**
- `0`: uma das três saídas válidas;
- `1`: falha interna;
- `2`: uso errado (argumento, TTY, entrada vazia, última linha sem `PARADA:`, motivo vazio).

### `scripts/jev-falso.mjs` (novo, ESM)

Segue o molde de `brain-mcp/scripts/embeddings-falso.mjs`: um substituto determinístico, só para
teste, com defeitos sob encomenda. Nenhum código de produção o importa. O cabeçalho diz isso e o
porquê.

```js
export function criarJevFalso({ defeito = null, probabilidade = null } = {})
  → { ligado, escolher, chamadas /* getter: quantas vezes escolher foi chamado */ }
```

- **Sem defeito:** `ligado()` devolve `true`. `escolher` procura no `texto` (em minúsculas) a
  primeira palavra-chave da tabela abaixo, na ordem, e resolve
  `{ opcao: <texto da categoria>, probabilidade: probabilidade ?? <padrão> }`. O texto da categoria
  vem de `CATEGORIAS`, importado de `./classificar-parada.mjs`.

  | palavra-chave | categoria | probabilidade padrão |
  |---|---|---|
  | `segundo revisor` | `segundo-revisor` | `0.93` |
  | `ambígu` | `alvo-ambiguo` | `0.91` |
  | `produto` | `escolha-de-produto` | `0.9` |
  | `desvio` | `desvio-de-spec` | `0.9` |
  | `vermelho` | `teste-vermelho` | `0.95` |
  | `merge` | `producao` | `0.97` |
  | `gate` | `gate-aberto` | `0.9` |
  | (nenhuma) | `outro` | `0.6` |

- **`defeito`**:
  - `"desligado"`: `ligado()` devolve `false`;
  - `"ligado-lanca"`: `ligado()` lança;
  - `"erro"`: `escolher` rejeita com `Error("jev falso: erro")`;
  - `"lanca-sincrono"`: `escolher` (função não `async`) lança antes de devolver promessa;
  - `"tempo"`: a promessa só termina quando o `signal` é abortado, e aí rejeita. Até lá segura um
    `setInterval`, que é limpo no abort;
  - `"tempo-surdo"`: segura um `setInterval` e **ignora** o `signal`. Só serve para o C9d, em
    processo filho;
  - `"opcao-fora"`: resolve `{ opcao: "Categoria que não existe", probabilidade: 0.9 }`;
  - `"probabilidade-fora"`: resolve a opção certa com `probabilidade: 1.5`;
  - `"nao-objeto"`: resolve `null`.

### `scripts/classificar-parada-teste.mjs` (novo, ESM)

Segue o molde de `scripts/skills-comum-teste.mjs`: `afirmar(ok, msg)`, cenários em blocos, um
`console.log` no fim e `process.exit(falhas === 0 ? 0 : 1)`. Uso:
`node scripts/classificar-parada-teste.mjs`. Os cenários estão em `## Plano de testes`. A suíte não
usa rede: todos os cenários usam o Jev falso, menos o C9b, que usa o cliente do #42 **desligado**
num ambiente isolado.

### `CLAUDE.md` (do repo): item 3 de `## A esteira`

Ao fim do item 3 (depois de "Edite a fonte e rode o script sem `--check`; nunca a cópia."), entra
este parágrafo, recuado como o segundo parágrafo do item 2:

> Mudou a tabela do `## Modo despachado` em `skills/_comum/convencoes.md`, ou um dos
> `scripts/classificar-parada.mjs`, `scripts/classificar-parada-teste.mjs` e `scripts/jev-falso.mjs`?
> A suíte inclui também `node scripts/classificar-parada-teste.mjs`, com o mesmo código `1`
> vermelho: a lista de categorias do classificador da `PARADA` é tirada dessa tabela.

Os irmãos #43 e #46 também mexem no item 3, e o conflito de texto, se houver, se resolve no rebase
juntando as frases.

### `docs/esteira-gm.md`: um parágrafo no fim de `## Modo despachado`

Depois do parágrafo **O que o argumento ainda carrega** (`docs/esteira-gm.md:322-325`) e antes de
`## Uma worktree por card`, entra este texto exato:

> **A parada classificada (opcional, atrás da flag do Jev).** Quem despacha pode passar a saída da
> sessão por `node scripts/classificar-parada.mjs`. O script lê do stdin, pega a última linha e
> escreve uma linha JSON com cinco campos:
> - `estado`: `classificada`, `sem-classificacao` ou `desligado`;
> - `categoria`: o id de uma das linhas **para** da tabela do `## Modo despachado` de
>   `skills/_comum/convencoes.md`, ou `gate-aberto`, ou `outro`;
> - `probabilidade`;
> - `escala`;
> - `porque`.
>
> `escala: true` é escalada obrigatória. Acontece em parada reservada ao humano (`producao`,
> `escolha-de-produto`), em `outro`, em confiança abaixo do limiar, em erro ou tempo esgotado do
> Jev, em resposta inválida e quando aquela tabela diverge da lista do script. `escala: false`
> deixa a categoria para a política da orquestradora, que não mora neste repo. `desligado` (sem a
> flag ou sem a chave do cliente do Jev, do #42) e código de saída diferente de `0` querem dizer a
> mesma coisa: ler a frase como sempre. A linha `PARADA:` não muda. A categoria é inferida, e a
> sessão nunca a declara.

### `README.md`: a linha de `scripts/` na árvore

`README.md:312` passa de
`├── scripts/                    skills-comum.mjs — carimba e checa os blocos comuns das skills`
para
`├── scripts/                    skills-comum.mjs (blocos comuns das skills), classificar-parada.mjs (motivo da PARADA, atrás da flag do Jev)`.

## File Change Summary

| Arquivo | Muda |
|---|---|
| `scripts/classificar-parada.mjs` | novo: lista, regra de escalada, guarda da tabela, CLI stdin → JSON |
| `scripts/jev-falso.mjs` | novo: Jev falso determinístico com defeitos, só para teste |
| `scripts/classificar-parada-teste.mjs` | novo: a suíte do card (C1–C9) |
| `CLAUDE.md` | um parágrafo no item 3 de `## A esteira` (o portão da suíte nova) |
| `docs/esteira-gm.md` | um parágrafo no fim de `## Modo despachado` |
| `README.md` | a linha de `scripts/` na árvore (`README.md:312`) |
| `planning/44-parada-classificada/` | esta spec e as tasks |

Não são tocados: `skills/` (nenhum arquivo), `hooks/`, `brain-mcp/`, `sync.*` e `install.*`. Se a
implementação precisar tocar algum deles, é desvio de spec.

## Migrations & compatibilidade

N/A: não há dado nem formato em disco. O script é novo e só roda quando alguém o chama. Os
despachantes que existem (`d.sh`, `cadeia*.sh`) não mudam neste card e continuam lendo a frase. Sem
a flag do #42, a saída é `desligado`, que a doc manda ler como hoje. A linha `PARADA:` e os blocos
das skills não mudam (CA3).

## Rollback

`git revert -m 1 <merge da PR do #44 na dev>`. A sequência de `## Execution` garante que esse merge
é um commit só na `dev`. Nada fica para trás: não há instalação (o script roda do checkout), dado
nem config. Na orquestradora, basta parar de chamar o script, já que `desligado` e "não chamar"
querem dizer o mesmo.

## Verificação pós-deploy

Roda depois do merge do #44 na `dev`, no checkout de `dev`, em duas partes.

1. **Sem aval (a G5 roda isto).** O ambiente é isolado, para que nenhuma flag ou chave do #42
   instalada na máquina seja lida:
   ```
   T=$(mktemp -d)
   env -u <cada variável de flag/chave que a spec do #42 nomear> HOME=$T USERPROFILE=$T CLAUDE_CONFIG_DIR=$T \
     sh -c "printf 'PARADA: o merge na dev é do Leonardo.\n' | node scripts/classificar-parada.mjs"
   ```
   Esperado: código `0` e
   `{"estado":"desligado","categoria":null,"probabilidade":null,"escala":null,"porque":null}`.
   Também `node scripts/classificar-parada-teste.mjs` → `0` e
   `node scripts/skills-comum.mjs --check` → `0`.
2. **Com aval (CA4, pendência).** Com a chave e a flag do #42 ligadas, só para os arquivos cuja
   última linha não vazia é `PARADA:`:
   ```
   for f in ~/pessoal/claude/despachos-*/saida-*.json ~/notoria/claude/despachos-*/saida-*.json; do
     [ -s "$f" ] || continue
     l=$(jq -r '.result // empty' "$f" | sed '/^[[:space:]]*$/d' | tail -1)
     case "$l" in PARADA:*) ;; *) continue ;; esac
     ini=$(date +%s%N); out=$(printf '%s\n' "$l" | node scripts/classificar-parada.mjs)
     echo "$f	$(( ($(date +%s%N)-ini)/1000000 )) ms	$out"
   done
   ```
   O tempo medido inclui a partida do `node`, de algumas dezenas de ms. O Leonardo marca a
   categoria que ele leria em cada uma das 19 `PARADA` (contagem de 2026-11-10). A comparação dá
   os acertos por categoria e a latência mediana e máxima. Com esse dado, o limiar `0.8` é
   recalibrado numa PR própria. Esta parte não roda sem o aval.

## Plano de testes

A suíte é `node scripts/classificar-parada-teste.mjs`, que sai `0` ou `1`. Os cenários C1–C8 chamam
`classificar`, `executar`, `lerEntrada`, `linhasParaDaTabela` e `divergenciaDaLista` no próprio
processo, com `deps.cliente = criarJevFalso(...)`. A `lerConvencoes` padrão (o arquivo real) vale em
todos, menos no C5 e no C7.

| Cenário | Prova | Caso |
|---|---|---|
| C1 | CA1 | Oito motivos, um por palavra-chave da tabela do Jev falso; um deles não tem nenhuma e cai em `outro`. As oito categorias saem, cada uma ao menos uma vez, com `estado: "classificada"` e `aviso: ""`. |
| C2 | CA1 | `producao`, `escolha-de-produto` e `outro`, com `probabilidade` `0.3` e com `0.99`. Sai `escala: true`, com `porque` igual a `"reservada"`, `"reservada"` e `"outro"`. |
| C3 | CA1 | `teste-vermelho` com `0.79` → `escala: true, porque: "abaixo-do-limiar"`. Com `0.8` → `escala: false, porque: null`. |
| C4 | CA2 | Defeitos `erro` e `lanca-sincrono` → `sem-classificacao`, `porque: "erro"`. Defeito `tempo` com `tempoMs: 50` → `porque: "tempo"`, e o `signal` recebido pelo falso está abortado. Defeito `ligado-lanca` → `porque: "erro"`. Em todos, `escala: true`; nos três primeiros, `chamadas === 1`. |
| C5 | CA2 | Defeito `desligado`, com uma `lerConvencoes` injetada que conta as chamadas. Sai `resultado` igual a `DESLIGADO`, com `chamadas === 0` e a `lerConvencoes` não chamada. |
| C6 | R3 | Defeitos `opcao-fora`, `probabilidade-fora` e `nao-objeto` → `sem-classificacao`, `porque: "resposta-invalida"`, `escala: true`. |
| C7 | R1, R3 | `lerConvencoes` injetada em três versões: (a) o arquivo real com a 1ª célula de `Alvo ambíguo…` renomeada; (b) o arquivo real com uma linha `**para**` a mais; (c) uma função que lança. As três dão `porque: "lista-divergente"` e `chamadas === 0`. Em (a), `aviso` começa com `lista divergente:` e cita as duas células, a nova e a velha. Além disso, `linhasParaDaTabela` sobre o arquivo real devolve exatamente as seis `linha` de `CATEGORIAS`, e `divergenciaDaLista` sobre ele dá `null`. |
| C8 | R2 | `executar` com um texto de várias linhas terminado em `PARADA: x`, com `\r\n` e linhas em branco no fim → código `0`. `PROXIMO: /gm-plan-tasks x`, entrada vazia e `PARADA:` sem motivo → código `2` e `saida` vazia. No caso classificado, a `saida` tem as chaves na ordem `estado, categoria, probabilidade, escala, porque`. No caso (a) do C7, passado por `executar`, sai código `0` e `erro` igual ao `aviso`. |
| C9 | R2, CA2 | Processos de verdade, com `spawnSync(process.execPath, [...], { input, timeout })`. Detalhes nos itens (a)–(d) abaixo. |

Os quatro processos do C9:
- **(a)** O script com stdin `PROXIMO: /gm-x y` → `status === 2` e stdout vazio.
- **(b)** O script com stdin `PARADA: o merge na dev é do Leonardo.` e `timeout: 4000`, num ambiente
  isolado: uma cópia de `process.env` sem **toda** variável que a spec do #42 nomear como fonte da
  flag ou da chave, e com `HOME`, `USERPROFILE` e `CLAUDE_CONFIG_DIR` apontando para um diretório
  vazio de `mkdtempSync`. Se a spec do #42 nomear outra fonte (outro arquivo, outra variável), ela
  também é neutralizada. Esperado: `status === 0` (não morto pelo `timeout`) e stdout igual a
  `{"estado":"desligado","categoria":null,"probabilidade":null,"escala":null,"porque":null}\n`.
- **(c)** O script com um argumento qualquer → `status === 2`.
- **(d)** Um arquivo temporário `.mjs`, em diretório de `mkdtempSync`, que importa por URL
  `file://` o `rodarCli` e o `criarJevFalso` e chama
  `rodarCli([], { cliente: criarJevFalso({ defeito: "tempo-surdo" }), tempoMs: 200 })`. Rodado com
  stdin `PARADA: x` e `timeout: 6000` → `status === 0`, `signal === null` e stdout com
  `"porque":"tempo"`. Prova que o processo termina mesmo com o cliente segurando o event loop.

**CA3:** `git diff --quiet $(git merge-base HEAD feat/42-filtro-jev) HEAD -- skills/` (`0`),
`git status --porcelain -- skills/` (vazio) e `node scripts/skills-comum.mjs --check` (`0`).

**Portão do `/gm-ship` para este card** (precondição 4, item 3 do `CLAUDE.md` já editado):
`node scripts/classificar-parada-teste.mjs` e `node scripts/skills-comum.mjs --check`, os dois com
saída `0`. Este card não toca `brain-mcp/src/`, então `npm run smoke` e `npm run eval` não entram.
Se a branch do #42 trouxer mudança em `brain-mcp/src/`, esse portão é do #42.

## Technical Decisions

- **A lista fica no script, com guarda contra a tabela, e não é lida da tabela em tempo de
  execução.** A orquestradora casa a política pelo id, e a 1ª célula da tabela não é um id estável:
  é texto, e as #28 e #29 já o reescreveram. Lida em tempo de execução, uma linha renomeada viraria
  categoria sem id. Com a lista no script, a guarda do passo 2 transforma a divergência em escalada
  (fail-closed), o C7 pega a divergência no teste, e o item 3 do `CLAUDE.md` faz a suíte rodar
  quando a tabela muda.
  *Descartado:* ler a tabela a cada chamada, como a `prova-modelo` lê a dela. Lá a tabela é o dado;
  aqui ela só dá origem à lista.
- **`outro` escala sempre**, como a parada reservada. Uma parada que não cabe em nenhuma linha da
  tabela é uma que a esteira não previu, e a orquestradora não tem política para ela. A regra segue
  o "incerta escala" do card e o precedente fail-closed do #43 (portão de spec sensível).
  *Descartado:* tratar `outro` pelo limiar, porque o Jev pode estar muito seguro de que é "outro".
- **Resposta inválida, lista divergente e falha do `ligado()` escalam, cada uma com `porque`
  próprio, e não viram `desligado`.** Com a flag ligada, quem lê a saída espera que o classificador
  funcione. Uma falha silenciosa devolveria a parada à leitura de hoje justamente quando algo está
  quebrado.
- **A ordem é: `ligado()`, a guarda e depois o Jev.** Sem a flag, tudo fica como hoje, mesmo com a
  tabela divergente, e nada sai da máquina. Com a tabela divergente, o motivo não é enviado à
  TypeSafe AI para uma resposta que seria descartada. Isso pede o `ligado()` sem rede, que o #41
  também pede (J2).
- **O limiar é `0.8`, uma constante.** Sem dado real (o CA4 depende do aval), o número foi escolhido
  pelo custo do erro: escalar demais custa ao Leonardo uma leitura que ele já faz hoje, e escalar de
  menos é a dor do card. Com oito opções, o acaso dá `0.125`. A calibração com as 19 `PARADA` reais
  fica para uma PR própria, depois do aval.
  *Descartado:* opção de linha de comando ou variável de ambiente para o limiar, porque seria
  superfície nova sem dado que a justifique.
- **Há teto de tempo próprio (`5000` ms), `AbortSignal` e `process.exit` no callback da escrita.**
  O teto garante o CA2 ("estouro de tempo → sem classificação") mesmo se o orçamento do #42 for
  outro. O `signal` permite que o cliente feche o socket. O `process.exit` garante que o processo
  termine se o cliente não fechar. O precedente `process.exitCode` (`prova-modelo.mjs:448-449`)
  protege a saída no pipe, mas deixaria a CLI pendurada; sair dentro do callback da escrita protege
  as duas coisas. A orquestradora não tem pressa, porque uma etapa leva minutos.
- **Uma chamada, sem nova tentativa.** Tentar de novo dobraria o envio do motivo à TypeSafe AI e a
  latência, num caso em que a resposta segura (escalar) já existe.
- **A forma esperada do cliente é a mesma que o #41 pede.** Dois consumidores pedindo duas formas ao
  #42 o obrigariam a escolher entre os dois. O que só o #44 exige, ele diz por escrito: pelo menos
  oito opções.
- **A CLI roda do checkout, não da instalação.** `scripts/` não entra no `sync.sh`, assim como
  `skills-comum.mjs` e `prova-modelo.mjs`. Instalar exigiria mexer no `sync.*`, o que está fora do
  escopo e da regra do lote.
- **A entrada vem do stdin, e não de argumento.** O motivo de uma `PARADA` quase sempre tem crases
  (``a PR #1862 está pronta``), e `node x.mjs "$linha"` no bash executaria cada trecho entre crases.
- **Não há rede de palavras-chave que force a categoria reservada.** O card pede o Jev como
  classificador. Uma lista de palavras (merge, tag…) seria um segundo classificador, sem dado que o
  calibre. O risco de uma parada reservada ser lida como `gate-aberto` com confiança alta é
  exatamente o que o CA4 mede.

## Coding Standards

- ESM `.mjs`, só builtins `node:`, sem dependência nova. Comentários e mensagens em pt-BR, no tom
  dos cabeçalhos de `scripts/prova-modelo.mjs` e `brain-mcp/scripts/embeddings-falso.mjs`, que
  explicam o porquê de cada escolha não óbvia.
- CRLF vira LF antes de qualquer comparação, como em `prova-modelo.mjs`.
- Nada além do especificado: sem log em arquivo, sem métrica, sem opção de linha de comando e sem
  segundo cliente do Jev. O texto da `PERGUNTA` e o das categorias são os desta spec, literais.
