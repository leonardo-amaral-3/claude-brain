# Declarar modelo por estação no frontmatter das skills gm-* — Spec

## References
- Card: [#21](https://github.com/leonardo-amaral-3/claude-brain/issues/21) — repo `leonardo-amaral-3/claude-brain`
- Rota: o card declarou Hotfix; o `/gm-hotfix` recusou em 2026-09-12 (não é S1 — decisão #520). Especificada em
  profundidade **Completa** por escolha de Leonardo em 2026-09-14. O campo Rota do board continua `Hotfix`, também
  por escolha dele.
- Cérebro: decisão #515 (o mecanismo `model`/`effort`, conferido na doc) · decisão #575 (o override medido em
  `claude -p` + auto mode)
- Doc oficial, conferida em 2026-09-12 e 2026-09-14 com Claude Code 2.1.266:
  https://code.claude.com/docs/en/skills.md (tabela de frontmatter) · https://code.claude.com/docs/en/model-config.md ·
  https://code.claude.com/docs/en/permission-modes.md · https://code.claude.com/docs/en/cli-reference.md
- Padrão seguido para achar o executável: `operations-center/src/main/claudeBin.ts`

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir `claude-brain/` no workspace `pessoal`)
- Base branch: `dev` — a partir de `origin/dev` (`74f97a2`); a `dev` local está 13 commits atrás
- Feature branch: `feat/21-modelo-por-estacao`, na worktree `claude-brain-21-modelo-por-estacao`
- **O "deploy" deste repo é o `./sync.sh push`** (repo → `~/.claude/skills`), e não o merge. Ele acontece dentro da
  implementação, antes da PR, sempre com este protocolo:
  1. Na worktree da feature, `./sync.sh status` tem de listar **exatamente** os 12 `skills/gm-*/SKILL.md` e nada
     mais. Qualquer outro arquivo, sobretudo em `brain-mcp/`, é trabalho de outro card instalado na máquina
     (o #18 está em voo). Nesse caso: parar, mostrar a lista ao humano e não fazer push.
  2. O marcador da instalação aponta para outra pasta e outra branch
     (`worktree=/c/Users/lokin/pessoal/claude-brain`, `branch=main`). Por isso o push só avança com `--sobrescrever`,
     e ele só roda depois de o humano escolher num `AskUserQuestion` (header `Sync`, opções Sobrescrever / Parar).
     A `description` de Sobrescrever diz a consequência: a instalação viva passa a ser a desta worktree, e toda
     `/gm-*` desta máquina — `pessoal`, `notoria`, chat do cartão do Operations Center — começa a rodar nos modelos
     da tabela.
  3. Logo depois: `./sync.sh status` e a verificação de `## Verificação pós-deploy`.

## Estado atual (verificado nesta sessão)

**As skills e o doc**
- **As 12 skills não declaram modelo.** Os `skills/gm-*/SKILL.md` têm o mesmo frontmatter nas linhas 1–6: `---`,
  `name`, `description`, `disable-model-invocation: true` (linha 4), `argument-hint`, `---`. Nenhum tem `model:` ou
  `effort:`, nem no repo nem em `~/.claude/skills` (`grep -lE '^(model|effort):'` vazio em 2026-09-14).
- **`gm-tech-spec` existe e o card não a cita.** São 12 linhas DEPRECATED que só mandam usar `/gm-spec`. A lista de
  "demais" do card tem 6 nomes; as skills sem modelo definido no card são 7.
- **O único lugar do repo que escolhe modelo por tarefa** é o hook do diário:
  `hooks/obsidian-diario-titulo.js:20` (`MODELO = process.env.DIARIO_MODELO || 'haiku'`) e `:52` (`'--model', MODELO`).
- **Fim de linha:** todos os `SKILL.md` e o `docs/esteira-gm.md` são LF; `.gitattributes` tem `* text=auto eol=lf`.
- **Não há `scripts/` nem `package.json` na raiz.** Os scripts do servidor ficam em `brain-mcp/scripts/`;
  `brain-mcp/scripts/injecao.mjs:32` resolve a pasta do Claude Code como `CLAUDE_CONFIG_DIR || ~/.claude`.
- **`docs/esteira-gm.md`** (225 linhas):
  - `### Fora da esteira` na linha 124; o último parágrafo (`/defuddle`) termina na 137; a 138 é vazia;
  - `## Como as skills perguntam` na 139;
  - o diagrama recomenda sessão nova **só** para o `/gm-implement` (linha 32).

**Sincronia**
- **`./sync.sh status`** → `Tudo igual entre repo e maquina.`, seguido da lista de skills da instalação fora do repo
  (`obsidian-bases`, `tlc-spec-driven`).
- **O marcador `~/.claude/brain-sync-origem.txt`** registra `worktree=/c/Users/lokin/pessoal/claude-brain`,
  `branch=main`, `data=2026-09-10 17:43:54`.
- **Push de outra pasta ou branch pergunta antes** (`sync.sh:163-209`). Sem terminal, imprime
  `Sem terminal para perguntar, e silencio nao e aprovacao: nada foi copiado.` e sai com 1. `--sobrescrever`
  (`sync.sh:8,22`) segue sem perguntar.
- **O push leva mais do que skills:** também `brain-mcp/src`, `brain-mcp/scripts` e
  `package.json`/`package-lock.json`/`tsconfig.json`/`README.md` do `brain-mcp` (`sync.sh:90-96`).
- **Há outra worktree aberta:** `claude-brain-18-eval-portao-uso-real` (`0db1d94`), do card #18, que mexe em
  `brain-mcp/`.

**Executável**
- **No Windows, o `claude` do PATH é o shim do npm** (`AppData/Roaming/npm/claude`, `.cmd`, `.ps1`), que executa
  `node_modules/@anthropic-ai/claude-code/bin/claude.exe` (2.1.266). Pelo Node, `spawnSync('claude')` dá `ENOENT` e
  `spawnSync('claude.cmd')` dá `EINVAL`, a mesma armadilha que `claudeBin.ts` documenta.
- **`where claude` devolve linhas terminadas em `\r\n`**, nesta ordem: `…\npm\claude` (sem extensão) e
  `…\npm\claude.cmd`.
- **Existe um Claude Code velho fora do PATH:** `~/.local/bin/claude.exe`, versão **2.1.212**. Versões mínimas pela
  doc: Sonnet 5 ≥ 2.1.197, Opus 5 ≥ 2.1.219, Fable 5.1 ≥ 2.1.257.
- **Git Bash converte argumento com `/`:** `claude -p "/zz-skill"` chegou ao Claude Code como
  `C:/Program Files/Git/zz-skill`, e a skill nem foi invocada. Spawn feito pelo Node, sem shell, não passa pela
  camada MSYS.
- **`--max-turns`** não aparece no `--help`, mas está na cli-reference: só em modo `-p`, e sai com erro ao atingir o
  limite. `--disallowedTools` aceita lista separada por vírgula.

**O mecanismo**
- **Medido com uma skill de teste (decisão #575).** Numa pasta descartável, com uma skill declarando
  `model: claude-sonnet-5`, sessão em `claude-opus-5` e `--permission-mode auto`:
  - o evento `init` do stream-json informou `model: claude-sonnet-5` e `permissionMode: auto`;
  - no transcript, **todas** as mensagens do assistente daquele turno saíram com `message.model: claude-sonnet-5` e
    `attributionSkill: zz-prova-modelo`, inclusive a que veio depois de um `tool_result`;
  - o prompt livre seguinte (`--resume … --model claude-opus-5`) respondeu em `claude-opus-5`, sem
    `attributionSkill`.
- **Onde o turno começa e acaba**, medido no transcript desta sessão (`aaffc47c-…`), em ordem de entrada:
  - `/gm-hotfix` abre o `promptId` `9144fdf7`, e a resposta ao `AskUserQuestion` (entrada 50) mantém o mesmo id.
  - A mensagem livre "pq spec? …" (entrada 66) abre `9fc04738`.
  - `/gm-spec` (entrada 82) abre `591a047e`, e as respostas ao `AskUserQuestion` (168, 173, 180) mantêm o mesmo id.
  - No meio do turno, a skill `claude-api` carregada pelo `Skill` troca o `attributionSkill` de `gm-spec` para
    `claude-api` a partir da entrada 165, e ele não volta.
  - A interrupção feita pelo usuário durante um `AskUserQuestion` (entrada 187,
    `tool_result "[Request interrupted by user for tool use]"`) abre `592a89d1`. Dali em diante nenhuma mensagem é
    atribuída à `gm-spec`, e a entrada 189 é `model: <synthetic>`.
- **Não medido:** a combinação "skill com `model:` declarado **e** resposta a `AskUserQuestion`" (a `gm-spec` desta
  sessão não declarava modelo, e o modo `-p` não tem humano). Também não foi medido o modelo depois de uma skill
  carregada dentro de outra. O doc marca a primeira como dedução (TD-12).
- **O transcript registra, por mensagem do assistente:** `message.model`, `effort` e `attributionSkill`.
- **`modelUsage` não é prova:** o resultado de `claude -p` lista `claude-haiku-4-5-20251001` junto do modelo da
  sessão (tarefa de fundo do Claude Code).

**Modelos, custo e provedores**
- **Fable 5.1 disponível e sem crédito extra:** `claude -p --model claude-fable-5-1` respondeu em 2026-09-14, e o
  `/model` de Leonardo não mostra "Requires usage credits" na linha do Fable. O Fable sai da cota do plano.
- **Fable e créditos de uso, pela doc:**
  - em planos que cobram o Fable de créditos, a sessão interativa pede consentimento, e recusar no meio da sessão
    continua o turno no modelo padrão;
  - em `-p` e pelo Agent SDK, a cobrança acontece sem perguntar.
- **Janela de contexto:** na API da Anthropic, Sonnet 5, Opus 5 e Fable 5.1 têm 1M nativo. Entrar numa skill Sonnet
  a partir de uma sessão `opus[1m]` longa não encolhe a janela.
- **Outros provedores, pela doc:** em Bedrock, Google Cloud's Agent Platform, Foundry, Claude Platform on AWS e atrás
  de gateway, "Claude Code passes any string through without checking it". A doc não diz o que acontece com um id
  que o provedor não serve.
- **Sessão retomada, pela doc:** mantém "the model they were using when the transcript was saved".
- **Quem mais roda estas skills:** os dois workspaces desta máquina (`pessoal`, `notoria`) e o chat do cartão do
  Operations Center, que roda pelo Agent SDK. Os smokes do Operations Center usam prompts de texto puro e não invocam
  `gm-*`.

## Requisitos & critérios de aceite

**CA1 — Tabela e frontmatter dizem o mesmo, no repo e na instalação.**
Dado a tabela da seção `## Qual modelo roda cada estação` em `docs/esteira-gm.md`, com as 12 skills e os valores
desta spec, quando rodo `node scripts/prova-modelo.mjs` depois do push feito pelo protocolo de `## Execution`, então:
- o script sai com código 0;
- cada `skills/gm-*/SKILL.md`, no repo **e** em `<CLAUDE_HOME>/skills/`, tem exatamente uma linha `model:` no
  frontmatter, com o valor da tabela;
- nenhum tem `effort:`;
- todo valor é um de `claude-sonnet-5` · `claude-opus-5` · `claude-fable-5-1` · `inherit`;
- o conjunto de skills da tabela é igual ao conjunto de pastas `skills/gm-*` com `SKILL.md`;
- `./sync.sh status` contém `Tudo igual entre repo e maquina.`;
- a seção do doc é o texto desta spec byte a byte, na posição especificada.

A versão do card ("cada `skills/gm-*/SKILL.md` declara `model:`") inclui a `gm-tech-spec`, que declara `inherit`
(TD-4).

**CA2 — A skill roda no modelo dela, em auto mode, com a sessão aberta em outro.**
Dado a instalação sincronizada, quando rodo `node scripts/prova-modelo.mjs --viva`, então o executável resolvido é
Claude Code ≥ 2.1.257. Além disso, para cada modelo da tabela exceto `inherit`, uma skill real daquele modelo é
invocada numa sessão headless em auto mode aberta noutro modelo, com as ferramentas de escrita bloqueadas, e:
- o `init` da sessão informa `permissionMode: auto` e o modelo declarado;
- há ao menos uma mensagem do assistente no turno da skill, a primeira atribuída à skill, e todas com
  `message.model` igual ao declarado;
- nenhuma mensagem do turno é atribuída a outra skill;
- o prompt livre seguinte, na mesma sessão, responde no modelo da sessão e sem `attributionSkill`;
- nenhuma chamada a ferramenta bloqueada aparece;
- o script sai com código 0, e a saída vai literal para a seção `## Evidência` da task que o roda, de onde o
  `/gm-ship` a leva para a PR.

Com a tabela desta spec, são três provas: `gm-explore` (Sonnet 5, sessão em Opus 5), `gm-card` (Opus 5, sessão em
Sonnet 5) e `gm-spec` (Fable 5.1, sessão em Sonnet 5).

**CA3 — O doc diz quanto tempo o modelo vale, quanto custa trocar e quando ele não é usado.**
Dado a seção nova, quando a leio, então ela registra:
- (a) o override vale até o próximo prompt livre e não é salvo em settings;
- (b) dentro do turno, o modelo atravessa chamadas e resultados de ferramenta, e a resposta ao `AskUserQuestion`
  chega no mesmo turno — logo uma `/gm-spec` inteira fica no Fable, **marcado como dedução**. Mensagem livre ou Esc
  no meio de uma pergunta encerra o turno e volta ao modelo da sessão. Invocar a skill de novo traz o modelo de
  volta e recomeça o procedimento dela;
- (c) o cache de prompt é separado por modelo, com a recomendação de abrir a estação em sessão nova quando a atual já
  estiver longa;
- (d) quando o modelo declarado não é usado:
  - auto mode sem suporte ao modelo;
  - `availableModels`;
  - consentimento de créditos do Fable recusado no meio da sessão;
  - cobrança sem pedido em `-p` e no Agent SDK, nos planos em que o Fable cobra créditos;
  - em outro provedor, o Claude Code repassa o id sem conferir;
  - a versão mínima do Claude Code.

## Technical Overview

São três peças, e nada em `brain-mcp/`, nenhum formato em disco e nenhuma tool muda:

1. **Uma linha `model:`** em cada um dos 12 frontmatters, com id completo (`inherit` na `gm-tech-spec`).
2. **A seção `## Qual modelo roda cada estação`** em `docs/esteira-gm.md`: a tabela, que é a fonte da verdade, e as
   regras de uso — duração do override, custo de cache, quando ele não é usado.
3. **`scripts/prova-modelo.mjs`** (novo, sem dependências):
   - sem argumento, confere de graça a tabela contra o frontmatter do repo e o da instalação;
   - com `--viva`, abre uma sessão headless por modelo e prova no `init` e no transcript.

A ordem de entrega é essa. O push (protocolo de `## Execution`) roda **antes** da prova viva, porque é a instalação
que o Claude Code carrega.

## Implementation Details

### 1. Frontmatter das 12 skills

Uma linha nova `model: <valor>`, **imediatamente depois** de `disable-model-invocation: true`. Nada mais muda no
arquivo: nem `description`, nem corpo, nem fim de linha (LF). Exemplo, `skills/gm-spec/SKILL.md`:

```yaml
---
name: gm-spec
description: Create the single specification (requirements + technical) for a board card — …
disable-model-invocation: true
model: claude-fable-5-1
argument-hint: [#issue]
---
```

Valores (idênticos à tabela da seção 2):

| Skill | Modelo |
|---|---|
| `gm-triage` | `claude-sonnet-5` |
| `gm-explore` | `claude-sonnet-5` |
| `gm-card` | `claude-opus-5` |
| `gm-prd` | `claude-fable-5-1` |
| `gm-spec` | `claude-fable-5-1` |
| `gm-tech-spec` | `inherit` |
| `gm-plan-tasks` | `claude-opus-5` |
| `gm-implement` | `claude-sonnet-5` |
| `gm-ship` | `claude-sonnet-5` |
| `gm-correcao` | `claude-opus-5` |
| `gm-release` | `claude-opus-5` |
| `gm-hotfix` | `claude-opus-5` |

### 2. `docs/esteira-gm.md` — seção nova

O conteúdo do bloco abaixo, **byte a byte e com LF**, entra logo depois da linha 138 (a vazia que segue o parágrafo
`/defuddle`), seguido de **uma** linha vazia antes de `## Como as skills perguntam`. Nenhuma outra linha do doc
muda. O bloco é tudo o que está entre a linha ` ````markdown ` e a ` ```` ` que a fecha:

````markdown
## Qual modelo roda cada estação

Cada skill declara no próprio frontmatter o modelo em que roda (`model:`), escolhido pelo que a
estação entrega: **Fable** onde sai documento que outros executam ao pé da letra, **Opus** onde se
julga um artefato ou uma ação sem volta, **Sonnet** onde se lê ou se executa o que já foi decidido.

Esta tabela é a fonte da verdade, e `node scripts/prova-modelo.mjs` confere que os doze `SKILL.md` —
no repo e na instalação — dizem o mesmo que ela. Mudou uma linha aqui? Mude o frontmatter junto, rode
`./sync.sh push` e depois `node scripts/prova-modelo.mjs --viva`.

| Skill | Modelo | Por quê |
|---|---|---|
| `gm-triage` | `claude-sonnet-5` | classifica e deduplica; volume alto, nada sai dela como contrato |
| `gm-explore` | `claude-sonnet-5` | só lê código e responde com evidência |
| `gm-card` | `claude-opus-5` | escreve os critérios de aceite que o resto da esteira herda |
| `gm-prd` | `claude-fable-5-1` | documento de produto que a spec vai seguir ao pé da letra |
| `gm-spec` | `claude-fable-5-1` | o contrato que o implementador executa literalmente |
| `gm-tech-spec` | `inherit` | deprecated: só manda usar `/gm-spec`, e não vale trocar de modelo para isso |
| `gm-plan-tasks` | `claude-opus-5` | cada task é o prompt inteiro de um agente novo; o recorte é julgamento |
| `gm-implement` | `claude-sonnet-5` | executa uma task já decidida; é a estação que mais roda |
| `gm-ship` | `claude-sonnet-5` | roda a suíte e monta a PR a partir do que já existe |
| `gm-correcao` | `claude-opus-5` | julga cada achado do review contra a spec |
| `gm-release` | `claude-opus-5` | reconcilia a fila e conduz merge e tag, que não têm volta |
| `gm-hotfix` | `claude-opus-5` | emergência em produção: diagnóstico sob pressão e ações sem volta |

Ids completos, e não apelidos (`sonnet`, `opus`): a skill roda exatamente o modelo da tabela até
alguém mudar a linha, e trocar de geração é um commit com prova nova — nunca uma troca silenciosa.
Exige Claude Code 2.1.257 ou mais novo, o mínimo do Fable 5.1.

### Quanto tempo o modelo da skill vale

O `model:` troca o modelo **até o seu próximo prompt livre**, e não é salvo em settings.

- Dentro do turno, a skill segue no modelo dela a cada chamada de ferramenta e a cada resultado.
- A resposta que você dá pelo `AskUserQuestion` chega como resultado de ferramenta, no mesmo turno,
  então uma `/gm-spec` inteira fica no Fable enquanto a conversa passar pelas perguntas dela. Isto é
  dedução: foi medido que a resposta chega no mesmo turno e que o modelo da skill atravessa
  resultados de ferramenta, mas não as duas coisas juntas.
- Mensagem digitada livremente encerra o turno, e apertar Esc no meio de uma pergunta para escrever
  outra coisa também. Dali em diante vale o modelo da sessão, mesmo no meio da `/gm-spec`: a
  resposta a um "por que isso?" e tudo o que vier depois rodam nele.
- Para voltar ao modelo da estação, invoque a skill de novo. Ela é carregada outra vez e recomeça o
  procedimento dela, com o que já está na conversa como contexto.

### Trocar de modelo custa cache

O cache de prompt é separado por modelo. Numa sessão que já carregou muito contexto, a primeira
resposta da skill lê tudo sem cache no modelo dela, e na volta ao modelo da sessão o que estava em
cache antes da skill só é aproveitado se ainda não tiver expirado. Numa sessão longa, isso come a
economia que motivou declarar o modelo. Por isso, **quando a sessão atual já estiver longa, abra a
estação numa sessão nova**: é a orientação que o caminho acima dá ao `/gm-implement`, agora valendo
para todas.

### Quando o modelo declarado não é usado

A sessão fica no modelo em que está, sem erro, quando:

- ela roda em **auto mode** (ou em plan mode com o classificador) e o modelo declarado não é
  suportado por ele — na API da Anthropic, Haiku e Sonnet/Opus anteriores ao 4.6;
- o id está fora do `availableModels` da organização;
- o seu plano cobra o Fable de créditos de uso e você recusa o pedido de consentimento no meio da
  sessão: o turno continua no modelo padrão.

Nesses planos, em `claude -p` e pelo Agent SDK — o chat do cartão do Operations Center roda por ele —,
o Fable é cobrado dos créditos de uso sem pedido de consentimento.

Em Bedrock, Google Cloud's Agent Platform, Foundry ou atrás de um gateway, o Claude Code repassa o id
sem conferir, e é o provedor quem decide o que fazer com um id que não serve. Quem usa outro provedor
troca a tabela, o frontmatter e a lista `IDS` do topo de `scripts/prova-modelo.mjs` pelos ids de lá, e
roda a prova.
````

O script lê a tabela por máquina e depende de três coisas:
- o heading exato `## Qual modelo roda cada estação`;
- as linhas no formato `` | `gm-xxx` | `valor` | texto | ``;
- a seção terminar no próximo heading de nível 2 (linha que começa com `"## "`). Os `### ` internos não terminam a
  seção.

### 3. `scripts/prova-modelo.mjs` (novo)

ESM, Node ≥ 20, só módulos nativos (`node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`,
`node:url`). Sem `package.json` na raiz.

**Uso** (vai no comentário do topo, no estilo de `brain-mcp/scripts/injecao.mjs:1-20`):

```
node scripts/prova-modelo.mjs [--repo <dir>]          estática: tabela × repo × instalação, sem custo
node scripts/prova-modelo.mjs --viva [--repo <dir>]   estática e, se verde, as sondas vivas (gasta cota)
```

**Argumentos e códigos de saída:**
- `--repo` recebe um diretório, resolvido com `path.resolve`.
- `--repo` sem valor, `--repo` vazio ou qualquer outro argumento → `uso: node scripts/prova-modelo.mjs [--viva]
  [--repo <dir>]` no stderr e código **2**.
- Código **0**: tudo verde. Código **1**: alguma FALHA.

**Constantes:**
- `REPO`: o `--repo` resolvido, ou `join(dirname(fileURLToPath(import.meta.url)), "..")`.
- `CLAUDE_HOME`: `process.env.CLAUDE_CONFIG_DIR || join(os.homedir(), ".claude")`.
- `SECAO`: `"## Qual modelo roda cada estação"`.
- `IDS`: `["claude-sonnet-5", "claude-opus-5", "claude-fable-5-1"]`. `inherit` é aceito à parte.
- `VERSAO_MINIMA`: `[2, 1, 257]`, o mínimo do Fable 5.1.
- `PREFERENCIA`: `["gm-explore", "gm-triage", "gm-card", "gm-spec", "gm-prd", "gm-plan-tasks", "gm-correcao",
  "gm-ship", "gm-release", "gm-hotfix", "gm-implement"]`.
- `BLOQUEADAS`: `["Bash", "PowerShell", "Write", "Edit", "NotebookEdit", "Agent", "EnterWorktree", "ExitWorktree",
  "CronCreate", "CronDelete", "RemoteTrigger", "Workflow"]`.
- `ARG`: `"sonda da prova-modelo (card #21): nao escreva nada, nao crie nada e nao invoque outras skills"`.

**Leitura de arquivo:** todo texto lido (doc, `SKILL.md` do repo e da instalação, transcript) passa por
`.replace(/\r\n/g, "\n")` antes de qualquer comparação.

**Parte estática.** Todas as falhas são coletadas; o script imprime todas e só então sai com 1.

1. **Tabela** (`REPO/docs/esteira-gm.md`): da linha igual a `SECAO` até a próxima linha que começa com `"## "`,
   exclusive. Linhas que casam `/^\|\s*`(gm-[a-z-]+)`\s*\|\s*`([^`]+)`\s*\|/` viram `{skill → valor}`, na ordem do
   arquivo.
   - Seção ausente → `FALHA: docs/esteira-gm.md sem a seção "## Qual modelo roda cada estação"`. A estática para
     aqui, porque não há contra o que comparar.
   - Skill repetida → `FALHA: <skill> aparece N vezes na tabela`.
2. **Conjuntos:** `SKILLS_REPO` são as pastas `REPO/skills/gm-*` que contêm `SKILL.md`.
   - Em `SKILLS_REPO` e fora da tabela → `FALHA: <skill> sem linha na tabela`.
   - Na tabela e fora de `SKILLS_REPO` → `FALHA: <skill> está na tabela e não existe em skills/`.
3. **Valor**, para cada linha da tabela: tem de estar em `IDS` ou ser `inherit`. Senão:
   `FALHA: <skill> declara "<valor>" na tabela — use id completo (IDS) ou inherit`.
4. **Frontmatter**, só para as skills que estão **na tabela e em `SKILLS_REPO`**, lido em
   `REPO/skills/<skill>/SKILL.md` (`<onde>` = `repo`) e em `CLAUDE_HOME/skills/<skill>/SKILL.md`
   (`<onde>` = `instalação`):
   - Arquivo ausente na instalação → `FALHA: instalação sem <skill> — rode ./sync.sh push`.
   - Primeira linha diferente de `---` → `FALHA: <onde> <skill> sem frontmatter`.
   - Nenhuma outra linha `---` depois → `FALHA: <onde> <skill> com frontmatter sem fechamento`.
   - Nas linhas do frontmatter, as que casam `/^model:/`:
     - zero → `FALHA: <onde> <skill> sem model:`;
     - mais de uma → `FALHA: <onde> <skill> com N linhas model:`;
     - uma que não casa `/^model:\s*(\S+)\s*$/` → `FALHA: <onde> <skill> com model: malformado (<linha>)`;
     - valor diferente da tabela → `FALHA: <onde> <skill> declara <x>, a tabela diz <y>`.
   - Qualquer linha `/^effort:/` → `FALHA: <onde> <skill> declara effort: (a spec do #21 decidiu só modelo)`.
5. **Saída:** uma linha por skill em que repo e instalação estão verdes, `ok  <skill>  <valor>`, e ao final
   `estática: <N> ok` (N = skills verdes) ou a lista de falhas.

**Parte viva.** Só com `--viva`, e só se a estática saiu sem nenhuma falha: tabela quebrada não gasta cota.

1. **Achar o executável**, no desenho de `claudeBin.ts`, antes de qualquer sonda:
   1. `BRAIN_CLAUDE_BIN` com valor não-vazio depois de `trim`. Se o caminho existe, usa. Se não existe:
      `FALHA: BRAIN_CLAUDE_BIN aponta para <x>, que não existe.` — e não cai para o degrau seguinte.
   2. Em `win32`: `execFileSync("where", ["claude"], { encoding: "utf8" })`, separado com `.split(/\r?\n/)`,
      `.map(l => l.trim())` e `.filter(l => l !== "")`. As linhas são percorridas na ordem, com `node:path/win32`:
      - extensão `.exe` e o arquivo existe → usa;
      - `.cmd` → `join(dirname(linha), "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe")`, se
        existir;
      - qualquer outra extensão, inclusive nenhuma → pula;
      - `where` que lança conta como lista vazia.
   3. Em `win32`: `join(os.homedir(), ".local", "bin", "claude.exe")`, se existir.
   4. Fora de `win32`: `"claude"`, que o spawn resolve pelo PATH.
   5. Nada achado → `FALHA: Claude Code não encontrado — aponte BRAIN_CLAUDE_BIN para o executável.`
   6. **Versão:** `spawnSync(bin, ["--version"], { encoding: "utf8" })`, e o primeiro `/(\d+)\.(\d+)\.(\d+)/` do
      stdout é comparado com `VERSAO_MINIMA`.
      - Abaixo do mínimo → `FALHA: <bin> é <versão>; a prova exige Claude Code ≥ 2.1.257 — rode claude update ou
        aponte BRAIN_CLAUDE_BIN`.
      - Sem versão legível → `FALHA: <bin> não informou versão`.
      - Imprime `bin: <caminho> (<versão>)`.
   - Qualquer falha deste passo encerra a parte viva sem rodar sondas.
2. **Escolher as sondas:** para cada valor de `IDS` presente na tabela, em ordem de primeira aparição na tabela, a
   primeira skill de `PREFERENCIA` com aquele valor. O modelo da sessão é `claude-opus-5` quando o declarado é
   `claude-sonnet-5`, e `claude-sonnet-5` nos demais casos. Modelo sem skill em `PREFERENCIA` →
   `FALHA: nenhuma skill sondável para <modelo>`. Com a tabela desta spec, a ordem é `gm-explore`, `gm-card`,
   `gm-spec`.
3. **Cada sonda, em série.** Uma sonda que falha não interrompe as seguintes.
   1. `cwd = fs.mkdtempSync(join(os.tmpdir(), "prova-modelo-"))`, uma pasta vazia e sem `CLAUDE.md`, e
      `sid = crypto.randomUUID()`.
   2. Opções de spawn: `{ cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 600000,
      maxBuffer: 64 * 1024 * 1024 }`, **sem `shell`**.
   3. Flags comuns: `["--permission-mode", "auto", "--strict-mcp-config", "--settings", '{"disableAllHooks":true}',
      "--disallowedTools", BLOQUEADAS.join(","), "--output-format", "stream-json", "--verbose"]`.
   4. **Rodada 1 (a skill):** `spawnSync(bin, ["-p", "/" + skill + " " + ARG, "--model", sessao, "--session-id",
      sid, "--max-turns", "2", ...comuns], opções)`.
   5. **Rodada 2 (o prompt livre)**, só se a rodada 1 subiu: `spawnSync(bin, ["-p", "responda apenas: ok",
      "--resume", sid, "--model", sessao, "--max-turns", "1", ...comuns], opções)`.
   6. **O código de saída do processo não é critério:** `--max-turns` sai com erro ao atingir o limite. A rodada
      "não subiu" quando `spawnSync` devolve `error` ou quando o stdout não tem evento `init`. Nesse caso:
      `FALHA: <skill> rodada N não subiu: <error.code ou as últimas 20 linhas do stderr>`.
   7. **`init`:** a primeira linha do stdout que é JSON com `type === "system" && subtype === "init"`. Linhas que não
      são JSON são ignoradas.
      - `permissionMode !== "auto"` → `FALHA: <skill> rodada N sem auto mode (<valor>) — a prova do CA2 não vale
        fora dele`.
      - `init.model`, sem um sufixo `[1m]` final, tem de ser o declarado na rodada 1 e `sessao` na rodada 2. Senão:
        `FALHA: <skill> rodada N init em <x>, esperado <y>`.
   8. **Transcript:** o arquivo `<sid>.jsonl` procurado em cada subpasta de `CLAUDE_HOME/projects`. Ausente →
      `FALHA: <skill> sem transcript <sid>.jsonl`. As entradas são lidas em ordem de arquivo, e linhas que não são
      JSON são ignoradas.
      - A **rodada 1** é o `promptId` da primeira entrada `type === "user"`.
      - A **rodada 2** é o primeiro `promptId` de entrada `user` diferente desse.
      - Cada entrada `assistant` pertence ao `promptId` da última entrada `user` antes dela.
      - Entradas `assistant` com `message.model === "<synthetic>"` não contam.
   9. **Asserções no transcript** (cada violação vira uma FALHA que nomeia skill, rodada e valor visto):
      - **Rodada 1:**
        - ≥ 1 mensagem, senão `FALHA: <skill> rodada 1 sem resposta do assistente`;
        - a primeira com `attributionSkill === skill`;
        - toda mensagem com `message.model === declarado`;
        - nenhuma com `attributionSkill` definido e diferente de `skill`, senão
          `FALHA: <skill> rodada 1 carregou a skill <x> — sonda inconclusiva`.
      - **Rodada 2:** ≥ 1 mensagem; toda com `message.model === sessao` e sem `attributionSkill`.
      - **Em qualquer rodada:** bloco `tool_use` com `name` em `BLOQUEADAS` →
        `FALHA: <skill> chamou <name>, que devia estar bloqueada`.
   10. **Evidência impressa antes da limpeza**, uma linha por sonda, com o **conjunto** de modelos vistos em cada
       rodada:
       `<skill>  declarado <m>  sessão <s>  init <permissionMode>  skill: <n> msgs em {<modelos>}  livre: <k> msgs
       em {<modelos>}  ok|FALHA`.
   11. **Limpeza, em `finally`:**
       - `fs.rmSync(cwd, { recursive: true, force: true })`;
       - a pasta do transcript (`dirname` do `.jsonl`) só é apagada **se** seu nome terminar com
         `basename(cwd).replace(/[^A-Za-z0-9]/g, "-")`. Nenhuma outra pasta é apagada, nunca;
       - erro de `rmSync` vira `aviso: não apaguei <caminho>: <mensagem>` e não muda o código de saída;
       - o script imprime o que apagou.
4. **Saída:** `viva: <N> ok` (N = sondas verdes) e código 0 se nenhuma falhou; senão a lista de falhas e código 1.

## File Change Summary

| Arquivo | Muda |
|---|---|
| `skills/gm-{triage,explore,card,prd,spec,tech-spec,plan-tasks,implement,ship,correcao,release,hotfix}/SKILL.md` | +1 linha `model:` depois de `disable-model-invocation: true` |
| `docs/esteira-gm.md` | + a seção da Implementation 2, depois da linha 138 atual, e uma linha vazia |
| `scripts/prova-modelo.mjs` | novo |
| `planning/21-modelo-por-estacao/spec.md` e `tasks/` | esta spec e as tasks do `/gm-plan-tasks` (a task da prova viva ganha `## Evidência`) |

Não mudam: `README.md`, `CLAUDE.md`, `brain-mcp/`, `hooks/`, `templates/`, `install.*`, `sync.*`.

## Migrations & compatibilidade

**Formato em disco, schema e tools: N/A** — nenhum dos três muda. O que muda é comportamento, a partir do push:
- **Alcance:** vale para toda invocação de `/gm-*` nesta máquina — workspaces `pessoal` e `notoria` e o chat do
  cartão do Operations Center —, inclusive as estações seguintes deste próprio card (`/gm-implement`, `/gm-ship`).
- **Sessão já aberta:** não precisa reiniciar. O modelo é lido quando a skill é invocada.
- **Versão:** exige Claude Code ≥ 2.1.257 (Fable 5.1). Nesta máquina o do PATH é 2.1.266; o `~/.local/bin/claude.exe`
  2.1.212 fica fora do PATH e o script o recusa.
- **Janela:** Sonnet 5, Opus 5 e Fable 5.1 têm 1M nativo na API da Anthropic, então nenhuma troca encolhe a janela.
- **Cobrança:** o Fable sai da cota do plano de Leonardo. Em planos que cobram o Fable de créditos, o chat do cartão e
  o `--viva` cobram sem perguntar (documentado na seção nova).
- **Outro provedor, `availableModels`, auto mode sem suporte:** documentados na seção nova.
- **Custo:** o cache perdido na troca vai documentado, com a recomendação de sessão nova.
- **Outro card em voo:** o push de uma worktree leva também `brain-mcp/` (`sync.sh:90-96`). O protocolo de
  `## Execution` impede este push de sobrescrever a instalação de outro card.

## Rollback

1. **Parar o efeito na máquina**, que é o que importa aqui:
   - `git worktree add <workspace>/claude-brain-rollback-21 <commit da origin/dev anterior ao merge do #21>`;
   - nela, `./sync.sh status`, que deve listar os 12 `skills/gm-*/SKILL.md`;
   - `./sync.sh push --sobrescrever`, depois de o humano escolher Sobrescrever num `AskUserQuestion`, pelo mesmo
     protocolo de `## Execution`;
   - `grep -lE '^model:' ~/.claude/skills/gm-*/SKILL.md` sai vazio;
   - `git worktree remove` da pasta.
2. **Registrar no git:** `git revert` dos commits do card numa branch a partir de `origin/dev`, com PR para a `dev`.
   Se já tiverem ido para a `main` num trem, o revert segue pelo próximo trem. Reverter também o script é aceitável:
   sem a seção no doc, a estática dele falha e avisa.

Não há dado nem estado para desfazer. Editar o frontmatter direto na instalação **não** é rollback (`CLAUDE.md`,
Regra 1).

## Verificação pós-deploy

O deploy é o push. A verificação roda em dois momentos, contra a instalação:

1. **Logo depois do push, na worktree da feature** (é a task da prova viva):
   - `./sync.sh status` contém `Tudo igual entre repo e maquina.`;
   - `node scripts/prova-modelo.mjs --viva` sai com código 0, com `estática: 12 ok` e `viva: 3 ok`. A saída vai
     literal para `## Evidência` da task.
2. **Depois do merge na `dev`:** numa worktree temporária em `origin/dev`:
   - `./sync.sh status` não lista nenhum `skills/gm-*/SKILL.md`;
   - `node scripts/prova-modelo.mjs` (estática) sai com código 0;
   - remover a worktree.
   Se o `/gm-correcao` tiver mexido em skills ou no doc antes do merge, o push da seção `## Execution` roda de novo,
   seguido da estática. O `--viva` só roda de novo se a tabela mudou.

A mudança não mexe em dado, então pela regra do workspace o G5 não é bloqueante. Mesmo assim, a prova viva é o
que fecha o CA2. O merge na `main` não muda nada nesta máquina.

## Plano de testes

Não há runner no repo; a prova é o script mais comandos únicos rodados na task, com shell em Git Bash a partir da
raiz da worktree. Duas regras:
- Nos greps com acento, use `grep -F` (literal): classe de caractere com `ã` falha com `LANG` vazio (emenda de
  2026-09-09 no card #5).
- A suíte que o `/gm-ship` roda é T1–T4, T6, T9–T11. **T5 e T7 não rodam no `/gm-ship`**: T7 gasta cota, e a
  evidência dele já está na task.

| Teste | Critério | Como | Passa quando |
|---|---|---|---|
| T1 | CA1 | `node scripts/prova-modelo.mjs` (depois do push de `## Execution`) | código 0; 12 linhas `ok`; `estática: 12 ok` |
| T2 | CA1 | `./sync.sh status` | a saída contém `Tudo igual entre repo e maquina.` |
| T3 | CA1 | tabela do doc = tabela desta spec (comando abaixo) | `diff` vazio |
| T4 | CA1 | seção do doc = bloco desta spec, byte a byte e na posição (comando abaixo) | os dois `diff` vazios; `numstat` = `71	0` (o bloco tem 70 linhas, mais a linha vazia) |
| T5 | CA2 | `node scripts/prova-modelo.mjs --viva`, **rodado do Git Bash**, depois do push | código 0; `bin: … (2.1.266)`; três linhas de evidência `ok` — `gm-explore` (declarado `claude-sonnet-5`, sessão `claude-opus-5`), `gm-card` (`claude-opus-5`, sessão `claude-sonnet-5`), `gm-spec` (`claude-fable-5-1`, sessão `claude-sonnet-5`) — todas com `init auto`; `viva: 3 ok`. Saída colada em `## Evidência` |
| T6 | CA1 | negativos da estática, cada um numa cópia (comandos abaixo) | a cópia sem mutação sai 0; cada mutação sai 1 com a FALHA indicada |
| T7 | CA2 | a viva não gasta cota com a estática vermelha (comando abaixo) | código 1, `FALHA: repo gm-ship sem model:`, e **nenhuma** linha `BRAIN_CLAUDE_BIN aponta para` nem `bin:` |
| T8 | CA2 | `BRAIN_CLAUDE_BIN=/nao/existe node scripts/prova-modelo.mjs --viva` | código 1, `FALHA: BRAIN_CLAUDE_BIN aponta para`, e nenhuma linha de sonda |
| T9 | CA2 | depois de T5: `ls "$HOME/.claude/projects" \| grep -c prova-modelo` e `ls "$(node -p 'require("os").tmpdir()')" \| grep -c prova-modelo` | `0` e `0` |
| T10 | CA3 | frases obrigatórias ancoradas na seção (comando abaixo), no `HEAD` da branch e na `origin/dev` | nenhuma `FALTA` no `HEAD`; 14 `FALTA` na `origin/dev` |
| T11 | escopo | `git diff --numstat origin/dev...HEAD -- skills/` e `git diff --stat origin/dev...HEAD` | 12 linhas `1	0` em `skills/`; nenhum arquivo fora do `## File Change Summary` |
| T12 | uso | `node scripts/prova-modelo.mjs --repo` e `node scripts/prova-modelo.mjs --xyz` | código 2 e a linha `uso:` nos dois |
| — | `brain-mcp` | `npm run smoke` / `npm run eval` | **N/A**: `brain-mcp/` não muda (a regra 2 do `CLAUDE.md` vale para `brain-mcp/src/`) |

**T3 — tabela do doc igual à da spec:**

```bash
linhas() { grep -oE '^\| `gm-[a-z-]+` \| `[^`]+`' | sort -u ; }
diff <(linhas < planning/21-modelo-por-estacao/spec.md) \
     <(sed -n '/^## Qual modelo roda cada estação/,/^## Como as skills perguntam/p' docs/esteira-gm.md | linhas)
```

**T4 — seção byte a byte e na posição:**

```bash
bloco() { awk '/^````markdown$/{f=1;next} /^````$/{f=0} f' planning/21-modelo-por-estacao/spec.md ; }
diff <(bloco) <(sed -n '/^## Qual modelo roda cada estação/,/^## Como as skills perguntam/p' docs/esteira-gm.md | sed '$d' | sed '$d')
diff <(git show origin/dev:docs/esteira-gm.md | sed -n '1,138p') <(sed -n '1,138p' docs/esteira-gm.md)
git diff --numstat origin/dev...HEAD -- docs/esteira-gm.md     # 71	0
bloco | wc -l                                                  # 70 (ensaiado em 2026-09-14 numa cópia simulada)
```

**T6 — negativos da estática.** Cada caso roda numa cópia nova, apagada ao fim:

```bash
copia() { T=$(mktemp -d); cp -R skills docs "$T/"; mkdir -p "$T/home"; cp -R skills "$T/home/"; }
roda()  { CLAUDE_CONFIG_DIR="$T/home" node scripts/prova-modelo.mjs --repo "$T"; echo "saiu $?"; rm -rf "$T"; }

copia; roda                                                                   # base: saiu 0
copia; sed -i 's/^model: claude-opus-5$/model: claude-sonnet-5/' "$T/skills/gm-card/SKILL.md"; roda
                                                                              # repo gm-card declara claude-sonnet-5, a tabela diz claude-opus-5
copia; sed -i '/^model:/d' "$T/skills/gm-ship/SKILL.md"; roda                 # repo gm-ship sem model:
copia; sed -i '/^model:/a model: claude-opus-5' "$T/skills/gm-release/SKILL.md"; roda
                                                                              # repo gm-release com 2 linhas model:
copia; sed -i 's/^model: claude-opus-5$/model:/' "$T/skills/gm-hotfix/SKILL.md"; roda
                                                                              # repo gm-hotfix com model: malformado (model:)
copia; sed -i '/^model:/a effort: high' "$T/skills/gm-triage/SKILL.md"; roda  # repo gm-triage declara effort:
copia; sed -i 's/`gm-explore` | `claude-sonnet-5`/`gm-explore` | `sonnet`/' "$T/docs/esteira-gm.md"
       for d in "$T/skills" "$T/home/skills"; do sed -i 's/^model: claude-sonnet-5$/model: sonnet/' "$d/gm-explore/SKILL.md"; done; roda
                                                                              # gm-explore declara "sonnet" na tabela — use id completo
copia; sed -i '/^| `gm-hotfix` |/d' "$T/docs/esteira-gm.md"; roda             # gm-hotfix sem linha na tabela
copia; sed -i '/^| `gm-ship` |/a | `gm-fantasma` | `claude-opus-5` | x |' "$T/docs/esteira-gm.md"; roda
                                                                              # gm-fantasma está na tabela e não existe em skills/ (e nenhuma FALHA de frontmatter para ela)
copia; sed -i 's/^model: claude-fable-5-1$/model: claude-opus-5/' "$T/home/skills/gm-spec/SKILL.md"; roda
                                                                              # instalação gm-spec declara claude-opus-5, a tabela diz claude-fable-5-1
copia; rm -r "$T/home/skills/gm-prd"; roda                                    # instalação sem gm-prd
copia; sed -i '1d' "$T/skills/gm-correcao/SKILL.md"; roda                     # repo gm-correcao sem frontmatter
copia; sed -i 's/\r*$/\r/' "$T/home/skills/gm-implement/SKILL.md"; roda       # CRLF na instalação: saiu 0 (normalizado)
```

**T7 — a viva não roda com a estática vermelha:**

```bash
T=$(mktemp -d); cp -R skills docs "$T/"; sed -i '/^model:/d' "$T/skills/gm-ship/SKILL.md"
BRAIN_CLAUDE_BIN=/nao/existe node scripts/prova-modelo.mjs --viva --repo "$T"; echo "saiu $?"; rm -rf "$T"
```

**T10 — frases obrigatórias do CA3:**

```bash
frases=( 'até o seu próximo prompt livre' 'não é salvo em settings' 'AskUserQuestion' 'no mesmo turno' 'dedução'
         'apertar Esc' 'invoque a skill de novo' 'cache de prompt é separado por modelo'
         'estação numa sessão nova' 'auto mode' 'availableModels' 'créditos de uso' 'repassa o id' '2.1.257' )
confere() { S=$(sed -n '/^## Qual modelo roda cada estação/,/^## Como as skills perguntam/p'); for p in "${frases[@]}"; do grep -qF -- "$p" <<<"$S" || echo "FALTA: $p"; done; }
git show HEAD:docs/esteira-gm.md | confere           # nenhuma saída
git show origin/dev:docs/esteira-gm.md | confere     # 14 linhas FALTA
```

## Technical Decisions

- **TD-1 — Id completo, não apelido.** Escolha de Leonardo. A skill roda exatamente o modelo da tabela até alguém
  editar, e trocar de geração é commit com prova nova.
  - Descartado: o apelido, que segue as gerações novas e se adapta a outro provedor, mas troca o modelo sem commit e
    sem prova.
  - Consequência aceita: em outro provedor o id é repassado sem conferência. O doc manda trocar a tabela, o
    frontmatter e `IDS`, e o script recusa apelido (T6).
- **TD-2 — Só modelo, nenhum `effort:`.** Escolha de Leonardo. Cada estação herda o esforço da sessão (hoje `xhigh`).
  - Descartados: esforço em todas, e esforço só onde difere.
  - O script falha se algum `effort:` aparecer, para a decisão não se desfazer calada.
- **TD-3 — Critério "pelo que a etapa entrega".** Escolha de Leonardo:
  - Fable onde sai documento executado ao pé da letra (spec, prd);
  - Opus onde se julga um artefato ou uma ação sem volta (card, plan-tasks, correcao, release, hotfix);
  - Sonnet onde se lê ou executa (triage, explore, implement, ship).
  - Descartados: Fable também em plan-tasks e hotfix (mais caro); Fable só na spec; release em Sonnet.
  - Os cinco pontos de partida do card ficaram como estavam.
  - Reconfirmada depois da crítica: o Fable sai da cota do plano de Leonardo (sem "Requires usage credits" no
    `/model`, 2026-09-14).
- **TD-4 — `gm-tech-spec` declara `inherit`.** Escolha de Leonardo. Mantém o CA1 do card ao pé da letra para as 12,
  sem troca de modelo para ler um redirecionamento. Descartados: não tocar (como no #5) e declarar Fable por simetria.
- **TD-5 — Prova em script versionado.** Escolha de Leonardo. `scripts/prova-modelo.mjs` na raiz, porque não é
  script do `brain-mcp`.
  - A parte que gasta cota fica atrás de `--viva`, só roda com a estática verde, e fica fora da suíte do `/gm-ship`.
  - Em planos que cobram o Fable de créditos, a sonda do Fable cobraria sem perguntar, e isso vai no comentário do
    topo do script.
  - Descartados: comando único na task (sem prova pronta na próxima mudança da tabela) e sessão manual (mesmo risco
    do T5 do #5, decisão #448).
- **TD-6 — O doc registra o custo de cache e recomenda sessão nova.** Escolha de Leonardo. Estende a todas as
  estações a orientação que o diagrama dá ao `/gm-implement`. Descartados: só o fato, e não registrar.
- **TD-7 — A sonda roda skill real, em pasta vazia, com escrita bloqueada.**
  - Skill real porque o CA2 é sobre as `gm-*`, e não sobre uma skill de teste.
  - A pasta temporária não tem `CLAUDE.md`: as skills de board param na checagem de `## Board`, antes de escrever.
  - `--disallowedTools` e `--strict-mcp-config` (sem `lembrar`) são a segunda camada.
  - `disableAllHooks` evita nota de diário e injeção do cérebro.
  - `--max-turns` limita o custo.
  - `PREFERENCIA` põe primeiro as skills que só leem ou que param cedo; `gm-implement` fica por último porque cria
    branch e worktree.
  - Skill carregada dentro da sonda torna a sonda inconclusiva, e não verde: foi medido que o `attributionSkill`
    troca de dono.
- **TD-8 — Executável achado como no `claudeBin.ts`**, com a variável `BRAIN_CLAUDE_BIN` (prefixo dos envs deste
  repo: `BRAIN_CONFIG`, `BRAIN_DB`).
  - A separação de linhas do `where` é `/\r?\n/` com `trim`, como em `claudeBin.ts`: sem isso, o `.cmd\r` seria
    pulado e a cadeia cairia no 2.1.212.
  - A versão é conferida antes de gastar cota.
  - Spawn sempre sem shell: o Node recusa `.cmd`, e sem shell a camada MSYS não converte o `/` do slash command.
  - Fora do Windows, só o degrau do PATH, porque o repo é público e o `install.sh` cobre macOS e Linux.
- **TD-9 — A prova é o `init` e o transcript, nunca o `modelUsage`**, que inclui a Haiku de fundo do Claude Code.
  Entradas `<synthetic>` não contam como resposta.
- **TD-10 — O push acontece antes da PR.** É a prática do repo (decisão #448: o deploy é o `sync push`) e é
  inevitável aqui, porque o Claude Code só carrega a instalação. Uma instalação alternativa via `CLAUDE_CONFIG_DIR`
  para a prova viva foi descartada: as credenciais moram na mesma pasta.
- **TD-11 — Push da worktree por protocolo explícito.**
  - O status tem de listar só as 12 skills.
  - `--sobrescrever` só depois de escolha humana por `AskUserQuestion`.
  - Qualquer arquivo de `brain-mcp/` na lista para tudo.
  - Sem isso, o push sai com 1 no shell do agente (`sync.sh:206-208`), ou desfaz a instalação do #18.
- **TD-12 — "Resposta ao `AskUserQuestion` mantém o modelo" entra no doc como dedução.** Escolha de Leonardo. As
  duas metades foram medidas (mesmo `promptId`; modelo atravessando `tool_result`); a combinação não foi.
  Descartados: medir agora numa skill descartável interativa, e teste manual na task.
- **Fora do escopo** (do card, mais o que surgiu aqui):
  - `context: fork`;
  - `haiku` em qualquer estação;
  - fazer do script um portão do `/gm-ship`;
  - mencionar modelos no `README.md`;
  - trocar o modelo do hook do diário;
  - medir o modelo depois de skill aninhada;
  - remover o `~/.local/bin/claude.exe` 2.1.212.

## Coding Standards

- **Script:** só módulos nativos, ESM, zero dependência. Comentário de topo em pt-BR com o uso e os porquês, no estilo
  de `brain-mcp/scripts/injecao.mjs:1-20`. Os porquês que precisam estar lá:
  - spawn sem shell (`.cmd` com `EINVAL` e a camada MSYS);
  - `init` e transcript, e não `modelUsage`;
  - pasta vazia com escrita bloqueada;
  - por que a viva exige a estática verde;
  - a cobrança do Fable em créditos de uso, nos planos em que existe.
- **Processos:** `spawnSync`/`execFileSync` com array de argumentos; **nunca** `shell: true`. Linhas do `where` com
  `node:path/win32`.
- **Mensagens:** em pt-BR. Toda falha nomeia skill, lugar (repo, instalação ou rodada) e o valor visto contra o
  esperado.
- **Markdown:** as 12 edições de frontmatter são uma linha cada; o doc recebe o bloco da Implementation 2 byte a
  byte, com LF.
- **Nada além do especificado:** sem `effort:`, sem refactor nas skills, sem mexer em `README.md`, e sem guardar
  histórico das sondas fora de `## Evidência` da task.
