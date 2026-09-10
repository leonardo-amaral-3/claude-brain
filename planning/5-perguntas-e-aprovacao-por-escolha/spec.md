# Humanizar a conversa das skills gm-* — Spec

Rota **Curta**: o corpo técnico é um parágrafo. As seções machine-read (`## Execution`,
`## Requisitos & critérios de aceite`, `## Plano de testes`) ficam porque `gm-plan-tasks`,
`gm-implement` e `gm-ship` leem delas — sem elas as skills a jusante param.

## References
- Card: [#5](https://github.com/leonardo-amaral-3/claude-brain/issues/5) — repo `leonardo-amaral-3/claude-brain`
- PRD: N/A — Rota Curta; ferramenta de uma pessoa, sem trade-off de negócio a arbitrar.
- Decisões do brain: #396 (onde mora a regra · mecanismo · verificação), #398 (profundidade), #394 (escopo de esteira inteira, no G1)
- **Correção ao card:** o #5 cita `gm-implement/SKILL.md:46,53,63,84`. Em `origin/dev`, `:84` é
  prosa da seção de emenda pós-tasks; o ponto de aprovação é `:89`. O card foi escrito antes do
  merge da PR #4 (card #2), que mudou `gm-implement` e `gm-ship` no mesmo dia.

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir: a raiz deste repo — as skills moram aqui, não em subpasta de módulo)
- Base branch: `dev`
- Feature branch: `feat/5-perguntas-e-aprovacao-por-escolha`
- **A cópia que roda não é o repo.** Depois do commit, `./sync.ps1 push` (ou `./sync.sh push`) leva
  `skills/` para `~/.claude/skills/`, e é lá que o dogfood do CA3 acontece. Conferido em 2026-09-09:
  as 12 skills `gm-*` de `origin/dev` são idênticas à instalação, byte a byte depois de normalizar
  CRLF.

## Requisitos & critérios de aceite

**CA1 — nenhum ponto de aprovação pede texto livre.**
Dado qualquer um dos **47 pontos de decisão** listados no `## File Change Summary`, quando a skill
precisa da decisão, então ela chama a tool `AskUserQuestion` com opções nomeadas e a consequência
de cada uma no campo `description` — nunca pede a decisão como texto a digitar.
Verificável por T1–T4 do `## Plano de testes`. **A prova é T4** (leitura dirigida ponto a ponto);
T1–T3 são mecânicos, pegam o que a leitura esquecer e **não** substituem a leitura — ver a
ressalva medida em T3.

**CA2 — contexto antes do jargão.**
Dada uma pergunta com mais de um caminho válido, quando ela é apresentada, então o que está em
jogo e o trade-off de cada opção vêm em pt-BR **antes** de qualquer identificador de spec,
arquivo, campo do board ou id de opção.
Verificável por T4: cada um dos 22 pontos com opções próprias descreve a consequência de escolher
cada caminho, e nenhum abre citando identificador.

**CA3 — dá para decidir sem abrir a spec nem o código.**
Dado um card real passado por `/gm-spec` e `/gm-implement` **com as skills já instaladas**,
quando cada pergunta chega, então é possível decidir sem consultar `spec.md` nem o código-fonte
só para entender o que está sendo perguntado.
Verificável por T5.

**CA4 — todo card em voo tem worktree própria.**
Dado um card que entra em 🔨 Implementação, quando `/gm-implement` garante a branch, então ela é
criada e usada numa **worktree dedicada, irmã do repo e dentro do prefixo do workspace**
(`<workspace>/<repo>-<n>-<slug>`), nunca no checkout principal. `/gm-ship` remove a worktree ao
abrir a PR; `/gm-correcao` a recria pela mesma convenção quando o parecer exigir código novo; e
`sync push` não sobrescreve em silêncio uma instalação que veio de outra worktree.
Verificável por T6.

