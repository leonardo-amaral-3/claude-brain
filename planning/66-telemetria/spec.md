# Telemetria do brain e do Jev: medir saúde, custo e ganho da injeção de contexto — Spec

## References
- Card: [#66](https://github.com/leonardo-amaral-3/claude-brain/issues/66) — repo `leonardo-amaral-3/claude-brain` (épico; fases nas sub-issues listadas em `## Fases`)
- Decisões de origem: cofre `2026-11-24-em-24-11-2026-leonardo-entregou-o-epico-claude-brain-66-tele.md` (entrega da frente) e `2026-11-24-claude-brain-66-passou-no-g1-em-24-11-2026-com-4-criterios-d.md` (G1)
- Contrato do cliente do Jev: `planning/42-filtro-jev/spec.md` § *Contrato do cliente do Jev (estável)* — esta spec faz a **Emenda 4** dele (ver `### Emenda 4 do contrato do Jev`)
- PRD: não há (ferramenta de uma pessoa; o card traz Direção e Por quê)

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir `claude-brain/` no workspace `pessoal`)
- Base branch: `dev`
- Feature branches, uma por fase, cada uma numa worktree irmã `~/pessoal/claude-brain-<n>-<slug>`:
  - F1 `feat/67-telemetria-saude` (sub-issue #67)
  - F2 `feat/68-telemetria-ganho` (sub-issue #68)
  - F3 `feat/69-telemetria-gabarito` (sub-issue #69)
- As três saem da `dev` ao mesmo tempo e voltam por PR própria, em qualquer ordem. A spec (`planning/66-telemetria/spec.md`) entra no commit da primeira fase que mergear; as outras a recebem pelo rebase/merge da `dev` e não a editam fora de emenda.

## Fases

| Fase | Sub-issue | Pontos | Pronto quando… | Rota |
|---|---|---|---|---|
| F1 Saúde e custo | #67 | 1, e a chave do A/B do 3 | o hook de contexto e o `jev.js` gravam o diário de eventos, `npm run painel` mostra saúde e custo do período, e gravar não quebra nem segura o prompt | Completa |
| F2 Ganho | #68 | 2, e a leitura do A/B do 3 | `uso` tem a sessão, e o painel mostra a taxa de aproveitamento dos trechos injetados e a comparação com/sem filtro do Jev | Completa |
| F3 Gabarito | #69 | 3 (gabarito julgado à mão) | dá para sortear uma amostra, julgá-la à mão no terminal e ver no painel a concordância do Jev (e do aproveitamento) com o julgamento humano | Curta |

**Por que o Ponto 3 se divide em três.** A chave do A/B (sortear o grupo, pular o Jev, gravar `grupo` no evento) mora nas mesmas linhas do hook que a F1 instrumenta e precisa existir desde o primeiro evento gravado — se ela viesse numa fase própria, as duas mexeriam no mesmo trecho de `hooks/brain-contexto.js` e o A/B nasceria sem dados. A leitura do A/B é a mesma conta da taxa de aproveitamento, só agrupada por `grupo`: fica na F2. O que sobra do Ponto 3, o gabarito julgado à mão, é a F3.

**Paralelismo.** As fases não dividem arquivo nenhum (ver `## File Change Summary`, coluna *Fase*): cada uma é dona dos seus. O que as liga é só o contrato abaixo (formato do evento, a interface de seção do painel e a função exportada pela F2), escrito para ser implementado dos dois lados sem esperar o outro. Cada fase prova o seu lado com fixtures que seguem o contrato. A dependência que sobra é de **validação**, não de implementação: a 🧪 Validação em Dev da F2 e da F3 precisa da F1 já na `dev` e instalada, porque só ela grava eventos de verdade.

## Requisitos & critérios de aceite

Os quatro critérios do card, na forma canônica, mais o do gabarito (Ponto 3). O review de IA, o plano de testes e a validação em dev leem daqui.

**CA1 — Saúde e custo sem ler transcript (F1).**
Dado o diário de eventos com eventos `contexto` e `jev` de um período,
quando `npm run painel -- --dias N` (ou `--desde/--ate`) roda,
então ele mostra, **sem abrir transcript**: execuções do hook por desfecho; chamadas do Jev por `uso`; p50/p90 de `ms_total`, `ms_busca` e `ms_jev` do hook e de `ms` do Jev por uso; falhas por motivo (no hook e no Jev, por uso); e quantas chamadas do Jev no hook reprovaram todos os trechos (`desfecho = 'jev_reprovou_tudo'`), sobre o total de chamadas `jev = 'ok'`.

**CA2 — Aproveitamento por trecho (F2).**
Dado um evento `contexto` com `mostrados > 0` cujo transcript ainda existe,
quando o painel roda,
então cada caminho mostrado é classificado como *aproveitado* (aberto por alguma tool ou citado no texto do assistente no mesmo turno) ou não, o prompt é marcado com *rebusca* quando o mesmo turno chamou `mcp__brain__search_context` com ao menos metade dos tokens da busca presentes no prompt, e a seção `Ganho` mostra a taxa de aproveitamento (trechos aproveitados ÷ trechos mostrados) e a taxa de rebusca, com quantos eventos ficaram sem par no transcript.

**CA3 — A/B com e sem o filtro do Jev (chave na F1, leitura na F2; fecha na F2).**
Dado `BRAIN_TELEMETRIA_AB=<p>` com `0 < p ≤ 1`, a telemetria ligada e `contexto` em `BRAIN_JEV`,
quando um prompt chega ao passo 5 com candidatos,
então ele é sorteado para `sem_filtro` com probabilidade `p` (o hook injeta como se o Jev estivesse desligado) ou para `com_filtro` (o Jev filtra como hoje), o evento grava o `grupo`, e a seção `Ganho` mostra a taxa de aproveitamento de cada grupo com intervalo de confiança de 95% e um veredito. Sem a variável (ou com valor inválido), nenhum prompt é sorteado e `grupo` é `null`.

**CA4 — Gravar nunca quebra nem segura o prompt (F1).**
Dado o mesmo prompt e o mesmo índice,
quando o hook roda com a telemetria desligada, ligada, e ligada com o destino indisponível (o diretório é um arquivo comum),
então a stdout é **byte a byte** a mesma nos três casos, a saída é código 0, a stderr fica vazia (sem `BRAIN_HOOK_DEBUG`), e a mediana do tempo de parede do hook ligado (nos dois casos) não passa a do desligado em mais de 20 ms (medido por `node brain-mcp/scripts/telemetria.mjs --custo`).

**CA5 — Gabarito julgado à mão (F3).**
Dado o diário com eventos `contexto` em que o Jev julgou trechos,
quando `npm run painel -- --amostrar 30` roda e Leonardo julga a amostra com `npm run painel -- --julgar <arquivo>`,
então a seção `Gabarito` do painel mostra, sobre os itens julgados, a precisão e a cobertura do Jev no limiar gravado e numa tabela de limiares hipotéticos (0,3 a 0,7), e, quando `painel/ganho.mjs` existe, a concordância entre o aproveitamento calculado e o julgamento humano.

**Requisitos transversais (todas as fases).**
- R1 — Nada de telemetria entra no repo: o diário e o gabarito moram em `<CLAUDE_HOME>/brain-telemetria/`, fora do repo e fora do `brain.db`. A saída do painel só traz contagens, percentuais, nomes de `uso`, desfechos e motivos: nunca caminho nem texto de prompt, e por isso pode ir para PR e card.
- R2 — O diário não guarda o texto do prompt nem o argumento do slash command (ver `### Privacidade`).
- R3 — Telemetria é **opt-in** (`BRAIN_TELEMETRIA=1`), como o `BRAIN_JEV`. Sem ela, nada é gravado e nada muda.
- R4 — Nenhum teste nem medição do repo grava no diário vivo nem põe id de sessão em `uso` do índice vivo (ver `### Isolamento dos testes` e o `sem-jev.mjs` da F2).

## Premissas medidas

Rodadas em 2026-11-24, nesta sessão, contra a worktree em `origin/dev` `a88e7a8` e a máquina de Leonardo (instalação e processos vivos), salvo onde dito.

| # | Premissa | Como foi provada | Resultado |
|---|---|---|---|
| P1 | O payload do `UserPromptSubmit` traz `session_id` e `prompt_id` | Comentário de medição em `hooks/brain-contexto.js:338-342` (medido em 2026-09-10 numa sessão interativa) | Lista as chaves `session_id, transcript_path, cwd, prompt_id, permission_mode, hook_event_name, prompt`. **Não** remedido hoje: não há dump de payload real em transcript (os três que têm `[brain-contexto] payload` são testes manuais com `session_id: "teste-jev"`). O desenho tolera a ausência (campos anuláveis) e a G5 da F1 confere |
| P2 | O servidor MCP de cada sessão recebe a sessão no ambiente | `/proc/<pid>/environ` dos 5 servidores `brain-mcp/dist/index.js` vivos, comparado com `~/.claude/projects/*/<id>.jsonl` | `CLAUDE_CODE_SESSION_ID` presente nos 5, e os 5 batem com um transcript vivo (inclusive o do `claude -p` desta sessão, `420d874a…`, diferente do `e543113e…` do processo pai: cada sessão recebe o seu). Não é variável documentada: está no binário do Claude Code 2.1.322 (`grep -ao CLAUDE_CODE_SESSION_ID`) |
| P3 | O Bash das sessões também tem a variável (é por onde as skills chamam a CLI do `jev.js`) | `echo $CLAUDE_CODE_SESSION_ID` nesta sessão | `420d874a-be73-4169-b2d8-fa6d603d7470`, o id desta sessão |
| P4 | O Claude Code conhece `_meta["claudecode/toolUseId"]` em requisições MCP | `grep -ao '"claudecode/toolUseId"'` no binário 2.1.322 | Presente, lido de `params._meta` de mensagens MCP. **Não provado** que vem em todo `tools/call` do cliente: por isso a coluna é anulável e a G5 da F2 mede o preenchimento |
| P5 | O handler de tool do SDK MCP recebe o `_meta` da requisição | `@modelcontextprotocol/sdk` 1.30.0 da instalação, `dist/esm/shared/protocol.d.ts:189` (`_meta?: RequestMeta` em `RequestHandlerExtra`) | Confirmado: o segundo argumento do callback de `registerTool` traz `_meta` |
| P6 | O transcript liga prompt, turno e tools | Leitura de `~/.claude/projects/-home-leo-pessoal/e543113e-….jsonl` | Entradas `user` têm `promptId`, `sessionId`, `timestamp`; `tool_use` tem `id`, `name`, `input`; o bloco do hook vem como `attachment` `hook_additional_context`. Igualdade `prompt_id` (payload) = `promptId` (transcript): **não medida** (ver P1) → o casamento tem fallback por horário e o painel conta qual caminho casou |
| P7 | A duração do hook de contexto não está nos transcripts | `grep '"hook_success"'` e `"command":"…brain-contexto…","durationMs"` em todos os transcripts | Zero ocorrências para o hook de contexto. A latência só sai do próprio evento (`ms_total`) e do banco de custo (`--custo`) |
| P8 | Nada grava telemetria hoje e não há destino | `ls ~/.claude/brain-telemetria`; `grep BRAIN_TELEMETRIA ~/.bashrc` | Diretório não existe; variável não existe. `~/.bashrc:19` exporta só `BRAIN_JEV` |
| P9 | `jev.js` é um contrato estável que proíbe stdout/stderr | `hooks/jev.js:8-10`, `:47-48`; `planning/42-filtro-jev/spec.md:116-117`, `:211-216` | Mudar item do contrato é emenda da spec do #42; gravar arquivo não é proibido, escrever em stdout/stderr é |
| P10 | `envSemJev` já é o saneador comum dos scripts que sobem filhos | `hooks/jev.js:142-149`; `brain-mcp/scripts/sem-jev.mjs:37-41` (smoke, eval, concorrencia); `grep envSemJev` em `brain-mcp/scripts/*.mjs` e `scripts/*.mjs` | Usado por `concorrencia`, `injecao`, `jev`, `sem-jev` (smoke/eval), `gm-triage-jev-teste`. `roteador.mjs` também passa por ele (`semJev`, `roteador.mjs:25-26`) e ainda define o falso (`:23`). Não usado por `classificar-parada-teste.mjs`, `gm-spec-sensivel-teste.mjs`, `prova-modelo.mjs`, `skills-comum-teste.mjs`, `embeddings-falso.mjs` |
| P11 | Coluna nova em `uso` precisa de migração; o INSERT nomeia as colunas | `brain-mcp/src/db.ts:118-126` (CREATE), `:149` (chamada), `:153-179` (`migrarUsoSemantica`), `:181` (`temColuna`), `brain-mcp/src/tools.ts:82-84` (INSERT com lista de colunas) | Confirmado: `CREATE IF NOT EXISTS` não acrescenta coluna em banco vivo; servidor com `dist/` velho continua inserindo, e as colunas novas ficam `NULL` |
| P12 | A sincronia tem lista fixa de hooks | `sync.sh:87` (`HOOKS_VERSIONADOS`), `sync.ps1:136` (`$hooksVersionados`); `install.sh:99` copia `hooks/.` inteiro | `hooks/telemetria.js` precisa entrar nas duas listas; o instalador já o copia |
| P13 | Percentil do repo | `brain-mcp/scripts/uso.mjs:54` | `pct = (v, p) => v[Math.floor(p * (v.length - 1))]` sobre vetor ordenado: o painel usa a mesma definição |
| P14 | O hook tem um ponto de saída por desfecho | `hooks/brain-contexto.js:330` (stdin), `:345` (source), `:362-363` (curto), `:372` (sem índice), `:437` (entidade), `:447` (slash curto), `:451` (busca), `:481` (candidatos), `:483-485` (Jev e sem achados), `:509` (injetado), `:515-517` (erro) | Confirmado nesta base |
| P16 | Como o slash command aparece no transcript | Leitura de `~/.claude/projects/-home-leo-pessoal/e543113e-….jsonl`, entradas `user` fora de sidechain | Prompt digitado: `content` string, `promptSource: 'typed'`, `origin.kind: 'human'`. Slash command: uma entrada com `<command-message>…<command-name>/gm-triage</command-name>…<command-args>…` (sem `isMeta`) **e** uma entrada `isMeta: true` com a skill expandida, as duas com o **mesmo** `promptId`. Resultado de tool: entrada `user` com bloco `tool_result` |
| P15 | Transcripts somem com o tempo | `ls -tr ~/.claude/projects/*/*.jsonl` (mais antigo 2026-10-27, quando o workspace foi reconstruído); `cleanupPeriodDays` ausente de `~/.claude/settings.json` | A retenção do Claude Code não foi medida (o padrão documentado é 30 dias, não conferido aqui). O aproveitamento só existe enquanto o transcript existe: o painel conta `sem_transcript` e não o esconde |

## Technical Overview

- **Um diário de eventos local, append-only, JSONL**, um arquivo por dia (UTC) em `<CLAUDE_HOME>/brain-telemetria/eventos-AAAA-MM-DD.jsonl`, versão de formato `v: 1`, retenção de 90 dias feita pelo próprio gravador, opt-in por `BRAIN_TELEMETRIA=1`. Fica fora do repo (público) e fora do `brain.db` (a decisão da PR #61 de não gravar telemetria no índice vivo continua valendo para o diário).
- **Dois gravadores, um módulo.** `hooks/telemetria.js` (CommonJS, sem dependência) é o único que escreve no diário. Quem o chama: `hooks/brain-contexto.js` (evento `contexto`, um por execução do hook, em todo desfecho) e `hooks/jev.js` (evento `jev`, um por chamada de `julgar`/`decidir` que não seja `desligado`). Ninguém mais grava; o painel e os scripts só leem.
- **Ligação por sessão e prompt.** O hook lê `session_id`/`prompt_id` do payload e os repassa ao `jev.js` por uma opção nova (`opcoes.telemetria`). Fora do hook, o `jev.js` usa `CLAUDE_CODE_SESSION_ID` do ambiente (servidor MCP e Bash das skills a recebem, P2/P3). O servidor MCP grava em `uso` duas colunas novas: `sessao` (do ambiente) e `tool_use_id` (do `_meta` da requisição, quando vier).
- **Painel**: `npm run painel` em `brain-mcp/` é um agregador (F1) que lê o diário do período e imprime as seções que existirem em `brain-mcp/scripts/painel/`: `saude.mjs` (F1), `ganho.mjs` (F2), `prova.mjs` (F3). Seção ausente vira uma linha "não instalada", e é isso que deixa as três fases mergearem em qualquer ordem.
- **A/B**: sorteio determinístico por `prompt_id` (SHA-256), proporção em `BRAIN_TELEMETRIA_AB`, só entre prompts que chegariam ao Jev; o grupo vai no evento e a leitura normal exclui o `sem_filtro`.
- **Aproveitamento**: calculado do transcript, por trecho mostrado, no turno do prompt (aberto por tool ou citado no texto), com a rebusca como sinal contrário.

## Implementation Details

### Contrato do evento (estável; compartilhado pelas três fases)

**Lugar e nome.**
- Diretório: `dirTelemetria(env)` = `env.BRAIN_TELEMETRIA_DIR` se não vazia; senão `join(CLAUDE_HOME, 'brain-telemetria')`, com `CLAUDE_HOME = env.CLAUDE_CONFIG_DIR || join(os.homedir(), '.claude')` (a regra de `hooks/brain-config.js:24`).
- Arquivo: `eventos-AAAA-MM-DD.jsonl`, com a data **UTC** de `evento.ts` (`new Date(ts).toISOString().slice(0, 10)`).
- Uma linha JSON por evento, terminada em `\n`, UTF-8. Gravada com **uma** chamada `fs.appendFileSync(arquivo, linha + '\n')`.

**Rotação e retenção.** A rotação é o nome do arquivo (um por dia). A retenção é de **90 dias**: quando o gravador cria o arquivo do dia (o arquivo não existia antes do append), ele varre o diretório e apaga todo `eventos-AAAA-MM-DD.jsonl` cuja data seja **anterior** a `hoje_UTC − 90 dias` (o de 90 dias atrás fica; o de 91 sai). Só arquivos que casam `/^eventos-(\d{4}-\d{2}-\d{2})\.jsonl$/` são considerados; o subdiretório `gabarito/` e qualquer outro arquivo nunca são tocados.

**Versão.** Todo evento começa com `v: 1`. Acrescentar campo opcional não muda a versão; remover, renomear ou mudar tipo/semântica de campo é `v: 2`, e os leitores ignoram (e contam) linha de versão que não conhecem.

**Tamanho.** Se a linha serializada passar de `MAX_LINHA = 8000` bytes, o gravador remove `itens` (evento `contexto`) ou `notas` (evento `jev`), acrescenta `cortado: true` e grava a linha menor.

**Envelope comum** (todo evento, nesta ordem de chaves):

| campo | tipo | o que é |
|---|---|---|
| `v` | `1` | versão do formato |
| `ts` | inteiro | `Date.now()` em ms; no `contexto`, o **início** da execução do hook; no `jev`, o início da chamada |
| `evento` | `'contexto' \| 'jev'` | tipo |
| `sessao` | string \| null | id da sessão do Claude Code |
| `prompt` | string \| null | `prompt_id` do payload do `UserPromptSubmit`; `null` fora do hook |

**Evento `contexto`** — gravado por `hooks/brain-contexto.js`, **uma linha por execução do hook**, em todo desfecho (inclusive os que não injetam).

| campo | tipo | valor |
|---|---|---|
| `ws` | string \| null | `ws.nome` do workspace do cwd; `null` antes de resolvê-lo ou sem workspace |
| `tipo` | `'slash' \| 'texto' \| null` | `null` só quando o payload não foi lido |
| `comando` | string \| null | nome do slash command, com a barra (`'/gm-spec'`), só se casar `/^\/[a-z0-9:_-]+$/i`; senão `'(outro)'` (um prompt que começa com `/home/...` é tratado como slash pelo hook, `brain-contexto.js:355`, e não pode gravar caminho). **Nunca o argumento**; `null` para texto |
| `alvo_chars` | inteiro \| null | `alvo.length` (o argumento, no slash; o prompt, no texto) |
| `alvo_tokens` | inteiro \| null | `tokensDe(alvo).length`; `null` quando o hook saiu antes de importar `search.js` |
| `desfecho` | enum | `'sem_payload'` (stdin ilegível) · `'ignorado'` (`source` ≠ `user`) · `'curto'` (slash sem argumento, texto < 12, ou slash com argumento < 12 no passo 5) · `'sem_indice'` (sem workspace ou sem `brain.db`) · `'entidade'` (injetou pela vizinhança) · `'sem_candidatos'` (passo 5 sem candidato depois de `daqui`+`relevante`) · `'sem_enviaveis'` (havia candidatos, mas nenhum com texto para o Jev; não injeta, como hoje em `brain-contexto.js:268-270`) · `'jev_reprovou_tudo'` (o Jev rodou, `ok`, e nenhum trecho no limiar; não injeta) · `'injetado'` (passo 5 injetou) · `'erro'` (o `catch` final) |
| `entidade` | string \| null | `ent.chave` quando o desfecho é `'entidade'` |
| `candidatos` | inteiro \| null | `candidatos.length` no passo 5; `null` se não chegou lá |
| `jev` | enum \| null | `'desligado'` (`usaJev()` falso: `contexto` fora de `BRAIN_JEV`) · `'sem_chave'` (`contexto` em `BRAIN_JEV`, mas `jev.ligado('contexto')` falso: sem chave e sem falso) · `'sem_enviaveis'` · `'ok'` · `'indisponivel'` (algum trecho voltou `indisponivel`) · `'prazo_hook'` (venceu `PRAZO_HOOK_JEV`) · `'erro'` (exceção ao carregar/chamar) · `'sem_filtro_ab'` (sorteado sem filtro); `null` quando não houve candidato no passo 5 ou o passo 5 não rodou |
| `jev_motivo` | string \| null | o `motivo` do primeiro `indisponivel`, quando `jev = 'indisponivel'` |
| `grupo` | `'com_filtro' \| 'sem_filtro' \| null` | só não nulo quando houve sorteio do A/B |
| `enviados` | inteiro \| null | trechos enviados ao Jev; `null` sem chamada |
| `aprovados` | inteiro \| null | trechos com `probabilidade ≥ limiar`; `null` sem `jev = 'ok'` |
| `limiar` | número \| null | o limiar usado; `null` sem chamada |
| `mostrados` | inteiro | quantos slots o bloco injetado tem (0 quando não injeta) |
| `itens` | array | no passo 5: os primeiros `LIMITE_JEV` (10) candidatos, na ordem do ranking; na entidade: os slots injetados. Cada item `{ caminho: string, fonte: string \| null, pos: inteiro (1-based, único no evento), chunk: inteiro \| null, trecho_sha: string \| null, prob: número \| null, mostrado: boolean }`. `chunk` = `r.chunk_id` (`brain-mcp/src/search.ts:130`) e `trecho_sha` = os 12 primeiros hex do SHA-256 de `r.full_text`, os dois só no passo 5 (na entidade, `null`); servem para a F3 recuperar o texto exato que o Jev julgou. O mesmo `caminho` pode aparecer em dois itens (a busca devolve até 2 trechos por documento, `search.ts:245-246`): `pos` é a identidade do item, nunca o caminho. `fonte` = `r.source` no passo 5 e `e.tipo` na entidade; `prob` só com `jev = 'ok'`, ligada ao item **pela posição** (nunca pelo caminho); `null` para o candidato sem texto, que não foi enviado. Array vazio quando não houve candidato |
| `ms_busca` | inteiro \| null | duração de `new Buscador(db, null).buscar(...)` |
| `ms_jev` | inteiro \| null | duração de `filtrarComJev(...)` (inclui a corrida contra o prazo) |
| `ms_total` | inteiro | `Date.now() − ts` medido **antes** de escrever a stdout. `ts` é tomado na primeira linha executável do arquivo, antes dos `require`; não inclui a partida do processo `node` (o painel diz isso ao lado do número) |
| `erro` | string \| null | no desfecho `'erro'`: `e.name`, mais `':' + e.code` se houver código. **Nunca** `e.message` (mensagem de SQLite/FTS pode conter tokens do prompt) |

**Evento `jev`** — gravado por `hooks/jev.js`, **uma linha por chamada** de `julgar` ou `decidir`, exceto quando a barreira de uso devolve `desligado` (aí não houve uso, não há linha).

| campo | tipo | valor |
|---|---|---|
| `uso` | string | `opcoes.uso` quando está na tabela `USOS`; senão `'(fora da tabela)'` (não se grava texto do chamador) |
| `op` | `'julgar' \| 'decidir'` | a função chamada |
| `cliente` | enum | até onde a chamada foi: `'invalida'` (uso fora da tabela ou entrada inválida antes do falso) · `'falso'` · `'sem_chave'` · `'api'` |
| `itens` | inteiro | `trechos.length` (julgar) ou `Object.keys(perguntas).length` (decidir); `0` quando `trechos`/`perguntas` nem é array/objeto |
| `ok` | inteiro | respostas com `estado: 'ok'` |
| `sim` | inteiro | respostas `noul` com `sim: true` (P ≥ 0,5; o limiar de cada consumidor é dele) |
| `motivos` | objeto | `Motivo → contagem` dos `indisponivel`; `{}` quando não houve |
| `detalhes` | string[] | `detalhe` distintos dos `indisponivel`, até 5, cada um cortado em 40 caracteres (`'429'`, `'falso'`…) |
| `notas` | array \| objeto | julgar: `Array<number \| null>` com a `probabilidade` de cada trecho na ordem (null para indisponível). decidir: `{ [id]: number \| { escolha: string, confianca: number } \| null }` |
| `ms` | inteiro | `Date.now()` no fim − `ts` |
| `tokens` | objeto \| null | soma, chave a chave, dos campos numéricos do objeto `usage` que a API devolver no corpo (`corpo.usage`), somado entre as requisições de um `julgar`; `null` se nenhuma resposta trouxe `usage` objeto (a premissa A1 do #42 não verificou o formato) |

**Exemplos** (as fixtures das três fases partem destes; os caminhos são fictícios):

```json
{"v":1,"ts":1795600000000,"evento":"contexto","sessao":"s-1","prompt":"p-1","ws":"pessoal","tipo":"texto","comando":null,"alvo_chars":41,"alvo_tokens":6,"desfecho":"injetado","entidade":null,"candidatos":7,"jev":"ok","jev_motivo":null,"grupo":"com_filtro","enviados":7,"aprovados":3,"limiar":0.5,"mostrados":3,"itens":[{"caminho":"/w/a.md","fonte":"planning","pos":1,"chunk":101,"trecho_sha":"3f9a0c1d2e4b","prob":0.91,"mostrado":true},{"caminho":"/w/b.ts","fonte":"code","pos":2,"chunk":202,"trecho_sha":"a1b2c3d4e5f6","prob":0.12,"mostrado":false}],"ms_busca":88,"ms_jev":402,"ms_total":530,"erro":null}
{"v":1,"ts":1795600000100,"evento":"jev","sessao":"s-1","prompt":"p-1","uso":"contexto","op":"julgar","cliente":"api","itens":7,"ok":7,"sim":3,"motivos":{},"detalhes":[],"notas":[0.91,0.12,0.7,0.2,0.66,0.1,0.3],"ms":398,"tokens":null}
{"v":1,"ts":1795600009000,"evento":"contexto","sessao":"s-1","prompt":"p-2","ws":"pessoal","tipo":"texto","comando":null,"alvo_chars":3,"alvo_tokens":null,"desfecho":"curto","entidade":null,"candidatos":null,"jev":null,"jev_motivo":null,"grupo":null,"enviados":null,"aprovados":null,"limiar":null,"mostrados":0,"itens":[],"ms_busca":null,"ms_jev":null,"ms_total":4,"erro":null}
```

**Quem grava e quem só lê.**

| Artefato | Grava | Lê |
|---|---|---|
| `eventos-*.jsonl` | `hooks/telemetria.js`, chamado só por `hooks/brain-contexto.js` e `hooks/jev.js` (F1) | `brain-mcp/scripts/painel/eventos.mjs` (F1) e, através do `ctx` do painel, `saude.mjs` (F1), `ganho.mjs` (F2), `prova.mjs` (F3); `brain-mcp/scripts/telemetria.mjs` (F1, testes e `--conferir`) |
| `uso.sessao`, `uso.tool_use_id` | `brain-mcp/src/tools.ts` (F2) | `painel/ganho.mjs` (F2) |
| `gabarito/amostra-*.jsonl` | `painel/prova.mjs` (F3) | `painel/prova.mjs` (F3) |
| transcripts (`<CLAUDE_HOME>/projects/*/<sessao>.jsonl`) | o Claude Code | `ganho.mjs` (F2), `prova.mjs` (F3), `telemetria.mjs --conferir` (F1) |

### De onde vêm a sessão e o prompt

| Ponto | `sessao` | `prompt` |
|---|---|---|
| Hook de contexto | `h.session_id` do payload (P1), `null` se ausente ou não string | `h.prompt_id` do payload, `null` se ausente ou não string |
| `jev.js` chamado pelo hook | o hook passa `opcoes.telemetria = { sessao, prompt }` com os dois valores acima | idem |
| `jev.js` chamado pelo servidor MCP (roteador `brain-mcp/src/roteador.ts:138`, juiz do `lembrar` `brain-mcp/src/juizJev.ts:49`) | sem `opcoes.telemetria`: `env.CLAUDE_CODE_SESSION_ID` (P2). Nenhuma mudança nesses arquivos | `null` |
| `jev.js` pela CLI (skills via Bash: triagem, `sensivel.mjs`, classificador da parada) | `env.CLAUDE_CODE_SESSION_ID` (P3); a CLI aceita também `telemetria` no JSON da stdin | `null` (ou o que vier em `telemetria.prompt`) |
| Servidor MCP, tabela `uso` | `process.env.CLAUDE_CODE_SESSION_ID` no momento do INSERT (P2) | não há; a coluna `tool_use_id` recebe `extra._meta["claudecode/toolUseId"]` quando é string (P4/P5), e o `tool_use.id` do transcript dá a sessão e o turno exatos |

Limite conhecido do servidor MCP: o processo é de longa duração e o id vem do ambiente de quando ele subiu. Se um `/clear` trocar a sessão sem reiniciar o servidor, as linhas seguintes de `uso` levam o id antigo. Não foi medido (pede uma sessão interativa com `/clear`); por isso existe o `tool_use_id`, que não depende disso, e a G5 da F2 mede os dois.

### Privacidade

- O diário **nunca** guarda o texto do prompt, o argumento do slash command, a mensagem de erro (`e.message`) nem texto de trecho. Guarda: tamanhos (`alvo_chars`, `alvo_tokens`), o nome do comando, a chave da entidade resolvida, os caminhos locais dos candidatos e as probabilidades do Jev.
- Por que o caminho entra: é a única chave que liga o trecho injetado ao `Read`/`read_doc` do transcript, que é o CA2. Fica na máquina, fora do repo, e some em 90 dias.
- O texto do prompt, quando preciso (rebusca na F2, pergunta do gabarito na F3), é lido do **transcript**, que já está na máquina, na hora da conta, e não é copiado para o diário.
- Única cópia deliberada de texto: o arquivo de amostra do gabarito (F3) guarda até 500 caracteres da pergunta e até 600 do trecho de cada item sorteado (30 por padrão), porque julgar exige ler os dois. Mora em `<dirTelemetria>/gabarito/`, fora do repo, e a retenção de 90 dias não o apaga (é o gabarito); apagar é manual.
- A saída do painel nunca imprime caminho nem texto (R1).

### `hooks/telemetria.js` — o gravador (F1)

CommonJS, sem dependência, `'use strict'`. Não escreve em stdout nem stderr em caso nenhum, nunca lança.

```js
const VERSAO = 1;
const RETENCAO_DIAS = 90;
const MAX_LINHA = 8000;

/** true sse env.BRAIN_TELEMETRIA === '1' e (env.BRAIN_JEV_FALSO === undefined ou env.BRAIN_TELEMETRIA_DIR não vazia). */
function ligada(env) {}
/** env.BRAIN_TELEMETRIA_DIR não vazia, senão join(CLAUDE_HOME, 'brain-telemetria'), CLAUDE_HOME lido de env. */
function dirTelemetria(env) {}
/** join(dirTelemetria(env), 'eventos-' + dataUtc(ts) + '.jsonl') */
function arquivoDoDia(ts, env) {}
/** Grava { v: VERSAO, ...evento } (v primeiro). Devolve true se gravou; false se desligada ou se falhou. */
function gravar(evento, env) {}

module.exports = { ligada, dirTelemetria, arquivoDoDia, gravar, VERSAO, RETENCAO_DIAS, MAX_LINHA };
```

- `env` padrão é `process.env` em todas.
- `gravar`: `if (!ligada(env)) return false;` → monta a linha (corte de `MAX_LINHA` acima) → `fs.mkdirSync(dir, { recursive: true })` → `const novo = !fs.existsSync(arq)` → `fs.appendFileSync(arq, linha + '\n')` → `if (novo) varrer(dir, evento.ts)` → `true`. Tudo dentro de um `try`; qualquer exceção → `false`. A varredura tem `try` próprio por arquivo: falhar em apagar um não impede o resto e não muda o retorno.
- Por que `BRAIN_JEV_FALSO` desliga: todo teste do Jev roda com o falso; sem essa regra, um teste com a variável `BRAIN_TELEMETRIA=1` herdada do shell gravaria no diário vivo. Teste que quer evento com o falso define `BRAIN_TELEMETRIA_DIR` (um diretório temporário), e aí grava.
- Concorrência: várias sessões gravam ao mesmo tempo; o `O_APPEND` de uma linha < 8000 bytes numa chamada é o que se aceita. Linha corrompida não derruba ninguém: o leitor a conta em `invalidas`.

### `hooks/brain-contexto.js` — evento `contexto` e o A/B (F1)

1. `const T0 = Date.now();` como primeira linha executável do arquivo (antes do `require('fs')`, `:17`), e, no início do IIFE (`:324`), um objeto `reg` com o envelope (`ts: T0`, `evento: 'contexto'`, `sessao: null`, `prompt: null`) e todos os campos do evento nos seus valores "não chegou lá" (`null`, `mostrados: 0`, `itens: []`).
2. O `JSON.parse` (`:332`) entra no `try` interno da leitura (`:327-331`): stdin ilegível **ou** JSON malformado → `reg.desfecho = 'sem_payload'` e `return fim()` (hoje o JSON malformado cai no `catch` final e também não imprime nada: a stdout não muda). Depois do parse: `reg.sessao`/`reg.prompt` = `h.session_id`/`h.prompt_id` quando são string não vazia.
3. Cada `return fim()` existente ganha antes a atribuição do `reg.desfecho` da tabela do contrato (pontos em P14). `tipo`, `comando` (`prompt.match(/^\/\S+/)[0]` no slash), `alvo_chars` e `ws` (`ws.nome`) são preenchidos assim que conhecidos; `alvo_tokens` logo depois do `import` de `search.js`.
4. `fim(saida)` passa a ser `fim(saida)` → `reg.ms_total = Date.now() − T0` → escreve a stdout (como hoje) → `clearInterval(manter)` → grava: `try { require('./telemetria.js').gravar(reg); } catch {}`. O `require` fica dentro do `try` e depois da stdout: um `telemetria.js` ausente ou quebrado nunca muda o que foi injetado.
5. Entidade (`:413-444`): antes do `return fim(...)`, `reg.desfecho = 'entidade'`, `reg.entidade = ent.chave`, `reg.mostrados = itens.length`, `reg.itens` = um item por slot (`caminho: e.doc_path`, `fonte: e.tipo`, `pos`, `prob: null`, `mostrado: true`).
6. Passo 5: `ms_busca` em volta do `buscar` (`:451`); `reg.candidatos = candidatos.length`; `reg.itens` = os primeiros `LIMITE_JEV` candidatos, `pos` = índice + 1, com `mostrado` marcado por **identidade de objeto** (o candidato está em `achados`), nunca por caminho.
7. `filtrarComJev` muda só o retorno, para o hook saber por que não filtrou: `{ estado: 'ok', passaram, enviados, limiar, notas }` (`notas`: array alinhado com o array `enviados`, uma `probabilidade` por posição; o hook leva cada nota ao item pelo objeto candidato) ou `{ estado: 'sem_chave' | 'sem_enviaveis' | 'indisponivel' | 'prazo_hook' | 'erro', motivo? }`. `sem_chave` é o `!jev.ligado('contexto')` de `:264`; `sem_enviaveis` é o `!enviados.length` de `:270`, que hoje devolve `{ passaram: [], enviados: 0 }` e passa a ser não-`ok` (o bloco continua vazio, como hoje: o chamador trata não-`ok` com `jev = null` **e** `achados = []` neste estado específico, para a stdout não mudar). O chamador usa `jev = r.estado === 'ok' ? r : null`, e o resto do caminho segue idêntico (a stdout não muda). O `jev.julgar` recebe `telemetria: { sessao: reg.sessao, prompt: reg.prompt }` nas opções.
8. **A/B**, imediatamente antes da chamada de `filtrarComJev` (`:483`), só quando `usaJev() && candidatos.length`, a telemetria está ligada (`require('./telemetria.js').ligada()`) **e** o Jev de fato responderia (`require('./jev.js').ligado('contexto')`), os dois dentro de `try` (falha = sem A/B). Sem chave não há sorteio: todo `com_filtro` sairia sem filtro e o dado seria jogado fora.
   - `p = Number(process.env.BRAIN_TELEMETRIA_AB)`; vale só se finito e `0 < p ≤ 1`. Fora disso, não há sorteio e `grupo` fica `null`.
   - Sorteio: com `reg.prompt` não nulo, `u = parseInt(sha256(reg.prompt).slice(0, 8), 16) / 2**32`; sem ele, `u = Math.random()`. `u < p` → `grupo = 'sem_filtro'`, senão `'com_filtro'`.
   - `sem_filtro`: não chama `filtrarComJev`; `jev = null` (o bloco sai **exatamente** como com o Jev desligado), `reg.jev = 'sem_filtro_ab'`.
   - `com_filtro`: segue como hoje.
   - Por que o sorteio fica atrás da telemetria ligada: tirar o filtro de um prompt sem medir o efeito é custo sem retorno.
9. Depois do Jev: `reg.jev` (o `estado`), `reg.jev_motivo`, `reg.enviados`, `reg.aprovados` (`passaram.length`), `reg.limiar`, `prob` de cada item; `ms_jev`. Quando `usaJev()` é falso e há candidatos, `reg.jev = 'desligado'`. `chunk` e `trecho_sha` de cada item do passo 5 (o SHA-256 por `require('crypto')`, só sobre os até 10 itens).
10. `!achados.length` (`:485`): `desfecho = 'jev_reprovou_tudo'` se `jev` (ok) e `passaram` vazio; `'sem_enviaveis'` se o estado foi esse; senão `'sem_candidatos'`. Injetou (`:509`): `'injetado'`, `mostrados = achados.length`.
11. `catch` final (`:515`): `reg.desfecho = 'erro'`, `reg.erro = e.name + (e.code ? ':' + e.code : '')`.
12. `BRAIN_HOOK_DEBUG=1` continua escrevendo o que escreve hoje; a telemetria não acrescenta nada à stderr.

### Emenda 4 do contrato do Jev (F1)

Texto a acrescentar em `planning/42-filtro-jev/spec.md`, depois da Emenda 3 existente (`planning/42-filtro-jev/spec.md:328`, a do candidato sem texto), dentro de `### Contrato do cliente do Jev (estável)`, e refletido no cabeçalho de `hooks/jev.js`:

> **Emenda 4 (claude-brain#66), aditiva.** (a) `Opcoes` ganha `telemetria?: { sessao?: string, prompt?: string }`, e a CLI aceita a mesma chave no JSON da stdin. (b) `decidir` e `julgar` gravam um evento `jev` no diário de telemetria (`planning/66-telemetria/spec.md` § *Contrato do evento*) por chamada que não seja `desligado`, pelo `hooks/telemetria.js` e só com ele ligado; a gravação é síncrona, depois de o resultado estar pronto, dentro de `try`, e falhar nela não muda o resultado. As garantias continuam todas: nada em stdout/stderr, nunca lança, resolve em até `timeoutMs` + 50 ms. (c) `envSemJev` passa a tirar também toda chave que começa com `BRAIN_TELEMETRIA`. (d) O adaptador devolve, além das respostas, o `usage` do corpo quando for objeto (interno; alimenta o campo `tokens`).

Implementação em `hooks/jev.js`:
- `envSemJev` (`:142-149`): `if (nome === 'TYPESAFE_API_KEY' || nome.startsWith('BRAIN_JEV') || nome.startsWith('BRAIN_TELEMETRIA')) continue;`.
- `decidir`/`julgar`: `const t0 = Date.now()` na entrada; cada `return` passa por uma função interna `registrar(op, opcoes, t0, cliente, itens, resultado, tokens)` que monta o evento `jev` e chama `require('./telemetria.js').gravar(evento, envDe(opcoes))` dentro de `try` (o `require` também). Barreira `desligado` → não registra. `itens` = 0 quando `trechos`/`perguntas` não é array/objeto. `sessao = opcoes.telemetria?.sessao ?? env.CLAUDE_CODE_SESSION_ID ?? null` (só string não vazia); `prompt = opcoes.telemetria?.prompt ?? null`.
- `consultarApi` passa a devolver `{ respostas, usage }`, com `usage = ehObjeto(corpo.usage) ? corpo.usage : null`; `julgar` soma os campos numéricos dos `usage` das requisições; `decidir` usa o da única.
- `executarCli` repassa `pedido.telemetria` (quando objeto) nas opções.

### Isolamento dos testes (F1)

Nenhum teste nem medição grava no diário vivo:
- Por construção: `ligada()` exige `BRAIN_TELEMETRIA=1`, e o falso do Jev desliga a gravação sem `BRAIN_TELEMETRIA_DIR` explícito.
- `envSemJev` tira `BRAIN_TELEMETRIA*` (Emenda 4c): cobre smoke, eval e concorrência (via `sem-jev.mjs:37`), `injecao`, `jev`, `gm-triage-jev-teste`.
- Os scripts que sobem filho sem `envSemJev` e sem o falso (P10) — `scripts/gm-spec-sensivel-teste.mjs`, `scripts/prova-modelo.mjs`, `scripts/skills-comum-teste.mjs`, `brain-mcp/scripts/embeddings-falso.mjs`, `scripts/classificar-parada-teste.mjs` — são conferidos um a um na F1: se o filho pode carregar `jev.js` ou `brain-contexto.js` sem `BRAIN_JEV_FALSO`, o env do filho perde `BRAIN_TELEMETRIA` e `BRAIN_TELEMETRIA_DIR`. `prova-modelo.mjs` sobe sessões reais do Claude Code: essas gravam de propósito (são uso real), e o script fica como está; a F1 diz isso numa linha do cabeçalho dele.
- Todo filho que `telemetria.mjs` sobe parte de `envSemJev(process.env)` (que já tira `BRAIN_JEV*` e `BRAIN_TELEMETRIA*`) e acrescenta, caso a caso, só as variáveis do caso; idem para `BRAIN_JEV_LIMIAR_CONTEXTO` (sai junto, é `BRAIN_JEV*`). Assim um `BRAIN_TELEMETRIA_AB` ou `BRAIN_TELEMETRIA_DIR` exportado no shell (a G5 da F2 pede o primeiro) não muda o resultado de teste nenhum.
- Prova: o caso `poluicao` de `telemetria.mjs` (abaixo) e o caso de `envSemJev` no `npm run jev`. Smoke, eval e concorrência ficam protegidos pela Emenda 4c (via `sem-jev.mjs:37`), que esse caso do `npm run jev` prova.

### `brain-mcp/scripts/painel.mjs` e `painel/eventos.mjs` — o agregador (F1)

`package.json` (F1): `"painel": "node scripts/painel.mjs"` e `"telemetria": "node scripts/telemetria.mjs"`. Nenhuma outra fase mexe no `package.json`.

`painel/eventos.mjs`:
```js
/** Lê os arquivos do diário cujas datas cobrem [desde, ate) e devolve os eventos v=1 com ts nesse intervalo, em ordem de ts. */
export function lerEventos({ dir, desde, ate }) // → { eventos, invalidas, outraVersao, arquivos }
/** O dirTelemetria do hooks/telemetria.js, resolvido como sem-jev.mjs:22-24 resolve o jev.js (repo, depois instalação). */
export function dirPadrao() // → string
```
Linha que não é JSON → `invalidas++`; `v !== 1` → `outraVersao++`.

`painel.mjs` exporta `export async function rodar({ argv, secoesDir, env }) → { codigo, saida }` e, quando é o `main`, chama `rodar({ argv: process.argv.slice(2), secoesDir: new URL('./painel/', import.meta.url), env: process.env })`, imprime `saida` e sai com `codigo`. É o `secoesDir` que deixa os testes (de qualquer fase) apontarem para um diretório temporário com seções de teste, sem depender de quais seções reais existem na `dev`.
- Argumentos: `--dias N` (padrão 7; `desde = agora − N·86400000`, `ate = agora`) ou `--desde AAAA-MM-DD --ate AAAA-MM-DD` (UTC; `ate` inclui o dia inteiro); `--amostrar N`, `--julgar <arquivo>`, `--semente <texto>` (repassados à F3). Argumento desconhecido → mensagem e código 2.
- `ctx` entregue a toda seção: `{ eventos, invalidas, outraVersao, desde, ate, agora, dir, claudeHome, projetos: join(claudeHome, 'projects'), db, args, lerEventos: ({ desde, ate }) => …, carregarSecao: async (nome) => módulo | null }`, onde `lerEventos` é o de `eventos.mjs` com o `dir` já preso e `carregarSecao` importa `<nome>.mjs` do mesmo `secoesDir` (null se não existe), onde `db` é `new DatabaseSync(process.env.BRAIN_DB || join(root, 'data', 'brain.db'), { readOnly: true })` ou `null` se o arquivo não existe (o mesmo par de `uso.mjs:20`).
- **Interface de seção** (contrato entre as fases): cada `painel/<nome>.mjs` exporta `export async function secao(ctx) → string`. O agregador importa, nesta ordem, `saude`, `ganho`, `prova` com `await import(new URL('<nome>.mjs', secoesDir))`; `ERR_MODULE_NOT_FOUND` daquele arquivo → imprime `(<nome>: seção não instalada)`; outra exceção → imprime `(<nome>: falhou — <e.name>)` e o código final vira 1.
- `--amostrar` e `--julgar`: chamam `prova.amostrar(ctx, n, semente)` e `prova.julgar(ctx, arquivo)`, que devolvem `{ codigo, linhas: string[] }`; o agregador imprime as linhas e usa o código (contrato com a F3). Esses dois modos **não** passam pela regra de período vazio abaixo e não imprimem seções. Sem `prova.mjs` → `seção prova não instalada` e código 2.
- Cabeçalho: período (datas UTC), número de eventos por tipo, `invalidas`, `outraVersao`. Sem diretório ou sem evento no período → uma linha dizendo isso e lembrando `BRAIN_TELEMETRIA=1`, código 2.
- Códigos: 0 ok; 1 alguma seção falhou; 2 nada para ler ou argumento inválido.

### `painel/saude.mjs` — CA1 (F1)

Tudo sobre `ctx.eventos`, percentil `pct` de `uso.mjs:54`:
- **Hook**: total de eventos `contexto`; tabela por `desfecho` (n e %); p50/p90 de `ms_total` sobre os desfechos que buscaram (`entidade`, `sem_candidatos`, `sem_enviaveis`, `jev_reprovou_tudo`, `injetado`) e sobre todos, com a nota `sem a partida do node`; p50/p90 de `ms_busca` e de `ms_jev` (não nulos); contagem por `jev` (e por `jev_motivo` dentro de `indisponivel`); **reprovou tudo**: `jev_reprovou_tudo` ÷ eventos com `jev = 'ok'`, com os dois números; prompts sorteados no A/B por grupo (só contagem; a conta é da F2).
- **Jev (todo uso)**: por `uso`, chamadas, soma de `itens`, p50/p90 de `ms`, indisponíveis (soma dos `motivos`) e os motivos; linha por `cliente` (`api`, `falso`, `sem_chave`, `invalida`); `uso` fora da tabela aparece como `(fora da tabela)`; `tokens` somados por chave, ou a frase `a API não devolveu uso de tokens no período`.
- Só contagens e números (R1).

### `brain-mcp/scripts/telemetria.mjs` — testes e medições da F1

Script único, com casos nomeados; código 0 passou, 1 reprovou, 2 não medi (sem índice, sem `brain-workspaces.json`). Sobe o **hook de verdade** (`hooks/brain-contexto.js` do repo), um spawn por execução, com o JSON do `UserPromptSubmit` na stdin, como `injecao.mjs`; o Jev só pelo falso. Os prompts dos casos são escolhidos no início da rodada contra o índice vivo (como `injecao.mjs`), e a rodada diz `não medi` se não achar um de cada tipo: um slash que resolve entidade, um texto que injeta, um curto.
- `gravador`: unidade de `telemetria.js` num diretório temporário — `ligada` nas quatro combinações de `BRAIN_TELEMETRIA`/`BRAIN_JEV_FALSO`/`BRAIN_TELEMETRIA_DIR`; `v` primeiro; corte de `MAX_LINHA` com `cortado: true`; retenção (arquivos de hoje−91, hoje−90, hoje−89 e um `outro.txt`, `gabarito/` com um arquivo: só o de −91 some, e só na criação do arquivo do dia); destino indisponível (`BRAIN_TELEMETRIA_DIR` = um arquivo comum) → `false`, sem exceção, sem saída.
- `eventos`: para cada desfecho alcançável sem rede (`sem_payload` com stdin `{nao e json`, `ignorado`, `curto`, `sem_indice`, `entidade`, `sem_candidatos`, `jev_reprovou_tudo` com o falso `nao`, `injetado` com o falso `sim`, `jev = 'indisponivel'` com o falso `indisponivel`, `jev = 'sem_chave'` com `BRAIN_JEV=contexto` sem chave nem falso, e `jev = 'prazo_hook'` copiando `brain-contexto.js`, `brain-config.js` e `telemetria.js` para um diretório temporário ao lado de um `jev.js` de teste cujo `ligado` devolve `true` e cujo `julgar` nunca resolve — o falso `lento` não serve: ele responde `timeout` em 2000 ms, antes do prazo de 2200 ms do hook, `brain-contexto.js:243-244`), roda o hook com `BRAIN_TELEMETRIA=1` e `BRAIN_TELEMETRIA_DIR` temporário e confere: uma linha `contexto` com o desfecho certo, `sessao`/`prompt` iguais aos do payload, os campos da tabela com os tipos do contrato, nenhuma chave com o texto do prompt (o prompt do caso não aparece em lugar nenhum do arquivo), e a stdout com a telemetria ligada é byte a byte a do mesmo caso com ela desligada. Nos casos com o falso, uma linha `jev` com o mesmo `sessao`/`prompt`, `cliente: 'falso'`, `notas` do tamanho de `itens`.
- `ab`: com `BRAIN_TELEMETRIA_AB=1` todo prompt elegível sai `sem_filtro` e a stdout é a do Jev desligado; com `0.0001` e um `prompt_id` cujo `u` conhecido é maior, sai `com_filtro`; com `abc`, `0`, `-1`, `2` não há sorteio (`grupo: null`); o mesmo `prompt_id` sorteia sempre o mesmo grupo; com a telemetria desligada e `BRAIN_TELEMETRIA_AB=1`, não há sorteio e a stdout é a do Jev ligado.
- `stdout` (CA4, parte 1): para os três prompts, a stdout com a telemetria desligada, ligada e ligada com destino indisponível é byte a byte igual, código 0, stderr vazia.
- `poluicao` (R4): roda `npm run jev`, `node scripts/classificar-parada-teste.mjs` e `node scripts/gm-triage-jev-teste.mjs` (as suítes da F1 que carregam o `jev.js` ou o hook; o smoke e o eval não entram porque a F1 não muda `brain-mcp/src/` e eles já passam pelo `envSemJev`) com `BRAIN_TELEMETRIA=1` e `CLAUDE_CODE_SESSION_ID=poluicao-<aleatório>` no ambiente, e confere que nenhum `eventos-*.jsonl` do `dirTelemetria` padrão ganhou linha com esse `sessao`. Se reprovar, as linhas vazadas ficam no diário vivo marcadas com esse `sessao`, e o script imprime quantas e o comando para tirá-las.
- `--custo` (CA4, parte 2): 3 rodadas de aquecimento descartadas e depois 30 execuções por braço, **intercaladas** (desligada, ligada, ligada com destino indisponível, desligada, …), dos mesmos prompts (o que injeta pelo passo 5, com `BRAIN_JEV=contexto` e o falso `sim`, e o de entidade), medindo o tempo de parede do spawn até a saída; imprime a mediana de cada braço e as duas diferenças; passa se as duas diferenças ≤ 20 ms. É o portão do CA4 e roda na PR e na G5.
- `--conferir --dias N` (G5): conta os prompts nos transcripts do período pela regra de *entrada de prompt* (ver `painel/ganho.mjs`) e os eventos `contexto` com o mesmo `sessao`; imprime a cobertura e quantos eventos casam `prompt` = `promptId` (mede P1/P6). Só contagens.

### `brain-mcp/src/db.ts` e `brain-mcp/src/tools.ts` — `uso` com sessão (F2)

- `db.ts`: `migrarUsoSemantica` vira `migrarColuna(db, tabela, coluna, tipo)`, com o mesmo corpo (o `temColuna` e a tolerância a `duplicate column name` só quando o PRAGMA confirma a coluna, `:166-179`), chamada três vezes depois do `exec` do schema: `('uso', 'semantica', 'INTEGER')`, `('uso', 'sessao', 'TEXT')`, `('uso', 'tool_use_id', 'TEXT')`. O comentário de `:153-165` passa a cobrir as três colunas e o significado do `NULL` de cada uma (linha anterior à migração, servidor com `dist/` velho, ou valor ausente).
- `tools.ts`, wrapper `registerTool` (`:67-96`): o callback passa a receber `(args, extra)`; o INSERT ganha `sessao` e `tool_use_id`:
  - `sessao = typeof process.env.CLAUDE_CODE_SESSION_ID === 'string' && process.env.CLAUDE_CODE_SESSION_ID !== '' ? process.env.CLAUDE_CODE_SESSION_ID : null`;
  - `tool_use_id = typeof extra?._meta?.['claudecode/toolUseId'] === 'string' ? extra._meta['claudecode/toolUseId'] : null`.
  - O handler continua recebendo só `args`; nenhuma tool muda de comportamento nem de resposta.
- `scripts/uso.mjs` não muda (não lê as colunas novas).
- `brain-mcp/scripts/sem-jev.mjs` (F2): `semJev` passa a apagar também `CLAUDE_CODE_SESSION_ID` do `process.env`, com o comentário do porquê: smoke, eval e concorrência sobem o servidor contra o índice vivo e, sem isso, as buscas deles entrariam em `uso` com o id da sessão que rodou o teste, contadas pela seção Ganho como buscas daquela sessão. (R4 cobre `uso.sessao` também.)
- `brain-mcp/scripts/concorrencia.mjs` (F2): o caso `uso-pre-migracao-ganha-a-coluna` (`:1256`) passa a conferir as três colunas.

### `painel/ganho.mjs` — CA2 e a leitura do A/B (F2)

Exporta `secao(ctx)` e, para a F3, **`medirAproveitamento(eventos, ctx) → Map<string, Medida>`**:
- chave: `` `${sessao}|${prompt ?? 'ts:' + ts}` ``;
- `Medida = { par: 'promptId' | 'horario' | 'sem_par' | 'sem_transcript', mostrados: string[], abertos: string[], citados: string[], rebusca: boolean }`.
- Entram eventos `contexto` com `desfecho ∈ {'injetado', 'entidade', 'sem_candidatos', 'sem_enviaveis', 'jev_reprovou_tudo'}`: os dois primeiros têm trechos para aproveitar; os três últimos (sem bloco) entram com `mostrados = []` porque são a linha de base da rebusca e porque o A/B precisa deles (o `jev_reprovou_tudo` só existe no `com_filtro`).
- `mostrados`, `abertos` e `citados` são **caminhos distintos** (o mesmo caminho pode vir em dois itens, `search.ts:245-246`): um arquivo aberto uma vez conta uma vez.

Algoritmo, por evento:
1. **Transcript**: `<ctx.projetos>/*/<sessao>.jsonl` (lista de diretórios lida uma vez). Ausente ou `sessao` nula → `sem_transcript`.
2. **Entrada de prompt** (P16): `type === 'user'`, `isSidechain` diferente de `true`, `isMeta` diferente de `true`, sem bloco `tool_result`, e cujo texto (o `content` string, ou a concatenação dos blocos `text`) não começa com `<local-command` nem é resumo de compactação (`isCompactSummary` diferente de `true`). O **texto do prompt** é esse texto; quando ele contém `<command-name>`, é o conteúdo de `<command-name>` + espaço + o de `<command-args>` (vazio se não houver).
3. **Turno**: a entrada de prompt com `promptId === evento.prompt` → `promptId`. Sem ela: a primeira entrada de prompt cujo `timestamp` esteja em `[ts − 2000, ts + 15000]` ms → `horario`. Nenhuma → `sem_par`.
4. **Janela**: as entradas depois da do turno até, exclusive, a próxima entrada de prompt com `promptId` diferente; entradas com `isSidechain: true` não contam (a entrada `isMeta` da skill expandida tem o mesmo `promptId` e fica dentro, mas não é `assistant`, então não conta como aberto nem citado).
5. **Aberto**: algum `tool_use` de entrada `assistant` da janela tem, entre as folhas string do `input` (percorridas recursivamente), uma que contém o caminho, comparando com `norm = s => s.toLowerCase().replace(/\\/g, '/')`.
6. **Citado**: algum bloco `text` de entrada `assistant` da janela contém `norm(caminho)`, ou contém `norm(basename)` quando o basename tem 12 caracteres ou mais **e não aparece** no texto do prompt do turno (o arquivo que o próprio usuário nomeou não conta como ganho da injeção).
7. **Aproveitado** = aberto ou citado.
8. **Rebusca**: algum `tool_use` `mcp__brain__search_context` da janela cujo `input.query` tenha ao menos metade dos seus tokens no texto do prompt do turno; tokens = NFD sem acento, minúsculas, `split(/[^a-z0-9]+/)`, comprimento ≥ 3; query sem token → não é rebusca.

Seção `Ganho` (só contagens e taxas, R1):
- Prompts com injeção **fora do grupo `sem_filtro`**, e quantos casaram por `promptId`, por `horario`, `sem_par`, `sem_transcript`.
- Trechos (caminhos distintos) mostrados, aproveitados (abertos, citados), **taxa de aproveitamento** = aproveitados ÷ mostrados, sobre os eventos com injeção e com par; % de prompts com injeção com ao menos um aproveitado; **taxa de rebusca** dos prompts com injeção e, ao lado, a dos prompts sem bloco (`sem_candidatos`, `sem_enviaveis`, `jev_reprovou_tudo`) como linha de base. A rebusca tem base alta por construção (o rodapé do bloco manda chamar `search_context`, `brain-contexto.js:303-306`): a seção diz que ela só vale comparada, nunca sozinha.
- Por desfecho (`entidade` × `injetado`), as mesmas duas taxas.
- Pelo `uso` (sem transcript; `ctx.db` não nulo e coluna `sessao` presente): para cada evento com injeção, as linhas de `uso` com a mesma `sessao` e `ts` em `[ts do evento, ts do próximo evento contexto da sessão)`, limitado a 30 min: chamadas de `search_context` e de `read_doc`, e quantos `read_doc` têm `args.path` igual a um caminho mostrado (`args` é cortado em 500 caracteres, `tools.ts:87`: tenta `JSON.parse`; se falhar, o regex `/"path":"((?:[^"\\]|\\.)*)"/`; se nenhum achar, a linha não conta como `read_doc` de caminho injetado). Sem coluna → a linha diz `uso sem sessão (servidor anterior à F2)`.
- **Comparação A/B**, sobre **todos** os eventos com `grupo` não nulo (qualquer desfecho, inclusive `jev_reprovou_tudo`) e com par no transcript. A unidade é o **prompt sorteado**, não o trecho (a taxa por trecho favorece o filtro por construção: ele mostra menos e só os aprovados). Por grupo: prompts; média de trechos mostrados por prompt; média de aproveitados por prompt; **% de prompts com ao menos um aproveitado** (métrica principal) com intervalo de Wilson de 95% (z = 1,96) sobre prompts; % de prompts com rebusca, com o mesmo intervalo. Análise **primária por intenção de tratar** (todo prompt sorteado conta no seu grupo, inclusive o `com_filtro` em que o Jev ficou indisponível); a **secundária por protocolo** tira do `com_filtro` os prompts com `jev ≠ 'ok'` e mostra quantos saíram. Veredito da primária: `inconclusivo` se algum grupo tem menos de 30 prompts ou se os intervalos da métrica principal se sobrepõem; senão qual grupo tem a % maior. Sem evento com grupo → `A/B desligado no período`.
- **Por que o `sem_filtro` sai da conta normal**: ele é o desvio deliberado; a taxa do relatório normal tem de ser a do comportamento de produção (com filtro, quando o Jev está ligado).

### `painel/prova.mjs` — o gabarito, CA5 (F3)

Exporta `secao(ctx)`, `amostrar(ctx, n, semente)` e `julgar(ctx, arquivo)`.

- **Arquivo de amostra**: `<ctx.dir>/gabarito/amostra-AAAAMMDD-HHmm.jsonl` (UTC), uma linha por item:
  `{ v: 1, criado, sessao, prompt, ts_evento, caminho, fonte, prob, limiar, mostrado, grupo, pergunta, trecho, julgamento: null, nota: '' }`, com `pergunta` = até 500 caracteres do texto do prompt do turno (localizado pela regra dos passos 1-2 da F2, implementada aqui de novo, sem importar da F2) e `trecho` = até 600 caracteres do **mesmo texto que o Jev julgou**: o `chunks.text` de `ctx.db` com `id = item.chunk`, conferido pelo `trecho_sha`; se o id não existe mais ou o SHA não bate (o documento foi reindexado), procura entre os chunks do mesmo `caminho` (`chunks` × `docs.path`) um com o mesmo SHA; não achou → o item é descartado e outro é sorteado (julgar outro texto mediria outra coisa). Item com `chunk` nulo não entra no universo. A linha guarda também `pos` e `chunk`.
- **`amostrar`**: universo = itens com `prob !== null` de eventos `contexto` com `jev = 'ok'`; metade (arredondada para cima) sorteada entre os de `prob ≥ limiar` do evento e o resto entre os de `prob < limiar`; estrato curto completa com o outro; sem repetir (`sessao`, `prompt`, `pos`); item cuja pergunta não se acha é descartado e outro é sorteado. PRNG mulberry32 com semente = hash de `semente` (padrão: a data UTC de hoje). `n` padrão 30. Devolve `{ codigo: 0, linhas }` com o **nome** do arquivo criado (não o caminho completo) e quantos itens; universo vazio ou `ctx.db` nulo → `{ codigo: 2, linhas: [motivo] }`. O texto da pergunta é de todos os workspaces da máquina, `notoria` inclusive: `--ws <nome>` restringe o universo a eventos daquele `ws`, e o `docs/telemetria.md` avisa que o arquivo de amostra guarda texto de prompt.
- **`julgar`**: devolve `{ codigo, linhas }`; exige TTY (`process.stdin.isTTY`), senão `{ codigo: 2 }` com a mensagem. Para cada linha com `julgamento: null`, mostra pergunta, trecho e `prob` e pergunta `[s]im relevante, [n]ão, [p]ular, [q] sair`; grava `'sim'`/`'nao'` e reescreve o arquivo inteiro a cada resposta (arquivo temporário + `rename`). Esta é a única saída do painel que mostra texto: é local, no terminal de Leonardo, e nunca vai para PR.
- **Seção `Gabarito`**: lê todos os `gabarito/amostra-*.jsonl` (sem filtro de período: o gabarito é acumulado) e usa os itens com `julgamento` não nulo: n; no limiar gravado, verdadeiros/falsos positivos e negativos, precisão (dos aprovados, quantos `sim`), cobertura (dos `sim`, quantos aprovados) e acurácia; tabela para os limiares 0,3 · 0,4 · 0,5 · 0,6 · 0,7. Se `await ctx.carregarSecao('ganho')` devolve um módulo que exporta `medirAproveitamento`, a concordância: lê os eventos do intervalo dos itens julgados com `ctx.lerEventos({ desde: min(ts_evento) − 60000, ate: max(ts_evento) + 60000 })` (o gabarito é acumulado e pode ser anterior ao período do painel), chama `medirAproveitamento` e mostra, entre os itens `mostrado`, % aproveitado entre os julgados `sim` e entre os julgados `nao` (chave do contrato, com `ts_evento`); senão a linha `concordância com o aproveitamento: precisa de painel/ganho.mjs (F2)`. Sem item julgado → `gabarito vazio: rode --amostrar e --julgar`.
- Só contagens e taxas na seção (R1).

### Docs e sincronia (F1)

- `docs/telemetria.md` (novo, F1): o que é gravado, onde, como ligar (`export BRAIN_TELEMETRIA=1` no `~/.bashrc` e reiniciar as sessões), o A/B (`BRAIN_TELEMETRIA_AB=0.2` como valor sugerido; desligar = remover a variável), privacidade, `npm run painel`, e uma linha por seção apontando para `painel/ganho.mjs` e `painel/prova.mjs` (que se documentam no próprio cabeçalho). F2 e F3 não editam este arquivo.
- `sync.sh:87` e `sync.ps1:136`: `telemetria.js` entra na lista de hooks versionados.
- Cabeçalho de `hooks/jev.js`: a Emenda 4 nos blocos *Ambiente*, *Funções* e *Garantias*.

## File Change Summary

| Arquivo | Fase | Mudança |
|---|---|---|
| `hooks/telemetria.js` | F1 | novo: o gravador do diário |
| `hooks/brain-contexto.js` | F1 | evento `contexto`, retorno de `filtrarComJev`, A/B |
| `hooks/jev.js` | F1 | evento `jev`, `opcoes.telemetria`, `envSemJev` tira `BRAIN_TELEMETRIA*`, `usage` do adaptador, cabeçalho |
| `planning/42-filtro-jev/spec.md` | F1 | Emenda 4 do contrato |
| `brain-mcp/scripts/painel.mjs` | F1 | novo: agregador |
| `brain-mcp/scripts/painel/eventos.mjs` | F1 | novo: leitor do diário |
| `brain-mcp/scripts/painel/saude.mjs` | F1 | novo: seção Saúde e custo |
| `brain-mcp/scripts/telemetria.mjs` | F1 | novo: testes, `--custo`, `--conferir` |
| `brain-mcp/scripts/painel-teste.mjs` | F1 | novo: teste do agregador e da saúde sobre fixtures |
| `brain-mcp/scripts/fixtures/telemetria/saude/` | F1 | novo: fixtures JSONL |
| `brain-mcp/package.json` | F1 | scripts `painel` e `telemetria` |
| `scripts/gm-spec-sensivel-teste.mjs`, `scripts/skills-comum-teste.mjs`, `scripts/classificar-parada-teste.mjs`, `brain-mcp/scripts/embeddings-falso.mjs`, `scripts/prova-modelo.mjs` | F1 | só se o filho puder gravar: env sem `BRAIN_TELEMETRIA*` (o `prova-modelo` ganha só a linha de cabeçalho) |
| `sync.sh`, `sync.ps1` | F1 | `telemetria.js` na lista de hooks |
| `docs/telemetria.md` | F1 | novo |
| `brain-mcp/src/db.ts` | F2 | `migrarColuna`; colunas `sessao` e `tool_use_id` |
| `brain-mcp/src/tools.ts` | F2 | wrapper grava `sessao` e `tool_use_id` |
| `brain-mcp/scripts/painel/ganho.mjs` | F2 | novo: seção Ganho e `medirAproveitamento` |
| `brain-mcp/scripts/sem-jev.mjs` | F2 | apaga `CLAUDE_CODE_SESSION_ID` além do que o `envSemJev` tira |
| `brain-mcp/scripts/concorrencia.mjs` | F2 | caso da migração confere as três colunas |
| `brain-mcp/scripts/uso-sessao.mjs` | F2 | novo: teste da migração e do INSERT |
| `brain-mcp/scripts/painel-ganho-teste.mjs` | F2 | novo: teste da seção sobre fixtures |
| `brain-mcp/scripts/fixtures/telemetria/ganho/` | F2 | novo: eventos e transcripts de fixture |
| `brain-mcp/scripts/painel/prova.mjs` | F3 | novo: amostra, julgamento, seção Gabarito |
| `brain-mcp/scripts/painel-prova-teste.mjs` | F3 | novo |
| `brain-mcp/scripts/fixtures/telemetria/prova/` | F3 | novo |
| `planning/66-telemetria/spec.md` | 1ª a mergear | esta spec |

Nenhum arquivo aparece em duas fases.

## Migrations & compatibilidade

- **Diário (F1)**: formato novo, sem migração (não existia). Versão `v: 1`; regras de versão no contrato.
- **`uso` (F2)**: duas colunas `TEXT` anuláveis, aditivas, pela mesma migração idempotente da `semantica` (`db.ts:166-179`), tolerante aos oito servidores que abrem o banco. Não destrutiva, sem backfill: linhas antigas ficam `NULL`. Servidor com `dist/` velho continua inserindo (o INSERT nomeia as colunas, P11) e grava `NULL` nas novas. Relatórios que leem `uso` (`uso.mjs`, `colher-golden.mjs`) não leem as colunas novas.
- **Contrato do Jev (F1)**: Emenda 4, aditiva. Consumidores que não passam `opcoes.telemetria` continuam iguais; o efeito novo (arquivo) só existe com `BRAIN_TELEMETRIA=1`.
- **Janela de risco**: hook novo instalado com `jev.js` velho (ou o contrário) — cada um carrega `telemetria.js` dentro de `try`, e o hook novo trata o retorno de `julgar` como hoje; o `jev.js` velho só não recebe `telemetria` e não grava.

## Rollback

- F1: tirar `BRAIN_TELEMETRIA` do `~/.bashrc` e reiniciar as sessões desliga tudo na hora, sem reverter código. Reverter: revert da PR na `dev` e `./sync.sh push`; o diretório `~/.claude/brain-telemetria/` pode ser apagado à mão.
- F2: revert da PR, `./sync.sh push` e `npm run build` na instalação. As colunas ficam no banco (anuláveis, inofensivas: o código antigo nomeia as colunas no INSERT). Não há `DROP COLUMN`.
- F3: revert da PR; os arquivos de gabarito ficam no diretório e podem ser apagados à mão.

## Verificação pós-deploy

Bloqueante (delta 1 do workspace `pessoal`: mudança de formato em disco), na 🧪 Validação em Dev, feita por **Leonardo** contra a instalação (o agente não instala: instalação viva é parada sempre). Sequência comum: merge da fase na `dev` → `git pull` no checkout principal → `./sync.sh push` → (F2) `npm run build` na instalação → reiniciar as sessões do Claude Code.

**F1**
1. `export BRAIN_TELEMETRIA=1` no `~/.bashrc`; nova sessão; três prompts (um slash com card, uma pergunta, um "ok"). `~/.claude/brain-telemetria/eventos-<hoje>.jsonl` tem três linhas `contexto` com `sessao` igual ao id da sessão (o nome do transcript) e os desfechos esperados; com `contexto` em `BRAIN_JEV`, há linha `jev` com o mesmo `sessao`/`prompt`.
2. Nenhuma linha contém o texto dos prompts digitados (`grep` de uma palavra rara do prompt no arquivo → nada).
3. `npm run painel -- --dias 1` (com `BRAIN_DB` apontando para o índice vivo) imprime a seção Saúde com os números do dia e as linhas `(ganho: seção não instalada)`/`(prova: …)` se F2/F3 não estiverem na `dev`.
4. `npm run telemetria -- --custo` no checkout atualizado: as duas diferenças ≤ 20 ms (o número vai para o card).
5. Depois de um dia de uso, `npm run telemetria -- --conferir --dias 1`: cobertura de prompts com evento ≥ 95%, e o número de eventos que casam `prompt` = `promptId` (fecha P1/P6; se for zero, a F2 está casando só por horário e isso vira nota no card).
6. Sem `BRAIN_TELEMETRIA`, nova sessão: nenhuma linha nova no diário.

**F2** (depois da F1 na `dev` e instalada)
1. Nova sessão, duas chamadas a `search_context`: as linhas novas de `uso` têm `sessao` igual ao id da sessão; `tool_use_id` preenchido com o `id` do `tool_use` do transcript, ou `NULL` — se `NULL`, P4 fica registrada como falsa no card e o painel usa só `sessao`.
2. Linhas anteriores ao deploy continuam com `NULL`; `npm run uso` roda igual.
3. `npm run painel -- --dias 3` mostra a seção Ganho com taxa de aproveitamento e rebusca, e a contagem de `promptId`/`horario`/`sem_par`/`sem_transcript`.
4. Com `BRAIN_TELEMETRIA_AB=0.2` por um período combinado por Leonardo, a comparação A/B aparece com os dois grupos; desligar a variável faz os eventos novos voltarem a `grupo: null`.
5. Se Leonardo usar `/clear` numa sessão: as linhas de `uso` depois dele, comparadas com o novo id da sessão, dizem se o limite conhecido do servidor MCP acontece (registrar no card).

**F3** (depois da F1 na `dev` e instalada, com eventos `jev = 'ok'` acumulados)
1. `npm run painel -- --amostrar 30` cria o arquivo em `~/.claude/brain-telemetria/gabarito/` com 30 itens divididos entre os dois lados do limiar.
2. `npm run painel -- --julgar <arquivo>` num terminal; julgar os 30.
3. `npm run painel` mostra a seção Gabarito com precisão, cobertura e a tabela de limiares, e a concordância com o aproveitamento se a F2 estiver instalada.

## Plano de testes

| Critério | Fase | Prova |
|---|---|---|
| CA1 | F1 | `node brain-mcp/scripts/painel-teste.mjs`: fixture com eventos de todos os desfechos, três usos do Jev, motivos e um `jev_reprovou_tudo` → a saída de `secao` traz os números esperados (contagens, p50/p90 com a definição de `uso.mjs:54`); `rodar({ secoesDir })` com um diretório temporário que tem só a `saude.mjs` real (copiada) imprime `seção não instalada` para as outras e sai 0; com uma `ganho.mjs` de teste que lança, sai 1; `--amostrar` com uma `prova.mjs` de teste devolve o código e as linhas dela; diretório vazio → 2; linha inválida e `v: 2` são contadas e não derrubam; a saída não contém nenhum caminho da fixture |
| CA1 (gravação) | F1 | `telemetria.mjs`, casos `gravador` e `eventos` |
| CA3 (chave) | F1 | `telemetria.mjs`, caso `ab` |
| CA4 | F1 | `telemetria.mjs`, casos `stdout` e `--custo` |
| R4 | F1 | `telemetria.mjs`, caso `poluicao` |
| Contrato do Jev intacto | F1 | `npm run jev` (T1-T16 continuam passando; caso novo: com `BRAIN_TELEMETRIA_DIR` temporário e o falso, `julgar`/`decidir` gravam uma linha cada e o resultado é idêntico ao sem telemetria; `desligado` não grava; `envSemJev` tira `BRAIN_TELEMETRIA` e `BRAIN_TELEMETRIA_DIR`); `node scripts/classificar-parada-teste.mjs` (exigido pelo `CLAUDE.md` quando `hooks/jev.js` muda); `node scripts/gm-triage-jev-teste.mjs` |
| Hook sem regressão | F1 | `npm run injecao -- --desde <d> --ate <d> --base origin/dev --portao jev`, com `<d>` = os três últimos dias completos: stdout do hook novo igual à do base com o Jev desligado, e o oráculo do falso igual |
| CA2 | F2 | `node brain-mcp/scripts/painel-ganho-teste.mjs`: fixture de eventos + transcripts sintéticos cobrindo slash command (`<command-name>` + `<command-args>` e a entrada `isMeta` com o mesmo `promptId`), `<local-command-…>` ignorado, o mesmo caminho em dois itens contado uma vez, basename que aparece no prompt não contando como citado, aberto por `Read`, aberto por `read_doc`, citado por caminho, citado por basename ≥ 12, basename curto que **não** conta, caminho com `\` do Windows, sidechain ignorada, janela que para no próximo prompt, rebusca com ≥ 50% e sem, par por `promptId`, por horário, `sem_par`, `sem_transcript`; números esperados conferidos; `medirAproveitamento` com a chave do contrato |
| CA3 (leitura) | F2 | o mesmo teste: grupos com números conhecidos → médias, Wilson sobre prompts e veredito esperados; `jev_reprovou_tudo` contando no `com_filtro`; `com_filtro` com `jev ≠ 'ok'` dentro da primária e fora da secundária; grupo com menos de 30 prompts → `inconclusivo`; `sem_filtro` fora da taxa normal; sem grupo → `A/B desligado no período` |
| `uso` com sessão | F2 | `node brain-mcp/scripts/uso-sessao.mjs`: com `BRAIN_SOMENTE_CONSULTA=1` (`config.ts:124`; o servidor não vira líder nem indexa) e `BRAIN_CONFIG` apontando para um config temporário sem raízes, banco temporário criado com o schema **antigo** de `uso` (sem `semantica`, `sessao`, `tool_use_id`) e linhas; sobe `dist/index.js` com `BRAIN_DB` nele e `CLAUDE_CODE_SESSION_ID=sessao-teste`, chama `search_context` com `_meta: {"claudecode/toolUseId": "toolu_teste"}` e outra sem `_meta` → as três colunas existem, linhas antigas `NULL`, a primeira nova com `sessao-teste`/`toolu_teste`, a segunda com `sessao-teste`/`NULL`; segundo servidor no mesmo banco sobe sem erro (idempotente); sem a variável → `sessao` `NULL` |
| `brain-mcp/src/` | F2 | `npm run build`, `npm run smoke`, `npm run concorrencia` (o caso da migração), `npm run eval -- --base origin/dev` com `BRAIN_DB`/`BRAIN_CONFIG` do índice vivo (regra 2 do `CLAUDE.md`; código 1 ou 2 = a PR não abre) |
| CA5 | F3 | `node brain-mcp/scripts/painel-prova-teste.mjs`: fixture de eventos e transcripts → `amostrar` com semente fixa produz sempre os mesmos itens, estratificados, sem repetição, sem item sem pergunta, `pergunta` ≤ 500 e `trecho` ≤ 600; `julgar` sem TTY sai 2; `secao` sobre um gabarito com julgamentos conhecidos dá precisão/cobertura/acurácia e a tabela de limiares esperadas; com um `ctx.carregarSecao` de teste que devolve um módulo com `medirAproveitamento` mostra a concordância, com um que devolve `null` mostra a linha da F2; item cujo `trecho_sha` não bate com nenhum chunk da fixture é descartado; a saída não contém caminho nem pergunta |

## Technical Decisions

- **Diário em JSONL por dia em `<CLAUDE_HOME>/brain-telemetria/`, não SQLite nem `brain.db`.** O hook e o `jev.js` são CJS sem dependência e rodam em processos curtos: `appendFileSync` de uma linha custa uma chamada de sistema, não abre banco, não disputa o lock dos oito servidores, e falha sem efeito colateral. `<CLAUDE_HOME>` é alcançável por todos os gravadores e leitores sem depender do `brain-workspaces.json`, e fica fora do repo e da sincronia (`sync.sh` só copia skills e a lista de hooks). Descartados: tabela no `brain.db` (a PR #61 decidiu não gravar telemetria no índice vivo; abrir o banco por prompt custa mais que os 20 ms), arquivo único com rotação por tamanho (apagar o velho exigiria reescrever o arquivo).
- **Opt-in (`BRAIN_TELEMETRIA=1`), e não ligado por padrão.** Os testes do repo chamam o `jev.js` com env mínimo e sobem o hook com o env do shell; ligado por padrão, todo teste gravaria no diário vivo. Opt-in segue o padrão do `BRAIN_JEV` (exportado no `~/.bashrc`, P8). O custo é ter de ligar: está na G5.
- **Sessão do servidor MCP pelo ambiente, mais o `tool_use_id`.** O servidor não recebe payload de hook, mas recebe `CLAUDE_CODE_SESSION_ID` ao subir (P2, medido em 5/5 servidores vivos). Como o id pode envelhecer num `/clear` (não medido), a coluna `tool_use_id` grava o `_meta["claudecode/toolUseId"]` quando o cliente o manda (P4/P5): ele aponta o `tool_use` exato do transcript. Uma migração só, com as duas colunas, em vez de uma segunda depois. Descartado: o servidor ler um arquivo "último prompt" escrito pelo hook (corrida entre sessões paralelas).
- **O hook passa sessão e prompt ao `jev.js` por `opcoes.telemetria`; fora dele, o `jev.js` lê o ambiente.** O `jev.js` não recebe payload e só o hook conhece o `prompt_id`. Descartado: o `jev.js` ler o payload (não tem acesso) ou o hook gravar o evento `jev` no lugar do cliente (deixaria de fora os outros cinco usos).
- **Evento `contexto` em todo desfecho, inclusive os que não injetam.** Sem a linha do "curto" e do "sem candidato", o painel não diria quantas vezes o hook rodou nem a fração que injeta, e a G5 não conferiria cobertura.
- **A/B por SHA-256 do `prompt_id`, só entre prompts que chegariam ao Jev, e só com a telemetria ligada.** Determinístico (o teste prova o grupo; a mesma execução repetida cai no mesmo grupo), sem estado, e os dois grupos saem da mesma população. Proporção na variável (sugestão 0,2 no doc). O `sem_filtro` sai da taxa normal. A comparação usa o prompt como unidade e a intenção de tratar como análise primária (achado 1 do revisor independente: por trecho, e tirando só do `com_filtro` os prompts com Jev indisponível, o veredito favoreceria o filtro por construção); por protocolo fica como secundária. Descartado: julgar em sombra o `sem_filtro` (gastaria a latência do Jev no prompt que justamente não usa o filtro, e cota da API).
- **Aproveitamento pelo transcript, e não só pelo `uso`.** O `Read` de um arquivo não passa pelo MCP; só o transcript vê o trecho aberto por tool ou citado no texto. O `uso` com sessão dá o sinal sem transcript (buscas e `read_doc` na janela do prompt), que continua existindo depois que o transcript some.
- **Recorte por dono de arquivo e interface de seção do painel.** É o que deixa as três PRs andarem em paralelo sem conflito: o agregador (F1) importa seções que podem não existir, e a F3 usa a F2 só se `ganho.mjs` existir.
- **Rotas**: F1 Completa (formato novo em disco e emenda de contrato público do `jev.js`); F2 Completa (formato do índice, a tabela `uso`); F3 Curta (só lê o diário e cria um arquivo local próprio, especificado aqui inteiro; não toca índice, contrato nem hook).
- **Sem mudar limiar nem regra do Jev** (fora do escopo do card); a tabela de limiares hipotéticos da F3 só mostra o efeito, não muda nada.

## Coding Standards

- Português nos comentários e mensagens, como o resto do repo; comentário diz o porquê, com a medição quando houver.
- Hook e `jev.js`: CJS sem dependência, falha em silêncio, nada novo em stdout/stderr; `require` de `telemetria.js` sempre dentro de `try`.
- Scripts: ESM `.mjs`, `node:sqlite` somente leitura, códigos 0/1/2 como `injecao.mjs` e `eval.mjs`.
- Saída de painel e de teste: só contagens (R1), como o aviso de `injecao.mjs:14-16`.
- Nada além do especificado: sem painel visual, sem mudar limiar/regra do Jev, sem telemetria no repo.
