# lembrar: marcar a vizinha que a decisão nova provavelmente contradiz, com o Jev julgando por par — Spec

> Profundidade **Lite** (decisão #1388). Rota do card: Curta (G1, decisão #1376). Desenho: decisões
> #1397 e #1398, revistas depois do revisor de IA independente (#1413).

> **Emenda 2026-11-11 (G4 da PR #61, braço direito, cofre #1691).** O parecer do `/code-review high`
> contra `a6f6172` mudou quatro pontos desta spec; o resto vale como está.
> - **R2, R6 e `### tools.ts` (achado 1).** A vizinha cujo `id` é o `supersede` da própria chamada
>   não vai ao Jev: o handler julga `relacionadas.filter((v) => v.id !== args.supersede)` e formata o
>   aviso com `relacionadas` inteira. Ela continua na lista, sem marca; com o Jev desligado o retorno
>   é o de hoje (R1). O diff de `tools.ts` ganha esse filtro além dos imports e do bloco do
>   julgamento. Prova: `lembrar-com-supersede-nao-julga-a-substituida` (servidor, Jev falso `ligado`:
>   A1 e A2 que o falso marcaria, `supersede: A1` → A1 sem marca, A2 marcada, e o registro do falso
>   só tem o par com A2).
> - **R3 e `prazoJulgamentoMs` (achado 3).** Vale só inteiro de 1 a `PRAZO_MAXIMO_MS = 2147483647`
>   (o teto do `setTimeout`; acima, o timer dispara em ~1 ms e marca nenhuma apareceria); acima, volta
>   a `PRAZO_PADRAO_MS`. `montar-pergunta-e-prazo` soma `"2147483647"` → 2147483647,
>   `"2147483648"` → 4000 e `"99999999999999999999"` → 4000.
> - **`### Fronteira com o #42: juizJev.ts` (achado 4).** Cai "Este arquivo não tem teste próprio".
>   `juiz-jev-ponte-real` importa o `dist/juizJev.js` real num filho sem o hook de troca e sem
>   `NODE_OPTIONS`, com `envSemJev` + `BRAIN_JEV=lembrar` e o `BRAIN_JEV_FALSO` do #42, sem
>   `TYPESAFE_API_KEY`: roteiro que só responde à pergunta `contradiz` com `estado` =
>   `montarPergunta(par)` → P(sim) 0,37; `sim` → 0,95; par fora do roteiro → o juiz rejeita;
>   `lembrar` fora de `BRAIN_JEV`, ou `BRAIN_JEV` ausente → `obterJulgarPar()` `null`. O `fetch` do
>   filho lança e é contado: zero chamadas.
> - **`PERGUNTA_CONTRADICAO` (achado 9).** Passa a ser constante exportada de `contradicao.ts`, usada
>   por `montarPergunta` e importada pelo `juizJev.ts`, no lugar da cópia literal da emenda
>   2026-11-10. O texto não muda. O ramo `"não"` do `criarJulgarPar` fica: o `ClienteJev` genérico é
>   a fronteira do G2 (#1413).
> - Consequência no Plano de testes (achados 5 e 6): o falso de `scripts/jev-falso.mjs` passa a ler
>   `BRAIN_CONTRADICAO_FALSO` e `BRAIN_CONTRADICAO_FALSO_REGISTRO` (os mesmos quatro modos), e não
>   `BRAIN_JEV_FALSO`/`BRAIN_JEV_FALSO_REGISTRO`, que ficam só com o sentido do contrato do #42; todo
>   filho que os casos do #46 sobem parte de `envSemJev(process.env)`.

## References
- Card: [#46](https://github.com/leonardo-amaral-3/claude-brain/issues/46) — repo `leonardo-amaral-3/claude-brain`
- Dependência: [#42](https://github.com/leonardo-amaral-3/claude-brain/issues/42) — dono do cliente do Jev e da flag
- PRD: não há

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir `claude-brain/` no workspace `pessoal`)
- Worktree: `~/pessoal/claude-brain-46-freio-contradicao`
- Feature branch: `feat/46-freio-contradicao`
- Base branch: **a branch do #42, quando ela existir.** Hoje a `feat/46-freio-contradicao` sai de
  `origin/dev`; o braço direito faz o rebase sobre a branch do #42 antes de a implementação começar.
  A PR vai para `dev`, depois da do #42 (ou empilhada nela, se a do #42 ainda estiver aberta).
- **O #46 não cria cliente do Jev.** Ele consome o cliente do #42 por uma fronteira fina, o arquivo
  `brain-mcp/src/juizJev.ts` (ver `### Fronteira com o #42`). Nenhum outro arquivo do #46 importa o
  módulo do #42.
- Portão do `/gm-ship` (CLAUDE.md do repo, `## A esteira`, item 2 — toca `brain-mcp/src/`):
  `npm run build`, `npm run concorrencia`, `npm run smoke` e `npm run eval -- --base origin/dev`, com o
  `dist/` recompilado e `BRAIN_DB`/`BRAIN_CONFIG` apontando para o índice vivo no `smoke` e no `eval`.
  Código `1` ou `2` em qualquer um: a PR não abre.
- Ambiente: `brain-mcp/node_modules` não existe nesta worktree nem no checkout principal; provê-lo é
  fora do `/gm-ship` (CLAUDE.md, `## Convenções da esteira`). Nada desta spec foi compilado nem rodado.
- Proibido em qualquer etapa: chamar a API do Jev, rodar `npm run contradicao -- --enviar` com o Jev
  real, ou mandar trecho do cofre à TypeSafe AI, até o aval de Leonardo (critério 4).

## Requisitos & critérios de aceite

**R1 — Jev desligado é o comportamento de hoje.** (critério 1 do card)
- Dado que `obterJulgarPar()` resolve `null` (a flag do #42 ausente ou sem chave), quando o `lembrar`
  é chamado, então nenhum par é julgado, a gravação é a de hoje e o texto devolvido é **byte a byte**
  o de hoje (o formato de `tools.ts:559-566` em `origin/dev`).
- Prova: `contradicao-sem-juiz-nao-julga`, `aviso-sem-marca-igual-ao-de-hoje`,
  `lembrar-com-jev-desligado-fica-como-hoje`.

**R2 — Jev ligado marca só a vizinha julgada contradição.** (critério 2)
- Dado o Jev ligado e N vizinhas (N ≤ 5) na lista de hoje, quando o `lembrar` é chamado, então cada
  par (fato novo, fato da vizinha) é julgado uma vez, e a vizinha com P(contradiz) ≥ `0,70` sai com
  ` [contradição provável, Jev 0.93]` (a probabilidade com duas casas) entre o `)` e o `:` da linha
  dela; as outras linhas, o cabeçalho e a ordem saem como hoje.
- Prova: `contradicao-marca-so-acima-do-limiar`, `aviso-com-marca-muda-so-a-linha-marcada`,
  `juiz-jev-adaptador`, `lembrar-com-jev-falso-marca-a-contradicao`.

**R3 — Falha do Jev não muda nada.** (critério 2)
- Dado o Jev ligado, quando qualquer par rejeita, devolve valor que não é número em [0,1], ou o
  conjunto não termina dentro do prazo (`4000` ms, ou `BRAIN_CONTRADICAO_PRAZO_MS`), então a decisão
  já está gravada (o julgamento roda **depois** da gravação), o aviso sai **sem nenhuma marca**,
  idêntico ao de hoje, e a resposta da tool não é erro.
- Prova: `contradicao-falha-volta-ao-aviso-de-hoje`, `contradicao-prazo-estoura`, `juiz-jev-adaptador`,
  `lembrar-com-jev-em-erro-grava-e-avisa-como-hoje`, `lembrar-com-jev-lento-respeita-o-prazo`.

**R4 — A tool nunca recusa e nunca preenche o `supersede`.** (critério 2)
- Em **cada** caso de servidor: a resposta não tem `isError` nem erro de protocolo (`chamarCru`), a
  linha nova tem `supersede IS NULL` (o chamador não passa `supersede`) e toda vizinha listada continua
  com `supersedida_por IS NULL`.

**R5 — Formato em disco intocado.** (critério 3)
- O `.md` gravado no cofre com o Jev ligado e uma vizinha marcada é byte a byte o que o código de
  hoje grava para a mesma entrada; a tabela `decisoes` não ganha coluna (`db.ts:102-116` não muda);
  `registrarDecisao` e `publicarDecisaoNoCard` (`memoria.ts:124-265`) não mudam, logo o comentário
  `gm:decisao` também não.
- Prova: `lembrar-com-jev-falso-marca-a-contradicao` (`.md` comparado com o literal) e o diff (G4).

**R6 — Só o `fato` sai do processo.** (decorre da autorização pendente do critério 4)
- O texto entregue ao cliente do Jev por par é exatamente `montarPergunta({ nova, anterior })`, com
  `nova` = o `fato` da decisão nova e `anterior` = o `fato` da vizinha. Nem `porque`, nem
  `alternativas`, nem `refs`, nem `escopo`, nem `data`.
- Prova: `contradicao-marca-so-acima-do-limiar` (forma do par), `juiz-jev-adaptador` (o texto que o
  cliente recebe) e o registro do Jev falso em `lembrar-com-jev-falso-marca-a-contradicao`.

**R7 — A medição existe e só envia com dois portões.** (critério 4, que depende do aval de Leonardo)
- `npm run contradicao` mede, sobre um snapshot do índice, quantas substituições conhecidas a marca
  acerta, quantas marcas não correspondem a substituição (teto das inventadas) e a latência que o
  julgamento soma ao `lembrar`. Ele só envia pares com o Jev ligado **e** `--enviar`; sem um dos dois,
  diz o que mandaria e sai com código `2`, sem chamar o juiz.
- Prova da mecânica: `contradicao-mede-com-jev-falso`. **A medição com pares reais é o critério 4 e
  fica pendente do aval** (chave do Jev e autorização de mandar trechos do cofre à TypeSafe AI); a PR
  registra o critério como não medido.

## Premissas medidas

Todas medidas em 2026-11-10, nesta sessão, lendo o fonte da `feat/46-freio-contradicao` (= `origin/dev`,
`3c3b92c`) e o cofre/índice vivos só por leitura.

- O `lembrar` calcula as vizinhas **antes** de gravar e formata o aviso depois · `tools.ts:546-566`
  lido · `decisoesRelacionadas` em 547, `registrarDecisao` em 548, `indexer.scan()`/`vigia.agendar`
  em 557-558, aviso em 559-565, retorno em 566 · 2026-11-10.
- A lista de vizinhas: até 300 candidatas mais recentes por `ts` (não supersedidas, escopo igual ou
  nulo), depois cosseno ≥ 0,82 (ou sobreposição de termos ≥ 0,5 sem embeddings), ordenada por
  semelhança, as 5 primeiras · `memoria.ts:65-109` lido · `LIMIT 300` em 74, `slice(0, 5)` em 94 e
  107, `LIMIAR_MESMO_ASSUNTO = 0.82` em 37, não exportado · 2026-11-10.
- A lista de hoje mistura decisões de outros cards e do workspace Notoria (faturamento SUS) quando
  estas não têm escopo · os avisos dos `lembrar` das decisões #1388, #1397 e #1398 nesta sessão ·
  entre as 5 vizinhas, #893, #898 e #69 (cards da Notoria, sem escopo, semelhança 0,84-0,87) ·
  2026-11-10. Consequência: ligar a flag manda ao Jev o `fato` de decisões da Notoria também.
- `registrarDecisao` e `publicarDecisaoNoCard` recebem só `DadosDecisao` e não leem nada do aviso ·
  `memoria.ts:124-265` lido · 2026-11-10.
- `hoje()` é a data UTC (`toISOString().slice(0, 10)`); o título do `.md` é a primeira frase até 110
  caracteres; o nome do arquivo sai de `slug(fato)` cortado em 60 caracteres e `writeFileSync`
  sobrescreve homônimo · `memoria.ts:46-58, 183-201` lidos · 2026-11-10.
- Ninguém parseia o texto de retorno do `lembrar` · `grep -rn "Registrado como\|semelhan"` no repo e
  em `~/pessoal/claude/despachos-claude-brain-46` · só `tools.ts:563,566` e prosa · 2026-11-10.
- Todo servidor dos testes sobe com `--import embeddings-falso-hook.mjs`, que troca
  `/dist/embeddings.js` por um hook de resolução ESM; os servidores do eval nos casos do `concorrencia`
  recebem o mesmo hook por `NODE_OPTIONS` · `concorrencia.mjs:25, 133-146, 2073` e
  `embeddings-falso-hook.mjs:14-26` lidos · 2026-11-10.
- O stub de embeddings é bag-of-words com hashing em 384 posições, somando ocorrências e normalizado;
  frases de ~20 palavras que diferem em uma ficam com cosseno ~0,96, e ~0,90 com um marcador `[p=...]`
  a mais · `embeddings-falso.mjs:52-69` lido; medição do revisor independente com `node -e` sobre o
  stub · 2026-11-10.
- `concorrencia.mjs` já tem o arnês de servidor com `chamarCru`, `criarFixture(..., { comDecisoes: true })`
  e um caso que grava decisões por servidor; `subirServidor` herda `...process.env` e usa
  `fx.registro` = `quem-embutiu.log` para o stub de embeddings · `concorrencia.mjs:104-127, 133-146,
  196-215, 860-952` lidos · 2026-11-10.
- `scripts/eval.mjs` exporta `tirarSnapshot(origem)` (`VACUUM INTO` com origem `readOnly`, em
  `mkdtemp(tmpdir()/brain-eval-)`), não tem efeito ao ser importado e só roda o `main` quando é o
  script de entrada, terminando com `process.exit` · `eval.mjs:11-38, 249-265, 755-776` lidos · 2026-11-10.
- O `smoke.mjs` não chama o `lembrar` (e não deve: roda contra a instalação viva) · `smoke.mjs:51-125`
  lido · 2026-11-10.
- Há substituições conhecidas para o critério 4 · `grep -rl "^substitui:" ~/notoria/claude/decisoes/ | wc -l`
  · 100 decisões com `substitui:` em 1.376 arquivos · 2026-11-10.
- Node da máquina tem `node:sqlite` com `readOnly` · `node --version` = v26.12.0 e uso em
  `eval.mjs:254` · 2026-11-10.
- O hook `brain-contexto.js` (alvo do #42) importa módulos do `dist/` do `brain-mcp` · `hooks/brain-contexto.js:309-313`
  lido · 2026-11-10. Isto **não** prova onde o #42 põe o cliente; ver D1.
- O #42 ainda não tem branch, spec nem decisão registrada · `gh issue view 42` (sem comentários),
  `git branch -a` (sem `feat/42-*`), busca `source: decisao` sobre o cliente do Jev (nada) · 2026-11-10.

### Fronteira com o #42 (o que o #46 precisa do cliente — não é premissa medida)

O #42 não decidiu ainda a interface. A spec não a fixa; ela só exige o mínimo abaixo. Se, quando a
branch do #42 existir, o cliente não atender D1-D5, é **desvio da spec**: o implementador para com
`PARADA` (protocolo de desvio do `gm-implement`), não improvisa.

- **D1** — o cliente é importável de `brain-mcp/src/` (vive em `brain-mcp/src/`, compila para `dist/`).
- **D2** — dá para fazer uma pergunta fechada em texto livre (pt-BR) e receber a resposta do Jev como
  "sim" ou "não" **e** a probabilidade, com o #42 dizendo (no código ou na spec dele) se a
  probabilidade é a da resposta dada ou a de "sim". Sem essa informação, `PARADA`.
- **D3** — existe um predicado "ligado" que já cobre "flag ausente" e "sem chave" (o critério 1 nomeia
  os dois), síncrono ou assíncrono. Se o #42 só expõe a flag e a chave em separado, o `juizJev.ts`
  compõe as duas com `&&`.
- **D4** — o cliente não escreve em stdout (no servidor MCP, stdout é o JSON-RPC).
- **D5** — o predicado é avaliado a cada chamada (não guardado no topo do módulo); se depender de
  variável de ambiente, mudar a flag pede reiniciar a sessão MCP, o que é aceitável (ver `## Rollback`).
- **Desejável, não exigido:** aceitar um `AbortSignal`. Sem ele o prazo continua valendo (a corrida
  do `julgarContradicoes` não depende do cliente honrar o sinal); a chamada só segue em segundo plano
  até terminar e o resultado é descartado.

> **Emenda 2026-11-10 (braço direito, cofre #1440 e a que a substitui):** o G2 do #42 (cofre #1426,
> #1427 e #1433) fixou o contrato em `planning/42-filtro-jev/spec.md`, § *Contrato do cliente do Jev
> (estável)*. Contra ele:
> - **D1 não fecha ao pé da letra, e foi emendado.** O cliente é `hooks/jev.js` (CJS, sem dependência),
>   não um módulo de `brain-mcp/src/`. O `juizJev.ts` o carrega como o contrato manda (ver a emenda em
>   `### Fronteira com o #42: brain-mcp/src/juizJev.ts`).
> - **D2 fecha** pelo `decidir` com uma pergunta `noul`: `probabilidade` = P(sim).
> - **D3 fecha**: `ligado('lembrar', env?)`, síncrono, já cobre o uso fora de `BRAIN_JEV`, a falta de
>   chave e o `BRAIN_JEV_FALSO`. Não há `&&` a compor.
> - **D4 fecha**: `decidir`/`julgar` não escrevem em stdout nem em stderr; só o modo CLI
>   (`require.main === module`) escreve.
> - **D5 fecha**: o env é lido a cada chamada, de `opcoes.env ?? process.env`.
> - **O desejável não entra**: não há `AbortSignal`. O prazo vai em `opcoes.timeoutMs`, sem teto, e a
>   chamada resolve em até `timeoutMs + 50 ms` sem rejeitar. A corrida do `julgarContradicoes`
>   continua sendo a guarda.
> - `ClienteJev`, `criarJulgarPar` e todo o `contradicao.ts` **não mudam**.

## Technical Overview

O julgamento entra **depois** da gravação, entre o `vigia.agendar` e o retorno do `lembrar`. A lógica
vive num módulo novo, `contradicao.ts`: pergunta, limiar, prazo, corrida, validação, formato do aviso
e o adaptador `criarJulgarPar`, que converte um cliente mínimo (`ClienteJev`) numa função `JulgarPar`.
A única ponte com o código do #42 é `juizJev.ts`: `obterJulgarPar()` importa o módulo do #42 **sob
demanda** (`await import`), monta o `ClienteJev` só ligando nomes e chama `criarJulgarPar`. Nos testes,
o mesmo hook de resolução que já troca os embeddings passa a trocar também `/dist/juizJev.js` por
`scripts/jev-falso.mjs`, então **nenhum processo de teste alcança o Jev real**, seja qual for o
ambiente de quem roda. Falhou qualquer coisa no julgamento: o aviso é o de hoje. Um script de medição,
`scripts/contradicao.mjs`, prepara o critério 4 sem executá-lo.

## Implementation Details

### `brain-mcp/src/contradicao.ts` (novo)

```ts
import type { DecisaoRelacionada } from "./memoria.js";

/** O par levado ao juiz. Só o `fato` de cada lado sai do processo (R6). */
export interface ParDecisoes {
  nova: string;
  anterior: string;
}

/** Devolve P(a nova contradiz a anterior) em [0,1] e rejeita em qualquer falha. */
export type JulgarPar = (par: ParDecisoes, signal: AbortSignal) => Promise<number>;

/** O mínimo que o #46 precisa do cliente do #42 (D2, D3). `juizJev.ts` só liga nomes. */
export interface ClienteJev {
  ligado(): boolean | Promise<boolean>;
  /** `probabilidade` é a da resposta dada; `juizJev.ts` converte se o #42 der a de "sim". */
  perguntar(texto: string, signal: AbortSignal): Promise<{ resposta: "sim" | "não"; probabilidade: number } | null>;
}

export const LIMIAR_CONTRADICAO = 0.7;
export const PRAZO_PADRAO_MS = 4000;
export const TETO_PARES = 5;
```

- `prazoJulgamentoMs(): number` — lê `process.env.BRAIN_CONTRADICAO_PRAZO_MS` **a cada chamada**;
  aceita só inteiro positivo (`/^\d+$/` e `> 0`); qualquer outra coisa (ausente, `"0"`, `"-5"`,
  `"abc"`, `"2.5"`) → `PRAZO_PADRAO_MS`.
- `montarPergunta(par: ParDecisoes): string` — exatamente:

  ```ts
  `Duas decisões registradas no mesmo cofre de decisões de projeto.\n\n` +
  `Decisão anterior: ${par.anterior}\n\n` +
  `Decisão nova: ${par.nova}\n\n` +
  `A decisão nova contradiz a decisão anterior, isto é, as duas não podem valer ao mesmo tempo?`
  ```

- `criarJulgarPar(cliente: ClienteJev): Promise<JulgarPar | null>`
  1. `await cliente.ligado()` dentro de `try`. `false` → `null`. Lançou →
     `console.error("[brain] contradicao: predicado do Jev falhou:", msg)` e `null`. Nunca rejeita.
  2. Ligado → devolve `async (par, signal) => { ... }` que chama
     `cliente.perguntar(montarPergunta(par), signal)` e converte: `null`/`undefined` → lança
     `"jev sem resposta"`; `probabilidade` que não é número finito em [0,1] → lança
     `"probabilidade invalida: <valor>"`; `resposta === "sim"` → `probabilidade`;
     `resposta === "não"` → `1 - probabilidade`; qualquer outro valor de `resposta` (inclusive
     `"Sim"`, `"nao"`, `undefined`) → lança `"resposta invalida: <valor>"`. Sem normalizar caixa nem
     acento: uma resposta fora do contrato é falha, não palpite.
- `julgarContradicoes(nova: string, vizinhas: DecisaoRelacionada[], julgar: JulgarPar | null, prazoMs = prazoJulgamentoMs()): Promise<Map<number, number> | null>`
  - `null` = **não julgado** (o aviso sai como hoje). `Map` (possivelmente vazio) = julgado; contém só
    as vizinhas com probabilidade ≥ `LIMIAR_CONTRADICAO`, chave = `id`, valor = probabilidade.
  - `julgar === null` ou `vizinhas.length === 0` → devolve `null` **sem chamar** `julgar`.
  - Julga só `vizinhas.slice(0, TETO_PARES)` (a lista já vem ordenada por semelhança).
  - Um `AbortController` por chamada. Cada par vira
    `Promise.resolve().then(() => julgar({ nova, anterior: v.fato }, ac.signal))` — o `then` transforma
    `throw` síncrono em rejeição. Cada promessa recebe também um `.catch(() => {})` descartado: o
    `Promise.all` já trata as rejeições hoje, e isto é **defesa contra refatoração** (trocar o
    `Promise.all` por um laço com `await` deixaria a rejeição tardia sem dono e o Node 26 derrubaria o
    servidor com `unhandledRejection`).
  - Corrida: `Promise.race([Promise.all(promessas), prazo])`, onde `prazo` rejeita com
    `new Error(\`prazo de ${prazoMs} ms\`)` num `setTimeout` que é limpo no `finally`.
  - Validação de cada valor: `typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 1`; senão
    lança `new Error(\`probabilidade invalida: ${String(p)}\`)`.
  - **Tudo ou nada:** qualquer rejeição, valor inválido ou prazo → `ac.abort()`,
    `console.error(\`[brain] contradicao: aviso sem marca (${motivo})\`)` e devolve `null`. A função
    nunca rejeita: o corpo inteiro fica num `try/catch`.
  - Sucesso → `console.error(\`[brain] contradicao: ${n} pares julgados em ${ms} ms, ${k} acima de ${LIMIAR_CONTRADICAO}\`)`
    e devolve o `Map`. (O stderr é o canal de diagnóstico do servidor; o texto da tool não muda.)
- `formatarAviso(vizinhas: DecisaoRelacionada[], marcas: Map<number, number> | null): string` — move
  para cá o formato de `tools.ts:559-565`, **sem mudar um caractere** quando não há marca. O cabeçalho
  é cópia caractere a caractere de `tools.ts:560-561` em `origin/dev` (inclui o travessão `—`):

  ```ts
  if (vizinhas.length === 0) return "";
  return (
    "\n\nJá havia registro sobre o mesmo assunto — confira se alguma contradiz esta e, se sim, " +
    "chame lembrar de novo com supersede:<id>:\n" +
    vizinhas
      .map((d) => {
        const p = marcas?.get(d.id);
        const marca = p === undefined ? "" : ` [contradição provável, Jev ${p.toFixed(2)}]`;
        return `  #${d.id} (${d.data}${d.escopo ? ", " + d.escopo : ""}, semelhança ${d.semelhanca.toFixed(2)})${marca}: ${d.fato}`;
      })
      .join("\n")
  );
  ```

### Fronteira com o #42: `brain-mcp/src/juizJev.ts` (novo)

```ts
import { criarJulgarPar, type JulgarPar } from "./contradicao.js";
// A única ponte com o cliente do Jev do #42. Nos testes este arquivo é trocado por
// scripts/jev-falso.mjs pelo hook de resolução (embeddings-falso-hook.mjs).
export async function obterJulgarPar(): Promise<JulgarPar | null> {
  try {
    const jev = await import("./<módulo do #42>.js");
    return await criarJulgarPar({ ligado: /* … */, perguntar: /* … */ });
  } catch (err) {
    console.error("[brain] contradicao: cliente do Jev indisponivel:", (err as Error).message);
    return null;
  }
}
```

- Import **dinâmico**, dentro do `try`: o servidor sobe e o `lembrar` funciona mesmo que o módulo do
  #42 lance ao ser carregado, e com a flag desligada o módulo nem precisa estar íntegro.
- O corpo só **liga nomes** do que o #42 exporta aos dois campos de `ClienteJev`: compor flag e chave
  com `&&` (D3) e, se o #42 devolve a probabilidade de "sim" em vez da da resposta dada, passar
  `{ resposta: "sim", probabilidade: pSim }`. Qualquer outra lógica (limiar, prazo, cache, log,
  normalização) é proibida aqui. Se ligar o #42 a `ClienteJev` exigir mais que isso, `PARADA`.
- Este arquivo não tem teste próprio (o hook o troca em todo processo de teste); a lógica que importa
  está em `criarJulgarPar`, provada por `juiz-jev-adaptador`. O que sobra aqui o G4 lê no diff.

> **Emenda 2026-11-10 (braço direito):** o `await import("./<módulo do #42>.js")` acima caiu. O
> cliente é `hooks/jev.js` (CJS), e o `juizJev.ts` fica assim, dentro do mesmo `try`, com o mesmo
> `catch`:
>
> 1. **Resolver o caminho**, na ordem do contrato do #42: primeiro
>    `join(<raiz do brain-mcp>, "..", "hooks", "jev.js")`, com a raiz =
>    `join(dirname(fileURLToPath(import.meta.url)), "..")` a partir de `dist/` (o layout do repo e da
>    worktree). Se não existir, `join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"),
>    "hooks", "jev.js")` (o layout da instalação). Nenhum dos dois existe → `null`, sem log de erro.
> 2. **Carregar** com `createRequire(import.meta.url)(caminho)`. Os tipos ficam numa `interface` local
>    (`ModuloJev`: `ligado(uso)` e `decidir(estado, perguntas, opcoes)`), sem importar tipo do #42.
> 3. **Ligar** ao `ClienteJev`:
>    - `ligado: () => jev.ligado("lembrar")`;
>    - `perguntar: async (texto) => { const r = (await jev.decidir(texto, { contradiz: { tipo: "noul",
>      instrucao: PERGUNTA_CONTRADICAO } }, { uso: "lembrar", timeoutMs: prazoJulgamentoMs() }))?.contradiz;
>      return r?.estado === "ok" && r.tipo === "noul" ? { resposta: "sim", probabilidade: r.probabilidade } : null; }`.
>      `PERGUNTA_CONTRADICAO` é a última frase de `montarPergunta`, literal: `"A decisão nova contradiz a
>      decisão anterior, isto é, as duas não podem valer ao mesmo tempo?"`. O `signal` não é repassado,
>      porque o contrato não o aceita.
>
> Isto é o máximo que a ponte faz: resolver o caminho, desembrulhar a chave `contradiz` e passar
> P(sim) como a probabilidade de "sim". Qualquer outra lógica continua proibida aqui. O `estado` que
> vai ao Jev é o texto de `montarPergunta`, que só contém os dois `fato` (R6 intacto).

### `brain-mcp/src/tools.ts` (handler do `lembrar`, 546-566)

- Imports: `import { julgarContradicoes, formatarAviso } from "./contradicao.js";` e
  `import { obterJulgarPar } from "./juizJev.js";`.
- Depois de `vigia.agendar("decisao");` (558) e no lugar do bloco `const aviso = ...` (559-565):

  ```ts
  // O julgamento roda DEPOIS da gravação: a decisão nunca espera o Jev, e nada daqui pode virar
  // erro da tool — a linha já está no banco, e um erro faria quem chamou gravar de novo.
  let marcas: Map<number, number> | null = null;
  try {
    const julgar = relacionadas.length ? await obterJulgarPar() : null;
    marcas = await julgarContradicoes(args.fato, relacionadas, julgar);
  } catch (err) {
    console.error("[brain] contradicao: aviso sem marca:", (err as Error).message);
  }
  const aviso = formatarAviso(relacionadas, marcas);
  ```
- O `return` (566), o `inputSchema` e a `description` da tool **não mudam** (o `tools/list` fica igual
  com a flag desligada ou ligada). O diff de `tools.ts` fica restrito aos imports e a este bloco.

### `brain-mcp/src/memoria.ts`

- Linha 37: `const LIMIAR_MESMO_ASSUNTO` passa a `export const` (o script de medição usa o mesmo número).
- Comentário de `decisoesRelacionadas` (60-64) passa a ser exatamente:

  ```ts
  /**
   * Decisões anteriores que falam do mesmo assunto. Esta função NÃO afirma que há contradição —
   * julgar isso aqui seria chute com cara de certeza. Traz os candidatos com a semelhança medida
   * para quem está escrevendo decidir se substitui ou convive. Com o Jev ligado (#42),
   * `contradicao.ts` anota as que ele julga contradição provável; é anotação para quem chama, não
   * veredito: a tool nunca recusa nem preenche o `supersede`.
   */
  ```
- Nada mais muda em `memoria.ts`.

### `brain-mcp/scripts/jev-falso.mjs` (novo)

Substituto de `dist/juizJev.js` nos testes, no molde de `embeddings-falso.mjs` (cabeçalho explicando
por que existe e o que não enfraquece). Exporta `async function obterJulgarPar()`, lendo o ambiente
**a cada chamada**:

| `BRAIN_JEV_FALSO` | `obterJulgarPar()` resolve |
|---|---|
| ausente ou `desligado` | `null` |
| `ligado` | juiz que, após `setTimeout` de 10 ms, devolve o número de `[p=<n>]` no `par.anterior` (regex `/\[p=(0(?:\.\d+)?|1(?:\.0+)?)\]/`) ou `0.05` sem marcador |
| `erro` | juiz que rejeita com `new Error("jev falso: erro de propósito")` |
| `lento` | juiz que **ignora o `signal`** e resolve `0.99` após 60 000 ms, com o timer `unref()` |

Com `BRAIN_JEV_FALSO_REGISTRO=<arquivo>`, todo juiz, antes do comportamento acima, faz
`appendFileSync(arquivo, JSON.stringify({ pid: process.pid, par }) + "\n")`, com `par` sendo o objeto
recebido inteiro (é o que prova R6 e a contagem de chamadas). Não escreve em stdout.

### `brain-mcp/scripts/embeddings-falso-hook.mjs`

O `resolve` (`:14-26`) passa a trocar também `r.url.endsWith("/dist/juizJev.js")` por
`scripts/jev-falso.mjs` (mesma técnica, a URL do falso embutida no mesmo `data:` URL). Cabeçalho ganha
o porquê: todo processo que os testes sobem com este hook fica incapaz de alcançar o Jev real,
qualquer que seja a flag no ambiente de quem roda. O nome do arquivo não muda (`concorrencia.mjs:25`).

### `brain-mcp/scripts/contradicao.mjs` (novo) e `package.json`

`package.json`: `"contradicao": "node scripts/contradicao.mjs"`.

Script de medição do critério 4. Só leitura: tira `tirarSnapshot(dbPath)` (import de `./eval.mjs`;
`dbPath` de `dist/config.js`), mede no snapshot e apaga o snapshot no `finally`; o processo termina
**sempre** com `process.exit(codigo)` no fim do `finally`, no molde de `eval.mjs:755-776` (um cliente
que não honra o `AbortSignal` não pode segurar o processo vivo).

1. Amostra de **decisões novas**, do snapshot, com `embedding IS NOT NULL`, sendo `M` = `--max-novas`
   (inteiro positivo; padrão `40`, e qualquer outro valor vira `40`):
   - positivas: até `M` com `supersede IS NOT NULL`, `ORDER BY id DESC`;
   - neutras: até `M` com `supersede IS NULL` e ao menos uma vizinha pela regra do passo 2,
     `ORDER BY id DESC`.
2. Vizinhas de cada nova `n`, reproduzindo `decisoesRelacionadas` no passado: as 300 decisões `a` de
   maior `ts` com `a.id < n.id` e `(n.escopo IS NULL OR a.escopo = n.escopo OR a.escopo IS NULL)`
   (o `LIMIT 300` de `memoria.ts:74`); delas, as com `embedding` não nulo e cosseno
   (`cosseno`/`deBlob` de `dist/embeddings.js`) do embedding de `n` com o de `a` ≥
   `LIMIAR_MESMO_ASSUNTO`, ordenadas por cosseno decrescente, as 5 primeiras. Cada uma vira um
   `DecisaoRelacionada` (`{ id, data, escopo, fato, semelhanca }`, `memoria.ts:29-35`). Limitações
   impressas no relatório: o embedding gravado de `n` é o do seu `fato` (o mesmo que o `lembrar`
   calculou), mas o `supersedida_por` de cada `a` no momento da gravação não é recuperável e é ignorado.
3. Sem `--enviar`, ou com `obterJulgarPar()` (de `dist/juizJev.js`) resolvendo `null`: imprime
   `não enviei nada: <motivo>` e `mandaria <P> pares de <K> decisões novas (só o campo fato)` e sai `2`.
4. Com os dois: para cada nova com vizinhas, `julgarContradicoes(n.fato, vizinhas, julgar)` (o mesmo
   código do `lembrar`, com o prazo padrão), cronometrado com `performance.now()`. Imprime exatamente:

   ```
   decisões novas: <K> (<Kp> com substituição, <Kn> sem) · pares julgados: <P> · sem julgamento (erro ou prazo): <F>
   substituições na lista: <S> · marcadas (acertos): <A> · não marcadas (perdidas): <S-A> · fora da lista: <X>
   marcas sem substituição (teto das inventadas): <I> de <P-S> pares
   latência somada ao lembrar (ms): p50 <..> · p95 <..> · máx <..>
   limitação: "inventada" é teto — o rótulo é a falta de supersede, e há contradição que ninguém registrou
   limitação: supersedida_por no momento de cada gravação não é recuperável e foi ignorado
   ```
   Contagens:
   - `K`, `Kp`, `Kn`: a amostra do passo 1. Nova positiva **sem nenhuma vizinha** não é julgada (não
     chama o juiz, não entra em `F` nem em `P`) e conta em `X`.
   - `F`: novas com vizinhas cujo `julgarContradicoes` devolveu `null`. Não contam em mais nada.
   - Sobre as demais (julgadas): `P` = pares julgados; `S` = positivas em que a decisão `a` com
     `a.id = n.supersede` está entre as vizinhas; `A` = dessas, quantas têm `a.id` no `Map`;
     `X` = positivas julgadas em que `a` não está entre as vizinhas, somadas às positivas sem vizinha
     (o Jev nunca as veria); `I` = entradas do `Map` que não são `n.supersede`.
   - Latência: tempo de cada `julgarContradicoes` das julgadas; percentil por posto mais próximo,
     arredondado para inteiro; sem nenhuma julgada, os três valores saem `-`.

   Sai `0`.
5. Qualquer exceção → mensagem no stderr e sai `2`. O script não tem código `1`: não é portão.

Volume máximo enviado numa rodada com o padrão: até 80 decisões novas × 5 vizinhas = até 400 pares, ou
seja, o `fato` de até 80 decisões novas e de até 400 vizinhas.

### `brain-mcp/README.md`

- `## Memória ativa` (106-109): o parágrafo passa a dizer que a **busca** não afirma contradição, e um
  parágrafo novo diz que, com a flag do Jev ligada (#42), cada vizinha da lista é julgada ("a nova
  contradiz esta?") e a provável contradição sai marcada com a probabilidade — anotação, não veredito;
  o julgamento roda depois da gravação, com prazo, e qualquer falha devolve a lista de hoje; só o
  `fato` da nova e o da vizinha saem para a TypeSafe AI, **inclusive decisões sem escopo de outro
  workspace** (a lista inclui as sem escopo).
- `## Comandos`: `npm run contradicao -- --enviar   # critério 4 do #46: mede a marca do Jev em substituições conhecidas (manda fatos à TypeSafe AI)`.
- Variáveis de ambiente: `BRAIN_CONTRADICAO_PRAZO_MS` (prazo do julgamento no `lembrar`, padrão 4000).

## File Change Summary

| Arquivo | Mudança |
|---|---|
| `brain-mcp/src/contradicao.ts` | novo — pergunta, limiar, prazo, `criarJulgarPar`, `julgarContradicoes`, `formatarAviso` |
| `brain-mcp/src/juizJev.ts` | novo — `obterJulgarPar()`, única ponte com o cliente do #42, import dinâmico |
| `brain-mcp/src/tools.ts` | `lembrar` julga depois da gravação e formata o aviso por `formatarAviso` |
| `brain-mcp/src/memoria.ts` | exporta `LIMIAR_MESMO_ASSUNTO`; comentário de `decisoesRelacionadas` |
| `brain-mcp/scripts/jev-falso.mjs` | novo — Jev falso por `BRAIN_JEV_FALSO` |
| `brain-mcp/scripts/embeddings-falso-hook.mjs` | também troca `/dist/juizJev.js` pelo falso |
| `brain-mcp/scripts/contradicao.mjs` | novo — medição do critério 4 sobre snapshot |
| `brain-mcp/scripts/concorrencia.mjs` | os 13 casos do `## Plano de testes` |
| `brain-mcp/package.json` | script `contradicao` |
| `brain-mcp/README.md` | `## Memória ativa`, `## Comandos`, variável de ambiente |

## Migrations & compatibilidade
N/A — nenhuma coluna, tabela, arquivo ou formato novo: `decisoes` (`db.ts:102-116`), o `.md` do cofre e
o `gm:decisao` ficam como estão (R5). O texto devolvido ganha a marca só com a flag ligada e ninguém o
parseia (premissa medida). Por que isto não é "superfície pública das tools" no sentido do CLAUDE.md
(`## A esteira`, item 1): `inputSchema` e `description` não mudam e o retorno é texto livre que ganha
uma anotação aditiva atrás de flag — o G1 pesou exatamente isso (#1376). Com o `dist/` do #42 sem o
#46, nada muda; com o #46 e a flag desligada, também não.

## Rollback
Desligar a flag do #42 volta o `lembrar` ao comportamento de hoje sem deploy (R1); se a flag for
variável de ambiente, vale a partir da próxima sessão MCP (D5). Reverter a PR remove o código; não há
dado a desfazer, porque nada novo foi gravado em disco.

## Verificação pós-deploy
Não é a obrigatória do delta 1 (não muda dado nem formato em disco), mas roda na 🧪 Validação em Dev,
com Leonardo, depois do `sync.sh push` e do `npm run build` na instalação:
1. Flag desligada: a próxima decisão real gravada pelo `lembrar` sai com o aviso no formato de hoje, e
   o stderr do servidor não tem linha `[brain] contradicao:`.
2. Só depois do aval (chave e autorização): `npm run contradicao -- --enviar` na instalação; os
   números entram na PR do trem como o critério 4. Sem aval, o critério 4 fica registrado como não
   medido, com o motivo.

## Plano de testes

Tudo em `brain-mcp/scripts/concorrencia.mjs` (`npm run concorrencia`), sem framework, com `caso(...)`.

- **Unidade** = importa `dist/contradicao.js` no próprio processo. Caso que mexe em `process.env` ou
  registra listener restaura o valor original e remove o listener no `finally` (`subirServidor` herda
  `...process.env`, `concorrencia.mjs:139`).
- **Servidor** = `subirServidor` (já com o hook, que agora também troca o juiz) numa
  `criarFixture(nome, {}, { comDecisoes: true })`, chamadas por `chamarCru`. `envExtra` **sempre**
  traz `BRAIN_JEV_FALSO` explícito (`desligado` no caso desligado) e
  `BRAIN_JEV_FALSO_REGISTRO = join(fx.dir, "jev-falso.log")` (não é o `fx.registro`, que é do stub de
  embeddings). Escopo `freio` (a fixture tem `github.repos: []`, nada é publicado em card).
- **Fatos dos casos de servidor**: cada um é uma frase só, de ≥ 20 palavras (de preferência
  distintas) e ≤ 110 caracteres (o título do `.md` é a frase inteira); A1, A2 e B diferem **duas a duas
  em uma palavra entre as cinco primeiras** (o nome do `.md` sai dos 60 primeiros caracteres do slug;
  palavra diferente depois disso faria um sobrescrever o arquivo do outro). O caso afirma primeiro que
  as vizinhas esperadas estão na lista e só depois a marca.
- **`<hoje>`** = `new Date().toISOString().slice(0, 10)` (UTC, como `memoria.ts:56-58`).
- **Semelhança esperada** `s` = `cosseno(embutirFalso([fatoB])[0], embutirFalso([fatoA])[0]).toFixed(2)`,
  com `cosseno` de `embeddings-falso.mjs` (é o mesmo stub que o servidor usa).
- **R4 em cada caso de servidor**: `!r.falhou`; `SELECT supersede FROM decisoes WHERE id = <B>` é
  `NULL`; `supersedida_por` de toda vizinha listada é `NULL`.

| Caso | Tipo | Prova | O que afirma |
|---|---|---|---|
| `contradicao-sem-juiz-nao-julga` | unidade | R1 | `julgar = null` → `null`; vizinhas `[]` com juiz contador → `null` e 0 chamadas |
| `contradicao-marca-so-acima-do-limiar` | unidade | R2, R6 | juiz devolve 0.91 / 0.70 / 0.69 / 0.2 para 4 vizinhas → `Map` só com as de 0.91 e 0.70; 4 chamadas; cada par tem exatamente as chaves `nova` e `anterior`, com os dois `fato`; 7 vizinhas → 5 chamadas |
| `contradicao-falha-volta-ao-aviso-de-hoje` | unidade | R3 | um par rejeita e os outros resolvem → `null`; juiz com `throw` síncrono → `null`; valores `1.7`, `-0.1`, `NaN`, `"0.9"` → `null` |
| `contradicao-prazo-estoura` | unidade | R3 | juiz que nunca resolve e ignora o sinal, `prazoMs = 100` → `null` em < 1000 ms e `signal.aborted === true`; guarda de regressão: juiz que rejeita 200 ms depois do prazo → nenhum `unhandledRejection` (listener contando, espera de 300 ms, removido no `finally`) |
| `juiz-jev-adaptador` | unidade | R2, R3, R6 | `criarJulgarPar` com `ClienteJev` falso: `ligado` → `false` → `null`; `ligado` que lança → `null` sem rejeitar; `ligado` assíncrono `true` → função; `{sim, 0.8}` → 0.8; `{"não", 0.8}` → 0.2 (com tolerância de 1e-9); `null` → rejeita; `{"Sim", 0.9}`, `{"nao", 0.9}`, `{sim, 1.5}` → rejeita; o texto recebido por `perguntar` é `=== montarPergunta(par)` e o `signal` recebido é o passado |
| `aviso-sem-marca-igual-ao-de-hoje` | unidade | R1 | `formatarAviso(v, null)` e `formatarAviso(v, new Map())` são iguais a um **literal escrito no teste**, cujo cabeçalho é cópia caractere a caractere de `tools.ts:560-561` em `origin/dev` (uma vizinha com escopo, uma sem); `formatarAviso([], null) === ""` |
| `aviso-com-marca-muda-so-a-linha-marcada` | unidade | R2 | com `Map([[id1, 0.934]])`, a linha de `id1` ganha ` [contradição provável, Jev 0.93]` antes do `:`, e cabeçalho e outra linha são iguais ao literal |
| `montar-pergunta-e-prazo` | unidade | R6, R3 | `montarPergunta` igual ao literal da spec; `prazoJulgamentoMs()` com env ausente, `"250"`, `"0"`, `"-5"`, `"abc"`, `"2.5"` → 4000, 250, 4000, 4000, 4000, 4000; env restaurado no `finally` |
| `lembrar-com-jev-desligado-fica-como-hoje` | servidor | R1, R4 | `desligado`: grava A, depois B; o texto inteiro da resposta de B é igual a `` `Registrado como #${idB} em ${pathB}` `` + cabeçalho literal + `` `  #${idA} (${hoje}, freio, semelhança ${s}): ${fatoA}` `` (`idB`/`pathB` lidos da tabela); o registro do falso não existe |
| `lembrar-com-jev-falso-marca-a-contradicao` | servidor | R2, R4, R5, R6 | `ligado`: grava A1 (com `[p=0.93]`) e A2, depois B; linha de A1 com a marca 0.93, linha de A2 sem marca e igual ao formato de hoje; no registro, as linhas com `par.nova === fatoB` são exatamente 2 (uma com o fato de A1, outra com o de A2), e todo `par` do registro tem só as chaves `nova`/`anterior`; o `.md` de B (caminho lido de `doc_path`) é igual ao literal `` `---\ndata: ${hoje}\ntipo: decisao\nescopo: freio\n---\n\n# ${fatoB}\n\n${fatoB}\n` `` |
| `lembrar-com-jev-em-erro-grava-e-avisa-como-hoje` | servidor | R3, R4 | `erro`: grava A, depois B; texto da resposta de B igual ao do caso desligado (mesma construção); linha e `.md` de B existem; o registro tem 1 linha com `par.nova === fatoB` |
| `lembrar-com-jev-lento-respeita-o-prazo` | servidor | R3, R4 | `lento` + `BRAIN_CONTRADICAO_PRAZO_MS=300`: resposta de B em < 5 s desde a chamada, sem marca; linha de B existe; servidor vivo 1 s depois (`s.vivo`) e responde um `search_context` sem `falhou` |
| `contradicao-mede-com-jev-falso` | script | R7 | banco de fixture (`openDb(fx.db)` cria o esquema) com decisões inseridas direto (`ts` crescente, `escopo` `freio`, embeddings de `embutirFalso` pelo `paraBlob`), na ordem de id: A (tema X, com `[p=0.9]`), C (tema X), D (tema Y, com `[p=0.8]`), N1 (tema X, sem marcador, `supersede = id de A`), N2 (tema Y, sem marcador, sem substituição). Os temas X e Y não têm palavra em comum (os marcadores dividem os tokens `p` e `0`, mas N1 e N2 não têm marcador); os fatos de cada tema seguem a regra dos casos de servidor; o caso confere, pelo próprio `cosseno` do stub, que N1×A, N1×C e N2×D ficam ≥ 0,82 e os cruzados < 0,82 antes de rodar o script. Três rodadas, cada uma com o seu arquivo de registro: (1) `ligado` sem `--enviar` → código 2, `não enviei nada` e registro inexistente; (2) `desligado` com `--enviar` → código 2 e registro inexistente; (3) `ligado`, `--enviar`, `--max-novas 1` (amostra = N1 e N2) → código 0 e as linhas `decisões novas: 2 (1 com substituição, 1 sem) · pares julgados: 3 · sem julgamento (erro ou prazo): 0`, `substituições na lista: 1 · marcadas (acertos): 1 · não marcadas (perdidas): 0 · fora da lista: 0` e `marcas sem substituição (teto das inventadas): 1 de 2 pares`. Em todas: a contagem de `decisoes` do banco de origem não muda e o conjunto de diretórios `brain-eval-*` em `tmpdir()` é o mesmo antes e depois |

O script sobe com `spawnSync(process.execPath, ["--import", hookStub, join(root, "scripts", "contradicao.mjs"), ...args], { cwd: root, env: { ...process.env, BRAIN_DB, BRAIN_CONFIG, BRAIN_JEV_FALSO, BRAIN_JEV_FALSO_REGISTRO }, encoding: "utf8" })`.

O predicado "ligado" do #42 (flag ausente, sem chave) é provado pelos testes do #42; aqui se prova que
`obterJulgarPar()` resolvendo `null` ⇒ comportamento de hoje, que a conversão do cliente é a de D2, e
que nenhum processo de teste alcança o Jev real.

Fora do `concorrencia`: `npm run smoke` não muda e continua sem chamar o `lembrar`; ele sobe o servidor
real, o que prova que o boot não depende do módulo do #42 (import dinâmico). `npm run eval -- --base origin/dev`
prova que a busca não mudou (nenhum arquivo da busca é tocado). Critério 4: `npm run contradicao -- --enviar`
só depois do aval.

## Technical Decisions

- **Julgar depois de gravar** (#1397). A decisão nunca espera o Jev nem depende dele; uma sessão que
  morre durante o julgamento já gravou. Descartado: julgar antes, junto com `decisoesRelacionadas`
  (somaria a latência do Jev à gravação e abriria a janela em que a sessão morre sem gravar).
- **Tudo ou nada** (#1397). Qualquer par com falha, valor inválido ou prazo vencido devolve o aviso de
  hoje inteiro, como o critério 2 diz. Descartado: marcar as que vieram e calar as que falharam (uma
  vizinha sem marca passaria por "o Jev disse que não" quando ele nem respondeu).
- **Limiar 0,70, prazo 4000 ms, teto 5 pares em paralelo** (#1397). 0,70 porque 0,5 é cara ou coroa e a
  marca precisa ganhar do ruído de "mesmo assunto" (G1 #1376); o número é provisório até o critério 4.
  4000 ms porque o `lembrar` já paga o embedding e a latência do Jev é número do fornecedor, não
  medido. Teto 5 = o tamanho da lista de hoje, reafirmado no `contradicao.ts` para que ampliar a lista
  não aumente sozinho o que sai do cofre. Descartado: julgar em série (latência ×5).
- **Só o `fato` sai** (#1397). Descartado: mandar `porque`/`alternativas` (mais contexto, mais cofre
  fora, sem autorização).
- **Fronteira fina com o #42 e Jev falso por hook de resolução** (#1398, revista em #1413). A lógica do
  adaptador (`criarJulgarPar`, conversão sim/não, falhas) fica em `contradicao.ts`, testada; o
  `juizJev.ts` só liga nomes e importa o #42 sob demanda, para que o boot e a flag desligada não
  dependam do módulo do #42. Resposta fora de `"sim"`/`"não"` é falha, não palpite. Descartado: falso
  no nível HTTP (dependeria do protocolo do cliente do #42); importar o #42 direto de `tools.ts`; o
  adaptador inteiro dentro do `juizJev.ts` (ficaria sem teste, porque o hook o troca).
- **Superfície da tool intocada** (#1398). `description` e `inputSchema` iguais; a marca se explica no
  próprio texto. Descartado: mencionar o Jev na `description` (mudaria o `tools/list` com a flag
  desligada).
- **Script de medição com dois portões** (#1398). Flag do #42 **e** `--enviar`, porque uma rodada manda
  o `fato` de até 80 decisões novas e 400 vizinhas à TypeSafe AI. Descartado: deixar o critério 4 sem
  ferramenta (quem recebesse o aval teria de escrevê-la).

## Coding Standards
- Português nos nomes, comentários e mensagens, no tom dos arquivos vizinhos; comentário diz o porquê.
- Testes no `concorrencia.mjs`, sem framework novo (`concorrencia.mjs:1-2`).
- `console.error` com o prefixo `[brain]` para diagnóstico; nada em stdout no servidor; o texto da
  tool só muda onde R2 diz.
- Nada além do especificado: sem cache de julgamentos, sem configuração no `brain.config.json`, sem
  mexer em `registrarDecisao`, `publicarDecisaoNoCard`, `decisoesRelacionadas` (exceto o `export` do
  limiar e o comentário), na busca ou no `smoke.mjs`.