> **Emenda 2026-09-09 (durante a task 1).** O CA4 não veio de decisão derrubada — é **demanda nova
> do humano**, acrescentada com aprovação explícita depois de eu apresentar o custo de forçá-la
> aqui em vez de abrir card próprio: mistura mudança de comportamento numa spec de redação e
> empurra a feature para além do teto de tasks. Entrou assim mesmo, por escolha registrada.
> **O que ela quebra nesta spec:** "a mudança é markdown de skill" (`## Plano de testes`) passa a
> ser falso — `sync.ps1` e `sync.sh` ganham código —, e o `## Rollback` deixa de ser "sem estado em
> disco", porque worktrees e o marcador de instalação são estado fora do git.
> **Motivação:** vários cards em voo ao mesmo tempo, às vezes no mesmo repo.
> **As três decisões abertas, fechadas por escolha do humano nesta sessão:**
> 1. *Onde mora* — irmã do repo, dentro do workspace. Medido: a worktree `feat/1` de hoje vive em
>    `~/claude-brain-feat1`, **fora** de `~/pessoal`, e por isso não tem nenhum `CLAUDE.md` de
>    workspace acima dela (sem `## Board`, sem as duas regras do cérebro) e não cai em workspace
>    nenhum do `brain-workspaces.json`, que resolve por prefixo de caminho. Descartados:
>    `<workspace>/worktrees/…` (agrupa melhor, mas afasta o `../CLAUDE.md`) e qualquer caminho fora
>    do prefixo do workspace.
> 2. *O conflito do `sync push`* — `sync.ps1` lê o destino do `args[0]` do MCP em `~/.claude.json` e
>    copia com `-Force`: alvo **único e global**, sem noção de quem instalou por último. Com N
>    worktrees, qualquer uma enterra o dogfood da outra em silêncio, e esta feature mexe em 11
>    skills. Escolhido: gravar de qual worktree/branch veio a instalação e **pedir confirmação**
>    quando o push seguinte vier de outra. Descartados: proibir push de worktree de feature (mataria
>    o T5, que pressupõe dogfood antes do release) e adiar para card separado.
> 3. *Quando morre* — no `/gm-ship`, ao abrir a PR. **Consequência derivada, não escolhida:** a
>    `/gm-correcao` roda *depois* do ship, então ela **recria** a worktree pela mesma convenção em
>    vez de trabalhar no checkout principal — é a única saída que não viola o próprio CA4.
>    Descartados: remover só em ✅ Produção (sobreviveria à correção, ao custo de pastas de pé) e
>    nunca remover sozinha.
> **Dívida assumida:** o card #5 está sendo implementado no checkout principal, não em worktree —
> ele nasceu antes da própria regra. O CA4 vale dos próximos cards em diante.
> **Exceção ao teto de tasks, declarada:** o CA4 vira as tasks **8** (convenção nas 4 skills que
> mexem em branch + `docs/`) e **9** (marcador de origem no `sync.ps1`/`sync.sh`), levando a
> feature a **9 tasks** contra o teto de 6–8. Escolhido pelo humano depois de eu mostrar as três
> saídas. A razão de caber: o teto governa o **planejamento**, e aqui não há mais planejamento a
> governar — juntar as duas numa só respeitaria a letra do teto e enfraqueceria o que ele protege,
> porque a unidade de revisão passaria a atravessar markdown, PowerShell e bash de uma vez.
> Descartado devolver o CA4 a card próprio, que é o que a regra de fatiamento manda quando o teto
> estoura.

> **Emenda 2026-09-10 (durante a task 7).** A varredura T4 mediu que os dois trilhos que cortam
> release — `gm-release` e `gm-hotfix` — declaram na regra geral que "nothing is merged, **tagged
> or published** unless the human chose it" (`gm-release:52`, `gm-hotfix:53`, herdado de
> `origin/dev:18` e `:19`), mas a **Fase 6 dos dois** roda `git tag` + `gh release create` num
> bloco de código puro, sem chamada nenhuma. As release notes — que saem em linguagem de hospital
> para quem pediu o card — são o único artefato público da esteira que nunca passou por portão,
> enquanto corpo de card, de spec e de PR passam.
> **O que ela derruba nesta spec:** a enumeração de **43 pontos** tratava tag e release notes como
> não-pontos, e a linha "os 4 pontos **X**" das `## Technical Decisions` fixava o conjunto de ação
> irreversível em quatro. Nenhuma das duas foi decisão medida — eram omissão da tabela, e converter
> a regra geral em texto específico foi o que tornou a omissão visível.
> **O que a spec passa a dizer:** **47 pontos** (22 **P** + 19 **A** + 6 **X**). `gm-release` e
> `gm-hotfix` ganham cada um um **A** (as notes, mostradas inteiras antes de existirem) e um **X**
> (a tag + `gh release create`, com a consequência física escrita). A regra geral **R** dos dois
> passa a nomear qual conjunto cobre o quê, para não voltar a prometer portão que não existe.
> **Descartados**, ambos apresentados ao humano: registrar como card novo pelo protocolo de achado
> (default da skill; deixaria a regra mentindo até alguém puxar o card) e citar só no corpo da PR
> (morre no merge).
> **Custo aceito:** o fecho do trem ganha duas perguntas, e a task 7 — que nasceu declarando "sem
> pontos novos" — entrega quatro.

