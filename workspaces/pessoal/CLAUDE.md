# Workspace pessoal

Workspace de Leonardo (`leonardo-amaral-3`) com dois repos: o repo do produto, que é o produto deste
workspace, e o `claude-brain`, que tem o seu próprio `CLAUDE.md` e o seu próprio board. **Dentro de
`claude-brain/`, vale a seção `## Board` de lá (Project 3), não a daqui.** O que é do repo do produto
(o board dele, as convenções que só a ele servem, onde ficam as specs) mora na parte local deste
arquivo, que o `sync.sh push` monta no lugar da linha marcadora de `## Convenções da esteira`: veja
`CLAUDE.privado.md`, ao lado deste arquivo, na pasta do workspace.

## Regra 1: o cérebro vem antes da exploração

Existe um MCP local chamado `brain` que indexa **todo** o contexto dos dois workspaces desta máquina
— specs de planning, docs, diário de sessões, notas de memória, mapas de arquitetura, cards e PRs do
GitHub, mensagens de commit e o código-fonte dos repos.

**Antes de abrir arquivo na mão, rodar Grep/Glob ou lançar agente de exploração para entender
finalidade, histórico ou localização de algo, consulte o cérebro.** As tools são:

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

- A busca é **híbrida** (palavra-chave + semântica). Keyword é mais precisa quando você sabe o termo.
- Se a primeira busca vier fraca, **reformule** antes de cair no Grep. Vocabulário daqui: esteira,
  estação, cartão, card, épico, fase, despacho, sessão, transcript, `SessionHost`, `BoardReader`,
  `CardReader`, kanban, gate (G1–G5), emenda, trem.
- Filtre por `source`: `mapa` (arquitetura de um repo), `code`, `github` (cards/PRs),
  `planning` (specs), `git` (mensagens de commit), `diario`, `decisao`, `memoria`.

Grep e agentes de exploração continuam válidos — só não como **primeiro** movimento.

## Regra 2: registre a decisão na hora

Quando algo for decidido durante a sessão, chame `mcp__brain__lembrar` **naquele momento** —
registre o que foi decidido, **por quê**, e o que foi descartado. Não espere o fim da sessão: se ela
morrer antes, o porquê se perde, e o porquê é a única parte que ninguém reconstrói lendo o diff.

O `/diario` no fim continua valendo, para a narrativa da sessão. `lembrar` é para o fato durável.

## A esteira

A mesma rota completa e os mesmos 5 gates descritos em `claude-brain/docs/esteira-gm.md` › `## O
caminho`, com três deltas que valem para todo o workspace `pessoal`:

1. **G2 sem segundo humano.** Não há outra pessoa para revisar a spec. O `/gm-spec` dispara o revisor
   de IA independente antes do G2, e o contrapeso que sobra é a **verificação pós-deploy bloqueante
   do G5**: obrigatória em mudança de dado ou de formato em disco, roda na 🧪 Validação em Dev contra
   o app buildado e os boards de verdade, e quem valida é Leonardo. Release promovida sem ela fica
   registrada na PR do trem com o motivo.
2. **Release sem trem semanal.** Sai quando há o que soltar; `main` só recebe PR da `dev` pelo
   `/gm-release`.
3. **G4 só com revisão de IA.** Não há revisor humano de PR além do autor.

Regras duras que **não** mudam: skills `gm-*` têm `disable-model-invocation: true` (peça o comando ao
usuário, nunca reimplemente a skill na mão) · sem card não há implementação · nada de commit sem
aprovação explícita · o PR nasce com `Card: #n` na primeira linha e **nunca** com `Closes`.

## Convenções da esteira

As skills `gm-*` leem daqui o que é deste workspace (vale para o repo do produto; o `claude-brain`
declara as suas no `CLAUDE.md` dele):

- **Segundo humano**: não.
- **Despacho**: sessões headless (`claude -p`) fecham com `PROXIMO: /gm-<skill> <argumento>` ou
  `PARADA: <motivo>`. As instruções do braço direito (a sessão orquestradora) — como despachar, os
  freios, o que decide sozinha — ficam num arquivo que só ela lê, junto com os scripts de despacho
  (`d.sh`, `base*.txt`, `cadeia*.sh`), **não neste `CLAUDE.md`**: ele é carregado por toda sessão
  despachada. O que a sessão decide sozinha e onde para está no `## Modo despachado` das skills.
- **Paralelo**: 3

<!-- privado: CLAUDE.privado.md entra aqui -->

## Branches

`dev` é a base de integração e `main` é produção. Branch de card (`feat/<n>-<slug>` ou
`fix/<n>-<slug>`) sai da `dev` e volta para ela por PR. Card em voo trabalha numa worktree irmã,
`~/pessoal/<repo>-<n>-<slug>`, e não no checkout principal.

## Onde ficam as coisas

- `claude-brain/` — o setup distribuído (brain MCP, skills `gm-*`, hooks, templates). Tem
  `CLAUDE.md` e board próprios (Project 3).
- `claude/diario/`, `claude/mapas/` — cofre Obsidian deste workspace: sessões e mapas de arquitetura.
- `notas/` — notas soltas.
