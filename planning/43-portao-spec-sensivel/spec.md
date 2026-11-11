# gm-spec: o Jev decide junto se a spec é sensível, e incerto exige o revisor independente — Spec

Profundidade: **Lite** (cofre #1391). Rota do card: **Curta**, mantida — não há tool nova no MCP, nada
em `brain-mcp/src/` nem em `hooks/`, e nenhum dos formatos em disco do item 1 de `## A esteira`
(índice, `conversations.json`, decisões) muda.

## References
- Card: [#43](https://github.com/leonardo-amaral-3/claude-brain/issues/43) — repo `leonardo-amaral-3/claude-brain`
- Cliente do Jev: [#42](https://github.com/leonardo-amaral-3/claude-brain/issues/42) (dono do cliente, da flag e da chave)
- Decisões (cofre, escopo `claude-brain#43`): G1 #1381 · fail-closed #1375 · empilhamento #1387 ·
  desta spec #1391, #1392, #1393, #1404 (substitui #1394), #1405, #1406
- PRD: não há

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir `claude-brain/` no workspace `pessoal`)
- Worktree: `~/pessoal/claude-brain-43-portao-spec-sensivel`
- Feature branch: `feat/43-portao-spec-sensivel`
- Base branch: **`feat/42-filtro-jev`, quando ela tiver o contrato do cliente** (cofre #1387). O braço
  direito rebaseia esta branch sobre ela antes do `/gm-implement`. A PR do #43 aponta para
  `feat/42-filtro-jev` enquanto a PR do #42 estiver aberta, e para a `dev` depois que ela entrar.
- **O #43 não cria cliente do Jev**, nem flag nem leitura de chave do Jev. Ele consome o cliente do
  #42 por uma única função adaptadora (`carregarJev`). O que ele cria de próprio é o opt-in de
  **mandar texto de spec** (cofre #1404), que só deixa o portão mais estrito.
- **Ordem das tasks:** as que não tocam o cliente (regra de decisão, registro, CLI, texto da skill,
  docs, teste) não dependem do #42. A task da fronteira (`carregarJev`) só começa com o contrato do
  #42 publicado (`gm:spec` no card #42; seção do contrato em `planning/42-*/spec.md`). Contrato que
  não atende R1–R4 de `### Fronteira com o cliente do #42` é **desvio** (PARADA no `/gm-implement`).
- **A PR só abre com a fronteira ligada ao contrato publicado** (cofre #1406), nunca com o stub que
  devolve `null`: o critério 3 do card ("usa o cliente do #42") não fecha com ele.

## Requisitos & critérios de aceite

As quatro categorias sensíveis são as da norma: **dado, faturamento, deploy, migration**. Os motivos
que podem disparar o revisor, com o id da saída e o rótulo que a sessão lê:
`autor` → `autor` · `jev-sim` → `Jev sim` · `confianca-baixa` → `confiança baixa` ·
`jev-indisponivel` → `Jev indisponível`.

- **CA1 — regra "qualquer condição vale", fechada por inversão.** Uma categoria só fica **limpa**
  quando o autor disse `nao` **e** o Jev respondeu `nao` válido com confiança finita ≥ **0,90**.
  Qualquer outra coisa gera motivo: autor diferente de `nao` → `autor`; Jev `sim` (qualquer
  confiança) → `jev-sim`; Jev `nao` abaixo de 0,90 → `confianca-baixa`; qualquer outro estado do Jev
  (cliente ausente, opt-in desligado, flag desligada, sem chave, erro, tempo esgotado, resposta
  inválida, spec acima do limite, valor faltando) → `jev-indisponivel`. A spec é sensível se alguma
  categoria não está limpa. O Jev nunca dispensa o que o autor marcou.
- **CA2 — motivo registrado, sem a sessão compor o texto.** O script devolve o campo `linha`, já
  pronto — `Spec sensível: sim — <motivos>` ou `Spec sensível: não` — e a sessão a copia **verbatim**
  na mensagem do gate (ou na resposta final, em modo despachado), seguida do `sha256` curto da versão
  classificada.
- **CA3 — o mesmo critério decide as duas exigências.** Sensível ⇒ o revisor de IA independente roda
  e, em workspace com segundo humano, a pergunta `2º revisor` é feita. Não sensível ⇒ nenhum dos dois
  é **exigido** (rodar o revisor por vontade do humano ou do argumento continua permitido).
- **CA4 — sem chave, fail-closed, sem API.** No estado desta máquina (sem opt-in, sem chave, sem
  cliente instalado), com o autor dizendo `nao` nas quatro, o script devolve `sensivel: true` com
  `jev-indisponivel` nas quatro, a linha `Spec sensível: sim — Jev indisponível (as quatro)`, e nada
  sai da máquina. Provado pelo teste, sem rede; a parte "o revisor roda" é conferida no G4.
- **CA5 — falha do próprio script é indisponível.** `node` ausente, comando morto pelo timeout,
  código diferente de 0 e de 2, ou stdout que não é uma linha JSON do contrato → a sessão trata como
  sensível, escreve a linha fixa `Spec sensível: sim — Jev indisponível (as quatro)` e diz o que
  falhou. Código 2 é erro de uso: corrigir e rodar de novo.
- **CA6 — um cliente só.** `skills/gm-spec/sensivel.mjs` não faz rede nem processo por conta própria
  (regex do teste estático em `## Plano de testes`) e só fala com o Jev por `carregarJev`.
  `node scripts/skills-comum.mjs --check` sai com código 0.
- **CA7 — `deploy` incluído onde a skill e os docs listam as categorias**: a Fase 4 de
  `skills/gm-spec/SKILL.md`, `docs/esteira-gm.md` e `templates/CLAUDE.example.md` trazem a lista das
  quatro, e as listas de três somem.
- **CA9 — o veredito só cresce.** O script grava cada rodada em `sensibilidade.json` ao lado do
  `spec.md` e devolve a união: uma categoria com motivo em qualquer rodada anterior continua com ele.
  Spec sensível não volta a não sensível, nem com outro `--autor`, nem rodando de novo, nem noutra
  sessão. A sessão só roda de novo com código 2 ou com o `spec.md` mudado; e o revisor roda de novo
  quando a rodada traz `novos` não vazio depois de ele já ter rodado.
- **CA10 — opt-in próprio para mandar spec.** Sem `<CLAUDE_HOME>/gm-spec-jev.json` contendo
  `{"enviarSpecAoJev": true}`, o script não importa o cliente nem chama `perguntar`; as quatro ficam
  `jev-indisponivel` com motivo `envio de spec ao Jev não autorizado nesta máquina`.
- **CA8 — com a API de verdade (depende do aval do Leonardo: chave, opt-in e autorização para mandar
  texto de spec à TypeSafe AI; não bloqueia a PR).** Uma spec sensível conhecida e uma não sensível
  conhecida recebem as respostas do Jev registradas. Fica em `## Verificação pós-deploy`.

## Premissas medidas

Todas medidas em 2026-11-10, nesta sessão, na worktree em `3c3b92c` (= `origin/dev`).

| Premissa | Prova | Resultado |
|---|---|---|
| A Fase 4 cita três categorias, sem `deploy` | `sed -n 185,240p skills/gm-spec/SKILL.md` | `:203` "data, faturamento rules or migrations"; `:208` "<dado · regra de faturamento · migration>"; `:216` "(data, faturamento, migration)" |
| A norma lista quatro | `sed -n 70,95p ~/notoria/CLAUDE.md` (o `fluxo-gm-desenvolvimento.md` não existe nesta máquina: `find ~/notoria -maxdepth 3 -name 'fluxo-gm*'` vazio) | `~/notoria/CLAUDE.md:79-80`: "Spec que toca **dado, faturamento, deploy ou migration**" (norma de 2026-09-14) |
| Docs e template repetem as três | `grep -rn sensív docs templates`; `sed -n 86,88p templates/CLAUDE.example.md` | `docs/esteira-gm.md:88`; `templates/CLAUDE.example.md:86-87` (a lista quebra a linha entre `faturamento,` e `migration)`) |
| O doc diverge da skill sobre quando o revisor roda | `docs/esteira-gm.md:88-90` × `SKILL.md:224` | doc: "se não há segundo humano, ou se você escolhe seguir sem ele"; skill: "It runs in both answers of the *2º revisor* call" |
| Arquivo novo na pasta da skill chega à instalação | `sync.sh:81-84`, `sync.ps1:131-132`, `install.sh:98`, `install.ps1:124-125` | os quatro copiam `skills/<nome>/` inteira |
| `sync.sh push` não apaga na instalação o que sumiu do repo | `sync.sh:216` | "nao existe na origem, pulado" |
| A sessão sabe onde a skill está instalada | o prompt desta sessão, ao carregar a `gm-spec` | o Claude Code injeta "Base directory for this skill: /home/leo/.claude/skills/gm-spec" |
| O `--check` só lê `SKILL.md` | `scripts/skills-comum.mjs:93-104` | itera `skills/gm-*/SKILL.md`; outro arquivo na pasta não entra |
| O `--check` está verde na base | `node scripts/skills-comum.mjs --check` | "11 skills × 3 blocos iguais à fonte", código 0 |
| `sensibilidade.json` não entra no índice como doc | `brain-mcp/src/indexer.ts:126-131` | root que não é `code` só indexa `.md` |
| Não existe cliente, chave nem menção ao Jev hoje | `grep -ril 'jev\|typesafe' hooks brain-mcp/src skills scripts docs templates` | nenhum arquivo (código 1) |
| O contrato do #42 ainda não existe | `git worktree list`; `ls planning` em `~/pessoal/claude-brain-42-filtro-jev`; `gh issue view 42` | worktree em `3c3b92c`, sem `planning/42-*`; o card fixa só a forma: pergunta + trecho(s) → sim/não com probabilidade, ou "indisponível"; flag explícita desligada por padrão; mesmo cliente para hook e `brain-mcp`; orçamento "bem abaixo do `timeout: 10` do hook" |
| Spec real pode ter dezenas de KB | `wc -c planning/1-escritor-unico-do-indice/spec.md` | 46.668 bytes (esta spec: 36.978) |
| Nenhuma skill embarca script hoje | `ls skills/*/` | só `SKILL.md` (e `_comum/convencoes.md`) |
| Node e padrão de teste do repo | `node --version`; `scripts/skills-comum-teste.mjs` | v26.12.0; script `.mjs` que sai 0/1, sem framework |

O caminho do módulo do cliente, a semântica da probabilidade, o orçamento e o limite de tamanho **não**
são premissas: são requisitos ao contrato do #42 (R1–R4), conferidos no `/gm-implement`.

## Technical Overview

A decisão sai do julgamento livre da sessão e vai para um script ao lado da skill,
`skills/gm-spec/sensivel.mjs`. A sessão passa a sua classificação das quatro categorias por
argumento; o script lê o `spec.md` do disco, faz ao Jev quatro perguntas fixas pelo cliente do #42
(só com o opt-in de envio ligado), aplica a regra invertida de CA1, une com as rodadas anteriores
gravadas em `sensibilidade.json` e imprime uma linha JSON com o veredito e a `linha` pronta. A skill
lê `sensivel`, `novos` e `linha` e decide o `2º revisor` e o revisor independente. Toda falha cai
para "sensível".

O script não sabe falar com a TypeSafe AI: o único contato é `carregarJev()`, que devolve o cliente
do #42 adaptado à forma de que o #43 precisa, ou `null`. Nesta máquina, hoje, o resultado é
`Jev indisponível` nas quatro — e é isso que o teste prova, sem rede.

## Implementation Details

### `skills/gm-spec/sensivel.mjs` (novo, ESM, só `node:` builtins)

Cabeçalho: comentário curto com o porquê (o autor não julga sozinho o próprio portão; fail-closed;
o Jev só acrescenta; cofre #1375, #1404, #1405) e o uso.

**Constantes exportadas**

```js
export const CATEGORIAS = ["dado", "faturamento", "deploy", "migration"];
export const LIMIAR = 0.9;          // confiança mínima de um "não" do Jev; cofre #1393
export const ORCAMENTO_MS = 20000;  // teto de carregar o cliente + as quatro perguntas
export const PERGUNTAS = {
  dado: "A mudança descrita nesta spec altera dados já gravados, o formato em que são gravados, ou como dados existentes são lidos, tratados ou apagados?",
  faturamento: "A mudança descrita nesta spec altera uma regra de faturamento: o que é cobrado, calculado, validado ou enviado como produção faturável?",
  deploy: "A mudança descrita nesta spec altera como o sistema é implantado: infraestrutura, configuração de ambiente, pipeline de deploy ou o processo de instalação?",
  migration: "A mudança descrita nesta spec inclui uma migration: mudança de schema, de formato em disco, ou script que converte dados existentes?",
};
export const MOTIVOS = ["autor", "jev-sim", "confianca-baixa", "jev-indisponivel"]; // ordem fixa
export const ROTULOS = { "autor": "autor", "jev-sim": "Jev sim", "confianca-baixa": "confiança baixa", "jev-indisponivel": "Jev indisponível" };
export const OPT_IN = "gm-spec-jev.json";      // em <CLAUDE_HOME>; conteúdo {"enviarSpecAoJev": true}
export const REGISTRO = "sensibilidade.json";  // ao lado do spec.md
```

**Tipos (JSDoc)**

```js
/** @typedef {{estado:"ok", resposta:"sim"|"nao", confianca:number} | {estado:"indisponivel", motivo:string}} RespostaJev */
/** @typedef {{perguntar:(pergunta:string, trecho:string)=>Promise<unknown>, cabe?:(trecho:string)=>boolean, origem:string}} Jev */
```

`origem` é o caminho absoluto do módulo do cliente carregado.

**Funções exportadas**

- `optInLigado(claudeHome): boolean` — lê `<claudeHome>/gm-spec-jev.json`; `true` só se o arquivo
  existe, é JSON e `enviarSpecAoJev === true` (estrito). Qualquer erro → `false`. `claudeHome` vem de
  `process.env.CLAUDE_CONFIG_DIR || join(os.homedir(), ".claude")`, como `hooks/brain-config.js`.
- `async carregarJev(): Promise<Jev|null>` — **a fronteira com o #42** (seção abaixo). Nunca lança:
  qualquer erro ao localizar ou importar → `null`. O `import()` usa `pathToFileURL(caminho).href`.
- `normalizar(bruta: unknown): RespostaJev` — aceita só `{estado:"ok", resposta:"sim"|"nao",
  confianca: número finito em [0,1]}` ou `{estado:"indisponivel", motivo: string}`. Outra coisa →
  `{estado:"indisponivel", motivo:"resposta inválida"}`.
- `async classificar({texto, carregar = carregarJev, optIn, orcamentoMs = ORCAMENTO_MS})` →
  `{jev: Record<categoria, RespostaJev>, cliente: string|null}`. Um único temporizador de
  `orcamentoMs` cobre tudo abaixo e é limpo (`clearTimeout`) no fim:
  1. `optIn !== true` → as quatro `indisponivel`, motivo `"envio de spec ao Jev não autorizado
     nesta máquina"`, **sem chamar `carregar`**; `cliente: null`.
     > **Emenda (2026-11-11), achado 8 do G4 da PR #53, autorizada pelo braço direito (cofre #1617).**
     > Era `optIn === false`: quem chamasse `classificar` sem `optIn` carregava o cliente e mandava a
     > spec, e o fail-closed do CA10 só valia pelo CLI. Agora só o literal `true` liga; o teste prova
     > que, sem `optIn`, o `carregar` espião não é chamado. Nenhum critério de aceite muda.
  2. `await carregar()` em corrida com o temporizador. `null` → motivo `"cliente do Jev não
     encontrado"`; estouro → `"tempo esgotado ao carregar o cliente"`. `cliente = jev.origem`.
  3. `jev.cabe` definido e `jev.cabe(texto) === false` → as quatro `indisponivel`, motivo `"spec maior
     que o limite do cliente"`, **sem chamar `perguntar`** e sem truncar.
  4. As quatro `jev.perguntar(PERGUNTAS[c], texto)` correm em paralelo, cada uma embrulhada em
     `Promise.resolve().then(() => jev.perguntar(...))` (throw síncrono vira rejeição), em corrida com
     o temporizador: não resolveu → `"tempo esgotado"`; rejeitou → `"erro do cliente (<error.name>)"`
     — **só o `name`**, nunca a `message` (pode trazer chave ou texto do corpus para o card público);
     resolveu → `normalizar`.
  - `texto` vai **inteiro e sem alteração** a cada chamada.
  - Durante os passos 2–4, `console.log`, `console.info`, `console.debug` e `process.stdout.write`
    apontam para o stderr; o script guarda o `process.stdout.write` original antes e o restaura só
    para escrever a linha final. Assim, log do cliente nunca corrompe a saída.
- `decidir({autor, jev, limiar = LIMIAR})` → `{categorias, motivos, sensivel}`. Para cada `c` de
  `CATEGORIAS`, motivos da categoria, nesta ordem e sem repetição:
  - `autor` se `autor?.[c] !== "nao"`;
  - sobre `j = normalizar(jev?.[c])`: `jev-sim` se `j.estado === "ok" && j.resposta === "sim"`;
    `confianca-baixa` se `j.estado === "ok" && j.resposta === "nao" && !(j.confianca >= limiar)`;
    `jev-indisponivel` se `j.estado !== "ok"`.
  - `0.9` exato não é baixa. `motivos` do topo = união, na ordem de `MOTIVOS`. `sensivel =
    motivos.length > 0`. `categorias[c] = {autor: autor?.[c] ?? null, jev: j, motivos}`.
- `unir(anterior, atual)` → para cada categoria, motivos = união (na ordem de `MOTIVOS`) dos da
  `uniao` anterior e dos atuais; devolve também `novos`: lista `"<motivo>:<categoria>"` dos pares
  **`autor` ou `jev-sim`** que aparecem agora e não estavam na união anterior.
- `montarLinha(motivosPorCategoria)` → `Spec sensível: não` quando nenhuma categoria tem motivo;
  senão `Spec sensível: sim — ` + os motivos na ordem de `MOTIVOS`, cada um como
  `<ROTULOS[m]> (<categorias na ordem de CATEGORIAS, unidas por ", ">)` ou `<ROTULOS[m]> (as quatro)`
  quando são as quatro, unidos por `"; "`. Ex.: `Spec sensível: sim — autor (dado); Jev indisponível (as quatro)`.

**Registro `sensibilidade.json`** (ao lado do `spec.md`; UTF-8, `JSON.stringify(_, null, 2)` + `\n`):

```json
{
  "rodadas": [
    {"data": "2026-11-10T21:00:00.000Z", "sha256": "<hex do spec.md lido>", "autor": {"dado":"nao","faturamento":"nao","deploy":"nao","migration":"nao"},
     "cliente": null, "categorias": {"dado": {"motivos": ["jev-indisponivel"], "jev": {"estado":"indisponivel","motivo":"..."}}, "...": {}}}
  ],
  "uniao": {"dado": ["jev-indisponivel"], "faturamento": ["jev-indisponivel"], "deploy": ["jev-indisponivel"], "migration": ["jev-indisponivel"]}
}
```

- Ausente → anterior vazio. Existe mas não é JSON, ou não tem `rodadas` array e `uniao` objeto, ou
  alguma das quatro categorias da `uniao` não é um array só de motivos de `MOTIVOS` →
  código **2**, mensagem `sensibilidade.json ilegível — não apague nem edite à mão; mostre ao humano`
  (a skill trata como ambiente quebrado: em modo despachado, PARADA).
  > **Correção (2026-11-11), achado 5 do G4 da PR #53.** A conferência de cada entrada da `uniao`
  > entrou agora: antes, `uniao.dado = "autor"` (uma string) ou um motivo desconhecido era descartado
  > em silêncio na união, e a spec podia voltar a `Spec sensível: não` sem sair com código 2.
- Escrito depois da decisão e **antes** de imprimir; falha ao escrever → código 2 com a mensagem do
  sistema. Nada de texto da spec vai para ele (só sha, autor, motivos e os motivos fixos do Jev).

**CLI** (`main` só quando o arquivo é o ponto de entrada: `realpathSync(process.argv[1])` comparado
com `realpathSync(fileURLToPath(import.meta.url))`, para link simbólico e para o teste poder importar):

```
node "<Base directory da skill>/sensivel.mjs" --spec <caminho do spec.md> --autor dado=nao,faturamento=nao,deploy=nao,migration=nao
```

- Argumentos: exatamente um `--spec` e um `--autor`; `--autor` com as quatro categorias, cada uma uma
  vez, valor `sim` ou `nao`. Argumento desconhecido, repetido, posicional, categoria faltando,
  repetida ou desconhecida, valor fora de `sim|nao` → mensagem em pt-BR no stderr, **nada** no
  stdout, código **2**.
- `--spec`: o nome do arquivo tem de ser `spec.md`; ilegível, vazio ou só espaços em branco → código 2.
- Caminho feliz: lê o arquivo, `sha256` do conteúdo, `classificar` (com `optIn = optInLigado(...)`),
  `decidir`, lê o registro, `unir`, grava o registro, e escreve **uma** linha JSON no stdout, código
  **0** (o código não diz o veredito):

```json
{"sensivel":true,"motivos":["jev-indisponivel"],"novos":[],"linha":"Spec sensível: sim — Jev indisponível (as quatro)","spec":"/abs/planning/43-x/spec.md","bytes":12345,"sha256":"<hex>","cliente":null,"optIn":false,"limiar":0.9,"categorias":{"dado":{"autor":"nao","jev":{"estado":"indisponivel","motivo":"envio de spec ao Jev não autorizado nesta máquina"},"motivos":["jev-indisponivel"]},"faturamento":{},"deploy":{},"migration":{}}}
```

  `sensivel`, `motivos` e `linha` são os da **união**; `categorias[c].motivos` também (o da rodada
  fica no registro).
- Escreve com `process.stdout.write(linha + "\n", () => process.exit(0))`, para o pipe esvaziar
  antes da saída e um handle aberto do cliente não segurar o processo. Exceção não tratada sai com 1,
  que a skill trata como `Jev indisponível` (CA5).

### Fronteira com o cliente do #42

`carregarJev()` é a **única** função que conhece o cliente. O que o #43 precisa do contrato do #42
(faltando R1, R2 ou R4, é desvio → PARADA no `/gm-implement`):

- **R1 — alcançável de um processo Node avulso.** O módulo pode ser importado de um script que não é
  o hook nem o servidor MCP, por um caminho resolvível a partir da instalação (`<CLAUDE_HOME>` ou o
  `args[0]` do `mcpServers.brain` em `~/.claude.json`, como `sync.sh:67-76`). `carregarJev` resolve
  pelo caminho que o contrato declarar, nunca pela posição do script no repo; ausente → `null`.

  > **Correção (2026-11-11), achado 7 do G4 da PR #53.** Carrega com
  > `createRequire(import.meta.url)(caminho)`, como o contrato do #42 fixa para skills com script (o
  > `import()` de antes divergia dele). Arquivo ausente → `null` → `cliente do Jev não encontrado`;
  > presente mas que não carrega ou sem `decidir`/`MAX_ESTADO` → `carregarJev` rejeita →
  > `falhou ao carregar o cliente (<name do erro>)`. Os dois seguem fail-closed. O cenário citado no
  > achado (jev.js sob um `package.json` com `"type":"module"`) falha com os dois carregadores; o que
  > a correção muda é a mensagem, que deixa de dizer que o arquivo não existe.
- **R2 — uma pergunta e um trecho → sim/não com probabilidade, ou indisponível.** O contrato diz o
  que a probabilidade é. Confiança na resposta dada → `confianca = p`. P(sim) → `resposta = p >= 0.5
  ? "sim" : "nao"` e `confianca = max(p, 1 - p)`. O contrato não diz → desvio.
- **R3 — flag e chave são do cliente.** Flag desligada ou chave ausente → o cliente responde
  indisponível (fixado no G1 do #42). O #43 não lê flag nem chave do Jev.
- **R4 — tamanho.** O contrato declara se há limite e em que unidade, e se trunca. O adaptador
  expõe `cabe(texto)`: em caracteres → `texto.length <= limite`; em bytes →
  `Buffer.byteLength(texto) <= limite`; em tokens → `texto.length <= limite` (conservador: um token
  tem ao menos um caractere). Sem limite → `cabe` indefinido. **Truncar sem declarar é desvio.**
- **Orçamento por chamada:** se o contrato aceita orçamento do chamador, o adaptador passa
  `ORCAMENTO_MS`. Se não aceita, vale o padrão do cliente e spec grande pode sair sempre `tempo
  esgotado` (sensível): não é desvio, é limitação registrada na PR (cofre #1406).

Até a branch do #42 existir, `carregarJev` devolve `null` com o comentário `// ligado ao contrato do
#42 na task da fronteira` — é o estado que as tasks anteriores testam, e não o da PR.

### `skills/gm-spec/SKILL.md` — Fase 4

Substituir os parágrafos `**Sensitive change first.**` e `**Independent AI reviewer.**`
(`SKILL.md:203-220`) por um passo de classificação seguido das consequências. Instrução em inglês,
como o resto do arquivo; o que o humano lê, em pt-BR. Conteúdo obrigatório, nesta ordem:

1. **`**Classify first: is this spec sensitive?**`** — sensível é tocar qualquer das quatro
   categorias da norma: **data, faturamento, deploy, migration** (em pt-BR, nas mensagens: dado,
   faturamento, deploy, migration). O autor não decide sozinho:
   a. Com o `spec.md` salvo (o do card, `planning/<n>-<slug>/spec.md`; para épico, o da pasta do
      épico), a sessão decide a **sua** classificação das quatro, sim/não cada.
   b. Roda, **exatamente neste molde, sem prefixo de variável de ambiente, sem `cd` e com timeout de
      60 s no Bash**: `node "<Base directory for this skill>/sensivel.mjs" --spec <caminho> --autor
      dado=<sim|nao>,faturamento=<sim|nao>,deploy=<sim|nao>,migration=<sim|nao>`.
   c. Código 2 → corrigir os argumentos e rodar de novo (se a mensagem é a do `sensibilidade.json`
      ilegível: parar e mostrar ao humano; em modo despachado, PARADA). `node` ausente, timeout,
      outro código, ou stdout que não é uma linha JSON → sensível, com a linha fixa
      `Spec sensível: sim — Jev indisponível (as quatro)`, dizendo o que falhou.
   d. Copia `linha` **verbatim** na resposta, seguida de `(sha <12 primeiros de sha256>, cliente
      <cliente ou "nenhum">)`. Em modo despachado, essa linha vai na resposta final.
   e. A regra, para quem lê a skill: sensível quando vale qualquer uma — o autor disse sim, o Jev
      disse sim, o Jev disse não com confiança abaixo do limiar do script, ou o Jev não respondeu.
      O Jev só acrescenta a exigência, nunca a dispensa. Sem chave ou sem o opt-in de envio, toda
      spec é sensível — o fail-closed, consequência aceita.
   f. **Rodar de novo só** com código 2 ou com o `spec.md` mudado. O veredito é o da união que o
      script devolve: uma spec sensível não volta a não sensível. Nunca apagar nem editar o
      `sensibilidade.json`.
2. **`2º revisor`** — mesma pergunta de hoje, disparada por `sensivel: true`. A primeira linha do
   texto em pt-BR passa a `> Esta spec foi classificada como sensível (<linha sem o prefixo "Spec
   sensível: sim — ">). A norma recomenda um segundo humano com prazo de 24h, e quem decide se a
   espera vale é você.` As opções e o "workspace sem segundo humano pula em uma linha" não mudam.
3. **Independent AI reviewer** — exigido com `sensivel: true`: roda nas duas respostas do
   `2º revisor`, ou direto quando o workspace declara não ter segundo humano. Trocar o parêntese
   "(data, faturamento, migration)" pela referência ao passo 1. `How it runs:` (`SKILL.md:222-228`)
   fica como está.
4. `sensivel: false` → a linha do passo 1d e uma frase: nem a pergunta nem o revisor são exigidos;
   segue para `**Then the spec itself.**`.
5. **Reescrita até a publicação.** Se o `spec.md` muda depois de uma rodada e antes de o comentário
   `gm:spec` ser publicado (achados do revisor aplicados, *Ajustar* da Fase 4 ou da Fase 5), a sessão
   roda o passo 1 de novo sobre o arquivo novo. Se a saída passa a `sensivel: true` e o revisor ainda
   não rodou, rodam a pergunta e o revisor (passos 2–3) antes do gate. Se o revisor já rodou e
   `novos` não está vazio, ele roda de novo sobre a versão nova; com `novos` vazio, não.

Nada muda nas seções carimbadas (`## Como perguntar e como aprovar`, `## Convenções de saída`,
`## Modo despachado`): a linha "Segundo revisor de spec sensível" continua verdadeira.

### Docs

- `docs/esteira-gm.md:88-92` — reescrever o parágrafo: spec sensível é a que toca **dado,
  faturamento, deploy ou migration**, e quem decide é a regra do `sensivel.mjs` (o autor ou o Jev
  dizendo sim, a confiança baixa ou o Jev indisponível; o Jev só acrescenta; sem chave ou sem o
  opt-in de envio, toda spec é sensível). O revisor independente roda **em toda spec sensível** —
  nas duas respostas do `2º revisor`, ou direto quando não há segundo humano. Uma frase sobre o
  opt-in: `~/.claude/gm-spec-jev.json` com `{"enviarSpecAoJev": true}` autoriza mandar o texto da
  spec ao Jev nesta máquina; desligado por padrão.
- `templates/CLAUDE.example.md:86-88` — "(dado, faturamento, migration)" → "(dado, faturamento,
  deploy, migration)" (a troca atravessa a quebra de linha), e "Com `não`, o `/gm-spec` dispara um
  revisor…" → "O `/gm-spec` dispara um revisor de IA independente em toda spec sensível; com `não`,
  ele é o único olhar além do seu antes do G2."
- `CLAUDE.md` (do repo), `## A esteira` item 3 — acrescentar: mudou `skills/gm-spec/sensivel.mjs`? a
  suíte inclui também `node scripts/gm-spec-sensivel-teste.mjs`; código 1 é vermelho.

## File Change Summary

| Arquivo | Mudança |
|---|---|
| `skills/gm-spec/sensivel.mjs` | **novo** — constantes, `optInLigado`, `carregarJev`, `normalizar`, `classificar`, `decidir`, `unir`, `montarLinha`, CLI |
| `skills/gm-spec/SKILL.md` | Fase 4: passo de classificação com as quatro categorias; `2º revisor` e revisor dependem de `sensivel`; reescrita reclassifica |
| `scripts/gm-spec-sensivel-teste.mjs` | **novo** — teste sem rede (padrão de `skills-comum-teste.mjs`: sai 0/1) |
| `docs/esteira-gm.md` | parágrafo da spec sensível: quatro categorias, a regra, o opt-in, quando o revisor roda |
| `templates/CLAUDE.example.md` | `deploy` na lista; revisor em toda spec sensível |
| `CLAUDE.md` | item 3 de `## A esteira` cita o teste novo |

Nenhum arquivo em `brain-mcp/` nem em `hooks/`. O `sensibilidade.json` nasce em cada pasta de
planning quando a `/gm-spec` roda, não nesta PR (a do #43 terá o seu, gerado na próxima rodada).

## Migrations & compatibilidade
N/A para dado: nada existente é convertido. O `sensibilidade.json` é arquivo novo por pasta de
planning, criado sob demanda; ausente = sem rodadas anteriores. Instalação com a `SKILL.md` nova e
sem o `sensivel.mjs` (cópia parcial) cai no CA5 → sensível. Sem o cliente do #42 ou sem opt-in →
`Jev indisponível` → sensível. O portão só fica mais estrito, nunca mais frouxo.

## Rollback
Reverter o commit da PR na `dev`, rodar `./sync.sh push` e **`rm ~/.claude/skills/gm-spec/sensivel.mjs`**
— o push pula arquivo que sumiu da origem (`sync.sh:216`), e sem o `rm` o próximo `pull` o traz de
volta ao repo. Os dois últimos passos são na instalação viva: de Leonardo. Os `sensibilidade.json`
que ficarem nas pastas de planning são inertes.

## Verificação pós-deploy
Depois do `./sync.sh push` (Leonardo), sem rede, numa cópia (o script grava o registro ao lado):
1. `d=$(mktemp -d) && cp ~/pessoal/claude-brain/planning/29-limpeza-skills/spec.md "$d/" && node ~/.claude/skills/gm-spec/sensivel.mjs --spec "$d/spec.md" --autor dado=nao,faturamento=nao,deploy=nao,migration=nao`
   → `"sensivel":true`, `"linha":"Spec sensível: sim — Jev indisponível (as quatro)"`, `"optIn":false`.
2. A próxima `/gm-spec` real traz essa linha com o sha e roda o revisor independente.
3. **Pendente do aval do Leonardo (CA8):** com chave, flag do #42, opt-in deste card e autorização
   para mandar texto de spec à TypeSafe AI, rodar o comando 1 com uma cópia de uma spec sensível
   conhecida (`planning/1-escritor-unico-do-indice/spec.md`, muda o índice) e de uma não sensível
   conhecida (`planning/29-limpeza-skills/spec.md`), e colar as duas saídas no card. Não bloqueia a PR.

## Plano de testes

`scripts/gm-spec-sensivel-teste.mjs` importa `skills/gm-spec/sensivel.mjs` e roda sem rede, tudo em
diretório temporário; sai 0 se tudo passa, 1 se algo falha.

| Caso | Prova |
|---|---|
| `decidir`: autor `nao` ×4, Jev `nao` 0,95 ×4 → `sensivel:false`, `motivos:[]` | CA1 |
| `decidir`: autor `dado=sim`, Jev `nao` 0,99 ×4 → `["autor"]` (o Jev não dispensa) | CA1 |
| `decidir`: Jev `deploy` `sim` 0,60 → `["jev-sim"]` | CA1, CA7 |
| `decidir`: Jev `migration` `nao` 0,89 → `["confianca-baixa"]`; `nao` 0,90 → não sensível | limiar e borda |
| `decidir`: Jev `faturamento` indisponível → `["jev-indisponivel"]` | CA1 |
| `decidir` fail-open: autor `undefined`, `"Sim"`, `"não"`; `autor` sem a chave `deploy`; `jev` sem a chave `dado`; `confianca: NaN`; `jev` inteiro `undefined` → motivo em cada categoria afetada (`autor` ou `jev-indisponivel`) | CA1 (inversão) |
| `decidir`: autor sim + Jev indisponível → `["autor","jev-indisponivel"]`, nessa ordem | CA2 |
| `montarLinha`: o exemplo de `autor (dado); Jev indisponível (as quatro)`, `Spec sensível: não`, e duas categorias `confiança baixa (faturamento, migration)` — string exata | CA2 |
| `classificar` com Jev falso que grava as chamadas → exatamente as quatro `PERGUNTAS`, e o trecho de cada chamada é igual, byte a byte, ao texto | o que vai ao Jev |
| `classificar` com `optIn:false`, sem `optIn`, com `"true"` e com `1` (emenda de 2026-11-11), e `carregar` espião → quatro `indisponivel` com o motivo do opt-in, `carregar` **não** chamado | CA10 |
| `classificar` com `carregar` que devolve `null` → quatro `cliente do Jev não encontrado` | CA4 |
| `classificar` com `carregar` que nunca resolve e `orcamentoMs: 50` → `tempo esgotado ao carregar o cliente`, e o teste termina | CA5 |
| `classificar` com `perguntar` que lança síncrono, e que rejeita com `message` contendo `"sk-segredo"` → `erro do cliente (Error)`, e `"sk-segredo"` não aparece na saída | CA1, não vaza |
| `classificar` com `perguntar` que nunca resolve e `orcamentoMs: 50` → `tempo esgotado` | CA1 |
| `classificar` com `{resposta:"talvez"}` e `{estado:"ok",resposta:"nao",confianca:1.5}` → `resposta inválida` | CA1 |
| `classificar` com `cabe: () => false` → quatro `spec maior que o limite do cliente`, `perguntar` **não** chamado | não truncar |
| `classificar` com `perguntar` que faz `console.log` e `process.stdout.write` → nada disso no stdout capturado (vai ao stderr) | saída limpa |
| `unir`: anterior com `autor` em `dado`, atual limpo → `dado` continua com `autor`, `novos:[]`; atual com `jev-sim` em `deploy` novo → `novos:["jev-sim:deploy"]`; `jev-indisponivel` novo não entra em `novos` | CA9 |
| CLI sem opt-in: copiar só o `sensivel.mjs` para um temporário, `env = {PATH, HOME:<tmp>, CLAUDE_CONFIG_DIR:<tmp>}`, spec fixture inócua em `<tmp>/p/spec.md`, autor `nao` ×4 → código 0, uma linha JSON, `sensivel:true`, `linha` = `Spec sensível: sim — Jev indisponível (as quatro)`, `optIn:false`, `cliente:null`, `sha256` igual ao do arquivo, e `<tmp>/p/sensibilidade.json` com uma rodada | CA4, CA2 |
| CLI com opt-in ligado em `<tmp>/gm-spec-jev.json` e o mesmo ambiente → motivo `cliente do Jev não encontrado`, `optIn:true`, ainda sensível | CA10, CA4 |
| CLI duas rodadas: a 1ª com `--autor dado=sim,...`, a 2ª com `nao` ×4 → a 2ª ainda tem `autor (dado)` na `linha` e o registro tem duas rodadas | CA9 |
| CLI com `sensibilidade.json` corrompido → código 2, stdout vazio | registro |
| CLI com `--autor` incompleto, valor `talvez`, categoria repetida, `--autor` repetido, argumento posicional, `--spec` inexistente, `--spec` vazio, `--spec` que não se chama `spec.md` → código 2, stdout vazio | CA5 (uso) |
| CLI por link simbólico para o `sensivel.mjs` → roda o `main` (código 0, uma linha JSON) | ponto de entrada |
| Estático: o fonte de `sensivel.mjs` não casa `/fetch\s*\(\|XMLHttpRequest\|WebSocket\|undici\|["'](node:)?(http\|https\|http2\|net\|tls\|dgram\|child_process)["']/`, e só tem `import(` dentro de `carregarJev` | CA6 |
| `node scripts/skills-comum.mjs --check` → código 0 | CA6 |
| Strings: a Fase 4 contém `data, faturamento, deploy, migration`; `docs/esteira-gm.md` contém `dado, faturamento, deploy ou migration`; o template, com espaços normalizados, contém `(dado, faturamento, deploy, migration)`; e somem dos três `data, faturamento rules or migrations`, `(data, faturamento, migration)` e `(dado, faturamento, migration)` | CA7 |

Portão do `/gm-ship` (precondição 4): `node scripts/skills-comum.mjs --check` (item 3 de
`## A esteira`) e `node scripts/gm-spec-sensivel-teste.mjs`. Sem código em `brain-mcp/src/`, então
`npm run smoke` e `npm run eval` **não** se aplicam. Conferidos na revisão (G4), contra esta seção:
CA3, a parte de skill do CA4 e do CA5 (o molde do comando, o timeout, a linha fixa), o CA9 na Fase 4
(passos 1f e 5) e que `carregarJev` resolve o caminho que o contrato do #42 declara (o `cliente` da
saída). CA8 fica em `## Verificação pós-deploy`.

## Technical Decisions

- **Script ao lado da skill, não tool no MCP** (#1391). Descartados: tool nova (Completa por algo que
  só a `gm-spec` usa); chamar um CLI do #42 direto do markdown (depende do que o #42 não decidiu e
  deixa a regra sem teste).
- **O que vai ao Jev: o `spec.md` inteiro, lido do disco pelo script** (#1392). Resumo da sessão traz
  de volta o viés do autor; acima do limite, indisponível em vez de truncar.
- **Limiar 0,90 na confiança de um "não"; "sim" conta em qualquer confiança** (#1393). Custos
  assimétricos e sem dado para calibrar; constante única.
- **Opt-in próprio para mandar spec; flag e chave do Jev ficam no #42; sem Jev falso por env; o
  `cliente` carregado sai na saída** (#1404, que substitui #1394). Ligar o filtro do hook não pode
  passar a mandar specs. O opt-in desligado só deixa o portão mais estrito. O `cliente` e o molde sem
  prefixo de env fecham o atalho de trocar `CLAUDE_CONFIG_DIR` para carregar um módulo falso.
  Descartados: só a flag do #42; opt-in por env; chave no `brain-workspaces.json`.
- **Regra invertida, registro e união no script, `linha` pronta** (#1405). Achados ALTO/MÉDIO do
  revisor: casamento exato deixava valor inesperado passar; rodar de novo até o Jev sair favorável;
  veredito perdido entre sessões; a sessão compondo o texto do motivo. Descartados: monotonia só no
  markdown; veredito dentro do `spec.md` (mudaria o sha); ler do card.
- **A PR só abre com a fronteira ligada; orçamento por chamada e limite em tokens não são desvio;
  truncar calado é** (#1406).
- **A classificação do autor entra por argumento antes de ele ver a saída do Jev**; na união, mudar
  o `--autor` depois não tira nada.
- **Código de saída não carrega o veredito** (0 com qualquer veredito; 2 uso): qualquer outro código
  é inequivocamente falha, e falha é sensível.
- **O teste novo entra no item 3 do `CLAUDE.md`**: sem isso, a próxima mudança no `sensivel.mjs` não
  teria portão escrito.
- **Consequência aceita no G1, com o efeito escrito:** sem chave (ou sem opt-in), toda `/gm-spec` é
  sensível. Num workspace com segundo humano, isso faz a pergunta `2º revisor` em toda spec; numa
  sessão despachada ali, a linha "Segundo revisor de spec sensível" do `## Modo despachado` (**para**,
  salvo autorização por nome) faz toda `/gm-spec` despachada parar nela. Nenhum workspace desta
  máquina tem segundo humano hoje (`~/notoria/CLAUDE.md:79`; delta 1 do `CLAUDE.md` do `pessoal`):
  o efeito hoje é só o revisor independente em toda spec.
- **Fora do escopo:** reclassificar em emenda durante a implementação (protocolo de desvio do
  `gm-implement`, emenda pós-tasks) — card próprio; a sensibilidade do trem no `gm-release`
  (outra regra).
- Esclarecimento, não mudança: a skill já manda o revisor rodar "nas duas respostas" do
  `2º revisor` (`SKILL.md:224`); o texto novo e o doc passam a dizer isso uma vez, a partir de
  `sensivel`.

## Coding Standards

- `.mjs` ESM, só módulos `node:`; sem dependência nova; comentários em pt-BR com o porquê, como em
  `scripts/skills-comum.mjs`.
- Mensagens ao humano em pt-BR; instrução da `SKILL.md` em inglês, como o resto do arquivo.
- Nunca editar as seções carimbadas da `SKILL.md`; rodar o `--check` antes de declarar pronto.
- Nada além do especificado: nenhuma mudança em `brain-mcp/`, `hooks/`, `gm-release` ou nas outras
  skills.