**Fora do escopo** (do card): mudar os gates em si — quantos são, onde ficam, quem aprova.
Também fora, por decisão desta spec: `README.md` — as menções a "aprovação" em `:243` e `:245`
continuam verdadeiras, aprovar por escolha ainda é aprovar (conferido: são as duas únicas do
arquivo). `templates/` não entra porque não tem o que mudar — `grep -iE "aprova|approv|pergunt|escolh"`
no `templates/CLAUDE.example.md` devolve zero linhas.

## Technical Overview

Cada uma das 11 skills `gm-*` com ponto de interação ganha, **logo depois do título e da prosa de
missão, antes de qualquer outra seção `##`**, um bloco `## Como perguntar e como aprovar`
**idêntico ao caractere nas 11**, com cinco regras: (1) **contexto antes do jargão** — primeiro o
que está em jogo e o que muda em cada caminho, em pt-BR, e só depois o identificador de spec,
arquivo, campo ou id; (2) **toda decisão chega pela tool `AskUserQuestion`, uma pergunta por
chamada** — sem lote e sem `multiSelect`; (3) **dois conjuntos padrão, escolhidos pelo que está em
jogo**: para **artefato** (spec, corpo de card, corpo de PR) é *aprovar · ajustar · rejeitar*, e o
artefato vai na mensagem **antes** da chamada porque a tool não exibe corpo longo; para **ação
irreversível** (commit, merge que dispara deploy) é *executar · revisar antes de executar ·
cancelar*, com a consequência física no `description` — "o deploy de produção começa sozinho" —
porque "ajustar" um merge não quer dizer nada, e opção morta num menu treina o clique automático
que este card existe para matar; (4) **lista maior que 4 não vira menu truncado em silêncio**: a
lista inteira vai na mensagem e as opções carregam os candidatos mais prováveis, com "Other" para
o resto; (5) **silêncio nunca é aprovação** — "Other" está sempre disponível e nunca se força a
mão, e sem humano na sessão a skill **para e diz o que faltou decidir** em vez de assumir. A versão
longa da convenção, para humano ler de fora, vira uma seção nova em `docs/esteira-gm.md`, e as
cinco linhas de lá que descrevem o gesto antigo são realinhadas no mesmo commit — âncora que
contradiz o que ancora não serve para conferir nada.

## Implementation Details

N/A — Rota Curta. O texto literal do bloco e os 22 conjuntos de opções próprias são decisão do
implementador na hora, dentro das cinco regras acima. Risco nomeado e aceito no gate (decisão
#398): eles não passam por gate humano antes de existirem; a defesa que sobra é T1 (bloco
byte-idêntico nas 11) mais a revisão da PR.

## File Change Summary

Baldes: **A** = artefato (conjunto *aprovar · ajustar · rejeitar*, sem texto próprio) ·
**X** = ação irreversível (conjunto *executar · revisar · cancelar*, sem texto próprio) ·
**P** = opções próprias, escritas na linha · **R** = regra geral, passa a apontar para o bloco ·
**=** = já diz o certo, só muda de "ritmo" para "mecanismo".

