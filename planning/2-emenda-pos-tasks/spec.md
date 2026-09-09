# Emenda pós-tasks — a decisão que cai entre a última task e a PR — Spec

> **Rota Curta.** Esqueleto Lite: seções curtas, nada omitido em silêncio. Não altera formato em
> disco nem superfície de tools — só o texto de skills e docs.
>
> Os dois blocos longos de texto normativo **não** estão inline: moram em
> `trechos/gm-implement-emenda-pos-tasks.md` e `trechos/gm-ship-decisao-caiu.md`, para serem
> copiados verbatim. Não é preciosismo: o `chunkMarkdown` do próprio `brain-mcp`
> (`brain-mcp/src/indexer.ts:44`) fatia em `/^(#{1,3})\s+(.+)/` **sem enxergar cerca de código**, de
> modo que um `## …` de exemplo dentro de um bloco ```` ``` ```` quebraria a indexação desta spec no
> índice que este repo entrega — e um `# comentário` de bash viraria H1, jogando as seções seguintes
> sob uma migalha errada.

## References
- Card: [#2](https://github.com/leonardo-amaral-3/claude-brain/issues/2) — repo `leonardo-amaral-3/claude-brain`
- PRD: N/A — Rota Curta; o card já traz estado atual, direção, por quê e critérios de aceite.

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir: a raiz deste repo — **não** há repo de módulo aninhado)
- Base branch: `dev`
- Feature branch: `feat/2-emenda-pos-tasks`

**Passo 0, obrigatório e antes de tudo: a `dev` não existe.** Há só `main`, com 2 commits
(conferido nesta sessão: `git branch -a` e `git ls-remote --heads origin`). Nenhuma skill cria base
faltante — o `## Guarantee the branch` do `gm-implement` (`:19-33`) trata só da branch de *feature*,
e o `createLinkedBranch` de `:28` lê `ref(qualifiedName:"refs/heads/<base>")`, que volta `null` sem
a `dev`; o fallback de `:33` (criar local a partir de `origin/<base>`) falha pelo mesmo motivo. Sem
o passo 0 a task 1 morre no setup. Portanto, o primeiro ato da implementação é:

```
git branch dev main && git push -u origin dev
```

E o `git ls-remote --exit-code --heads origin dev` entra no `## Plano de testes`. A partir daqui
`main` é produção e recebe PR da `dev` no release, como manda o `## Branches` do `CLAUDE.md`.

**Depois de commitar: `./sync.sh push`.** O que o Claude Code carrega é a instalação em
`~/.claude/skills/`, não esta pasta; sem o push a mudança existe em git e não existe em uso. Nada de
`npm run build` — não se toca em `brain-mcp/src/`.

## Requisitos & critérios de aceite

**CA1 — o caminho existe, tem nome e recusa os dois atalhos errados.**
Dado que todas as tasks de uma feature estão `✅` e ainda não há PR, quando uma decisão aprovada no
G2 é derrubada, então `skills/gm-implement/SKILL.md` tem a seção `## Emenda pós-tasks` que produz,
nesta ordem, a emenda datada aprovada pelo humano e a **task N+1** — e que **dentro da própria
seção** diz que este caminho não passa por `/gm-spec` (autoria) nem por `/gm-plan-tasks`. E a
entrada do `## Setup` deixa de oferecer `/gm-ship` como saída única: a frase antiga não sobra.

**CA2 — o `/gm-ship` aponta para ele no momento em que a coisa acontece.**
A regra mora em `## Open the PR` de `skills/gm-ship/SKILL.md` — não nas precondições, que são
avaliadas antes do `git push` e antes de escrever os critérios de aceite, que é justamente quando a
decisão cai. Ela traz um **gatilho** (conferir cada critério contra a suíte *e as medições* da
sessão), manda **não abrir a PR**, nomeia `/gm-implement <pasta>` / *emenda pós-tasks* como saída, e
se distingue explicitamente da precondição 2 (task pendente).

