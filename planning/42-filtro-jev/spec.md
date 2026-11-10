# Filtro do Jev no contexto que o hook injeta, e o cliente único do Jev — Spec

## References
- Card: [#42](https://github.com/leonardo-amaral-3/claude-brain/issues/42) — repo `leonardo-amaral-3/claude-brain`
- G1: comentário `gm:decisao` do card, cofre #1384. Mandato "assuma": cofre #1379. Desenho: cofre #1400 e as decisões do G2 em `## Technical Decisions`.
- Irmãos que consomem o contrato (não são duplicata): [#41](https://github.com/leonardo-amaral-3/claude-brain/issues/41) gm-triage · [#43](https://github.com/leonardo-amaral-3/claude-brain/issues/43) gm-spec · [#44](https://github.com/leonardo-amaral-3/claude-brain/issues/44) PARADA · [#45](https://github.com/leonardo-amaral-3/claude-brain/issues/45) roteador de source · [#46](https://github.com/leonardo-amaral-3/claude-brain/issues/46) freio do `lembrar`
- Documentação pública da TypeSafe AI lida em 2026-11-10. Nenhum trecho do corpus foi enviado e a API não foi chamada. Páginas: `https://docs.typesafe.ai/introduction/quickstart.md`, `/api/system-one.md`, `/api/errors.md`, `/primitives.md`, `/cookbooks/classifying_rag_passages.md`
- PRD: não há

## Execution
- Repo: `leonardo-amaral-3/claude-brain`. Working dir: **só** a worktree `/home/leo/pessoal/claude-brain-42-filtro-jev`.
- Base branch: `dev` (a branch saiu de `origin/dev` 3c3b92c).
- Feature branch: `feat/42-filtro-jev`. É nela que #41, #43, #44, #45 e #46 empilham a implementação.
- Profundidade: **Lite**, com o contrato escrito por inteiro. Rota do board: Curta.
- **Ambiente (precisa ser provido antes do `/gm-ship`, fora dele):**
  - O diff toca o pacote `brain-mcp/` (`scripts/` e `package.json`, com `package-lock.json` ao lado), e `skills/gm-ship/SKILL.md:57-60` exige `brain-mcp/node_modules`.
  - Na worktree ela **não existe**. O despachante relatou que o `npm ci` falhou ao compilar o `sharp` (dependência de `@huggingface/transformers`) no Node v26.12.0. A falha não foi reproduzida aqui.
  - Para prover: um symlink `brain-mcp/node_modules -> /home/leo/notoria/claude/brain-mcp/node_modules`. A instalação tem `node_modules` com `sharp`, e o servidor vivo roda no mesmo Node: `/proc/<pid>/exe` = `/home/leo/.local/share/mise/installs/node/26.12.0/bin/node`. O link só lê a instalação.
  - Cuidado: o `.gitignore` tem `brain-mcp/node_modules/`, com barra. Um symlink não é diretório para o git e aparece como *untracked*. Nos commits, os arquivos entram por nome, nunca com `git add -A`/`.`.
  - Quem provê é a orquestradora ou Leonardo. Sem isso, o `/gm-ship` para com `PARADA: ambiente`.
  - O código do #42 em si roda em Node puro (`hooks/*.js`, `brain-mcp/scripts/injecao.mjs`, `brain-mcp/scripts/jev.mjs`). O hook continua importando `db.js`/`search.js` do `dist/` da instalação (`hooks/brain-contexto.js:310-313`).
- **Regra 2 (smoke + eval) não se aplica:** nada em `brain-mcp/src/`. O `eval --base origin/dev` sai 2 já na `origin/dev` porque um negativo do golden apodreceu (cofre #1395, aviso do #45). Essa correção fica com o primeiro card do lote que mexer em `src/` (#45), e não aqui.
- Nunca: chamar a API do Jev, pôr chave em arquivo, `sync.sh push`, escrever em `~/.claude` ou em `~/notoria/claude/brain-mcp`, mexer no checkout principal ou nas worktrees dos irmãos.

## Requisitos & critérios de aceite

**CA1 — Filtro no passo 5.**
- Dado `BRAIN_JEV` contendo `contexto` e o cliente ligado, quando um prompt cai no passo 5 (texto) com candidatos que passam pelo filtro de workspace e pelo piso de tokens, então os até 10 primeiros vão a `jev.julgar`.
- Entram no bloco, **na ordem original do ranking**, só os que ficam com `probabilidade >= limiar`, até 5.
- Quando nenhum passa, a stdout do hook fica vazia: não sai bloco, como já acontece hoje quando não há achado.
- Os passos 1-4 (entidade do grafo) não mudam e não chamam o cliente.

**CA2 — Contrato único.**
- Existe um cliente só, `hooks/jev.js`. O contrato está em `### Contrato do cliente do Jev (estável)` e também no cabeçalho do arquivo.
- O hook o usa por `require('./jev.js')`. O `brain-mcp` e as skills o alcançam pelos caminhos fixados no contrato, sem mudá-lo.
- Entrada: pergunta e trecho(s), ou um estado e perguntas.
- Saída: sim/não com probabilidade, escolha com probabilidades, ou `indisponivel` com motivo.
- Só liga por **uso nomeado** em `BRAIN_JEV`, e vem desligado por padrão.

**CA3 — Sem chave ou com a API fora, nada muda.** A stdout do hook é **byte a byte** a do hook de `origin/dev`, sem esperar mais que 2200 ms além do custo de hoje, quando:
- `BRAIN_JEV` está ausente ou sem `contexto`;
- falta `TYPESAFE_API_KEY` e não há `BRAIN_JEV_FALSO`;
- qualquer trecho volta `indisponivel` (HTTP, rede, resposta inválida, tempo esgotado);
- `hooks/jev.js` está ausente ou quebrado, inclusive uma promessa que nunca resolve.

Com a flag desligada, `node scripts/injecao.mjs --desde 2026-11-03 --ate 2026-11-09 --base origin/dev --portao jev` acha 0 saídas diferentes entre antes e depois no corpus, e portanto a mesma taxa.

**CA4 — Nada sai da máquina por acidente.**
- O cliente só chama `fetch` com o uso ligado em `BRAIN_JEV`, `TYPESAFE_API_KEY` não vazia **e** `BRAIN_JEV_FALSO` **indefinida**. Com `BRAIN_JEV_FALSO` definida, mesmo vazia, nunca chama.
- `injecao.mjs` e `jev.mjs` disparam todo filho com `envSemJev(process.env)`, sem a chave em modo nenhum.
- O `jev.mjs` substitui o próprio `globalThis.fetch` por um que lança.
- A saída do portão não imprime texto do corpus.
- Prova: `scripts/jev.mjs` injeta um `fetch` espião e confere zero chamadas nesses casos.

**CA5 — Medição própria deste card.**
- `injecao.mjs --portao jev` (exige `--desde`, `--ate` e `--base` explícitos) roda duas partes:
  - (a) a igualdade do CA3 no corpus;
  - (b) o `golden.json` com o cliente falso em modo oráculo:
    - (b1) todo documento esperado que o hook de `--base` injeta continua no bloco, e é preciso haver pelo menos 1;
    - (b2) todo slot do bloco filtrado é documento esperado do caso, e os negativos saem sem bloco.
- Códigos de saída: `0` passou, `1` reprovou, `2` não mediu.
- Sem `--portao`, ou com `--portao ca2`, o script se comporta como hoje, inclusive o portão `CA-2`: as constantes em `injecao.mjs:43-44` e o portão em `:478-490`.
- A rodada com o Jev de verdade fica nas pendências.

## Premissas medidas
Todas rodadas em 2026-11-10, nesta sessão, contra a worktree (igual a `origin/dev` 3c3b92c) e contra a instalação e o índice vivo, só leitura.

| # | Premissa | Prova (comando/leitura) | Resultado |
|---|---|---|---|
| P1 | O passo 5 do hook roda `Buscador.buscar(alvo, {}, 24)`, filtra por `daqui` e `relevante` e corta em 5. Os passos 1-4 retornam antes e não passam por esse filtro | leitura de `hooks/brain-contexto.js:348-379` (entidade, com `return fim(...)`) e `:381-433` (passo 5; o corte é `:409`); o guard de argumento curto é `:382` | confirmado |
| P2 | O harness dá 10 s ao hook | `~/.claude/settings.json:31-32` → `"command": "node /home/leo/.claude/hooks/brain-contexto.js"`, `"timeout": 10` | confirmado |
| P3 | O hook instalado é igual ao da worktree | `diff -q ~/.claude/hooks/brain-contexto.js hooks/brain-contexto.js` | iguais |
| P4 | Quanto o hook custa hoje | spawn serial do hook atual para os 82 casos do golden × 2 workspaces (`/tmp/m42/golden-hook.mjs`, fora do repo) | 164 execuções: p50 94 ms, p95 152 ms, máx 218 ms |
| P5 | Base da janela fixa | `node scripts/injecao.mjs --desde 2026-11-03 --ate 2026-11-09 --base origin/dev` | 494 prompts, 295 injetados = 59,7% (entidade 33, texto 262, relevância 95); "byte a byte iguais", rodada única, exit 0, 30 s |
| P6 | O golden não é vazio para o hook: há esperado que o hook injeta hoje | mesmo script de P4: o hook com `cwd` em `~/notoria` e em `~/pessoal`, casando `esperado` por substring do caminho normalizado | 128 de 164 execuções injetam; 10 de 500 slots são esperados (precisão 2,0%); 8 consultas têm o esperado no bloco; os 2 negativos injetam em 3 de 4 execuções |
| P7 | O Node tem `fetch` e `AbortController` | `node --version` → v26.12.0; `node -e "console.log(typeof fetch, typeof AbortSignal.timeout, typeof AbortSignal.any)"` | `function function function`. O prazo **não** usa `AbortSignal.timeout` (o timer dele não segura o event loop, achado do revisor); usa `AbortController` + `setTimeout` |
| P8 | O servidor MCP herda o ambiente do processo `claude` | `/proc/<pid>/environ` dos 6 processos `brain-mcp/dist/index.js` vivos; `mcpServers.brain.env` em `~/.claude.json` | 207-210 variáveis cada, incluindo `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `OMARCHY_PATH`; `env: {}`. Logo a chave, quando existir, chega também a todo servidor que `eval`/`smoke` sobem com `process.env` (`eval.mjs:469`, `smoke.mjs:7`) |
| P9 | Não há chave nem flag nesta máquina | `env \| grep -E "^(BRAIN_\|TYPESAFE)"` nesta sessão | vazio |
| P10 | O `sync` usa lista fixa de hooks e copia `brain-mcp/scripts/` para a instalação | `sync.sh:87` (`HOOKS_VERSIONADOS=...`), `sync.ps1:136-138`, `sync.sh:94` (`scripts`), `install.sh:99` (`cp -R "$REPO"/hooks/.`) | um hook novo precisa entrar nas duas listas. Na instalação, `<brain-mcp>/../hooks` não existe (`ls -d ~/notoria/claude/hooks` → ausente) |
| P11 | Tamanho dos trechos | `sqlite3 -readonly brain.db "select max(length(text)), avg(length(text)), count(*) from chunks"` | máx 50 237, média 1 884, 41 440 chunks |
| P12 | Campos do resultado do `Buscador` | `brain-mcp/src/search.ts:131` (`full_text`), `:141` (`snip`), `:170-172` | `full_text` = texto do chunk; `breadcrumb`, `path`, `source` |
| P13 | O `golden.json` tem 82 casos (80 positivos, 2 negativos), sem `cwd`, com `esperado` casado por substring de caminho | `python3` sobre `brain-mcp/scripts/golden.json`; `eval.mjs:158` (`norm` + `includes`) | confirmado; 44 casos têm filtros, que o hook não usa |
| P14 | O servidor vivo escreve no índice durante uma rodada | `brain-mcp/src/index.ts:91`, `:141` (`Vigia`, o watcher) | confirmado: duas rodadas seguidas podem ver índices diferentes, e daí o intercalado com repetição no portão |

**Pontos abertos do G2.** Nenhum bloqueia o contrato nem a PR. Cada um diz o que falta.
- **A1 — Formato da API.**
  - O adaptador segue a documentação pública lida em 2026-11-10:
    - `POST https://api.typesafe.ai/v1/systemone` com `Authorization: Bearer`;
    - corpo `{model, state, questions}`;
    - `noul` → `answers[id].noul` ∈ [0,1];
    - `choice` → `answers[id].{choice, confidence, probabilities}`;
    - erros 400/401/413/415/422/429/529.
  - Nada disso foi verificado contra a API, porque não há chave e Leonardo não autorizou enviar corpus.
  - Fica isolado no adaptador.
- **A2 — Limiar 0,5 provisório.** A calibração depende da chave e da autorização (`### Limiar`).
- **A3 — Precisão, latência e limite de taxa reais** são números do fornecedor, **não verificados**. O pior caso são 10 requisições paralelas por prompt. 429 ou lentidão viram `indisponivel`, e o hook volta ao comportamento de hoje.
- **A4 — Retenção de dados na TypeSafe** não aparece nas páginas lidas e entra na decisão de Leonardo sobre o envio. O que sairia está em `### O que sai da máquina`. Um recorte por workspace no hook (ligar só no `pessoal`, por exemplo) não está neste card. Se a autorização vier recortada assim, a mudança fica só no hook e não toca o contrato.
- **A5 — O processo do hook herda a env?** Não foi medido nesta sessão; a herança pelo servidor foi (P8). Se não herdar, a flag fica desligada para o hook, o que é seguro. A prova está no pós-deploy, passo 5.
- **A6 — O Jev com instrução e estado em pt-BR** não foi verificado e entra na calibração.

## Technical Overview
- O cliente do Jev é um arquivo CommonJS sem dependência, `hooks/jev.js`. Fica ao lado do primeiro hook que o usa e é instalado com os outros hooks em `<CLAUDE_HOME>/hooks/`.
- Expõe três funções:
  - `ligado(uso)`;
  - `decidir`: uma requisição, várias perguntas `noul`/`escolha` sobre um estado, que é a primitiva do Jev;
  - `julgar`: uma pergunta e N trechos, com uma requisição por trecho, em paralelo, sob prazo único. É o padrão do cookbook de RAG do fornecedor.
- Também exporta `envSemJev`, para quem dispara processos de teste.
- Nenhuma função lança exceção. Toda falha vira `{estado:'indisponivel', motivo}`.
- Cada consumidor liga só o seu **uso**, numa lista em `BRAIN_JEV`. O cliente falso (`BRAIN_JEV_FALSO`) nunca toca a rede, e uma CLI com envelope JSON serve às skills.
- O hook só faz `require('./jev.js')` com `contexto` em `BRAIN_JEV`. Manda os até 10 candidatos do passo 5 e mantém os que ficam com `probabilidade >= limiar`. Um `indisponivel` em qualquer trecho, ou o prazo do próprio hook vencido, abandona o filtro inteiro.
- O `injecao.mjs` ganha `--portao jev`: igualdade byte a byte no corpus com a flag desligada, e golden com um oráculo falso gerado do `golden.json`.

## Implementation Details

### Contrato do cliente do Jev (estável)
É esta a seção que #41, #43, #44, #45 e #46 citam: `planning/42-filtro-jev/spec.md` § *Contrato do cliente do Jev (estável)*. Mudar qualquer item dela é emenda desta spec. O **adaptador** (URL, modelo, formato do corpo) é interno e muda sem quebrar o contrato.

**Onde mora e como se alcança**
- Fonte: `hooks/jev.js` no repo. Instalado em `<CLAUDE_HOME>/hooks/jev.js`, com `CLAUDE_HOME = $CLAUDE_CONFIG_DIR || ~/.claude` (a mesma regra de `hooks/brain-config.js:24` e `brain-mcp/src/config.ts:61`).
- **Hook** (CJS): `require('./jev.js')`, sempre dentro de `try`, só depois de conferir o uso na env.
- **brain-mcp** (ESM/TS), dentro de `try`, nesta ordem de resolução:
  1. `join(<raiz do pacote brain-mcp>, '..', 'hooks', 'jev.js')`, se existir. É o layout do repo e da worktree, o que permite medir sem instalar. A raiz é `join(dirname(fileURLToPath(import.meta.url)), '..')` a partir de `dist/`.
  2. Senão, `<CLAUDE_HOME>/hooks/jev.js`, o layout da instalação.
  - Carregar com `createRequire(import.meta.url)(caminho)`. Falha ao carregar vale `{estado:'indisponivel', motivo:'desligado'}`. Os tipos ficam numa `interface` local do consumidor.
- **Skills e scripts** (Bash):
  - Comando: `node "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks/jev.js"`, com JSON na stdin e JSON na stdout (ver *CLI*).
  - Os scripts de `brain-mcp/scripts/` usam a ordem de resolução do brain-mcp, com a raiz = `join(dirname(script), '..')`.

**Usos.** Valores fechados. Uso novo é emenda desta spec.

| uso | card |
|---|---|
| `contexto` | #42, o hook `brain-contexto.js` |
| `triagem` | #41 |
| `spec` | #43 |
| `parada` | #44 |
| `roteador` | #45 |
| `lembrar` | #46 |

**Ambiente.** Lido a cada chamada, de `opcoes.env ?? process.env`, e nunca no carregamento do módulo.

| Variável | Papel | Padrão |
|---|---|---|
| `BRAIN_JEV` | lista de usos ligados, separados por vírgula (`contexto,parada`). Cada item passa por `trim()` e minúsculas. Não há curinga: `1`, `*` e `todos` não ligam nada | ausente = tudo desligado |
| `TYPESAFE_API_KEY` | a chave, com o nome que a documentação e os SDKs do fornecedor usam. Nunca no repo, no `brain.config.json` ou no `brain-workspaces.json`: fica no ambiente do processo `claude` | ausente |
| `BRAIN_JEV_FALSO` | cliente falso (ver *Cliente falso*). **Definida, mesmo vazia**, o real nunca roda | indefinida |

Ordem de decisão, por chamada. A primeira que casa vence, para todas as chaves:
1. `opcoes.uso` fora da tabela de usos → `entrada_invalida`.
2. Uso fora de `BRAIN_JEV` → `desligado`.
3. `BRAIN_JEV_FALSO !== undefined` → falso. Vazia vale roteiro ilegível.
4. `TYPESAFE_API_KEY` vazia ou ausente → `sem_chave`.
5. Validação da entrada. Inválida → `entrada_invalida`.
6. O adaptador real.

**Tipos** (JSDoc no arquivo; nomes e valores exatos)
```js
/** @typedef {'contexto'|'triagem'|'spec'|'parada'|'roteador'|'lembrar'} Uso */
/** @typedef {{ id: string, texto: string, titulo?: string, fonte?: string }} Trecho
 *  id: identifica o trecho para quem chama (o hook usa o caminho). NUNCA é enviado ao Jev. */
/** @typedef {{ tipo: 'noul', instrucao: string }
 *          | { tipo: 'escolha', instrucao: string, opcoes: Record<string, string> }} Pergunta
 *  opcoes: nome → descrição, 1 a 255 entradas. */
/** @typedef {'desligado'|'sem_chave'|'timeout'|'http'|'rede'|'resposta_invalida'|'entrada_invalida'} Motivo */
/** @typedef {{ estado: 'ok', tipo: 'noul', sim: boolean, probabilidade: number }} RespostaNoul
 *  probabilidade = P(sim) ∈ [0,1]; sim = probabilidade >= 0.5. O limiar de decisão é de quem chama. */
/** @typedef {{ estado: 'ok', tipo: 'escolha', escolha: string, confianca: number,
 *              probabilidades: Record<string, number> }} RespostaEscolha
 *  escolha ∈ opcoes; probabilidades tem exatamente as chaves de opcoes. */
/** @typedef {{ estado: 'indisponivel', motivo: Motivo, detalhe?: string }} Indisponivel
 *  detalhe: status HTTP ('429') ou frase curta. Nunca contém a chave nem o corpo enviado. */
/** @typedef {{ uso: Uso, timeoutMs?: number, env?: Record<string,string|undefined>,
 *              fetch?: typeof fetch, instrucao?: string }} Opcoes   // uso é OBRIGATÓRIO */
```

**Constantes exportadas:** `TIMEOUT_MS = 2000`, `MAX_TEXTO = 4000`, `MAX_PERGUNTA = 4000`, `MAX_ESTADO = 200000`, `MAX_TRECHOS = 16`, `USOS` (o array da tabela), `INSTRUCAO_PADRAO = 'O trecho é relevante para responder ou executar a pergunta?'`.

**Funções exportadas** (`module.exports = { ligado, decidir, julgar, envSemJev, ...constantes }`)
- `ligado(uso, env?) → boolean`
  - Vale `true` sse o uso está na tabela, está em `BRAIN_JEV`, e `BRAIN_JEV_FALSO !== undefined` ou `TYPESAFE_API_KEY` não vazia.
  - Sem I/O.
- `envSemJev(env) → object`
  - Cópia de `env` sem `TYPESAFE_API_KEY` e sem toda chave que começa com `BRAIN_JEV`.
  - É o que todo script de teste ou medição passa a processo filho que possa carregar o cliente (hook, servidor, CLI). Vale para o `eval`/`smoke` quando #45/#46 os tocarem.
- `decidir(estado, perguntas, opcoes) → Promise<Record<string, RespostaNoul|RespostaEscolha|Indisponivel>>`
  - `estado`: string ou valor JSON. `perguntas`: `Record<id, Pergunta>`, com pelo menos 1.
  - **Uma** requisição. O resultado tem exatamente as chaves de `perguntas`, e o que vale para a requisição inteira vale para todas elas.
  - Entrada inválida → `entrada_invalida` em todas as chaves:
    - `perguntas` vazio;
    - `tipo` desconhecido;
    - `instrucao` que não é string;
    - `opcoes` vazias ou com mais de 255 entradas;
    - `JSON.stringify(estado)` com mais de `MAX_ESTADO` caracteres. O estado **não** é cortado: cortar JSON estruturado não tem regra segura.
  - Se `perguntas` nem for objeto → `{}`.
  - Resposta ausente ou fora do formato → `resposta_invalida` só naquela chave.
- `julgar(pergunta, trechos, opcoes) → Promise<Array<RespostaNoul|Indisponivel>>`
  - Mesmo tamanho e ordem de `trechos`. `trechos` vazio ou que não é array → `[]`.
  - `pergunta` é cortada em `MAX_PERGUNTA` e cada `texto` em `MAX_TEXTO` caracteres antes do envio.
  - Cada trecho vira uma requisição com `estado = { pergunta, trecho: { titulo, fonte, texto } }` e uma pergunta `noul` de chave `relevante`, com instrução `opcoes.instrucao ?? INSTRUCAO_PADRAO`.
  - Os trechos até `MAX_TRECHOS` saem **em paralelo**, sob **um** prazo comum de `timeoutMs`. Os que passam do índice 15 voltam `entrada_invalida`, assim como um trecho com `texto` vazio ou sem `id` string.
- Garantias de `decidir` e `julgar`:
  - nunca rejeitam e nunca lançam exceção;
  - nunca fazem retry;
  - resolvem em até `timeoutMs` + 50 ms;
  - não escrevem nada em stdout nem em stderr;
  - `timeoutMs` ausente, não finito ou ≤ 0 → `TIMEOUT_MS`.
  - O prazo é um `AbortController` + `setTimeout`, limpo em `finally`, para segurar o event loop até resolver e não deixar timer pendurado.

**CLI** (`if (require.main === module)`)
- stdin: `{"op":"decidir","uso":…,"estado":…,"perguntas":{…},"timeoutMs"?:n}` ou `{"op":"julgar","uso":…,"pergunta":"…","trechos":[…],"instrucao"?:"…","timeoutMs"?:n}`.
- stdout: **uma** linha JSON, sempre num envelope:
  - `{"ok":true,"resultado":<o retorno da função>}`;
  - ou `{"ok":false,"motivo":"entrada_invalida"}`, quando a stdin não é JSON ou o `op` é desconhecido.
- Código de saída `0` sempre que o envelope foi escrito.
- **Regra para o consumidor:** stdout que não é JSON, envelope sem `ok`, exit ≠ 0 ou `jev.js` ausente valem `indisponivel` em tudo o que se perguntou. É o que mantém fail-closed o portão do #43.

**Cliente falso** (`BRAIN_JEV_FALSO` definida e uso ligado; nunca chama `fetch`)
- `sim`:
  - `noul` → `probabilidade: 0.95`;
  - `escolha` → a primeira opção com 0,95 e o resto (0,05) dividido igual entre as demais; com uma opção só, 1,0. `confianca === probabilidades[escolha]`.
- `nao`:
  - `noul` → `probabilidade: 0.05`;
  - `escolha` → probabilidades uniformes `1/n`, escolha = a primeira opção, `confianca = 1/n`.
- `indisponivel` → todas as chaves `{estado:'indisponivel', motivo:'rede', detalhe:'falso'}`.
- `lento` → `setTimeout` até o prazo, e `timeout` em todas as chaves.
- Qualquer outro valor, inclusive vazio, é o **caminho de um roteiro JSON**. Ilegível ou inválido → todas as chaves `{estado:'indisponivel', motivo:'resposta_invalida', detalhe:'roteiro'}`. Formato:
  ```json
  { "regras": [ { "quando": { "pergunta": "texto exato", "trechoId": "substring", "id": "chave exata" },
                  "responde": { "probabilidade": 0.9 } } ],
    "padrao": { "probabilidade": 0.05 } }
  ```
- Regras do `quando`:
  - todos os campos são opcionais, e os presentes precisam casar todos;
  - `pergunta`: igualdade com a `pergunta` do `julgar`, ou com o `estado` do `decidir` quando ele é string. Com `estado` não string, a regra **não casa**;
  - `trechoId`: substring do `id` do trecho, com os dois lados em minúsculas e `\` trocado por `/` (a `norm` do `eval.mjs`). No `decidir` a regra **não casa**;
  - `id`: chave da pergunta. No `julgar` é sempre `relevante`.
- Formas do `responde`:
  - `{probabilidade}` para `noul`;
  - `{escolha, confianca?}` para `escolha`. A escolhida leva `confianca`, que vale 0,95 quando omitida; o resto se divide igual entre as demais. `escolha` fora de `opcoes` → `resposta_invalida`;
  - `{indisponivel: <Motivo>}`.
- A primeira regra que casa vence. Sem regra, vale `padrao`. Sem `padrao`, ou com `responde` de tipo errado → `resposta_invalida`.

**Sem chave, nada quebra.** Fora do adaptador real com chave, toda chamada resolve sem I/O de rede. O que fazer com `indisponivel` é de cada consumidor: no #42, voltar ao comportamento de hoje; no #43, contar como incerto (decisão do #43 no cofre).

### hooks/jev.js — adaptador (interno; premissa A1)
- `POST https://api.typesafe.ai/v1/systemone`, com headers `Authorization: Bearer ${TYPESAFE_API_KEY}` e `Content-Type: application/json`, e `signal` = o do `AbortController` da chamada.
- Corpo: `{ model: 'jev-latest', state: estado, questions }`.
  - `noul` → `{type:'noul', instructions: instrucao}`.
  - `escolha` → `{type:'choice', instructions: instrucao, criteria: opcoes}`.
  - As chaves de `questions` são os `id` de `perguntas`. A documentação diz que elas não vão ao modelo.
- `fetch = opcoes.fetch ?? globalThis.fetch`.
- Erros:
  - `res.ok` falso → `{motivo:'http', detalhe: String(res.status)}`;
  - abort pelo prazo → `timeout`;
  - outra rejeição → `rede`;
  - JSON ilegível, ou sem `answers` objeto → `resposta_invalida`.
- Por chave:
  - `noul` exige `answers[id].noul` finito em [0,1];
  - `escolha` exige `choice` ∈ `opcoes`, `confidence` finito em [0,1] e `probabilities` objeto. Ela devolve `confianca = confidence` e `probabilidades` com as chaves de `opcoes` (ausente vira 0).
  - Fora disso → `resposta_invalida`.
- No `julgar`, as requisições compartilham um `AbortController` só.

### hooks/brain-contexto.js — o filtro (CA1, CA3)
Constantes novas, ao lado de `LIMITE_FINAL` (`:233-235`):
```js
const LIMITE_JEV = 10;   // quantos candidatos do passo 5 vao ao Jev
const LIMIAR_JEV = 0.5;  // provisorio: ver ### Limiar da spec do #42
const INSTRUCAO_JEV = 'O trecho é relevante para o que o usuário pediu na pergunta?';
const PRAZO_HOOK_JEV = 2200; // TIMEOUT_MS do cliente + 200: o hook nao confia no prazo de quem chama
// O uso so liga com `contexto` na lista; conferido aqui para nem carregar o jev.js sem ele.
const usaJev = () => String(process.env.BRAIN_JEV || '').split(',').some((u) => u.trim().toLowerCase() === 'contexto');
const limiarJev = () => {
  const s = String(process.env.BRAIN_JEV_LIMIAR_CONTEXTO || '').trim();
  const n = s ? Number(s) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : LIMIAR_JEV;
};
```
Função nova, antes do `(async () => {` (`:259`):
```js
// Devolve { passaram, enviados, limiar }, ou null = "filtro indisponivel, injete como hoje".
const filtrarComJev = async (alvo, cands) => {
  let timer;
  try {
    const jev = require('./jev.js');
    if (!jev.ligado('contexto')) return null;
    const limiar = limiarJev();
    const prazo = new Promise((r) => { timer = setTimeout(() => r(null), PRAZO_HOOK_JEV); });
    const vs = await Promise.race([
      jev.julgar(alvo, cands.map((r) => ({
        id: String(r.path), texto: String(r.full_text || ''), titulo: r.breadcrumb || '', fonte: r.source || '',
      })), { uso: 'contexto', instrucao: INSTRUCAO_JEV }),
      prazo,
    ]);
    if (!Array.isArray(vs) || vs.length !== cands.length || vs.some((v) => !v || v.estado !== 'ok')) return null;
    if (DEBUG) vs.forEach((v, i) => process.stderr.write('[brain-contexto] jev ' + (i + 1) + ' ' + v.probabilidade + ' ' + cands[i].path + '\n'));
    return { passaram: cands.filter((_, i) => vs[i].probabilidade >= limiar), enviados: cands.length, limiar };
  } catch (e) {
    if (DEBUG) process.stderr.write('[brain-contexto] jev ' + (e && e.stack ? e.stack : e) + '\n');
    return null;
  } finally {
    clearTimeout(timer);
  }
};
```
A troca na linha `:409`:
```js
const candidatos = resultados.filter(daqui).filter(relevante);
let achados = candidatos.slice(0, LIMITE_FINAL);
const jev = usaJev() && candidatos.length ? await filtrarComJev(alvo, candidatos.slice(0, LIMITE_JEV)) : null;
if (jev) achados = jev.passaram.slice(0, LIMITE_FINAL);
if (!achados.length) return fim();
```
O formato da linha de debug é fixo, `[brain-contexto] jev <posição 1-based> <probabilidade> <path>`, porque o T16 o lê.

Texto do bloco:
- Sem `jev`, as duas strings atuais ficam **intactas** (`:423`, `:425`).
- Com `jev`, o cabeçalho é:
  ```js
  'Cerebro (busca lexica automatica sobre este prompt, filtrada pelo Jev: ' + jev.passaram.length + ' de ' + jev.enviados + ' candidatos passaram; abaixo, os ' + achados.length + ' primeiros — voce nao gastou tool call nenhuma):\n\n'
  ```
- Com `jev`, o fecho é `'\n\nIsto e so a metade lexica, filtrada pelo Jev (limiar ' + jev.limiar + '). '`, seguido de `RODAPE`.
- O trecho `busca lexica automatica` fica no cabeçalho filtrado de propósito: é ele que o `motivo()` (`injecao.mjs:337`) usa para contar `texto`.

Comentário no topo do passo 5, explicando três escolhas:
- o piso de tokens vem **antes** do Jev: o filtro só tira candidato, o que sai da máquina diminui e sem candidato o cliente nem é chamado;
- um `indisponivel` em **qualquer** trecho abandona o filtro inteiro, porque um bloco julgado pela metade não é nem o de hoje nem o filtrado;
- o prazo próprio existe porque o hook não pode ficar preso num `jev.js` quebrado.

### O que sai da máquina (com `contexto` em `BRAIN_JEV` e a chave; só então)
- Quando: todo prompt que chega ao passo 5 com candidatos. São dois casos:
  - texto corrido com 12 ou mais caracteres;
  - slash command cujo argumento tem 12 ou mais caracteres e não resolveu entidade (`brain-contexto.js:304`, `:382`).
- Quanto: até 10 requisições por prompt.
- O que cada uma leva:
  - o `alvo` (o prompt, ou o argumento), cortado em 4000 caracteres;
  - de um candidato, o `breadcrumb`, o `source` e o texto do chunk, cortado em 4000 caracteres.
- O `path` não sai.
- É isto que a autorização pendente de Leonardo cobre (A4).

### Limiar
- **Inicial: 0,5.** É o ponto em que o `noul` diz "mais sim que não", e o hook o compara com P(sim).
- Não há dado do Jev nesta máquina. O cookbook do fornecedor para passagens de RAG usa piso de relevância 0,45 combinado com outras perguntas, e isso não calibra este corpus.
- **Como muda:**
  - `BRAIN_JEV_LIMIAR_CONTEXTO` (vazio ou fora de [0,1] = 0,5) permite medir outros valores sem PR.
  - O padrão só muda por uma PR que traga a medição: o `injecao.mjs` com o Jev real, sobre a janela fixa e o golden, com precisão (slots esperados / slots) e preservação (b1) em pelo menos 0,3, 0,5 e 0,7.
  - Essa rodada, e o modo do script que a permite, ficam para um card de calibração. Hoje o script remove a chave de propósito. O card depende da chave e da autorização: pendência registrada.

### brain-mcp/scripts/injecao.mjs — `--portao jev` (CA3, CA4, CA5)
- **Argumento** `--portao <ca2|jev>`, padrão `ca2`.
  - Valor desconhecido → `fail`.
  - `--portao` junto com `--caso` → `fail("--portao não vale com --caso")`.
- **Carga do cliente.** `const jev = require(join(repo, 'hooks', 'jev.js'))`, ao lado do `cfg` (`:80-82`), com o mesmo `fail` de arquivo ausente de `:81`.
- **Ambiente dos filhos.** `rodar(hookPath, prompt, cwd, env)` recebe o `env` do filho e devolve também `saida` (a stdout crua). Por modo:
  - padrão para todo filho: `jev.envSemJev(process.env)`;
  - `--caso`: `envSemJev(process.env)` com `BRAIN_JEV`, `BRAIN_JEV_FALSO` e `BRAIN_JEV_LIMIAR_CONTEXTO` repostos como vieram. A chave **nunca** passa, então o `--caso` inspeciona o filtro com o falso e nunca com o real.
  - Um comentário no código diz que é isto que mantém "medição não usa rede" verdadeiro numa máquina que um dia tiver a chave.
- **`ca2`**: o fluxo de hoje, intocado. A única diferença é o `env` saneado.
- **`jev`** (códigos próprios: `0` OK, `1` reprovou, `2` não mediu, com `NÃO MEDI: <motivo>`):
  0. Pré-condições:
     - exige `--desde`, `--ate` e `--base` presentes na linha de comando. Faltando algum → `2`, com a mensagem de que o portão do #42 é sobre janela e base fixas;
     - exige que o hook da worktree seja diferente do base (`compara`). Igual → `2`: "o hook é igual ao base: não há o que o portão do #42 medir".
     - O temporário do base só é apagado no **fim**, num `finally`. Hoje ele é apagado em `:407`, logo depois do corpus.
  1. **Corpus.** Para cada prompt, roda o base e depois a worktree, **um seguido do outro** (dentro do mesmo item do `emLote`), as duas com o `env` saneado.
     - Divergência: `semCr(saidaBase) !== semCr(saidaWorktree)`, sobre a stdout crua.
     - Divergentes rodam o par **mais uma vez**, e só a divergência que se repete conta: o índice vivo muda durante a rodada (P14).
     - Imprime a taxa e a repartição de sempre, mais `Saídas diferentes com a flag desligada: <n>` e os **índices** dos divergentes (no máximo 10). Nunca o texto do prompt nem o do bloco.
     - Reprova (`1`) com `n > 0`. Timeout ou erro em qualquer coluna → `2`.
  2. **Golden.**
     - Lê `process.env.BRAIN_GOLDEN || join(root, 'scripts', 'golden.json')`.
     - Gera em `mkdtemp` o roteiro-oráculo: uma regra por (caso positivo, alvo de `esperado`), `{ quando: { pergunta: caso.q, trechoId: alvo }, responde: { probabilidade: 0.95 } }`, mais `padrao: { probabilidade: 0.05 }`.
     - Para cada caso × cada `conf.workspaces[].prefixo` existente, roda, em seguida um do outro:
       - A = o base, com o `env` saneado;
       - D = a worktree, com o `env` saneado + `BRAIN_JEV=contexto` + `BRAIN_JEV_FALSO=<roteiro>`.
     - Os caminhos de um bloco são a linha logo depois da linha de meta de cada slot que casa `/^\d+\. /`, normalizados por `norm`.
     - **(b1)**: em cada execução de caso positivo, todo caminho de A que casa `esperado` está em D. Uma violação na primeira passada repete o par antes de contar.
     - **(b2)**: todo caminho de D casa `esperado` do caso, e caso negativo tem D sem bloco.
     - Com 0 preservados no total, o (b1) não provou nada → `2`.
     - Imprime contagens: execuções, blocos antes/depois, `precisão antes x/y = p%`, `precisão depois x/y = p%`, `preservados n/n`, `negativos vazios antes/depois`. Cada violação sai com o **índice do caso no golden** e o workspace, nunca com o texto. O golden é versionado e público, mas a regra é uma só para as duas partes.
     - Comentário no (b2): com precisão de 2,0% hoje (P6), o oráculo prova o **encanamento** (só entra o que o cliente aprovou), e não a qualidade do Jev.
  3. Saída: `Portão do #42 OK` e exit `0`.
- Cabeçalho do arquivo: as linhas de uso de `--portao`, e a regra de que **a saída deste script não vai para PR nem card**, salvo as linhas de contagem.

### brain-mcp/scripts/jev.mjs — teste do cliente e do hook (sem rede)
- Script Node puro. Antes de tudo:
  - `process.env` passa a ser `envSemJev(process.env)`;
  - `globalThis.fetch = () => { throw new Error('rede proibida no teste') }`.
- Carrega o cliente pela ordem de resolução do contrato: `join(root, '..', 'hooks', 'jev.js')`, depois `<CLAUDE_HOME>/hooks/jev.js`. Se não achar nenhum, `fail` com a mensagem de que o script roda de dentro do repo ou com os hooks instalados.
- Sai `1` na primeira falha, com `FALHOU: <caso>`, no padrão de `smoke.mjs`. Entra no `package.json` como `"jev": "node scripts/jev.mjs"`.
- Parte **cliente**, T1-T10:
  - todo `fetch` é injetado por `opcoes.fetch`, e o espião conta chamadas;
  - os spawns da CLI usam `envSemJev` + só as variáveis do caso.
- Parte **hook**, T11-T16:
  - Repete o pré-voo mínimo do `injecao.mjs`: `brain-config.carregar()` não nulo, `conf.db` existe, `dist/db.js` e `dist/search.js` existem ao lado do índice. Faltando algo → exit `2` com `NÃO MEDI: <motivo>`. A parte cliente roda antes e não depende disso.
  - Dispara `hooks/brain-contexto.js` da worktree com o prompt de prova `como o hook de contexto filtra os trechos que injeta` e `cwd` = `~/pessoal/claude-brain`.
  - A referência é o hook de `origin/dev`, por `git show` para um temporário ao lado do `brain-config.js` da mesma ref, como o `resolverBase()` do `injecao.mjs`. Cada comparação roda base e worktree em seguida e repete uma vez se divergir.
  - Pré-condições verificadas na hora, com exit `2` "troque o prompt de prova" se falharem:
    - com a flag desligada, o hook injeta pelo caminho de texto (`busca lexica automatica`);
    - há pelo menos 6 candidatos, contados pelas linhas de debug com `BRAIN_JEV=contexto BRAIN_JEV_FALSO=sim BRAIN_HOOK_DEBUG=1`.

### Docs e sincronia
- `sync.sh:87`: `jev.js` entra em `HOOKS_VERSIONADOS`, logo depois de `brain-config.js`. O mesmo em `sync.ps1:136-138` (`$hooksVersionados`).
- `README.md`:
  - `:313`: "7 arquivos" passa a "8 arquivos", com a linha `│   ├── jev.js                  cliente do Jev (TypeSafe AI); cada uso liga em BRAIN_JEV`;
  - `:308`: a linha dos scripts ganha `jev`.
- `brain-mcp/README.md`:
  - `## Comandos` (`:209`) ganha `npm run jev` e `node scripts/injecao.mjs ... --portao jev`;
  - parágrafo curto "Jev (opcional, desligado)", com as quatro variáveis, a lista de usos, a frase "nada sai da máquina sem o uso em `BRAIN_JEV` e `TYPESAFE_API_KEY`" e o apontador para o contrato desta spec.

## File Change Summary
| Arquivo | Mudança |
|---|---|
| `hooks/jev.js` | **novo**: o contrato, o adaptador, o falso, `envSemJev` e a CLI |
| `hooks/brain-contexto.js` | passo 5 com `filtrarComJev`, as constantes, `usaJev()`, `limiarJev()` e as strings do bloco filtrado; o caminho sem flag fica intacto |
| `brain-mcp/scripts/injecao.mjs` | `--portao <ca2\|jev>`, `env` saneado em `rodar`, as partes corpus e golden do `jev`, a limpeza do temporário no fim |
| `brain-mcp/scripts/jev.mjs` | **novo**: T1-T16 |
| `brain-mcp/package.json` | o script `"jev"` |
| `sync.sh`, `sync.ps1` | `jev.js` na lista fixa de hooks |
| `README.md`, `brain-mcp/README.md` | a árvore, os comandos e o parágrafo do Jev |
| `planning/42-filtro-jev/spec.md` | esta spec |

Nada muda em `brain-mcp/src/`, `skills/` ou `templates/`. As regras 2 e 3 de `## A esteira` não se aplicam.

## Migrations & compatibilidade
N/A: não muda formato em disco, índice, tabela nem tool do MCP. A compatibilidade vale nos dois sentidos:
- hook novo sem `jev.js` (instalação parcial) injeta como hoje, porque o `require` fica no `try`, atrás da flag;
- `injecao.mjs` velho medindo o hook novo também funciona, porque sem a flag a saída é igual.

## Rollback
- Imediato, sem deploy: tirar `contexto` de `BRAIN_JEV`. O hook volta a ser byte a byte o de hoje (CA3).
- Pelo código: reverter a PR na `dev` e rodar o `sync.sh push`, que é de Leonardo. O `jev.js` que sobra na instalação é inofensivo, porque nada o carrega sem um uso ligado.

## Verificação pós-deploy
Roda na 🧪 Validação em Dev, depois do `sync.sh push` de Leonardo. Não usa chave nem rede. `P='{"prompt":"como o hook de contexto filtra os trechos que injeta","cwd":"'$HOME'/pessoal/claude-brain"}'`.
1. `./sync.sh status` não mostra `jev.js` nem `brain-contexto.js` divergentes.
2. `echo '{"op":"julgar","uso":"contexto","pergunta":"x","trechos":[{"id":"a","texto":"b"}]}' | env -u BRAIN_JEV node ~/.claude/hooks/jev.js` devolve `{"ok":true,"resultado":[{"estado":"indisponivel","motivo":"desligado"}]}`.
3. `echo "$P" | env -u BRAIN_JEV -u TYPESAFE_API_KEY node ~/.claude/hooks/brain-contexto.js` (o hook **instalado**) emite um bloco de texto.
4. O mesmo comando com `BRAIN_JEV=contexto BRAIN_JEV_FALSO=nao` não emite nada, o que prova que o hook instalado acha o `jev.js` instalado. Com `BRAIN_JEV=contexto BRAIN_JEV_FALSO=indisponivel`, a saída é igual à do passo 3 (`cmp`).
5. A5: numa sessão interativa aberta com `BRAIN_JEV=contexto BRAIN_JEV_FALSO=nao` exportados antes do `claude`, um prompt que hoje injeta não recebe bloco.

## Plano de testes
A suíte do card tem dois comandos, e os dois saem `0`:
- `cd brain-mcp && npm run jev`;
- `node scripts/injecao.mjs --desde 2026-11-03 --ate 2026-11-09 --base origin/dev --portao jev`.

Fora da suíte, só para provar que o uso atual não quebrou: `node scripts/injecao.mjs --desde 2026-11-03 --ate 2026-11-09 --base origin/dev` (sem `--portao`) continua aplicando o `CA-2`. Com o hook mudado e a flag desligada, a taxa não sobe, e ele **sai 1**. É o comportamento do `ca2`, feito para outra mudança, e não regressão. O corpo da PR diz isso só com as linhas de contagem.

| Caso | Prova | CA |
|---|---|---|
| T1 | sem `BRAIN_JEV`, `julgar` e `decidir` → `desligado` em tudo, inclusive com entrada inválida; `BRAIN_JEV=1` e `BRAIN_JEV=*` → `desligado`; `BRAIN_JEV=parada` com `uso:'contexto'` → `desligado`; espião 0 | CA2, CA4 |
| T2 | `uso` fora da tabela → `entrada_invalida`; `BRAIN_JEV=contexto` sem chave e sem falso → `sem_chave`; espião 0 | CA3, CA4 |
| T3 | `BRAIN_JEV=contexto` + chave + `BRAIN_JEV_FALSO=sim` → `0.95`; `BRAIN_JEV_FALSO=""` + chave → `resposta_invalida`/`roteiro`; espião 0 nos dois | CA4 |
| T4 | roteiro: regra por `pergunta`+`trechoId`; regra por `id` no `decidir`; `trechoId` no `decidir` não casa; `padrao`; `{indisponivel:'http'}`; `escolha` fora de `opcoes` → `resposta_invalida`; falso `sim` com uma opção → 1,0; `nao` → `confianca = 1/n`; roteiro ilegível → `resposta_invalida` | CA2 |
| T5 | `BRAIN_JEV_FALSO=lento`, `timeoutMs: 200` → todos `timeout` em < 250 ms, num processo filho que não sai antes de resolver (sem código 13) | CA3 |
| T6 | real, com `fetch` injetado e chave: URL, `Authorization`, `model`, `questions` com `type` `noul`/`choice`; o `id` do trecho e o `path` não aparecem no corpo; `texto` e `pergunta` de 5000 caracteres chegam com 4000; `estado` acima de `MAX_ESTADO` → `entrada_invalida` sem chamar | CA2, CA4 |
| T7 | real: `noul: 0.7` → `{sim:true, probabilidade:0.7}`; `choice` válido → `RespostaEscolha` com `probabilidades` nas chaves de `opcoes`; `noul: 1.4` ou chave ausente → `resposta_invalida` só nela | CA2 |
| T8 | real: 429 → `{motivo:'http', detalhe:'429'}`; `fetch` que rejeita → `rede`; `fetch` que só termina no abort, `timeoutMs: 200` → `timeout` em < 250 ms; 20 trechos → 16 julgados e 4 `entrada_invalida`; nada escrito em stdout/stderr | CA3 |
| T9 | entradas ruins (`trechos` null, trecho sem `id`, `perguntas` vazio, `opcoes` vazias ou com 256 entradas) → `[]`/`entrada_invalida`, sem exceção | CA2 |
| T10 | CLI: `op` julgar com flag desligada → envelope `ok:true` com `desligado`, exit 0; stdin `{` → `{"ok":false,"motivo":"entrada_invalida"}`, exit 0 | CA2 |
| T11 | hook com a flag desligada: bloco de texto (pré-condição), com stdout crua igual à do hook de `origin/dev` | CA3 |
| T12 | hook com `BRAIN_JEV=contexto BRAIN_JEV_FALSO=nao` → stdout vazia | CA1 |
| T13 | hook com `BRAIN_JEV=contexto BRAIN_JEV_FALSO=sim` → os mesmos caminhos de T11, na mesma ordem; cabeçalho `filtrada pelo Jev: n de n candidatos passaram; abaixo, os 5 primeiros`, com `n = min(10, candidatos)` | CA1 |
| T14 | hook com `BRAIN_JEV=contexto` e `BRAIN_JEV_FALSO=indisponivel`; depois `BRAIN_JEV=contexto` sem chave nem falso; depois `BRAIN_JEV=contexto BRAIN_JEV_FALSO=lento` → os três com stdout crua igual a T11; o `lento` em < 2200 + 1000 ms | CA3 |
| T15 | hook com o caminho de entidade (`/gm-spec #42`, `cwd` `~/pessoal/claude-brain`) e `BRAIN_JEV_FALSO=nao` → igual ao da flag desligada. Pré-condição: o bloco com a flag desligada não é vazio e não contém `busca lexica automatica`; senão, exit 2 | CA1 |
| T16 | hook com roteiro que aprova só os candidatos das posições 6 a `n` (caminhos tirados das linhas de debug de T13) → o bloco traz exatamente esses, na ordem do ranking; cabeçalho `k de n`, com `k = n − 5` | CA1 |
| injecao `--portao jev` | (a) 0 saídas diferentes no corpus da janela de P5; (b1) todos os slots esperados que o base injeta na rodada continuam, e ≥ 1 (10 em P6; o número varia com o índice, e o critério é *todos*); (b2) precisão depois de 100%, negativos sem bloco | CA3, CA5 |

## Technical Decisions
- **O cliente mora em `hooks/jev.js`, e não em `brain-mcp/src/`** (cofre #1400).
  - O hook da worktree acha o cliente ao lado de si, e a medição roda antes de qualquer instalação. Em `dist/`, o hook importaria o `dist/` da instalação (`:310`), onde o cliente não existe.
  - Nada em `src/` muda, então as regras 2 e 3 não se aplicam.
  - O brain-mcp resolve o cliente primeiro pelo layout do repo e depois pela instalação. É o que deixa #45/#46 medirem na worktree.
  - Descartados: `src/jev.ts` com uma env `BRAIN_DIST`, e dois clientes.
- **Duas primitivas, `decidir` e `julgar`.** O #41 (cinco campos) e o #44 (categoria de lista fixa) precisam de escolha numa lista, e o Jev tem `choice` nativo. O #45 confirmou por mensagem (cofre #1416) que se alinha a `decidir` com o tipo `escolha`. Descartados: só `julgar`, e os tipos `score`/`box`, que ninguém pede.
- **Um uso nomeado por consumidor em `BRAIN_JEV`, e não uma flag única** (achado do revisor).
  - A autorização pendente pode vir por uso: liberar o texto do PARADA sem liberar corpus, por exemplo.
  - Uma flag global ligaria o filtro do hook (10 chunks por prompt) junto com qualquer irmão, e pôr o escopo depois seria emenda do contrato.
  - Sem curinga, de propósito.
  - Descartados: `BRAIN_JEV=1` com uma env de exclusão; e lista de workspaces no contrato (é do hook, A4).
- **Uma requisição por trecho no `julgar`, com prazo comum.** É o padrão do cookbook do fornecedor. Um estado com os 10 trechos misturaria os julgamentos.
- **Qualquer `indisponivel` abandona o filtro inteiro, e o hook tem o próprio prazo.** É o "exatamente como hoje" do CA3, e é o que protege contra um `jev.js` quebrado.
- **O piso de tokens fica antes do Jev, e a ordem do ranking é mantida.** O filtro só tira candidato. Descartados: trocar o piso pelo Jev (mais corpus saindo, e população diferente) e reordenar pela probabilidade (uma segunda mudança, sem medição).
- **Nomes de env.**
  - `BRAIN_JEV*` segue o prefixo `BRAIN_`.
  - `TYPESAFE_API_KEY` é o nome do fornecedor.
  - Lida por chamada, para os testes poderem trocá-la.
  - `BRAIN_JEV_FALSO` vale **definida**, e não "não vazia" (achado do revisor): `""` nunca cai no real.
  - Descartado: a flag em `brain.config.json` ou `brain-workspaces.json`, porque o hook lê um e o servidor lê o outro.
- **Orçamento de 2000 ms no cliente e 2200 ms no hook.** O hook custa hoje no máximo 218 ms (P4), e o pior caso fica abaixo de 2,5 s, contra os 10 s do harness. Sem retry, porque não cabe no orçamento. O prazo usa `AbortController` + `setTimeout`, porque o timer do `AbortSignal.timeout` não segura o event loop.
- **Tetos de envio:** `MAX_TEXTO`, `MAX_PERGUNTA`, `MAX_ESTADO` (rejeita sem cortar) e `MAX_TRECHOS`. Limitam o que sai e evitam 413 e rajadas de 429.
- **Medição: `--portao jev` intercalado, com repetição, sobre a stdout crua.**
  - O uso atual fica idêntico.
  - Intercalado e com repetição, porque o índice vivo muda durante a rodada (P14).
  - Stdout crua, porque o CA3 fala do que o hook emite.
  - Com o (b1) vazio, o resultado é "não medi".
  - Descartados: o piso "depois ≤ antes", que com o oráculo é sempre verdade; medir sobre um snapshot do índice, que exigiria levar o `dist/` junto, porque o hook o deriva do caminho do db; e a precisão real do Jev na PR, que não tem chave.
- **O oráculo vem do `golden.json`, rodado nos dois workspaces.** O golden não tem `cwd` (P13). Comparar A com D por execução não exige saber de que workspace é o caso.
- **A saída da medição não leva texto do corpus.** O repo é público e o corpus traz conteúdo dos dois workspaces. Saem só índices e contagens.
- **A CLI responde num envelope** (`ok`), para o #43 distinguir "o Jev disse" de "o cliente falhou" sem ambiguidade com as chaves das perguntas.
- **Limiar de 0,5 provisório**, com `BRAIN_JEV_LIMIAR_CONTEXTO` para a calibração (`### Limiar`).

## Coding Standards
- CommonJS em `hooks/`, sem dependência, no estilo de `hooks/brain-config.js` e `hooks/brain-contexto.js`. Comentários em pt-BR sem acento, como os existentes, com o **porquê** de cada guarda.
- O hook falha em silêncio. Erro novo só aparece sob `BRAIN_HOOK_DEBUG=1`, na stderr.
- Scripts de `brain-mcp/scripts/`: ESM, Node puro, com `fail()` e os códigos de saída no padrão de `injecao.mjs`/`eval.mjs`.
- Nada além do especificado: sem `score`/`box`, sem cache, sem retry, sem log em disco, sem modo `--jev-real`, sem lista de workspaces no hook.
- Nenhum dado nem nome de cliente em código, teste, comentário ou PR. O prompt de prova e os roteiros de teste usam texto deste repo.