| Arquivo (linhas em `origin/dev`) | Pontos |
|---|---|
| `docs/esteira-gm.md` (148L) | seção nova vizinha de `## A regra que sustenta tudo` (`:138`) + realinhar `:27`, `:34`, `:81`, `:90`, `:98`, que descrevem o gesto antigo (`:90` é o lote que a regra 2 proíbe) |
| `skills/gm-triage/SKILL.md` (158L) | **R** `:21` · **P** `:47` (destino da demanda) · **A** `:131` |
| `skills/gm-card/SKILL.md` (112L) | **P** `:37` (duplicata: atualizar a existente · criar nova) · **P** `:80` (rota) · **A** `:84` |
| `skills/gm-explore/SKILL.md` (81L) | **A** `:58` |
| `skills/gm-prd/SKILL.md` (115L) | **P** `:20` (repo ambíguo) · **P** `:21` (card certo · criar · seguir sem card) · **=** `:39` · **R** `:43` · **A** `:48` (fim do Q&A) · **A** `:101` |
| `skills/gm-spec/SKILL.md` (143L) | **P** `:16` (repo ambíguo) · **P** `:22` (recorte da fase) · **P** `:31`–`:35` (profundidade) · **P** `:42` · **=** `:41` · **A** `:23` · **A** `:28` · **A** `:106` (o gate G2) · **A** `:110` (publicar no card) |
| `skills/gm-plan-tasks/SKILL.md` (94L) | **A** `:18`, e reescrever o fecho "No question-by-question ceremony", que passa a contradizer a regra 2 · **template** `:72`–`:73`: estão **dentro** do bloco cercado `:40`–`:75`, então são conteúdo do arquivo de task, não instrução da skill |
| `skills/gm-implement/SKILL.md` (136L) | **P** `:14` (sem argumento: escolher a pasta) · **P** `:17` (fechar · emendar) · **P** `:23` (working tree sujo) · **A** `:46` · **A** `:53` · **A** `:63` · **A** `:89` · **X** `:129` (commit) |
| `skills/gm-ship/SKILL.md` (81L) | **A** `:70` |
| `skills/gm-release/SKILL.md` (178L) | **R** `:18` · **P** `:15`+`:82`–`:88` (trem sensível — **um** ponto: `:15` é a regra dura que aponta para a Fase 3) · **P** `:58` (carona, item a item) · **P** `:124` (verificação vermelha: rollback vs `/gm-hotfix`) · **A** `:116` · **X** `:120` (merge → deploy de produção) · **A** Fase 6 (as release notes, antes de existirem) · **X** Fase 6 (tag + `gh release create`) |
| `skills/gm-hotfix/SKILL.md` (192L) | **R** `:19` · **P** `:17`+`:108` (migration no hotfix — **um** ponto, citado nos dois lugares) · **P** `:51` (qual das duas emergências) · **P** `:53` (conter antes de consertar) · **P** `:147` (verificação vermelha) · **P** `:175` (conflito no back-merge) · **A** `:79` · **X** `:109` (commit) · **X** `:143` (merge em `main` → produção) · **A** Fase 6 (as release notes) · **X** Fase 6 (tag + `gh release create`) |
| `skills/gm-correcao/SKILL.md` (120L) | **P** `:25` (confirmar a PR alvo) · **P** `:26` (escolher entre as PRs abertas) |
| `skills/gm-tech-spec/SKILL.md` (12L) | **nada** — 12 linhas que só mandam usar `/gm-spec` |

**Acréscimo da emenda 2026-09-09 (CA4)** — contabilizado à parte de propósito: o CA4 é mudança de
comportamento, e misturá-lo na contagem dos 43 pontos apagaria a fronteira entre o que passou pelo
G2 e o que entrou depois.

| Arquivo | O que muda |
|---|---|
| `skills/gm-implement/SKILL.md` | `## Guarantee the branch` passa a criar/entrar na worktree `<workspace>/<repo>-<n>-<slug>` antes de qualquer escrita; o checkout principal deixa de ser lugar de card |
| `skills/gm-ship/SKILL.md` | remove a worktree depois que a PR abre e o card vai a 👀 Revisão |
| `skills/gm-correcao/SKILL.md` | recria a worktree pela mesma convenção quando o parecer exigir código |
| `skills/gm-hotfix/SKILL.md` | mesma regra na branch `release/hotfix-*` — a pressa não compra exceção |
| `sync.ps1` · `sync.sh` | gravam de qual worktree/branch veio a instalação e pedem confirmação antes de sobrescrever uma de origem diferente |
| `docs/esteira-gm.md` | a convenção de worktree na versão longa, junto da de perguntas |

Total: 12 arquivos alterados, 0 criados, 0 removidos. **47 pontos** (22 **P** + 19 **A** + 6 **X**),
4 regras gerais **R** (`gm-triage:21`, `gm-prd:43`, `gm-release:18`, `gm-hotfix:19`), 2 alinhamentos
**=** (`gm-spec:41`, `gm-prd:39`), 1 fecho a reescrever (`gm-plan-tasks:18`) e 1 template
(`gm-plan-tasks:72`–`:73`).

