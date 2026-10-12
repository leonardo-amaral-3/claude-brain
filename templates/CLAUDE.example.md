# Workspace <nome>

> Modelo do `CLAUDE.md` de um workspace que usa o brain + a esteira `gm-*`.
> Copie para a raiz do workspace (a pasta que contem `claude/` e os repos) e preencha.
> As skills `gm-*` **leem o board daqui** — nao ha ID escrito dentro delas.

## Regra 1: o cérebro vem antes da exploração

Existe um MCP local chamado `brain` que indexa **todo** o contexto deste produto — specs de
planning (PRD/tech-spec/tasks), docs, diário de sessões, notas de memória, mapas de arquitetura,
cards e PRs do GitHub e o código-fonte dos repos.

**Antes de abrir arquivo na mão, rodar Grep/Glob ou lançar agente de exploração para entender
finalidade, histórico ou localização de algo no produto, consulte o cérebro.** As tools são:

- `mcp__brain__search_context` — busca unificada. É o ponto de partida quase sempre.
- `mcp__brain__read_doc` — lê o documento (ou uma seção) que a busca apontou.
- `mcp__brain__vizinhanca` — o que está ligado a um card, PR, feature ou arquivo. Use **antes de
  mexer em algo** para saber o que aquilo puxa junto.
- `mcp__brain__lembrar` — grava uma decisão no cofre e no grafo. Ver Regra 2.
- `mcp__brain__feature_timeline` — em que pé está uma feature e o que já foi decidido nela.
- `mcp__brain__list_features` — o que já existe, antes de propor algo novo.
- `mcp__brain__recent_activity` — briefing de início de sessão.

Se essas tools aparecerem como *deferred* (só o nome, sem schema), carregue os schemas com
`ToolSearch("select:mcp__brain__search_context,mcp__brain__read_doc")`.

Como buscar bem:

- A busca é **híbrida** (palavra-chave + semântica): tanto `<termo tecnico do dominio>` quanto
  `por que isso acontece duas vezes?` funcionam. Keyword é mais precisa quando você sabe o termo.
- Se a primeira busca vier fraca, **reformule** antes de desistir e cair no Grep — o vocabulário
  do domínio é específico (liste aqui os termos do seu: <termo>, <termo>, <termo>).
- Filtre por `source`: `mapa` (arquitetura de um repo), `code`, `github` (cards/PRs),
  `planning` (specs), `git` (mensagens de commit), `diario`, `decisao`, `memoria`.

Grep e agentes de exploração continuam válidos — só não como **primeiro** movimento.

## Regra 2: registre a decisão na hora

Quando algo for decidido durante a sessão, chame `mcp__brain__lembrar` **naquele momento** —
registre o que foi decidido, **por quê**, e o que foi descartado. Não espere o fim da sessão: se ela
morrer antes, o porquê se perde, e o porquê é a única parte que ninguém reconstrói lendo o diff.

O `/diario` no fim continua valendo, para a narrativa da sessão. `lembrar` é para o fato durável.

## Board

Coordenadas do board deste workspace. As skills `gm-*` leem **daqui** — nao ha ID hardcoded
dentro delas. Mudou campo ou opcao no Project? Atualize esta secao, nao a skill.

> Como descobrir os IDs (GitHub Projects v2, precisa do escopo `project` no `gh auth`):
>
> ```sh
> gh project list --owner <owner>
> gh project field-list <number> --owner <owner> --format json | jq '.fields[]
>   | {name, id, options: (.options // [] | map({name, id}))}'
> gh project view <number> --owner <owner> --format json | jq .id   # project-id (PVT_...)
> ```

- Project: number `<n>` ("<nome do board>"), owner `<owner>`, project-id `PVT_...`
- **Status** field `PVTSSF_...`:
  📥 Triagem=`<id>` · 📋 Backlog=`<id>` · 🎯 Especificação=`<id>` · 🔨 Implementação=`<id>` · 👀 Revisão=`<id>` · 🧪 Validação em Dev=`<id>` · 🚂 Release=`<id>` · ✅ Produção=`<id>`