**CA3 — o caminho curto não compra velocidade com rastro.**
A seção do CA1 exige, em palavras: **aprovação humana explícita**, nota datada
(`Emenda AAAA-MM-DD: …`) em `spec.md` **e** no `<!-- gm:spec -->` — no **pai**, se for épico —, a
linha nova no `<!-- gm:tasks -->` e a marcação da task superada quando houver. E a PR nascida depois
carrega uma linha nomeando a emenda, para o revisor humano ver que uma decisão do G2 caiu **depois**
do planejamento sem diffar o comentário do card.

**CA4 — nenhum texto vizinho fica mentindo.**
`skills/gm-spec/SKILL.md`, `skills/gm-correcao/SKILL.md` e `docs/esteira-gm.md` (dois pontos)
nomeiam a emenda pós-tasks. Sem isto, a "spec viva" continua dizendo *durante a implementação*
(que se lê como mid-task) e o `gm-correcao` continua prometendo que os baldes dele mapeiam **três**
protocolos do `gm-implement`, quando passam a ser quatro.

## Technical Overview

*(o parágrafo que o card pediu — a escolha e o porquê)*

A janela órfã é estreita e bem delimitada: **da última task `✅` até a PR existir**. Antes dela o
protocolo de desvio do `gm-implement` já cobre; depois dela, **quando há parecer da revisão de CI**,
o balde Desvio do `gm-correcao` cobre. Então a correção não é uma skill nova — é **uma entrada que
falta e uma saída que falta**, em duas skills que já têm toda a máquina. O `gm-ship` **detecta** (é
o único lugar onde a situação aparece e o único que precisa ser impedido de abrir a PR) e o
`gm-implement` **executa** (já é dono do protocolo de desvio, `:45-46`, e já sabe fazer nascer
arquivo de task, no protocolo de fatiamento, `:48-54`). Descartadas: uma skill nova `/gm-emenda`,
porque seria a quarta cópia do mesmo protocolo — ou exigiria refatorar `gm-implement`, `gm-spec` e
`gm-correcao` para apontarem para ela, maior que este card; e resolver tudo dentro do `gm-ship`,
porque obrigaria a skill que **fecha** o loop a repetir as garantias da que **abre** código (teste
antes de apresentar, resumo por risco, commit só após aprovação). Contra a janela virar porta dos
fundos há dois freios, não um: **uma emenda, uma task** (não coube em uma? a nota datada entra na
spec do mesmo jeito, mas o trabalho vira card novo) e **uma emenda por ship** (segunda queda
independente antes da mesma PR significa que a errada é a spec, e o caminho é `/gm-spec`, que tem
portão humano).

## Implementation Details

Conteúdo **normativo**, redação indicativa — ajuste de estilo é livre desde que nenhuma afirmação
se perca. Os dois blocos grandes são **cópia verbatim** dos arquivos em `trechos/`.

### Área 1 — `skills/gm-implement/SKILL.md`

**1a. Trocar o item 4 do `## Setup`.** Hoje (`:17`, literal, conferido nesta sessão):
`4. All tasks `✅` → offer `/gm-ship <folder>`.` — passa a:

> `4.` Todas as tasks `✅` → **pergunte por qual das duas o humano veio, nunca assuma**: fechar
> (`/gm-ship <folder>`) ou uma **emenda pós-tasks** — decisão da spec caiu depois da última task e
> antes de existir PR. Só a segunda continua aqui, pela seção `## Emenda pós-tasks` abaixo.

A frase antiga **não pode sobrar** (é o que o teste negativo confere). A do `## Close the task`
(`:91`, `All `✅` → offer `/gm-ship <folder>`.` — sem o "tasks") **fica intacta**: ela é a saída
*depois* de fechar uma task, inclusive a da emenda, e continua correta.

**1b. Inserir a seção nova** entre o fim do protocolo de achado (`:75`) e `## Present for review`
(`:77`): conteúdo verbatim de **`trechos/gm-implement-emenda-pos-tasks.md`**.