**Deliberadamente fora, apesar de parecerem pontos** — sem esta lista o implementador converte por
conta e o escopo vaza:

| Linha | Por que fica |
|---|---|
| `gm-ship:21`–`:30` | `:22` diz que **o gatilho é mecânico** ("confira cada critério contra o que a suíte e as medições mostraram") — é auto-checagem do agente, não pergunta. E `:27` manda, literal, `Se caiu: **não abra a PR.**` — oferecer "seguir" como opção clicável transformaria regra dura em menu. |
| `gm-hotfix:139` | A revisão humana acontece no GitHub, não no chat; não há artefato a apresentar. O portão in-session do hotfix é `X :143`, o merge. |
| `gm-correcao:61` | Célula de tabela que aponta para o protocolo de desvio do `gm-implement`; o ponto real é `gm-implement:46`. |
| 8× "Offer exactly one follow-up" (`gm-card:112`, `gm-explore:76`, `gm-hotfix:192`, `gm-plan-tasks:94`, `gm-prd:115`, `gm-release:178`, `gm-spec:25` e `:143`) | Sugestão do próximo comando depois que a skill terminou, não portão. |
| `gm-prd:33` | "Ask the user to describe the feature" — descrever uma feature do zero não tem opções a oferecer; é texto livre legítimo. |
| `gm-explore:70`, `gm-implement:37` | Mandam rodar `gh auth refresh -s project`. Instrução, não decisão. |

## Migrations & compatibilidade

Sem migration de dados. Dois efeitos fora do git:

1. **A instalação.** `./sync.ps1 push` **sobrescreve** `~/.claude/skills/`. Antes do push, comparar
   com `diff --strip-trailing-cr` entre cada `skills/gm-*/SKILL.md` e o par em `~/.claude/skills/`
   — **não** usar `./sync.ps1 status` como salvaguarda: o card **#3** deste board é exatamente o
   bug de ele acusar arquivos idênticos quando os finais de linha diferem, e depois desta mudança
   as 11 skills apareceriam divergentes sem que isso queira dizer nada.