- **Tipo** field `PVTSSF_...`: 🐞 Bug=`<id>` · ❓ Dúvida=`<id>` · ✨ Melhoria=`<id>` · 🧰 Débito técnico=`<id>`
- **Severidade** field `PVTSSF_...`: S1=`<id>` · S2=`<id>` · S3=`<id>`
- **Classe** field `PVTSSF_...`: 🔴 Expedite=`<id>` · 📅 Data fixa=`<id>` · ⚪ Padrão=`<id>` · 🔧 Intangível=`<id>`
- **Rota** field `PVTSSF_...`: Completa=`<id>` · Curta=`<id>` · Hotfix=`<id>`
- **Módulo** field `PVTSSF_...`: <opcao>=`<id>` · <opcao>=`<id>`
- **Campos TEXT**: Objetivo `PVTF_...` · Release `PVTF_...` · Bloqueado `PVTF_...`
- **repos** (cards são issues reais): `<repo>` · `<repo>` · `<repo>`
- **auto-add**: `<project-id>` engole todo issue novo do repo — sub-issue de fase precisa ser
  removida com `deleteProjectV2Item`

## Convenções da esteira

As skills `gm-*` não conhecem as regras deste workspace; elas leem daqui. Declare:

- **Typecheck do CI**: o comando exato que o CI roda (`<comando>`). O `/gm-ship` o executa na
  precondição 4 e não aceita outro; sem esta linha, ele pergunta.
- **Portão de teste**: o que roda local antes de abrir a PR (`<comandos>`, sempre com o typecheck
  do CI) e onde roda a suíte inteira: `local` ou `CI`. Com `CI`, o `/gm-ship` abre a PR com a parte
  local verde e "entregue" é o CI verde. Sem esta linha, ele roda a suíte inteira local.
- **Ambiente**: espaço livre mínimo (padrão 2 GB), como prover dependências numa worktree nova
  (ex.: junction para uma que já tem) e cada serviço de teste com o comando que prova que está de
  pé. O `/gm-ship` e o `/gm-correcao` checam na entrada e param cedo com o motivo.
- **Segundo humano**: há alguém, além de você, para revisar spec sensível (dado, faturamento,
  migration)? `sim` / `não`. Com `não`, o `/gm-spec` dispara um revisor de IA independente antes
  do G2.
- **Ambiente de ensaio**: existe uma cópia de produção onde migration e tratamento de dado rodam
  antes de valer? `não`, ou o comando que o `/gm-release` roda contra ela e onde lê o resultado.
  Sem esta linha, trem sensível para e pergunta — nunca assume que ensaiou.
- **Despacho**: se sessões headless (`claude -p`) rodam a esteira, lembre que a última linha da
  resposta é `PROXIMO: /gm-<skill> <argumento>` ou `PARADA: <motivo>`. E se uma sessão orquestradora
  despacha as outras, as instruções dela — como despachar, os freios, o que decide sozinha — ficam
  num arquivo que só ela lê, **não neste `CLAUDE.md`**: ele é carregado por toda sessão despachada,
  e cada parágrafo aqui é pago em cada uma delas. O que a sessão decide sozinha e onde para está no
  `## Modo despachado` das skills; o texto do despacho carrega só o que é do card.

## Onde ficam as coisas

- `<repo>/` — descreva cada repo em uma linha.
- `claude/brain-mcp/` — o servidor MCP acima (ou aponte para onde ele foi instalado).
  `npm run eval` mede a qualidade da busca, `npm run uso` mostra se ele está sendo usado.
- `claude/diario/`, `claude/mapas/`, `claude/decisoes/` — cofre Obsidian: sessões, mapas de
  arquitetura e decisões registradas com `lembrar`.