**1c. Uma cláusula em `:52`** (protocolo de fatiamento, "if the split pushes the feature past
**6–8 tasks total** … send it back to `/gm-card` + `/gm-spec`") — hoje ela contradiz frontalmente a
exceção do passo 3 da seção nova, 50 linhas abaixo, no mesmo arquivo. Acrescentar ao fim do item:
"(a task da **emenda pós-tasks** é exceção nomeada a este teto — ver a seção homônima abaixo)".

### Área 2 — `skills/gm-ship/SKILL.md`

**2a. A regra vai para `## Open the PR`**, entre o passo 1 (`git push`) e o passo 2 (corpo da PR):
conteúdo verbatim de **`trechos/gm-ship-decisao-caiu.md`**. A posição é a decisão, não um detalhe:
as precondições terminam em `:15`, o `git push` é `:19` e os critérios de aceite são escritos em
`:28-31` — uma regra colocada nas precondições é avaliada uma vez, antes dos dois momentos em que a
decisão de fato cai.

**2b. Um ponteiro de uma linha no fim da precondição 4** (a que roda a suíte), porque a suíte é o
outro momento de detecção: "**Verde não encerra a checagem** — leia o resultado contra as decisões
da spec; se a suíte ou uma medição derruba alguma, vale a regra do `## Open the PR` abaixo."

**2c. No template do corpo da PR**, dentro de `## Contexto para revisão`, um comentário HTML no
mesmo estilo do que já existe ali para card de fase:

    <!-- houve emenda pós-tasks? uma linha por emenda:
         "Emenda AAAA-MM-DD: <a decisão que caiu, em meia linha> — nota completa no gm:spec"
         para o revisor humano ver que uma decisão do G2 caiu DEPOIS do planejamento, sem ter de
         diffar o comentário do card. -->

### Área 3 — o texto vizinho que passaria a mentir (CA4)

Frases que hoje dizem "durante a implementação" e se leem como *mid-task*. Em todas, a cláusula é
**frase nova ao fim**, nunca inserção depois do parêntese — o parêntese é seguido do verbo da
oração (`atualizam` / `atualiza`), e inserir ali produz texto agramatical:

- `skills/gm-spec/SKILL.md`, parágrafo **Spec viva** (`:118`), depois de "…nunca vira mentira
  histórica.": acrescentar "Isso inclui a **emenda pós-tasks**, quando a decisão cai entre a última
  task e a PR."
- `docs/esteira-gm.md`, parágrafo "É **spec viva**" no verbete `/gm-spec`: a mesma frase.
- `docs/esteira-gm.md`, verbete `/gm-implement`, ao fim: "E se a decisão cair depois da última task,
  com a PR ainda por abrir, é aqui que a **emenda pós-tasks** nasce: nota datada aprovada pelo
  humano, uma task nova, e o `/gm-ship` retomado."
- `skills/gm-correcao/SKILL.md`, `:52-53` ("quatro baldes — os três últimos são os protocolos do
  `gm-implement`, não invente outros"), acrescentar: "; a **emenda pós-tasks**, quarta seção de lá,
  é anterior à PR e não se aplica aqui."

### Deliberadamente fora, com motivo

| Fora | Por quê |
|---|---|
| `README.md:245` (linha da tabela de skills) | índice de uma linha por skill, não contrato — a ressalva não cabe numa célula; o `docs/esteira-gm.md`, que é o detalhe, recebe a frase |
| `skills/gm-plan-tasks/SKILL.md:28` (teto 6–8) | ali o teto está escopado ao **protocolo de fatiamento** ("split there … into suffixed sub-tasks"), que a emenda explicitamente não é. Não há contradição a resolver — diferente de `gm-implement:52`, que é genérico e por isso muda |
| Decisão que cai **depois** da PR mas **sem** parecer de revisão (workflow inativo, timeout, ou já em 🧪 Validação em Dev) | buraco real: `gm-correcao` para na precondição 2 sem `gm:revisao-status = Revisada`. É outra janela, com outra estação — **card novo** pelo protocolo de achado, não emenda deste |
| Mudar o gate G2 | fora do escopo declarado pelo card |

## File Change Summary

| Arquivo | O que muda |
|---|---|
| `skills/gm-implement/SKILL.md` | item 4 do `## Setup` vira pergunta (1a); seção `## Emenda pós-tasks` nova, 8 passos (1b); cláusula de exceção ao teto em `:52` (1c) |
| `skills/gm-ship/SKILL.md` | bloco novo em `## Open the PR` entre os passos 1 e 2 (2a); ponteiro na precondição 4 (2b); comentário HTML no template da PR (2c) |
| `skills/gm-spec/SKILL.md` | frase nova ao fim do parágrafo **Spec viva** |
| `skills/gm-correcao/SKILL.md` | meia frase em `:53` (quatro protocolos, não três) |
| `docs/esteira-gm.md` | a mesma frase no verbete `/gm-spec`; uma frase no verbete `/gm-implement` |
| `planning/2-emenda-pos-tasks/` | `spec.md` + `trechos/*.md` — já criados nesta sessão, versionados junto |

Ação sem arquivo, igualmente obrigatória: **criar e empurrar a branch `dev`** (passo 0 do
`## Execution`). Nada criado fora disso. Nenhum arquivo removido. Nenhum `.ts`, `.json` ou hook.

## Migrations & compatibilidade

N/A quanto a migration — só markdown, e nada de `brain-mcp/src/`, do formato do índice, do
`conversations.json` ou da superfície das tools (é por isso que a rota é Curta, pelo delta 1 do
`CLAUDE.md` deste repo). **Compatibilidade que precisa valer:** as skills seguem com
`disable-model-invocation: true` no frontmatter, e nenhum marcador HTML (`gm:spec`, `gm:tasks`,
`gm:spec-ref`, `gm:fase`, `gm:revisao-status`) muda de nome ou forma — `gm-correcao` e a revisão de
CI leem esses marcadores. Feature em voo: **nenhum arquivo de task existente muda de formato**, e o
`This is task N of [total]` das tasks antigas fica desatualizado por desenho (o passo 6 da seção
nova diz isso em voz alta, porque a alternativa seria reescrever N arquivos por emenda).

## Rollback

`git revert <sha>` na `dev` e `./sync.sh push` de novo — o estado anterior volta em dois comandos e
não há estado persistido a desfazer. Enquanto o revert não roda, o pior caso é o texto novo existir
e ninguém usar: as skills são `disable-model-invocation: true`, invocadas pelo humano, então nada
dispara sozinho. A `dev` criada no passo 0 **não** é revertida — ela é pré-requisito da esteira,
não desta feature.

## Verificação pós-deploy

Não toca dados nem faturamento, mas tem análogo obrigatório e bloqueante: **o que roda é a
instalação, não o repo.** Depois do merge e do `./sync.sh push`, os três, separadamente:

```
./sync.sh status                                                    # -> "Tudo igual entre repo e maquina."
grep -q '^## Emenda pós-tasks' ~/.claude/skills/gm-implement/SKILL.md ; echo $?   # -> 0
grep -q 'emenda pós-tasks'     ~/.claude/skills/gm-ship/SKILL.md     ; echo $?   # -> 0
```

Dois `grep -q` separados, não um `grep -c` sobre dois arquivos — aquele sai `0` se **qualquer** um
casar, e não seria portão. E os padrões diferem em caixa de propósito: no `gm-implement` a marca é o
**título** da seção (`## Emenda pós-tasks`); no `gm-ship` a menção é em minúscula no meio da frase.
`docs/` não é sincronizado (`sync.sh:33-44` cobre `skills`, `hooks` e `brain-mcp/{src,scripts}`),
então a mudança do CA4 em `docs/` é conferida no repo, pelo plano de testes, não aqui.

## Plano de testes

Não há suíte para markdown de skill — `npm run smoke` e `npm run eval` provam o índice do
`brain-mcp`, intocado aqui. A verificação é textual e mecânica, e a regra que a torna honesta é
esta: **todo grep que poderia passar hoje, antes da mudança, é ancorado na seção nova, não no
arquivo.** Sete dos greps de um rascunho anterior passavam no `HEAD` — `gm-plan-tasks`, `gm-spec`,
`Emenda AAAA-MM-DD`, `gm:spec` e `spec.md` já existem em `gm-implement:10,46,52`, e `gm-implement`
já aparece em `gm-ship:13`, que é exatamente a resposta errada que o CA2 substitui.

Comando único da task, da raiz do repo:

```bash
set -e
I=skills/gm-implement/SKILL.md ; S=skills/gm-ship/SKILL.md
falha() { echo "FALHA: $1" >&2 ; exit 1 ; }

SEC=$(mktemp)
sed -n '/^## Emenda pós-tasks/,/^## Present for review/p' "$I" > "$SEC"
test -s "$SEC" || falha "CA1: seção Emenda pós-tasks ausente"

  ## CA1 -- dentro da secao nova, nunca no arquivo inteiro
  for p in 'N+1' 'Uma emenda, uma task' 'gm-plan-tasks' 'gm-spec' \
           'exceção nomeada ao teto' 'Segunda emenda' ; do
    grep -q "$p" "$SEC" || falha "CA1: '$p' fora da seção"
  done

  ## CA1 -- a entrada do Setup mudou (teste negativo com if: 'set -e' ignora '!')
  if grep -qF 'All tasks `✅` → offer `/gm-ship <folder>`.' "$I" ; then
    falha "CA1: a saída única antiga sobrou no Setup"
  fi
  grep -q 'emenda pós-tasks' "$I"                          || falha "CA1: Setup não cita a seção"
  grep -qF 'All `✅` → offer `/gm-ship <folder>`.' "$I"     || falha "CA1: :91 foi alterada à toa"

  ## CA3 -- rastro, tambem dentro da secao
  for p in 'aprovação humana explícita' 'Emenda AAAA-MM-DD' 'gm:spec' 'spec.md' \
           'gm:tasks' 'gm:spec-ref' 'superada pela emenda' ; do
    grep -q "$p" "$SEC" || falha "CA3: '$p' fora da seção"
  done

  ## CA2 -- a regra esta em Open the PR, nao nas precondicoes
  awk '/^## Open the PR/,/^## Board/' "$S" > "$SEC.ship"
  for p in 'emenda pós-tasks' 'não abra a PR' 'medições' 'precondição 2' ; do
    grep -q "$p" "$SEC.ship" || falha "CA2: '$p' fora de Open the PR"
  done
  grep -q 'Emenda AAAA-MM-DD' "$S" || falha "CA3: corpo da PR não nomeia a emenda"

  ## CA4 -- vizinhanca coerente
  grep -q 'emenda pós-tasks' skills/gm-spec/SKILL.md     || falha "CA4: gm-spec"
  grep -q 'emenda pós-tasks' skills/gm-correcao/SKILL.md || falha "CA4: gm-correcao"
  test "$(grep -c 'emenda pós-tasks' docs/esteira-gm.md)" -ge 2 || falha "CA4: docs (2 pontos)"

  ## base branch e invariantes que nao podem quebrar
  git ls-remote --exit-code --heads origin dev >/dev/null || falha "passo 0: branch dev"
  grep -q 'disable-model-invocation: true' "$I" || falha "frontmatter gm-implement"
  grep -q 'disable-model-invocation: true' "$S" || falha "frontmatter gm-ship"

rm -f "$SEC" "$SEC.ship" ; echo OK
```

E duas checagens de leitura, mostradas na revisão da task porque `grep` não as faz:

- **CA2, leitura adversarial:** ler o bloco novo ao lado da precondição 2 e confirmar que um agente
  consegue dizer em qual dos dois está — task pendente *versus* tudo `✅` e spec errada.
- **CA1, coerência interna do arquivo:** ler `:52` (teto 6–8) e o passo 3 da seção nova juntos e
  confirmar que a exceção está nomeada nos dois lugares, não só num.

## Technical Decisions

1. **`gm-ship` detecta, `gm-implement` executa** — em vez de skill nova ou de tudo no ship. A
   janela é estreita e a máquina já está repartida assim: o `gm-implement` é dono do protocolo de
   desvio (`:45-46`) e de fazer nascer arquivo de task (`:48-54`); o `gm-ship` é onde a situação
   aparece e o único que precisa ser impedido de abrir a PR. Uma `/gm-emenda` seria a quarta cópia
   do protocolo (ou um refactor de três skills, maior que o card); tudo no ship faria a skill que
   fecha o loop repetir as garantias da que abre código.
2. **Dois freios, não um: uma task por emenda, uma emenda por ship.** O primeiro sozinho não segura
   nada — emendas de uma task cada, em série, reabrem a feature inteira sem tocar em portão. O
   segundo é o que fecha: segunda queda independente antes da mesma PR é sinal de que a errada é a
   spec, e devolver ao `/gm-spec` recoloca o portão humano do G2 no caminho.
3. **A unidade da emenda é a task, não a decisão.** O caso que originou o card foi *uma* medição
   derrubando *duas* decisões; tratá-lo como duas emendas dispararia o freio 2 no primeiro uso, que
   é exatamente o caso legítimo. Duas decisões que caem juntas e cabem numa task são uma emenda.
4. **A task da emenda é exceção nomeada ao teto de 6–8** — e a exceção é escrita nos **dois**
   lugares (`gm-implement:52` e a seção nova). O teto existe para pegar card que é épico disfarçado
   *antes* da implementação; no ship não há mais planejamento para governar, e invocá-lo devolveria
   ao `/gm-card` uma feature inteiramente implementada — caminho que ninguém percorre. Deixar a
   exceção só na seção nova produziria duas regras opostas a 50 linhas de distância no mesmo arquivo.
5. **A nota datada vai para a spec mesmo quando o trabalho vira card.** Os dois efeitos são
   independentes: "a spec está errada" já aconteceu; "quem faz o trabalho" é decisão de fila.
   Amarrar um ao outro produziria PR contra spec sabidamente errada — o que o CA2 proíbe.
6. **A regra do ship mora em `## Open the PR`, não nas precondições.** As precondições acabam em
   `:15` e o `git push` é `:19`: uma regra lá é avaliada antes dos dois momentos em que a decisão
   cai (ler a suíte, escrever os critérios de aceite). E o gatilho é explícito, porque suíte verde
   não denuncia decisão caída — no incidente de origem foi uma medição.
7. **A PR nomeia a emenda em uma linha que aponta para o `gm:spec`**, não numa cópia da nota. Dá o
   sinal ao revisor humano sem criar segunda fonte de verdade que possa divergir.
8. **A entrada do `gm-implement` pergunta em vez de assumir.** Com tudo `✅` a skill não tem como
   saber por qual dos dois motivos o humano veio, e as `gm-*` são `disable-model-invocation`:
   assumir errado aqui é exatamente o defeito que originou o card, uma estação antes.
9. **Task N+1 com número corrido, não sufixo.** Sufixo (`3a`, `3b`) já significa fatiamento de uma
   task existente; reusá-lo faria a emenda parecer fatiamento no arquivo e no `gm:tasks`.
10. **A emenda que invalida task já `✅` é declarada, não escondida.** O `gm-implement:90` já marcou
    `- [x]` e o corpo da PR lista a task como feita; sem a marcação `(superada pela emenda …)` o
    card anuncia como entregue um trabalho desfeito.
11. **Os blocos normativos moram em `trechos/`**, não em cerca de código dentro desta spec — o
    `chunkMarkdown` do `brain-mcp` (`src/indexer.ts:44`) não enxerga cerca, e um `## …` de exemplo
    partiria esta spec no índice que este próprio repo entrega. Efeito colateral bom: o implementador
    copia arquivo, não transcreve.

## Coding Standards

- Markdown apenas. Estilo dos arquivos vizinhos: prosa densa em pt-BR onde se explica *por quê*,
  imperativo curto onde se diz *o quê*, negrito na afirmação que não pode passar batida, `crase`
  para comando, arquivo e marcador.
- **Não reescrever o que não está no `## File Change Summary`.** Nada de "já que estou aqui":
  reordenar seções, uniformizar idioma (as skills misturam pt-BR e inglês de propósito) ou corrigir
  a contagem errada de skills no `CLAUDE.md` (`:4` e `:86` dizem "14 skills `gm-*`"; são 12 `gm-*` e
  15 pastas) são **outro assunto** — protocolo de achado, card novo.
- Frontmatter (`name`, `description`, `disable-model-invocation`, `argument-hint`) não muda em
  nenhum arquivo.
- Commit da raiz deste repo (não há repo aninhado), mensagem terminando com o trailer `Card: #2`.
  Depois do commit, `./sync.sh push`.