2. **Os arquivos de task já gerados.** `:72`–`:73` do `gm-plan-tasks` vivem no template, e medido
   nesta sessão há **119 arquivos de task** nos três workspaces com o texto antigo ("wait for the
   user's review"), dos quais **2 ainda `❌ Not Started`**. Não são migrados e não precisam ser: o
   arquivo de task é prosa de escopo, e quem governa como se aprova é o `SKILL.md` do
   `gm-implement`, que o agente lê na mesma sessão. As 2 pendentes rodam sob a regra nova sem
   edição. O template muda só para as tasks futuras.
3. **As worktrees que já existem** (emenda 2026-09-09). Medido nesta sessão, três, e **duas não
   obedecem ao CA4**: `~/claude-brain-feat1` está fora do prefixo do workspace (sem `CLAUDE.md`
   acima, sem workspace no brain) e o próprio `feat/5` roda no checkout principal. **Não são
   migradas por esta feature** — mover worktree de card em voo troca o chão debaixo de sessão
   aberta, e o `feat/1` tem 7 commits não enviados. A regra vale dos próximos cards em diante; as
   em voo terminam onde estão.
4. **O marcador do `sync`.** Estado novo fora do git, em `~/.claude/`. Instalação que nunca viu o
   marcador não tem origem registrada: o primeiro `push` depois da mudança **grava sem perguntar**
   — perguntar ali seria pedir confirmação contra um dado que não existe.

## Rollback

`git revert` do commit + `./sync.ps1 push` de novo. **Até a emenda de 2026-09-09** isto era
markdown puro, sem estado em disco e sem build — perfil de risco que sustentou a Rota Curta no G1.
O CA4 acrescenta dois resíduos que o `revert` não desfaz sozinho: as worktrees criadas (removidas
com `git worktree remove` + `git worktree prune`) e o marcador de origem da instalação (apagar o
arquivo em `~/.claude/`). Nenhum dos dois é dado de trabalho — são ponteiros —, então reverter
continua barato, só deixou de ser instantâneo.

## Verificação pós-deploy

O "deploy" desta mudança é o `sync push`, e ele pode falhar em silêncio. Depois dele, rodar **T1,
T2 e T3 apontados para `~/.claude/skills/`**, não para o repo: é a cópia instalada que responde se
funcionou. T4 e T5 já rodaram contra o repo e não repetem — o que se prova aqui é que o push
chegou, não que o texto está certo.

## Plano de testes

Não há suíte. Até a emenda de 2026-09-09 a mudança era só markdown de skill; com o CA4 ela passa a
incluir `sync.ps1`/`sync.sh`, que são código e por isso ganham o T6. O que prova cada critério:

- **T1 (CA1)** — extrair o bloco de cada skill (do heading `## Como perguntar e como aprovar` até o
  próximo `##`, exclusive), normalizar CRLF e comparar: **um único** hash, e **11** skills com o
  bloco. `gm-tech-spec` sem bloco. Conferir também que em todas ele está na mesma posição — logo
  depois da prosa de missão, antes da primeira outra seção `##`.
- **T2 (CA1)** — `grep -c AskUserQuestion` por skill ≥ **1 + p**, onde `p` é o número de pontos
  **P** daquela skill na tabela: triage 1 · card 2 · explore 0 · prd 2 · spec 4 · plan-tasks 0 ·
  implement 3 · ship 0 · release 3 · hotfix 5 · correcao 2 (soma 22). O `1` é a menção dentro do
  bloco; os pontos **A** e **X** não contam porque delegam ao bloco por decisão de projeto.
- **T3 (CA1) — rede de regressão, não prova.** Grep **case-insensitive** por vocabulário de texto
  livre, sobre `skills/gm-*/SKILL.md` **e** `docs/esteira-gm.md`, descartadas as linhas
  `description:` do frontmatter, a `gm-tech-spec` inteira e **a região do próprio bloco**:
  `explicit.*approval` · `approves? explicitly` · `aprovaç(ã|a)o.*(humana|explícita)` ·
  `on approval` · `get approval` · `after approval` · `show first, approve` ·
  `explicit.*decision` · `let the (user|human) decide` · `ask the user` · `veto or adjust` ·
  `confirme com o usuário` · `until.*(approved|agree)`. Devolve **zero linhas**.
  **Ressalva medida em 2026-09-09:** "pedir em texto livre" não é vocabulário enumerável. O padrão
  da primeira versão desta spec era case-sensitive e cobria **11 dos 43 pontos** — deixava passar
  inclusive `gm-spec:106`, o portão G2, só porque "Explicit" começa com maiúscula. **T3 verde com
  T4 pulado não fecha o CA1.**
  Cuidado auto-infligido: se o bloco usar a frase "aprovação explícita", ele reprova T3 nas 11
  skills de uma vez — por isso a região do bloco é excluída do grep.
  **Emenda 2026-09-09 (task 1):** o token acima era `aprovaç[ãa]o` e **não casava nada** nesta
  máquina — `ã` são dois bytes (`C3 A3`) e, com `LANG` vazio no Git Bash, o grep lê classe de
  caractere byte a byte, então `[ãa]` vira "um byte entre `C3`, `A3` ou `a`" e nunca alcança a
  sequência real. Medido antes de qualquer alteração: **zero linhas em `docs/esteira-gm.md`**,
  onde `:27`, `:81` e `:98` dizem literalmente "aprovação humana explícita", e **31 em vez de 33**
  nas skills — as duas perdidas eram `gm-implement:89` (o portão da emenda pós-tasks, um ponto
  **A** da tabela) e `gm-correcao:61`. Um T3 verde antes de o trabalho existir é pior que T3
  nenhum. Trocado por alternância `(ã|a)`, que independe de locale; descartado prefixar
  `LC_ALL=C.UTF-8` (também funciona, mas quem esquecer o prefixo volta ao verde falso, em
  silêncio). Conferidos os treze tokens: nenhum outro tem acento dentro de colchetes.
- **T4 (CA1 + CA2) — a prova.** Leitura dirigida dos 47 pontos da tabela, um a um: cada um chega
  como escolha, do balde certo (**A** artefato · **X** ação · **P** próprio), cada opção diz a
  consequência de escolhê-la, e nenhum abre citando identificador antes do contexto. É revisão, não
  script — o critério é sobre redação, e redação não tem grep.
- **T5 (CA3)** — dogfood: depois do `sync push`, passar o **card #3** por `/gm-card` (ele está em
  📥 Triagem, sem rota — precisa ser qualificado antes) e então por `/gm-spec` e `/gm-implement`,
  em sessão nova, registrando na validação em dev do #5 se deu para decidir sem abrir spec nem
  código. **Dependência declarada:** o #5 não sai de 🧪 Validação em Dev antes disso. Se o #3 não
  estiver pronto para rodar, qualquer outro card serve — o que não serve é o próprio #5, já
  especificado pelas skills antigas.
