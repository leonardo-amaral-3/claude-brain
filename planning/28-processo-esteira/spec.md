# Esteira: premissas medidas, épico na triagem, modo despachado e ambiente na entrada — Spec

## References
- Card: [#28](https://github.com/leonardo-amaral-3/claude-brain/issues/28) — repo `leonardo-amaral-3/claude-brain` (Fase 2 do épico [#30](https://github.com/leonardo-amaral-3/claude-brain/issues/30))
- Fases anteriores: `planning/27-esteira-despachada/spec.md` (Fase 1, modelo de forma) e `planning/29-limpeza-skills/spec.md` (Fase 3: fonte única + carimbo; regra *todos ou nenhum*, brain #3562)
- Trechos normativos desta spec (copiar, não transcrever): `planning/28-processo-esteira/trechos/`
- Decisões do G2: brain #3566 (portão de teste), #3567 (modo despachado), #3568 (ambiente, profundidade), #3569 (épico e premissas)

## Execution
- Repo: `leonardo-amaral-3/claude-brain` — working dir **só** a worktree `C:/Users/lokin/pessoal/claude-brain-28-processo`
- Base branch: `feat/29-limpeza-skills` (empilhada; o GitHub reaponta para `dev` quando a PR #36 for mergeada)
- Feature branch: `feat/28-processo-esteira`
- Profundidade: **Lite** (só markdown de skill/doc/template e a fonte carimbada; sem formato em disco, sem superfície de tool, sem `brain-mcp/`). Rota do board: Curta.
- Nunca: `sync push`, escrita em `~/.claude`, toque no checkout principal ou nas outras worktrees

## Requisitos & critérios de aceite
1. **Premissas medidas.** Dado o esqueleto da Phase 2 de `skills/gm-spec/SKILL.md`, então ele tem a seção `## Premissas medidas` entre `## Requisitos & critérios de aceite` e `## Technical Overview`, e a Phase 3 abre com o bullet *Unmeasured premises*. Dado `skills/gm-plan-tasks/SKILL.md`, então `## Setup` recusa planejar (aponta `/gm-spec <n>`) quando a spec não tem `## Premissas medidas` ou tem linha sem prova, e manda cada task citar as linhas de que depende. Prova: `grep -n "## Premissas medidas" skills/gm-spec/SKILL.md skills/gm-plan-tasks/SKILL.md` acha as duas; esta própria spec tem a seção.
2. **Um escopo nasce épico.** Dado `skills/gm-triage/SKILL.md`, então existe `## Step 1b — Um escopo ou vários?` entre o Step 1 e o Step 2, com a regra (objetivo numa frase, valida junto → um card `épico` com `## Pontos`; independente de verdade → card próprio; na dúvida, um card), o `AskUserQuestion` header `Escopo` e a criação do label quando falta. Dado `skills/gm-card/SKILL.md`, então o item `2b.` aplica a mesma regra no modo Criar e o Promover preserva `## Pontos`. Dado `skills/gm-spec/SKILL.md` Phase 6, então o épico vindo da triagem é fatiado pelos pontos, qualquer que seja o tamanho. Prova: `grep -c "épico" skills/gm-triage/SKILL.md skills/gm-card/SKILL.md` ≥ 1 em cada; `grep -n "An épico from triage" skills/gm-spec/SKILL.md` acha.
3. **Modo despachado na fonte.** Dado `skills/_comum/convencoes.md`, então `grep -c "^## " ` devolve `3`, a terceira é `## Modo despachado` = `trechos/modo-despachado.md` verbatim (≤ 3.600 caracteres), e o preâmbulo não tem mais "Reservado para a Fase 2". O item 5 de `## Como perguntar e como aprovar` aponta para `## Modo despachado`. Quando se roda `node scripts/skills-comum.mjs --check`, então sai `0` com `11 skills × 3 blocos iguais à fonte`; `node scripts/skills-comum-teste.mjs` sai `0`. Dado `trechos/base-29-reescrita.txt`, então ele tem menos bytes que `claude/despachos-30/base-29.txt` (1.718 contra 2.871) e nenhuma das frases que a tabela cobre (`grep -ci "sync push\|mergeie\|lembrar\|primeiro plano\|PROXIMO\|PARE\|frashdopredio\|Card: #"` = `0`).
4. **Ambiente e portão.** Dado `skills/gm-ship/SKILL.md` e `skills/gm-correcao/SKILL.md`, então ambos têm `## Ambiente na entrada` (trecho A de `trechos/ambiente-e-portao.md`, idêntico nas duas: o `awk` da seção dá o mesmo md5) logo antes de `## Preconditions`. A precondição 4 do `gm-ship` = trecho B (lê *Portão de teste*; `local`/`CI`/ausente), e o item 2 do *Corrige* do `gm-correcao` = trecho C. `templates/CLAUDE.example.md` declara *Portão de teste* e *Ambiente* (trecho D); o `CLAUDE.md` deste repo declara os dois para si. A escolha e o descartado estão em `## Technical Decisions` e no brain #3566.
5. **Heredoc (achado da PR #31).** `grep -c "<<" skills/*/SKILL.md` dá `0` em todas; o único `--body "` inline é `gm-hotfix` (uma frase, abaixo do limiar). Nada a mudar: fica anotado na prova da última task.
6. **Docs coerentes.** `docs/esteira-gm.md` ganha `## Modo despachado` (versão longa, para quem lê de fora: quando vale, as três colunas, o que o argumento ainda carrega) e cita premissas medidas, épico na triagem e ambiente na entrada onde descreve cada skill; nenhuma frase contradiz a fonte.

## Premissas medidas
| Premissa | Prova (rodada em 2026-10-12, nesta worktree) | Resultado |
|---|---|---|
| As 11 skills com blocos estão iguais à fonte antes da mudança | `node scripts/skills-comum.mjs --check` | `11 skills × 2 blocos iguais à fonte`, exit 0 |
| O teste do carimbo está verde antes | `node scripts/skills-comum-teste.mjs` | exit 0 |
| O script carimba qualquer número de seções e exige todas em cada skill | leitura de `scripts/skills-comum.mjs:101-128` (sem contagem fixa; `presentes < secoesFonte.length` → incompleta) | confirmado |
| O teste do carimbo fixa só os 2 cabeçalhos antigos e continua válido com uma 3ª seção no fim | leitura de `scripts/skills-comum-teste.mjs:14,75-105` (inverte os 2 blocos; o 3º fica no fim) | a confirmar rodando, na task 1 |
| `## Convenções de saída` é a última seção de todas as 11 | Explore, `## Convenções` seguida de EOF nas 11 | confirmado — a seção nova vai no EOF |
| Nenhum heredoc nas skills | `grep -c "<<" skills/*/SKILL.md` | 0 em todas |
| O label `épico` existe neste repo | `gh api repos/leonardo-amaral-3/claude-brain/labels --jq '.[].name'` | existe (outros repos podem não ter: o trecho cria) |
| `df -Pk .` funciona no Git Bash desta máquina | `df -Pk .` | `C: … 9793028 disponíveis (96%)` |
| Nenhum `CLAUDE.md` declara *Portão de teste* nem *Ambiente* hoje | `grep -n "Portão de teste\|Ambiente" CLAUDE.md templates/CLAUDE.example.md` | só *Ambiente de ensaio* no template |
| A Notoria já pratica "local só o tsc do CI e os testes do diff; a suíte inteira no CI" | `notoria/claude/despachos-1478/base-comum.txt` e `base-1592.txt` (parágrafo AMBIENTE) | confirmado; o mandato dela ainda diz "suíte inteira verde" (`notoria/CLAUDE.md:87`) |
| O texto-base de hoje mede 2.871 B (pessoal) e 6.361 B (Notoria) | `wc -c` | confirmado |

## Technical Overview
Quatro mudanças de texto, uma por critério do card. (1) O `gm-spec` exige `## Premissas medidas` e a crítica a ataca; o `gm-plan-tasks` recusa planejar sem ela. (2) A triagem e o `gm-card` Criar decidem "um escopo ou vários?" antes de criar card; um escopo nasce `épico` com `## Pontos`, e a Phase 6 do `gm-spec` fatia por eles. (3) A fonte carimbada ganha a terceira seção, `## Modo despachado`, que substitui o item 5 do "Como perguntar" só quando não há humano **e** o argumento entrega a frente; ela vai para as 11 skills pelo script (todos ou nenhum). (4) `gm-ship` e `gm-correcao` checam o ambiente na entrada e leem do `CLAUDE.md` o portão de teste (`local` ou `CI`), com o comportamento de hoje quando o item falta.

## Implementation Details

Números de linha da `feat/29-limpeza-skills` em `0180591`. Localize **pelo texto citado**; a Área 1 acrescenta linhas no fim das skills e não desloca nada acima.

### Área 1 — fonte e carimbo (CA3)
- `skills/_comum/convencoes.md`:
  - Preâmbulo, o parágrafo que começa em "**Reservado para a Fase 2 do épico #30 (#28):**" (linhas 22-24) → substituir por: `**Modo despachado** (Fase 2 do épico #30, #28): a terceira seção diz o que cada skill decide sozinha numa sessão `claude -p` que recebeu a frente, onde para e o que não faz. Ela vale para as 11 como as outras duas.` (pt-BR, uma frase; quebrar a ≤100 colunas.)
  - `## Como perguntar e como aprovar`, item 5, última frase: `…**stop and report what was left to decide** — never assume a default and carry on.` → acrescentar depois dela: ` The one exception is `## Modo despachado` below.` (quebrar a ≤100 colunas).
  - `## Convenções de saída`, item 1, última frase (`…with no human to answer, close with `PARADA: <the gate left open>`.`) → acrescentar depois dela: ` Under `## Modo despachado`, a gate in its **decide** rows is answered, not left open.`
  - `## Convenções de saída`, item 4: acrescentar `, and do nothing in the background` depois de `(`ScheduleWakeup`, `/loop`)`.
  - Acrescentar no fim, depois de uma linha vazia, a seção de `trechos/modo-despachado.md` (do `## Modo despachado` até o fim), verbatim.
- Nas 11 skills (`gm-card`, `gm-correcao`, `gm-explore`, `gm-hotfix`, `gm-implement`, `gm-plan-tasks`, `gm-prd`, `gm-release`, `gm-ship`, `gm-spec`, `gm-triage`): acrescentar no EOF `\n## Modo despachado\n` (só o cabeçalho) e então `node scripts/skills-comum.mjs` — o script escreve os três blocos. Nunca à mão.
- `scripts/skills-comum-teste.mjs`: não muda. Se sair `1` com a 3ª seção, é desvio — parar (a premissa está na tabela acima).

### Área 2 — premissas medidas (CA1)
- `skills/gm-spec/SKILL.md`, esqueleto da Phase 2 (bloco de código, ~linhas 137-179): trecho A de `trechos/epico-e-premissas.md`.
- `skills/gm-spec/SKILL.md`, Phase 3 (~linha 185): trecho B como primeiro bullet.
- `skills/gm-plan-tasks/SKILL.md`, `## Setup` (linha 49): trecho C como parágrafo seguinte.
- `skills/gm-spec/SKILL.md`, Phase 4 (linhas 218-219), a frase `With no human in the session, the findings go in the final answer and the session closes with `PARADA: spec aguardando o gate`.` → `With no human in the session and no handover (`## Modo despachado`), the findings go in the final answer and the session closes with `PARADA: spec aguardando o gate`; with the handover, the session resolves each finding against the code, records how, and the gate is answered.` Sem isso a skill contradiz a linha *Aprovar artefato* da tabela.

### Área 3 — épico na triagem (CA2)
- `skills/gm-triage/SKILL.md`: trecho D, nova seção entre `## Step 1` (linha 72) e `## Step 2` (linha 100). No `## Step 5 — Publish`, o `gh issue create` ganha a nota "épico → `--label épico`, e o corpo leva `## Pontos` depois do relato" (uma linha, fora do bloco de código).
- `skills/gm-card/SKILL.md`: trecho E como item `2b.` depois do item 2 do `## Workflow` (linhas 72-80).
- `skills/gm-spec/SKILL.md`, Phase 6 (linha 250, parágrafo dos sinais): trecho F como parágrafo seguinte.

### Área 4 — ambiente e portão (CA4)
- `skills/gm-ship/SKILL.md`: trecho A de `trechos/ambiente-e-portao.md` como seção nova antes de `## Preconditions` (linha 45); trecho B substitui o item 4 (linha 50) inteiro.
- `skills/gm-correcao/SKILL.md`: trecho A, idêntico, antes de `## Preconditions` (linha 52); trecho C substitui o item 2 do *Corrige* (linhas 146-147).
- `templates/CLAUDE.example.md`, `## Convenções da esteira`: trecho D depois do item *Typecheck do CI* (linhas 78-79). O item *Despacho* (linhas 86-90) ganha ao fim: `O que a sessão decide sozinha e onde para está no `## Modo despachado` das skills; o texto do despacho carrega só o que é do card.`
- `CLAUDE.md` deste repo, `## A esteira`, depois da lista dos três deltas e antes de "Regras duras": `**Portão de teste**: `local` — a suíte da área tocada (itens 2 e 3 acima); não há CI de teste. **Ambiente**: nenhum serviço; mínimo de disco padrão; numa worktree nova, `brain-mcp/node_modules` vem por junction ao checkout principal ou `npm ci`, nunca dentro do `/gm-ship`.`

### Área 5 — docs e prova final (CA5, CA6)
- `docs/esteira-gm.md`: seção nova `## Modo despachado` entre `## Convenções de saída` (linha 188) e `## Uma worktree por card` (linha 213), em pt-BR, ≤ 30 linhas: quando vale (as duas condições), a tabela resumida em três frases (decide · para · não faz), registro com `lembrar` e comentário, o que o argumento ainda carrega, e o exemplo medido (base-29: 2.871 → 1.718 B). Em `## As skills`: uma frase no `gm-triage` (escopo/épico), no `gm-spec` (premissas medidas; épico vindo da triagem), no `gm-plan-tasks` (recusa sem premissas) e no `gm-ship`/`gm-correcao` (ambiente na entrada; portão lido do `CLAUDE.md`).
- `README.md`: só se descrever o conteúdo da fonte por seção — conferir com `grep -n "convencoes\|Como perguntar" README.md`; não descrevendo, não muda.

## File Change Summary
- `skills/_comum/convencoes.md` — preâmbulo sem a reserva; item 5 e item 4 com a exceção; 3ª seção `## Modo despachado`
- `skills/gm-{card,correcao,explore,hotfix,implement,plan-tasks,prd,release,ship,spec,triage}/SKILL.md` — recebem `## Modo despachado` e os itens 4/5 novos pelo carimbo
- `skills/gm-spec/SKILL.md` — `## Premissas medidas` no esqueleto, bullet na crítica, frase sem humano da Phase 4, épico da triagem na Phase 6
- `skills/gm-plan-tasks/SKILL.md` — recusa sem premissas medidas
- `skills/gm-triage/SKILL.md` — `## Step 1b`, label no publish
- `skills/gm-card/SKILL.md` — item `2b.`
- `skills/gm-ship/SKILL.md` — `## Ambiente na entrada`, precondição 4
- `skills/gm-correcao/SKILL.md` — `## Ambiente na entrada`, item 2 do *Corrige*
- `templates/CLAUDE.example.md` — *Portão de teste*, *Ambiente*, frase no *Despacho*
- `CLAUDE.md` — portão e ambiente deste repo
- `docs/esteira-gm.md` — `## Modo despachado` e as frases em `## As skills`
- `planning/28-processo-esteira/` — esta spec, `trechos/`, `tasks/`

## Migrations & compatibilidade
N/A para dado — só markdown. Compatibilidade de comportamento: workspace sem *Portão de teste* segue a regra de hoje (suíte inteira local), e sem *Ambiente* checa só disco (2 GB) e dependências — nada para ao primeiro `sync push`. Spec antiga sem `## Premissas medidas` faz o `gm-plan-tasks` parar: é o efeito pedido pelo card, e afeta só card entre G2 e G3.

## Rollback
`git revert` do merge na `dev` e `sync push` da versão anterior (o `sync push` é do Leonardo). Nenhum estado fora do repo é criado.

## Verificação pós-deploy
Depois do `sync push` (G5, do Leonardo): `node scripts/skills-comum.mjs --check` na instalação não se aplica (a instalação não tem `scripts/`) — a prova é `grep -c "^## Modo despachado" ~/.claude/skills/gm-*/SKILL.md` = 1 nas 11, e o próximo despacho de `/gm-ship` termina com `PROXIMO`/`PARADA` sem o parágrafo de freios no argumento. Recomendado no mesmo dia: declarar *Portão de teste* e *Ambiente* no `CLAUDE.md` da Notoria (fora deste repo).

## Plano de testes
- CA1–CA2, CA4–CA6: `grep`/`awk`/`md5sum` listados em cada critério, rodados no fim de cada task e anotados nela.
- CA3: `node scripts/skills-comum.mjs --check` (exit 0, `11 skills × 3 blocos`), `node scripts/skills-comum-teste.mjs` (exit 0), `wc -m` da seção ≤ 3.600, `wc -c` dos dois textos-base.
- Toda task fecha com `node scripts/skills-comum.mjs --check` saindo 0 (invariante: edição fora dos blocos não quebra o carimbo).

## Technical Decisions
1. **Portão de teste lido do `CLAUDE.md`, com `local` ou `CI` (brain #3566).** Os dois workspaces medem o oposto: este só tem suíte local; a Notoria já roda local só o tsc do CI e os testes do diff, porque a stack de teste é única e serializada entre sessões e o disco enche. Descartados: exigir a suíte inteira local em todo lugar (contradiz a prática medida e não resolve a `dev` vermelha depois de merge de PRs verdes, que é skew de merge); declarar o CI como portão universal sem nada local (PR com typecheck vermelho, o que a Fase 1 já viu quebrar a `dev`); parar quando o item falta (quebraria a Notoria no dia do `sync push`). Teste no push da `dev`: fora do escopo do card.
2. **`## Modo despachado` por categoria, não por pergunta (brain #3567).** Uma tabela de 14 linhas cobre as ~40 perguntas das 11 skills sem envelhecer a cada edição. Vale só sem humano **e** com a frente entregue; o argumento pode acrescentar paradas, nunca tirar. `gm-release` e `gm-hotfix` ficam inteiras na coluna *para*: levam a produção. Custo aceito: +3,2 KB por carga de skill, contra a divergência medida entre textos-base copiados por pasta.
3. **Ambiente na entrada genérico (brain #3568).** Disco e dependências são de qualquer workspace; serviço é declarado (Docker é da Notoria, não da skill). Nunca instalar por padrão. Texto idêntico em `gm-ship` e `gm-correcao` em vez de ir para a fonte: a fonte é só para seção que vale nas 11.
4. **Épico na porta, fatiado no `gm-spec` (brain #3569).** O `gm-spec` continua dono do corte; a triagem só declara o escopo. Na dúvida, um card. Severidade do épico = a maior dos pontos (S1 nunca entra).
5. **`gm-plan-tasks` recusa, não re-mede.** Re-medir duplicaria o G2; ele só recusa seção ausente ou sem prova, e manda de volta ao `gm-spec`.
6. **Heredoc:** conferido, 0 ocorrências; nenhum exemplo a alinhar.

## Coding Standards
Instruções de skill em inglês, o que o humano lê em pt-BR; linhas ≤ 100 colunas na prosa nova; blocos carimbados só pelo script; trechos copiados verbatim; nada além do especificado.