- **T6 (CA4)** — worktree, em três provas:
  1. **Convenção nas skills** — `grep -l 'git worktree' skills/gm-{implement,ship,correcao,hotfix}/SKILL.md`
     devolve os quatro, e o caminho citado em todos é `<workspace>/<repo>-<n>-<slug>`, nunca um
     caminho fora do prefixo do workspace.
  2. **O `sync` recusa o atropelo** — com o marcador apontando para uma worktree A, rodar `push`
     de uma worktree B **para e pergunta** em vez de copiar; rodar de A de novo segue sem
     perguntar. Provado à mão nos dois scripts, porque `sync.sh` e `sync.ps1` não compartilham
     código e divergir aqui é o modo de falha esperado.
  3. **Ciclo completo** — o T5 já roda `/gm-card` → `/gm-spec` → `/gm-implement` num card real;
     conferir ali que a worktree nasceu no lugar certo, que o `/gm-ship` a removeu, e que
     `git worktree list` volta ao estado anterior sem deixar pasta órfã nem registro podre
     (`git worktree prune --dry-run` silencioso).

## Technical Decisions

| Decisão | Por quê | Descartado |
|---|---|---|
| Bloco inline nas 11 skills + seção longa em `docs/` | Conteúdo de arquivo referenciado **não entra no contexto** — só entra se o modelo ler. Ponteiro custa uma leitura por invocação e degrada em silêncio, justo no gate que é o único controle que sobrou (a norma abre mão do 2º revisor no G2 e do revisor humano no G4). | Arquivo comum único com ponteiro (zero divergência, mas a regra some sem aviso); só inline sem `docs/` (perde a âncora de conferência). Custo aceito: 11 cópias a manter em sincronia. |
| Tool `AskUserQuestion` | Opções clicáveis com a consequência de cada uma, e "Other" para texto livre sempre presente sem ser declarado — conferido **direto no schema da tool nesta sessão**. Mata o carimbo reflexo de digitar "aprovo". | Menu numerado em texto (cumpre a letra do CA1 e enfraquece o espírito — o usuário ainda digita); tool com fallback em texto quando não couber em 4 opções (exceção em regra de gate é por onde ela vaza). |
| Uma pergunta por chamada, sempre | Escolha humana no Q&A, contra a recomendação de lotear até 4. Cada resposta chega com o contexto das anteriores na mesa e nunca se decide algo cuja premissa ainda estava aberta. Custo aceito: um Q&A de spec vira 5–10 rodadas, e `gm-release:58` (carona) vira N chamadas em vez de um `multiSelect`. | Lote quando independentes; lote sempre que couber (pergunta feita antes da hora é pergunta respondida no chute — o que este card existe para evitar); `multiSelect` para listas, que reabriria o lote pela porta dos fundos. |
| Dois conjuntos: artefato e ação irreversível | "Ajustar" não quer dizer nada em "mergear `dev`→`main`", e opção morta num menu treina o clique automático. Os 6 pontos **X** (`gm-implement:129`, `gm-hotfix:109`, `:143` e a tag da Fase 6, `gm-release:120` e a tag da Fase 6) ganham *executar · revisar antes · cancelar*, com a consequência física escrita. | Um conjunto só, com "ajustar" = "volte e me mostre de novo" (mais fácil de manter idêntico, mas a opção do meio vira quase-sinônimo de rejeitar); opções à mão nesses 6 (fidelidade máxima, mas a regra perde a resposta para o próximo portão irreversível que alguém criar). |
| Padrão no bloco, exceções à mão | Os 21 pontos **A**+**X** são dois gestos repetidos; escrevê-los 21 vezes é repetição que diverge na próxima edição. | Todos os 43 escritos à mão (nada implícito e grep trivial, ao custo de diff grande e mais superfície para divergir). |
| Grep documentado + dogfood, com o grep rebaixado a rede | Proporcional à Rota Curta: markdown, sem infra nova. A crítica adversarial mediu que o grep cobria 11 dos 43 pontos, então ele **não** pode ser a prova — vira rede, e T4 vira a prova. | `scripts/lint-skills.mjs` — pegaria a divergência das 11 cópias para sempre, mas cria superfície nova num repo onde só `brain-mcp` tem `scripts/`. Vira candidato a card se as cópias divergirem de fato. |
| `gm-tech-spec` fora | 12 linhas que só mandam usar `/gm-spec`; nenhum ponto de interação para converter. | Incluir por simetria — bloco numa skill deprecada que ninguém executa é ruído. |
| **(emenda 2026-09-09)** Worktree irmã do repo, dentro do workspace | O `CLAUDE.md` de workspace e o `brain-workspaces.json` resolvem por **prefixo de caminho**. Worktree fora do prefixo não enxerga o `## Board` nem as regras do cérebro — medido no `~/claude-brain-feat1` de hoje. | `<workspace>/worktrees/…` (agrupa melhor, mas afasta o `../CLAUDE.md`); qualquer lugar fora do prefixo do workspace. |
| **(emenda)** `sync push` grava origem e pede confirmação | Alvo único e global (`args[0]` do MCP), cópia com `-Force`, nenhuma noção de quem instalou por último: com N worktrees o dogfood de uma enterra o da outra em silêncio. | Proibir push de worktree de feature (mataria o T5); adiar para card separado (deixa a janela aberta justo nesta feature, que mexe em 11 skills). |
| **(emenda)** Worktree morre no `/gm-ship` | Escolha do humano: raiz do workspace limpa assim que a PR sobe. | Remover só em ✅ Produção (sobreviveria à `/gm-correcao`, ao custo de pastas de pé); nunca remover sozinha. **Consequência aceita:** a `/gm-correcao` roda depois do ship e passa a **recriar** a worktree — trabalhar no checkout principal violaria o CA4. |

## Coding Standards

- Markdown das skills: as instruções seguem em inglês (padrão vigente nas 12); **o que o humano lê
  — pergunta, rótulo e `description` de cada opção — é pt-BR.**
- Restrições duras da tool, conferidas contra o schema nesta sessão: 1–4 perguntas por chamada
  (a regra 2 fixa em 1), **2–4 opções** por pergunta, `header` de até 12 caracteres, `label` de
  1–5 palavras, "Other" acrescentado automaticamente, e **nada de corpo longo** — o artefato vai na
  mensagem anterior. Existe um campo `preview` por opção, para trecho de código ou comparação lado
  a lado; ele **não** serve para exibir o artefato do gate (é por opção, não por pergunta), mas
  serve quando as opções são redações alternativas e ver a diferença é o que decide.
- **Dois casos que estouram o teto de 4 opções**, e que a regra 4 do bloco existe para resolver:
  `gm-implement:14` (número de pastas com task pendente é ilimitado) e `gm-release:58` (uma
  carona por vez, N delas). A lista completa vai na mensagem; as opções carregam os candidatos
  mais prováveis; "Other" recebe o resto.
- **`gm-release:86` precisa de complemento.** A frase que ele manda gravar verbatim é
  `promovido sem ensaio em ambiente release — decisão de <nome> em <data>`, e a resposta de uma
  escolha devolve só o rótulo, sem identidade. Ou o ponto pergunta o nome em seguida, ou a frase
  passa a nomear a data e o card em vez da pessoa.
- **Sessão sem humano** (`claude -p`, subagente): a skill **para e reporta o que faltou decidir**.
  Isto é uma **regra que esta spec impõe**, não comportamento medido da tool — não há medição
  citável do que o `AskUserQuestion` devolve sem interlocutor, e inventar uma seria o tipo de
  afirmação não verificada que a crítica desta spec existe para pegar.
- O bloco é copiado, não reescrito: qualquer melhoria nele é aplicada às 11 de uma vez, no mesmo
  commit. Bloco divergente reprova T1.
- Nada além do especificado: não mexer nos gates, no `README.md`, nos `templates/` nem em
  `brain-mcp/`.
