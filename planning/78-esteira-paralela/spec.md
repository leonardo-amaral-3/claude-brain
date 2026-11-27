# Esteira gm-* em paralelo e pós-PR destravado, tudo dentro do Claude Code — Spec

## References
- Card: [#78](https://github.com/leonardo-amaral-3/claude-brain/issues/78) — repo `leonardo-amaral-3/claude-brain` (épico, `## Pontos` 1 a 4)
- Decisões que não se reabrem (cofre): #3606 (nada no app do workspace; tudo dentro do Claude Code), #3607 (merge na dev pelo fluxo com CI verde + G4 tratado + spec não sensível; spec sensível espera o humano; main em lotes), #3608 (a frente inteira foi entregue ao braço direito, até a main), #3610, #3611 (G1)
- Decisões desta spec: #3617 (mecanismo do `/gm-frente`) e as gravadas no G2 (escopo `claude-brain#78`)
- PRD: não há

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir `claude-brain/` no workspace `pessoal`)
- Base branch: `dev`
- Feature branch: uma por fase — linha `Branch:` do `gm:spec-ref` de cada fase e coluna *Branch* de `## Fases`
- Esta spec (`planning/78-esteira-paralela/spec.md` e `sensibilidade.json`) entra no **primeiro commit de cada fase**, igual em todas (M9). **Nenhuma fase edita a spec**: emenda é `PARADA` para o dono da frente, que a aplica com um commit idêntico em toda branch de fase aberta e reclassifica (`sensivel.mjs`)

## Fases

| Fase | Pontos | Pronto quando… | Rota | Branch | Arquivos (só ela toca) | Bloqueio |
|---|---|---|---|---|---|---|
| F1 — `/gm-frente` | 1, e o validador do 2 | `/gm-frente <repo>#<n>` conduz um card ou épico em ondas e fases paralelas, provado com `claude` e `gh` falsos | Curta | `feat/<n>-gm-frente` | `skills/gm-frente/SKILL.md`, `skills/gm-frente/frente.mjs`, `skills/gm-frente/ondas.mjs`, `scripts/gm-frente-teste.mjs`, `scripts/claude-falso.mjs`, `scripts/gh-falso.mjs` | — |
| F2 — task com onda | 2 | o `/gm-plan-tasks` escreve `Onda:`, `Depende de:` e `Toca:` em toda task e o `/gm-implement --task` executa uma task de onda | Curta | `feat/<n>-task-onda` | `skills/gm-plan-tasks/SKILL.md`, `skills/gm-implement/SKILL.md` | — |
| F3 — pós-PR | 3 | o `/gm-ship` faz G4 e merge na dev pelas condições do `merge-dev.mjs`, e o `/gm-release` valida por trem e deixa o board limpo | Curta | `feat/<n>-pos-pr` | `skills/gm-ship/SKILL.md`, `skills/gm-ship/merge-dev.mjs`, `skills/gm-release/SKILL.md`, `skills/gm-release/trem.mjs`, `skills/gm-correcao/SKILL.md`, `skills/gm-spec/sensivel.mjs`, `scripts/gm-spec-sensivel-teste.mjs`, `scripts/gm-ship-merge-teste.mjs`, `scripts/gm-release-trem-teste.mjs` | — |
| F4 — comum e documentação | 4 (skills), e as linhas comuns de 1 e 3 | o `_comum` traz as linhas novas do `## Modo despachado`, nenhum trecho dele está repetido à mão, e a documentação e a suíte do `CLAUDE.md` contam a esteira nova | Curta | `feat/<n>-comum` | `skills/_comum/convencoes.md`, `skills/_comum/opcionais.md` (novo), `scripts/skills-comum.mjs`, `scripts/skills-comum-teste.mjs`, `scripts/classificar-parada.mjs`, `scripts/classificar-parada-teste.mjs`, `scripts/jev-falso.mjs`, `skills/gm-spec/SKILL.md`, `docs/esteira-gm.md`, `templates/CLAUDE.example.md`, `README.md`, `CLAUDE.md`, e o recarimbo de toda `skills/gm-*/SKILL.md` | espera F1, F2 e F3 na dev |
| F5 — CLAUDE.md do workspace | 4 (CLAUDE.md) | o `CLAUDE.md` do workspace `pessoal` versionado e instalado pelo `sync`, sem nota de reconstrução e sem "(a confirmar)" | Curta | `feat/<n>-claude-md-workspace` | `workspaces/pessoal/CLAUDE.md`, `sync.sh`, `sync.ps1` | espera a resposta de P-A (`## Pontos abertos`) |

`<n>` é o número da sub-issue da fase. **Partição:** F1, F2, F3 e F5 não compartilham arquivo nenhum além do `spec.md`/`sensibilidade.json` desta pasta, que entram iguais e não são editados por fase nenhuma (`## Execution`). F4 toca, pelo recarimbo do `scripts/skills-comum.mjs`, **todo** `skills/gm-*/SKILL.md` — inclusive os de F1, F2 e F3 — e por isso nasce bloqueada. Os pontos de colisão óbvios ficam com uma fase só: `skills/_comum/convencoes.md`, `docs/esteira-gm.md` e `CLAUDE.md` são da F4 (as linhas de suíte dos testes novos de F1 e F3 entram lá; até a F4, a suíte de F1 e F3 é a do `## Plano de testes` desta spec, que o `/gm-ship` lê junto com o `CLAUDE.md`).

## Requisitos & critérios de aceite

**R1 — `/gm-frente` (F1).**
- **R1.1** Dado um card com tasks no formato novo e duas delas na mesma onda, quando o condutor roda, então as sessões das duas abrem antes de qualquer uma terminar, cada uma numa worktree própria; depois da onda as duas estão juntadas na branch da unidade, com as worktrees e branches de task removidas.
- **R1.2** Dado um épico com duas fases promovidas e sem `Bloqueado`, quando o condutor roda, então as duas cadeias andam ao mesmo tempo, cada uma na sua worktree, e cada uma chega à sua PR sem esperar a outra.
- **R1.3** Rodar um card exige **0** arquivos de despacho escritos à mão: a única entrada é `/gm-frente <owner>/<repo>#<n>` mais o texto da entrega; o prompt de cada sessão filha é gerado no molde fixo e **não** repete freio, trailer nem suíte.
- **R1.4** Task antiga, sem os três campos, roda em sequência na worktree da unidade, uma por sessão.
- **R1.5** Sessão filha que fecha em `PARADA`, que sai sem linha de despacho ou que estoura o limite, ou onda que dá conflito ao juntar → aquela unidade para com o motivo, e as outras seguem.

**R2 — formato da task (F2; validador na F1).**
- **R2.1** Toda task escrita pelo `/gm-plan-tasks` tem, nas linhas 2 a 4, `Onda:`, `Depende de:` e `Toca:` no formato do *Contrato da task*, e `ondas.mjs --validar` sai `0` sobre a pasta.
- **R2.2** Nenhuma onda junta duas tasks cujos caminhos colidem nem duas tasks que dependem uma da outra.
- **R2.3** `/gm-implement <pasta> --task <arquivo>` executa só aquela task, recusa rodar com dependência que não está `✅` e recusa o commit quando o diff sai do `Toca:` (as duas recusas são do `ondas.mjs --conferir`).

**R3 — pós-PR (F3).**
- **R3.1** Com CI verde (ou o `CLAUDE.md` declarando que não há CI e o portão local verde no head atual) + branch atualizada com a `dev` + G4 tratado + spec não sensível, o `/gm-ship` faz o merge na dev e **não** fecha em "aguardando merge"; com spec sensível, para.
- **R3.2** Nenhuma PR nasce com base em branch de outro card, salvo com `Motivo da base:` no `## Execution` da spec.
- **R3.3** Depois do `/gm-release`: **0** cards do trem fora de ✅ Produção (card segurado sai do trem, com o porquê), todas as issues do trem fechadas, e o `/gm-release` confere e registra `main..<corte> = 0`.
- **R3.4** Os itens `[comando]` do G5 de cada card do trem rodam pela sessão, com a saída na PR do trem; só os `[humano]` vão ao humano.

**R4 — enxugar (F4, F5).**
- **R4.1** `node scripts/skills-comum.mjs --check` verde, e ele mesmo acusa (código `1`) trecho de 9 palavras seguidas de uma fonte do `_comum` fora dos blocos carimbados.
- **R4.2** O `CLAUDE.md` do workspace `pessoal` sem "(a confirmar)" e sem nota de reconstrução (F5).

## Premissas medidas

Todas rodadas em 2026-11-27, na worktree `claude-brain-78-esteira-paralela` (origin/dev `5c76b82`), Claude Code 2.1.322. Custo das sessões gastas para medir: ~US$ 0,06.

| # | Premissa | Comando / prova | Resultado |
|---|---|---|---|
| M1 | As skills `gm-*` têm `disable-model-invocation: true` | `grep -L "disable-model-invocation: true" skills/gm-*/SKILL.md` | vazio: as 12 têm |
| M2 | `claude -p "/gm-<skill> ..."` executa a skill | `despachos-66/saida-impl-67.json` (`subtype: success`, 66 turnos, última linha `PROXIMO: /gm-ship #67`); o transcript da sessão `1ba1099f…` contém `Base directory for this skill: …/skills/gm-implement` | executa |
| M3 | Duas sessões `claude -p` abertas em paralelo de dentro de outra sessão headless executam a skill | `claude -p "/gm-tech-spec #1"` e `#2` com `&` + `wait`, `--output-format json`; os dois transcripts têm `Base directory for this skill: …/gm-tech-spec` | as duas `success`, US$ 0,005 cada |
| M4 | O modelo não invoca skill `gm-*` | `Skill("gm-tech-spec")` nesta sessão | recusado: "cannot be used with Skill tool due to disable-model-invocation" |
| M5 | Subagente (Agent tool) não roda skill `gm-*` | subagente com prompt `/gm-tech-spec #1`: relata `NAO_EXPANDIDA`, e o `Skill` dele devolve a recusa de M4 | não roda. Workflow salvo **não foi rodado** (exige opt-in do usuário); os agentes dele são subagentes, e o desenho não depende dele |
| M6 | Processo lançado com `setsid` sobrevive ao fim da chamada Bash e ao fim da sessão `claude -p` que o lançou | `setsid -f bash -c 'sleep 25; echo vivo > …/pos-sessao'` dentro de um `claude -p` que terminou antes; o arquivo apareceu 24 s depois | sobrevive (também `systemd-run --user`) |
| M7 | Chamada Bash em primeiro plano tem teto | descrição da ferramenta Bash desta sessão ("max 600000 for a foreground command") | 10 min |
| M8 | Branches de task com arquivos disjuntos se juntam sem conflito; no mesmo arquivo, conflitam | repositório temporário, `git worktree add -b` + `git merge --no-ff` | disjuntos: limpo; mesmo arquivo: `rc=1`, e `git merge --abort` deixa a árvore limpa |
| M9 | Duas fases que adicionam o mesmo `spec.md` igual se juntam sem conflito | repositório temporário, add/add idêntico | limpo |
| M10 | `git branch -d` recusa branch presa a worktree | o mesmo repositório | recusa: remover a worktree vem antes |
| M11 | O `sync.sh` instala `skills/<nome>/` inteira, inclusive `.mjs` | `sync.sh:81-83` | instala |
| M12 | Hoje cada despacho repete à mão worktree, branch, base, freios, trailer e suíte | `despachos-66/comum.txt`, `cadeia.sh`, `prompt-impl-67.txt` (~3 KB cada) | repete |
| M13 | O `/gm-plan-tasks` escreve lista ordenada, sem dependência nem arquivo tocado | `skills/gm-plan-tasks/SKILL.md:3`, `:73`, molde em `:95-128` | sem campos |
| M14 | O `/gm-implement` pega a menor task `❌`, para se uma anterior não está `✅`, commita **antes** de virar o `✅`, marca o checkbox do `gm:tasks` | `skills/gm-implement/SKILL.md:70`, `:252-259` | duas tasks em paralelo disputariam o comentário; o `✅` ficaria fora do commit |
| M15 | O G4 não é passo de skill: no #66 veio do argumento do despacho | `grep -n G4 skills/*/SKILL.md` só acha citações; comentário do card #67 "G4 de IA com 7 achados" | precisa virar passo do `/gm-ship` |
| M16 | O `/gm-ship` termina com a PR aberta e remove a worktree logo depois; o `/gm-release` fecha só os cards do trem que leu e abre a PR com `--head dev` | `skills/gm-ship/SKILL.md:89-175` (`## Fechar a worktree` em `:148`); `skills/gm-release/SKILL.md:173`, `:282-295` | confirma o card; `--head dev` deixa a PR do trem andar com a `dev` |
| M17 | `gh pr merge` trava no head revisado | `gh pr merge --help` | `--match-head-commit SHA` |
| M18 | **Nesta máquina toda spec sai sensível**: o envio ao Jev não está autorizado | `sensibilidade.json` das 12 specs da máquina: todas sensíveis, Jev `indisponivel` ("envio de spec ao Jev não autorizado nesta máquina"); esta spec também (`optIn: false`) | o merge sozinho na dev não dispara aqui enquanto o envio estiver desligado — P-B |
| M19 | A tabela do `## Modo despachado` é lida pelo classificador da `PARADA` | `scripts/classificar-parada.mjs:63-80` (1ª célula exata de cada linha **para**), `:114-135`; `scripts/classificar-parada-teste.mjs:53` usa "o merge na dev é do Leonardo" como exemplo de `producao` | mudar a linha **para** do merge obriga `CATEGORIAS` e teste (F4) |
| M20 | Literal do `_comum` repetido à mão nas skills | 9-gramas de `convencoes.md` contra as skills fora dos blocos (script descartável) | **0**. A duplicação real: `## Ambiente na entrada` tem 19 linhas idênticas em `gm-ship` e `gm-correcao` (`diff` vazio); reafirmações em `gm-ship/SKILL.md:80`, `gm-release/SKILL.md:106`, `:121`, `:144` |
| M21 | O `skills-comum.mjs` carimba "todos ou nenhum" | `scripts/skills-comum.mjs:110-121`; `convencoes.md:22` | bloco de algumas skills precisa de fonte opcional |
| M22 | O `CLAUDE.md` do workspace `pessoal` não está na origin: só no `dev` local do checkout principal (`f798e21`, "ahead 1") | `git branch -a --contains f798e21` → só `dev` local; conteúdo igual ao instalado | a F5 o traz por `cherry-pick` |
| M23 | A norma citada pelos dois `CLAUDE.md` não existe na máquina | `find /home/leo -name "fluxo-gm-desenvolvimento*"` → nada | vira ponteiro para `docs/esteira-gm.md` › `## O caminho` |
| M24 | Este repo declara que não há CI | `CLAUDE.md` deste repo, `## Convenções da esteira` › *Typecheck do CI* | a condição de CI é o portão local no head atual |

## Technical Overview

1. **O condutor é um script; as estações são sessões.** `/gm-frente` é uma skill fina que lança `skills/gm-frente/frente.mjs` destacado (M6). O condutor abre cada estação como `claude -p "/gm-<skill> …"` (M2, M3) e lê a última linha `PROXIMO:`/`PARADA:`. A sessão do `/gm-frente` acompanha com chamadas de até 9 min (M7). Subagente e workflow ficam fora (M4, M5).
2. **A próxima estação vem dos artefatos**: card, comentários `gm:*`, tasks na worktree, PR. `PROXIMO` = siga, `PARADA` = pare esta unidade. Retomar é avaliar de novo.
3. **Uma worktree por unidade (card ou fase), e uma worktree + branch local por task de onda com mais de uma task**, juntadas por `git merge --no-ff` (M8). O `Toca:` garante a junção; conflito para a unidade.
4. **O que é decisão mecânica vira script testável**: `ondas.mjs` (plano e conferência da task), `merge-dev.mjs` (as condições do merge), `trem.mjs` (cards na main e itens do G5). As skills chamam os scripts e agem pelo resultado.
5. **O `_comum` ganha as linhas novas e uma fonte opcional**, e o `--check` passa a acusar duplicação.

## Implementation Details

### Gramática dos argumentos (contrato entre o condutor e as skills)

O primeiro token é sempre o alvo que a skill já lê hoje; as opções vêm depois e as skills (F2, F3) passam a reconhecê-las. Sem opção, cada skill age como hoje.

| Skill | Como o condutor chama |
|---|---|
| `gm-spec` | `/gm-spec #<n>` |
| `gm-plan-tasks` | `/gm-plan-tasks <pasta> --card <n>` |
| `gm-implement` | `/gm-implement <pasta> --card <n> --branch <branch> --task <arquivo>` |
| `gm-ship` | `/gm-ship <pasta> --card <n> [--merge]` |

`<pasta>` = nome da pasta de planning (épico: a do pai, `78-esteira-paralela`); `--card` = o card em voo (fase ou o próprio); `--branch` = a branch em que a worktree do `cwd` tem de estar; `<arquivo>` = caminho da task relativo à raiz do repo. As skills leem `planning/<pasta>/` e, com `--card`, tratam o `<n>` como o card em voo (fase: `tasks/<fase>/`, o `gm:spec-ref` dele).

### F1 — `skills/gm-frente/`

#### `skills/gm-frente/SKILL.md`

Frontmatter: `name: gm-frente`, `description` (em inglês, uma frase: conduz um card ou épico despachado inteiro, em ondas e fases paralelas, abrindo cada estação como sessão headless), `disable-model-invocation: true`, `model: inherit`, `argument-hint: <owner>/<repo>#<n> [texto da entrega]`. Instruções em inglês, mensagens ao humano em pt-BR. Os três blocos `## Como perguntar e como aprovar`, `## Convenções de saída` e `## Modo despachado` entram com os cabeçalhos exatos e são preenchidos por `node scripts/skills-comum.mjs` (só este arquivo muda; os outros já estão iguais à fonte).

Passos:

1. **Alvo.** `<owner>/<repo>#<n>` (ou `#<n>` quando o `## Board` lista um repo só). Sem alvo → `PARADA: alvo da frente ambíguo`.
2. **Entrega.** O resto do argumento é a entrega, que vai **literal** às filhas. Sem entrega: com humano → uma chamada `AskUserQuestion`, header `Entrega`, em pt-BR: **Entregar a frente** (as filhas decidem pelo `## Modo despachado` das skills: artefatos, commit, push e o merge na dev pelas condições do `/gm-ship`) · **Cancelar**; *Entregar* vira o texto `O humano entregou a frente nesta sessão: as sessões filhas decidem pelo ## Modo despachado das skills.` Sem humano e sem entrega → `PARADA: a frente precisa da entrega em palavras`. Filha sem entrega para no primeiro portão, e é esse o freio.
3. **Do `CLAUDE.md`** que governa o repo (o do repo, quando tem `## Convenções da esteira`; senão o do workspace): o item *Paralelo* (`- **Paralelo**: <n>`; ausente → `3`) e a existência do `## Board` (ausente → `PARADA`). Workspace = a pasta que contém o checkout principal; checkout principal = `<workspace>/<repo>`; base = o `dev` de `## Branches`.
4. **Spec**: `planning/<n>-*/spec.md` (fase: `<n>` do pai, por `issue.parent`) na `origin/<base>` (`git ls-tree`), no checkout atual (`git rev-parse --show-toplevel`) ou em `<workspace>/planning/`, nessa ordem. Achou → `--spec <caminho absoluto>`.
5. **Lança**: `node "<Base directory for this skill>/frente.mjs" iniciar --card <owner>/<repo>#<n> --workspace <dir> --checkout <dir> --base <base> --paralelo <n> --entrega-arquivo <arquivo> [--spec <caminho>]` (a entrega vai para arquivo temporário, convenção de saída 2). Devolve uma linha JSON `{"dir", "pid", "retomada"}`.
6. **Acompanha**: `node "<…>/frente.mjs" estado --dir <pasta> --esperar 540`, em primeiro plano, repetido até `terminal: true`; relata em pt-BR só o que mudou. `"condutor": "morto"` → `iniciar` de novo (retoma). A sessão não agenda retorno e não roda nada em segundo plano: o condutor é processo à parte, como um CI.
7. **Fecha** com a tabela das unidades (card, estação, PR, resultado) e a linha: todas `concluida` → `PARADA: frente <repo>#<n> na dev (<k> PRs); a main sai pelo /gm-release`; alguma parou → `PARADA: <card> parou em <estação>: <motivo>` (a primeira; as outras na tabela).

#### `skills/gm-frente/frente.mjs` — o condutor

Node ≥ 20, só módulos nativos, ESM. Pasta de estado: `${CLAUDE_CONFIG_DIR:-~/.claude}/gm-frente/<owner>-<repo>-<n>/`. `estado.json` é escrito por troca atômica (temporário + `renameSync`) e tem `{versao: 1, card, workspace, checkout, base, paralelo, spec, pid, batimento, inicio, terminal, unidades: [{card, branch, worktree, estacao, resultado, motivo, pr, sessoes: [{id, pid, estacao, task, inicio, fim}]}]}`. Versão desconhecida → código `2`.

Subcomandos:
- `iniciar` — código `2` com a mensagem quando falta `--card`, `--workspace`, `--checkout`, `--base` ou `--entrega-arquivo`, ou o arquivo está vazio. Condutor **vivo** = `batimento` com menos de 90 s (o condutor o renova a cada 30 s); vivo → não lança outro, devolve `retomada: true`. Senão grava `entrega.txt` e o `estado.json` (mantendo as unidades de uma rodada anterior) e lança `conduzir` destacado (`spawn(process.execPath, [frente.mjs, "conduzir", "--dir", d], {detached: true, stdio: ["ignore", log, log]})` + `unref()`, log em `frente.log`). `--reabrir` volta as unidades `parada` para avaliação; sem ele, unidade `parada` continua parada.
- `conduzir --dir <d>` — o laço abaixo.
- `estado --dir <d> [--esperar <s>]` — uma linha JSON `{terminal, condutor: "vivo"|"morto", unidades: [{card, estacao, pr, resultado, motivo}]}`; com `--esperar`, espera até `s` segundos (teto 540) por mudança do `estado.json` ou por `terminal`, conferindo a cada 5 s.

**Unidades.** Card com label `épico` e sub-issues → uma unidade por sub-issue aberta com comentário `<!-- gm:spec-ref -->` e `Bloqueado` vazio no board; as demais entram como `pulada` com o porquê (`não promovida`, `Bloqueado: <texto>`, `fechada`). Card sem sub-issues → ele mesmo. **Trava por unidade**: `mkdir <git-common-dir>/gm-frente/<n>.lock` com o caminho da pasta de estado dentro; trava existente cujo dono tem batimento vivo → unidade `pulada: conduzida por <pasta>`; dono morto → toma a trava. Até `--paralelo` sessões filhas ao mesmo tempo, somando todas as unidades e ondas; e **no máximo um `/gm-ship` por repo ao mesmo tempo**, para que dois merges na `dev` não corram juntos.

**Branch e worktree da unidade.** Branch: `Branch:` do `gm:spec-ref` (fase) ou `Feature branch:` do `## Execution` (card); ausente → a única branch remota `feat/<n>-*`/`fix/<n>-*`, se houver exatamente uma; senão a unidade para (`branch da unidade não declarada`). Worktree: `<workspace>/<repo>-<n>-<slug>`, `<slug>` = a branch sem `feat/<n>-`/`fix/<n>-`. Existe → usa (`git -C <worktree> pull --ff-only` se a remota estiver à frente). Não existe e a branch existe (local ou remota) → `git worktree add <worktree> <branch>`. A branch não existe → `createLinkedBranch` a partir de `origin/<base>` (a mutação do `gm-implement`, `## Guarantee the branch`; falhou → `git worktree add -b <branch> <worktree> origin/<base>`). Planning dentro do repo e a spec não está na branch → copia `spec.md` e `sensibilidade.json` de `--spec` para `planning/<pasta>/` na worktree e commita `docs(planning): spec do #<pai-ou-card>` com o trailer `Card: #<n>` (M9).

**Estações**, avaliadas de cima para baixo a cada volta; a primeira que casa vale:

| # | Estado lido | Sessão aberta | `cwd` |
|---|---|---|---|
| 1 | PR da branch mergeada | nenhuma: unidade `concluida` | — |
| 2 | PR da branch aberta | espera de CI (abaixo), depois `/gm-ship <pasta> --card <n> --merge` | worktree da unidade (recriada se faltar) |
| 3 | sem spec achada | `/gm-spec #<n>` | worktree destacada `<workspace>/<repo>-<n>-spec` em `origin/<base>` |
| 4 | spec, e sem pasta de tasks na worktree | `/gm-plan-tasks <pasta> --card <n>`; depois, se o planning mora no repo, o condutor commita a pasta de tasks (`docs(planning): tasks do #<n>`, trailer) | worktree da unidade |
| 5 | tasks com `❌` | as ondas (abaixo) | — |
| 6 | todas `✅`, sem PR | `/gm-ship <pasta> --card <n>` | worktree da unidade |

Toda sessão que fecha em `PARADA` deixa a unidade `parada` (sem nova volta). Estação 3: depois da sessão, se o `/gm-spec` deixou a pasta `planning/<n>-*/` na worktree `-spec`, o condutor a **move** para `<pasta de estado>/spec/` (`renameSync`), passa a usá-la como `--spec`, reavalia as unidades (o `/gm-spec` pode ter fatiado um épico) e remove a worktree `-spec`, agora limpa (`git worktree remove`, sem `--force`). Card sem spec de um workspace com segundo humano para no `/gm-spec` salvo quando a entrega nomeia o segundo revisor (regra da tabela do `## Modo despachado`); aqui não há segundo humano.

**Ondas.** `ondas.mjs` lê a pasta. Plano inválido → a unidade para com o erro do validador. Tasks sem os campos → **modo sequencial**: cada task `❌` é uma onda, na ordem do número, na worktree da unidade (R1.4). Por onda:
- **Uma task** → `/gm-implement <pasta> --card <n> --branch <branch> --task <arquivo>` na worktree da unidade.
- **Duas ou mais** → para cada task, `git worktree add -b <branch>-t<id> <workspace>/<repo>-<n>-<slug>-t<id> <branch>` e `/gm-implement <pasta> --card <n> --branch <branch>-t<id> --task <arquivo>` lá, todas ao mesmo tempo (até `--paralelo`). Terminada a onda, para cada task que fechou em `PROXIMO` e cujo arquivo está `✅` no último commit da branch dela, em ordem de número: `git merge --no-ff --no-edit -m "merge: task <id> da onda <k>" -m "Card: #<n>" <branch>-t<id>` na worktree da unidade. Conflito → `git merge --abort` e a unidade para com `conflito ao juntar a task <id>: <arquivos>`. Junção limpa → `git worktree remove <worktree da task>` (sem `--force`; recusou → fica, anotado) e `git branch -d <branch>-t<id>` (nunca `-D`).
- Depois da onda: `git push origin <branch>` e, uma por vez, o checkbox de cada task juntada no `gm:tasks` (`- [ ] <id> ` → `- [x] <id> `, relendo o comentário antes de cada edição). O modo task não empurra nem marca (F2): uma escrita por vez no comentário (M14).
- Task da onda que fechou em `PARADA` → as outras da onda ainda são juntadas; a unidade para depois.

**Sessão filha.** `spawn("claude", ["-p", prompt, "--permission-mode", "auto", "--permission-prompts", "none", "--add-dir", <pasta de estado>, "--output-format", "json"], {cwd, detached: true, stdio: ["ignore", saida, erro]})`, as opções dos despachos reais (M2). Arquivos: `prompt-<id>.txt`, `saida-<id>.json`, `erro-<id>.txt`, `<id>` = `<n>-<estacao>[-t<task>]-<k>`. Limite: `--limite-min` (padrão 120) → `SIGTERM` ao grupo, `SIGKILL` 30 s depois, unidade para com `sessão excedeu <m> min`. **Julgamento pela saída, nunca pelo código de saída** (uma sessão adotada na retomada não é filha do novo condutor): `JSON.parse` de `saida-<id>.json`, `is_error` falso, última linha não vazia de `.result` casando `^(PROXIMO|PARADA): (.+)$`; qualquer outra coisa → unidade para com `saída sem linha de despacho (<o quê>)`. Na retomada, sessão com `pid` vivo é esperada (até o `pid` sumir, com o mesmo limite contado do `inicio`), não reaberta.

**Prompt da sessão filha** — gerado, neste molde e só com isto:

```
/gm-<skill> <argumento da gramática>

Argumento do despacho (gerado pelo /gm-frente; o card é o da primeira linha):
- Card <owner>/<repo>#<n><, fase do épico #<p>>. Spec: <caminho da spec na worktree>.
- Onde trabalhar: <cwd>, branch <branch>, base <base>.< Task: <arquivo> — só ela.>
- Outras sessões desta frente correm ao mesmo tempo em worktrees irmãs: não toque nelas nem no checkout principal.
- Não há humano nesta sessão. <conteúdo de entrega.txt>
```

**Espera de CI** (estação 2): `gh pr checks <pr> --repo <r> --json bucket` a cada 60 s; nenhum `pending` → abre o `--merge` (quem julga verde, vermelho ou "sem CI" é o `merge-dev.mjs`); `pending` por mais de 60 min, ou "no checks reported" → abre o `--merge` mesmo assim. Quem espera é o condutor, nunca uma sessão filha.

**Fim.** Toda unidade `concluida`, `parada` ou `pulada` → `terminal: true`, `fim`, travas soltas, resumo em `frente.log`.

#### `skills/gm-frente/ondas.mjs` — o contrato da task

Exporta `lerTask(texto, arquivo)` → `{id, status, onda, dependeDe, toca}` (`null` nos três quando a task é antiga) e `validarOndas(tasks)` → `{ok: true, modo: "ondas"|"sequencial", ondas: [[ids]]}` ou `{ok: false, erros}`. CLI:
- `node ondas.mjs --validar <pasta>` → o JSON; código `0` válido, `1` inválido.
- `node ondas.mjs --conferir <arquivo-da-task>`, rodado no `cwd` da worktree: confere que cada id de `Depende de:` está `✅` na árvore e que `git diff --name-only HEAD` + os não rastreados (`git ls-files --others --exclude-standard`) ⊆ `Toca:` ∪ {o arquivo da task}. Código `0`, ou `1` com `{dependencias: [..], fora: [..]}`. Task antiga → `0` (nada a conferir).
- Código `2` para argumento ou arquivo ilegível.

#### Contrato da task (o que o `/gm-plan-tasks` escreve e o condutor lê)

Linhas 1 a 4 de todo arquivo de task, nesta ordem:

```
❌ Status: Not Started
Onda: <k>
Depende de: <ids separados por ", "> | —
Toca: `<caminho>`, `<caminho>`, …
```

- `<id>` = prefixo do nome do arquivo antes do primeiro `-` (`3`, `3a`). `Depende de: —` sem dependência.
- `Toca:` lista, relativo à raiz do repo, todo arquivo que a task cria, altera ou apaga; caminho terminado em `/` cobre tudo abaixo. O arquivo da própria task não entra. Pelo menos um caminho.
- **Regra das ondas**, aplicada pelo `/gm-plan-tasks` e conferida pelo validador:
  1. `Onda(t) = 1` sem dependência; senão `1 + max(Onda(d))`.
  2. Duas tasks da mesma onda com caminhos que colidem (iguais, ou um diretório que contém o outro) → a de número maior desce uma onda, e as que dependem dela descem junto; repete até não haver colisão.
  3. Dependência é também de uso: a task que usa algo que outra cria ou muda depende dela.
  4. Válido = ids únicos; toda dependência existe e está em onda menor; sem colisão dentro de uma onda; ondas de 1 em diante, sem buraco; todas as tasks da pasta com os campos, ou nenhuma.

### F2 — `skills/gm-plan-tasks/SKILL.md` e `skills/gm-implement/SKILL.md`

`gm-plan-tasks`:
- `description` e `## Phase 1`: de "ordered" para "tasks em ondas"; a proposta mostra, por task, título, escopo, o teste que a fecha, `Onda`, `Depende de` e `Toca`, agrupada por onda.
- Regras de divisão: "Dependency order" vira a *Regra das ondas* do contrato, escrita por inteiro; "no task depends on a future task" passa a valer por onda; "Code must compile after each task" passa a valer depois de cada task e de cada onda juntada.
- `### Structure`: as linhas 2 a 4 entram no molde; o `## Context` troca "Tasks 1..[N-1] are already in the codebase" por "As tasks de `Depende de:` já estão no código; outras desta onda correm ao mesmo tempo em outras worktrees e não estão aqui."
- `### Mirror on the card`: cada linha ganha ` (onda <k>)`.
- `### Quality checks`, item 8: `node "<Base directory for this skill>/../gm-frente/ondas.mjs" --validar <pasta de tasks>` sai `0`; `1` → corrige o plano antes de apresentar; o script não existe (instalação sem a F1) → diz isso numa linha e confere a regra à mão.
- `## Setup` aceita `--card <n>` (gramática).

`gm-implement`:
- `## Setup`, **modo task** (`<pasta> --card <n> --branch <b> --task <arquivo>`): executa só aquela task; os passos 3 e 4 do Setup e os passos 1, 2 e 4 de `## Guarantee the branch` não se aplicam; confere que `git branch --show-current` = `<b>` (diferente → para); antes de implementar, `ondas.mjs --conferir <arquivo>` não acusa dependência (acusa → para, `dependência <id> não está ✅`).
- Antes do commit, em qualquer modo, se a task tem `Toca:`: `ondas.mjs --conferir <arquivo>` sem `fora` (acusa → para com a lista, `a task tocou fora do Toca:`). Sem o script → `git status --porcelain` contra o `Toca:` à mão.
- `## Close the task`: **o `✅` vira antes do commit e entra nele** (em todos os modos — corrige a ordem de M14). No modo task: sem `git push` e sem marcar checkbox (é o condutor).
- Contra PR empilhada, passo 2 de `## Guarantee the branch`: a branch nasce de `origin/<base>`, e `<base>` diferente do `dev` de `## Branches` só com `Motivo da base:` no `## Execution`; senão para.
- `## Board (task 1 only)` → "primeira task a rodar": se o card ainda não está em 🔨 Implementação ou adiante, move.

### F3 — pós-PR

#### `skills/gm-ship/merge-dev.mjs`

`node merge-dev.mjs --repo <owner>/<repo> --pr <n> --spec <caminho> --base <dev> --ci <sim|nao>`, no `cwd` da worktree da PR. Faz só leitura (`gh`, `git`, `sensivel.mjs --consultar`) e imprime uma linha JSON `{pode: bool, head, condicoes: {base, mergeavel, atualizada, ci, g4, sensivel}, falhas: [..], acao: "merge"|"atualizar"|"esperar-ci"|"parar"}`; código `0` sempre que conseguiu ler, `2` para argumento ou leitura. Condições:
1. **base**: PR aberta e `baseRefName` = `--base`, ou o `## Execution` da spec traz `Motivo da base:` (R3.2).
2. **mergeavel**: `mergeable` = `MERGEABLE`.
3. **atualizada**: `git fetch origin` e `git merge-base --is-ancestor origin/<base> <head>`; falso → `acao: "atualizar"`.
4. **ci**: `--ci sim` → `gh pr checks --json bucket` com todos `pass`/`skipping` (algum `pending` → `acao: "esperar-ci"`; `fail`/`cancel` → falha). `--ci nao` → o `Portão local` do `gm:g4` está verde no head atual.
5. **g4**: comentário `<!-- gm:g4 -->` na PR, todo achado com tratamento, `Head final` = head atual.
6. **sensivel**: `sensivel.mjs --consultar --spec <caminho>` devolve `false`; `true` → `acao: "parar"` com o motivo.

`pode` = as seis verdadeiras.

#### `skills/gm-ship/SKILL.md`

- `## Preconditions`: aceita `--card` e `--merge` (gramática). **Base**: a da PR é o `dev` de `## Branches`; outra só com `Motivo da base:` no `## Execution`, copiado no corpo da PR; sem ele → para (R3.2).
- **`## G4 — revisão de IA`** (nova, entre o portão verde e `## Open the PR`): agente independente, só leitura, recebe só o caminho da spec, o `gm:spec-ref` da fase (se houver) e o intervalo `origin/<base>...HEAD`, e devolve achados com `arquivo:linha`. A sessão **corrige** (commit, portão de novo) ou **refuta** com o porquê cada um. Depois do `gh pr create`, comentário na PR `<!-- gm:g4 -->` com `Head revisado: <sha>`, `Head final: <sha>`, `Portão local: verde em <sha>` (comandos e resultados) e a tabela `achado · arquivo:linha · tratamento (corrigido em <sha> | refutado: <porquê>)`. Create-or-update.
- `## Fechar a worktree` sai do fim do `## Board` e passa para **depois do merge** (com o merge feito); sem merge, a worktree fica — é nela que a passada `--merge` roda.
- **`## Merge na dev`** (nova, depois do `## Board`; a primeira passada entra nela direto; `--merge` entra só nela). `--ci` = `sim` quando o `CLAUDE.md` declara CI (*Typecheck do CI* com comando, ou *Portão de teste* = `CI`), senão `nao`. Antes, se o `gm:g4` falta ou o `Head final` ≠ head: portão local + G4 sobre o intervalo novo (ou inteiro, se falta), e o `gm:g4` atualizado. Então `merge-dev.mjs`, e pela `acao`:
  - `atualizar` → `git merge origin/<base>` na worktree (conflito → para com os arquivos), portão local de novo, `git push`, `gm:g4` com o `Head final` e o `Portão local` novos (sem G4 de novo quando a junção não teve conflito), e `merge-dev.mjs` outra vez (no máximo duas atualizações; depois para).
  - `esperar-ci` → fecha `PROXIMO: /gm-ship <pasta> --card <n> --merge` (não espera).
  - `parar` (sensível) → `PARADA: spec sensível; o merge da PR #<pr> na dev espera o humano`. Outra falha → `PARADA` com a condição e a saída.
  - `merge` → com humano: uma chamada *ação irreversível*, header `Merge dev` (o código entra na `dev`; nada vai à produção; a `main` só pelo `/gm-release`). Sem humano e com entrega: **decide só quando a tabela `## Modo despachado` deste arquivo tem a linha `Merge na dev da PR do próprio card`** (chega com a F4); sem a linha → `PARADA: merge na dev pronto (condições verdes); a tabela ainda manda parar`. Merge: `gh pr merge <pr> --repo <r> --merge --match-head-commit <head>` (M17); card para 🧪 Validação em Dev; comentário no card; `## Fechar a worktree`. Última linha: `PARADA: PR #<pr> na dev; o card espera o trem do /gm-release`.
- Corpo da PR, `## Validação em dev`: cada item começa por `[comando]` (comando em crase e o esperado: `` - [ ] [comando] `node scripts/x.mjs` → código 0 ``) ou `[humano]` (o passo e quem valida).
- `## Report`: "PR aberta, CI/revisão pendentes" só quando o merge não aconteceu, dizendo qual condição faltou.

#### `skills/gm-correcao/SKILL.md`

Todo push numa PR aberta: portão local + `## G4 — revisão de IA` sobre o intervalo novo e o `gm:g4` atualizado (`Head final`, `Portão local`); a linha `PROXIMO` passa a ser `/gm-ship <pasta> --card <n> --merge`.

#### `skills/gm-spec/sensivel.mjs`

Modo `--consultar --spec <caminho>`: só lê `sensibilidade.json` ao lado da spec; não chama o Jev nem escreve. `sensivel: false` só quando o registro é legível, a última rodada tem `sha256` igual ao do `spec.md` atual, e toda categoria de `uniao` está vazia; senão `true` com o motivo (`sem registro`, `spec mudou depois da classificação`, `registro ilegível`, `união não vazia: <categorias>`). Saída: uma linha JSON `{sensivel, motivo, linha}`, código `0`; `2` só para argumento.

#### `skills/gm-release/trem.mjs`

- `node trem.mjs cards --repo <r> --project <n> --owner <o> --corte <sha>`: lê do board os cards em 🧪 Validação em Dev ou 🚂 Release (abertos ou fechados) e as PRs mergeadas na `dev` com `**Card:** #<n>` na primeira linha; devolve `{no_corte: [cards com todas as PRs ancestrais do corte], fora: [..]}`. Com `--main`, mede contra `origin/main` em vez do corte (é o que a Phase 7 usa depois do merge).
- `node trem.mjs itens --repo <r> --pr <n>`: extrai do `## Validação em dev` da PR os itens `{tipo: "comando"|"humano", texto, comando, esperado}`; item sem prefixo → `humano`.
- Códigos `0`/`2`.

#### `skills/gm-release/SKILL.md`

- **Phase 1**: o trem = `trem.mjs cards --corte <sha da origin/dev no corte>`, `no_corte`; o resto da reconciliação (caronas) fica como está.
- **Phase 4**: cria `release/v<AAAA.MM.DD>` no sha do corte e abre a PR do trem dela para `main` (em vez de `--head dev`, M16): o que sobe é o que foi validado, e o que entrar na `dev` depois fica para o próximo.
- **`## Phase 4b — G5 por trem`** (nova): para cada card do trem e cada PR dele, `trem.mjs itens`. `comando` → roda numa worktree destacada no sha do corte (`<workspace>/<repo>-trem-<AAAA.MM.DD>`, criada e removida pela skill, sem `--force`), cola comando, saída e código na PR do trem; diferente do esperado → o card entra no menu da carona (segurar o trem / reverter da `dev`). `humano` → a lista inteira na mensagem e uma `AskUserQuestion` por card, header `G5 <k>/<N>`: **Validado** · **Segurar o trem** · **Reverter da dev**. Sem humano → `PARADA` com a lista dos `humano`.
- **Phase 5**: `gh pr merge` da PR do trem com `--match-head-commit <sha do corte>`.
- **Phase 7**: `trem.mjs cards --main`: todo card de `no_corte` vai para ✅ Produção, ganha `Release` e é fechado; épico com todas as sub-issues fechadas é fechado e vai para ✅ Produção; card segurado sai do trem e fica em 🚂 Release com o porquê (não conta no R3.3). Depois, `git rev-list --count origin/main..<sha do corte>` = `0`, registrado no comentário de fechamento da PR do trem (`main..corte = 0`), junto com `origin/main..origin/dev` (o que vai no próximo trem). Diferente de `0` → `PARADA` com os commits.

### F4 — comum e documentação

`skills/_comum/convencoes.md`, tabela do `## Modo despachado` (três colunas):
- `Merge, \`main\`, tag, release, deploy, produção, instalação viva, apagar` → `Merge na \`main\`, tag, release, deploy, produção, instalação viva, apagar` | qualquer | **para**, sempre.
- nova: `Merge na dev da PR do próprio card` | `gm-ship` · `Merge dev` | **decide** quando o `merge-dev.mjs` devolve `pode: true`; spec sensível ou condição falhando → para com qual.
- nova: `Base da PR em branch de outro card` | `gm-implement`, `gm-ship` | **decide**: base `dev`; outra só com `Motivo da base:` na spec.
- nova: `Remover worktree e branch de task que a frente criou, depois de juntá-la` | `gm-frente` | **decide**: `git worktree remove` sem `--force`, `git branch -d`.
- `Esperar CI, agendar retorno, rodar em segundo plano` continua **não faz**, com o complemento "o condutor do `/gm-frente` é processo à parte, e é ele quem espera o CI e as sessões"; o item 4 de `## Convenções de saída` ganha a mesma ressalva em uma frase.

`skills/_comum/opcionais.md` (novo): blocos que valem só para algumas skills; cada `##` daqui é carimbado em toda `skills/gm-*/SKILL.md` que já tem aquele cabeçalho, sem "todos ou nenhum". Primeiro bloco: `## Ambiente na entrada`, com o texto atual de `gm-ship` (igual ao de `gm-correcao`, M20).

`scripts/skills-comum.mjs`: lê as duas fontes (cabeçalho nas duas → código `2`); o `--check` ganha o detector de R4.1 — 9-gramas (minúsculas, sem `` ` * _ > | ``, espaços colapsados) de cada fonte contra cada skill **fora** dos blocos carimbados; achou → `skill:linha` e o trecho, código `1`. `scripts/skills-comum-teste.mjs`: casos de bloco opcional carimbado só onde há o cabeçalho, cabeçalho nas duas fontes → `2`, trecho duplicado → `1`.

Limpeza: sai de `gm-ship/SKILL.md:80` "With no human, the CI is not waited on."; de `gm-release/SKILL.md:106`, `:121` e `:144`, as explicações do teto do `header` e do `multiSelect` (ficam as referências à regra).

`scripts/classificar-parada.mjs`: a `linha` de `producao` passa ao texto novo; `scripts/classificar-parada-teste.mjs:53` troca o exemplo "o merge na dev é do Leonardo" por um de merge na `main`; `scripts/jev-falso.mjs` acompanha se o teste exigir. A `PARADA` "spec sensível; o merge … espera o humano" não tem linha **para** própria: cai em `gate-aberto` (gate que espera humano), e o teste ganha esse caso.

`skills/gm-spec/SKILL.md`: `## Execution` com a linha opcional `Motivo da base:`; o `gm:spec-ref` da Phase 6 com `Branch: feat/<n>-<slug>`; a Phase 6 diz que as fases que podem andar juntas são promovidas juntas, com partição de arquivos e `Bloqueado` nas que dependem.

`docs/esteira-gm.md`: seção `## A frente` (condutor, ondas, estado, retomada, o que cada sessão recebe) e as seções `## O caminho`, `### Implementação`, `### Saída`, `## Modo despachado` (inclusive a paráfrase da linha de merge em `:321`) com o merge na dev, o G4 do `gm-ship` e o G5 por trem. `templates/CLAUDE.example.md`: item *Paralelo*. `README.md`: `gm-frente` onde as skills são listadas. `CLAUDE.md` deste repo: a norma de `## A esteira` aponta para `docs/esteira-gm.md` › `## O caminho` (M23); a suíte do item 3 soma `node scripts/skills-comum-teste.mjs` (mudou `scripts/skills-comum.mjs` ou `skills/_comum/`), `node scripts/gm-frente-teste.mjs` (mudou `skills/gm-frente/`), `node scripts/gm-ship-merge-teste.mjs` (mudou `skills/gm-ship/merge-dev.mjs` ou `skills/gm-spec/sensivel.mjs`) e `node scripts/gm-release-trem-teste.mjs` (mudou `skills/gm-release/trem.mjs`).

### F5 — CLAUDE.md do workspace

Só depois de P-A. Com "versionar como está": `git cherry-pick f798e21` (traz `workspaces/pessoal/CLAUDE.md` e o par do `sync.sh`/`sync.ps1`, M22); tirar o bloco `> **Reconstruído em …**` do topo; trocar a norma "(a confirmar)" de `## A esteira` pelo ponteiro para `claude-brain/docs/esteira-gm.md` › `## O caminho` (M23); acrescentar `- **Paralelo**: 3` em `## Convenções da esteira`. Outra resposta de P-A reescreve esta seção por emenda.

## File Change Summary

| Arquivo | Fase | O que muda |
|---|---|---|
| `skills/gm-frente/SKILL.md` | F1 | novo: a skill fina |
| `skills/gm-frente/frente.mjs` | F1 | novo: o condutor (`iniciar`, `conduzir`, `estado`) |
| `skills/gm-frente/ondas.mjs` | F1 | novo: contrato, validador e conferência da task |
| `scripts/gm-frente-teste.mjs` | F1 | novo: teste do condutor e do `ondas.mjs`, sem cota |
| `scripts/claude-falso.mjs`, `scripts/gh-falso.mjs` | F1 | novos: `claude` e `gh` falsos do teste da F1 |
| `skills/gm-plan-tasks/SKILL.md` | F2 | ondas, contrato, validação, `--card` |
| `skills/gm-implement/SKILL.md` | F2 | modo task, conferência, `✅` no commit, base |
| `skills/gm-ship/SKILL.md` | F3 | base, G4, merge na dev, worktree depois do merge, itens do G5 |
| `skills/gm-ship/merge-dev.mjs` | F3 | novo: as condições do merge |
| `skills/gm-release/SKILL.md` | F3 | trem do corte, G5 por trem, Phase 7 ampliada, `main..corte = 0` |
| `skills/gm-release/trem.mjs` | F3 | novo: cards do trem e itens do G5 |
| `skills/gm-correcao/SKILL.md` | F3 | G4 depois de cada push, `PROXIMO` para o `--merge` |
| `skills/gm-spec/sensivel.mjs` | F3 | modo `--consultar` |
| `scripts/gm-spec-sensivel-teste.mjs` | F3 | casos do `--consultar` |
| `scripts/gm-ship-merge-teste.mjs`, `scripts/gm-release-trem-teste.mjs` | F3 | novos, cada um com o seu `gh` falso embutido (não usam o da F1) |
| `skills/_comum/convencoes.md`, `skills/_comum/opcionais.md` | F4 | linhas do `## Modo despachado`, item 4; bloco opcional |
| `scripts/skills-comum.mjs`, `scripts/skills-comum-teste.mjs` | F4 | fonte opcional, detector |
| `scripts/classificar-parada.mjs`, `scripts/classificar-parada-teste.mjs`, `scripts/jev-falso.mjs` | F4 | linha `producao`, exemplo, caso `gate-aberto` |
| `skills/gm-*/SKILL.md` (todas) | F4 | recarimbo; `gm-ship`/`gm-release` sem reafirmações; `gm-spec` com `Motivo da base` e `Branch:` |
| `docs/esteira-gm.md`, `templates/CLAUDE.example.md`, `README.md`, `CLAUDE.md` | F4 | documentação e suíte |
| `workspaces/pessoal/CLAUDE.md`, `sync.sh`, `sync.ps1` | F5 | versionar e enxugar |
| `planning/78-esteira-paralela/spec.md`, `sensibilidade.json` | cada fase | primeiro commit, igual em todas |

## Migrations & compatibilidade

Nenhum formato do índice, do `conversations.json` ou das decisões muda (rota curta em todas). Formatos novos e convivência:
- **Task** antiga continua válida: o condutor roda em sequência, o `/gm-implement` sem `--task` age como hoje (exceto o `✅` dentro do commit).
- **`estado.json`**: novo, de máquina, fora do repo, `versao: 1`.
- **`gm:g4`**: PR antiga não tem; a passada `--merge` roda o portão e o G4 antes.
- **Item de validação sem prefixo**: o G5 por trem o trata como `[humano]`.
- **Entre F3 e F4 na dev**: o `## Merge na dev` só decide sozinho quando a linha da F4 existe na tabela carimbada; até lá ele para com as condições verdes — sem contradição com a tabela.
- **Instalação**: nada da esteira nova roda antes do `./sync.sh push` (do Leonardo, #3608).

## Rollback

Skill, script e documentação: reverter a PR da fase na `dev` (ou o trem) e `./sync.sh push`. O condutor só escreve na pasta de estado, nas worktrees e branches que cria e nos checkboxes do `gm:tasks`; para parar uma frente em voo, `kill <pid>` do `estado.json` (as filhas em voo terminam sozinhas; o feito está em commits e comentários) e apagar a trava `<git-common-dir>/gm-frente/<n>.lock` deixa de ser preciso depois de 90 s sem batimento.

## Verificação pós-deploy

Depois do trem com F1–F4 e do `./sync.sh push`:
1. `node ~/.claude/skills/gm-frente/ondas.mjs --validar planning/66-telemetria/tasks/f1` → `"modo": "sequencial"`, código `0`.
2. `node ~/.claude/skills/gm-spec/sensivel.mjs --consultar --spec planning/78-esteira-paralela/spec.md` → `sensivel: true` (M18), código `0`.
3. `node scripts/skills-comum.mjs --check` na `main` → código `0`.

## Plano de testes

| Critério | Prova | Fase |
|---|---|---|
| R1.1 | `scripts/gm-frente-teste.mjs` › *onda paralela*: repo temporário com `origin` nua, `CLAUDE_CONFIG_DIR` temporário, `claude` e `gh` falsos à frente do `PATH` (o teste confere `which claude` antes de começar); duas tasks na onda 1 com `Toca:` disjuntos; o falso grava início e fim e dorme 1 s; prova intervalos sobrepostos, duas worktrees `-t<id>` durante a onda, as duas junções, worktrees e branches de task removidas, `push` feito e dois checkboxes marcados no `gh` falso | F1 |
| R1.2 | *épico*: duas sub-issues promovidas e uma com `Bloqueado`; duas cadeias sobrepostas, duas PRs no `gh` falso, a terceira `pulada` com o motivo; *trava*: um segundo `iniciar` para uma fase já conduzida a marca `pulada` | F1 |
| R1.3 | *prompt gerado*: a única entrada é o arquivo da entrega; cada `prompt-*.txt` segue o molde linha a linha e não contém `Card: #` nem nome de suíte | F1 |
| R1.4 | *task antiga*: nenhuma worktree `-t<id>`, intervalos sem sobreposição, ordem por número | F1 |
| R1.5 | *PARADA de filho* (a outra unidade segue), *saída sem linha*, *limite* (`--limite-min 0.05`), *conflito* (o falso mente no `Toca:`), *retomada* (mata o `conduzir` no meio; `iniciar` de novo espera a filha viva e não reabre task `✅`), *precedência* (PR mergeada não reabre ship) | F1 |
| R2.1, R2.2, R2.3 | `gm-frente-teste.mjs` › `ondas.mjs`: `--validar` válido, dependência na mesma onda, colisão por diretório, buraco de onda, mistura, id duplicado; `--conferir` com dependência `❌` e com arquivo fora do `Toca:` | F1 |
| R2.x na skill | `node scripts/skills-comum.mjs --check` verde; Validação em dev | F2 |
| R3.1, R3.2 | `scripts/gm-ship-merge-teste.mjs`: repo temporário + `gh` falso embutido; casos `pode: true`; base de outro card sem e com `Motivo da base`; branch desatualizada → `atualizar`; CI `pending` → `esperar-ci`; CI `fail`; sem CI e portão do `gm:g4` em head antigo; `gm:g4` com achado sem tratamento; spec sensível → `parar`. `scripts/gm-spec-sensivel-teste.mjs`: `--consultar` limpo com sha igual → `false`; sem registro, sha diferente, ilegível, união não vazia → `true`; sem chamar o Jev | F3 |
| R3.3, R3.4 | `scripts/gm-release-trem-teste.mjs`: repo temporário com `main`, `dev`, merges com `**Card:** #n`; `cards --corte` separa no corte / fora; `--main` depois de juntar; `itens` lê `[comando]`, `[humano]` e item sem prefixo | F3 |
| R4.1 | `scripts/skills-comum-teste.mjs` (casos novos), `node scripts/skills-comum.mjs --check` verde, `node scripts/classificar-parada-teste.mjs` verde | F4 |
| R4.2 | `grep -c "a confirmar" workspaces/pessoal/CLAUDE.md` → 0; `grep -c "Reconstruído" …` → 0; `./sync.sh status` lista o par | F5 |

**Validação em dev** (F1–F4 na dev **e instaladas**; o `./sync.sh push` é do Leonardo, #3608). Quem valida: o braço direito, rodando `/gm-frente leonardo-amaral-3/claude-brain#<card pequeno>` de verdade num card de rota curta com pelo menos duas tasks independentes:
- [ ] [comando] `node ~/.claude/skills/gm-frente/ondas.mjs --validar <pasta de tasks gerada>` → código 0 e uma onda com duas tasks
- [ ] [humano] o `estado.json` mostra as duas sessões da onda com intervalos sobrepostos e as worktrees `-t<id>` removidas depois
- [ ] [humano] a PR nasce com `gm:g4` e base `dev`
- [ ] [humano] a cadeia para em `spec sensível; o merge … espera o humano` (M18); o caminho do merge sozinho fica provado pelo `gm-ship-merge-teste.mjs` até P-B

## Technical Decisions

- **Condutor em script destacado, estações em `claude -p`** (#3617): único caminho medido que roda skill `gm-*` (M2–M5) e passa do teto de 10 min (M6, M7). Descartados: subagente, workflow salvo, uma chamada Bash única, `run_in_background`/`ScheduleWakeup` na sessão.
- **Estações por artefato, com precedência fixa**: retomável sem confiar no texto da `PROXIMO`. Descartado seguir a `PROXIMO` ao pé da letra.
- **Batimento em vez de `pid`** para "condutor vivo", e **trava por unidade** no `git-common-dir`: `pid` reaproveitado enganaria; duas frentes sobre a mesma fase disputariam a worktree.
- **Julgar a filha pela saída JSON, não pelo código de saída**: a filha adotada na retomada não tem pai para ler o código.
- **Worktree + branch local por task de onda, `merge --no-ff`** (M8). Descartados: tasks paralelas na mesma worktree e `cherry-pick`.
- **O condutor empurra e marca checkbox; o modo task não** (M14). **O `✅` entra no commit da task**: é o que a junção confere.
- **Um `/gm-ship` por repo de cada vez, e branch atualizada como condição**: merges paralelos na `dev` testariam cada um sem o outro.
- **Condições do merge e do trem em script** (`merge-dev.mjs`, `trem.mjs`): o que é mecânico é testável sem cota e sem a Validação em dev, que não chega ao merge enquanto M18 vale.
- **`--consultar` sem rede nem escrita, amarrado ao sha**: a condição não muda o registro, e uma emenda volta a exigir classificação.
- **Merge com `--merge --match-head-commit`**: o modo das PRs que já entraram (merge commit, `5c76b82`), travado no head conferido.
- **Trem de `release/v<data>` no sha do corte**: a PR do trem não anda com a `dev` (M16), e `main..corte = 0` mede o que foi validado.
- **F3 só decide o merge quando a linha da F4 existe**: sem regra contraditória na `dev` entre as duas.
- **F4 depois das outras**: o recarimbo toca todo `SKILL.md`. **`CLAUDE.md` só na F4**: tirado da F1 para não colidir; até lá a suíte de F1 e F3 é a deste `## Plano de testes`.
- **Cada teste da F3 traz o seu `gh` falso**: não usa arquivo da F1, que corre junto.
- **`Paralelo` padrão 3; limite de 120 min por sessão**: o `/gm-implement` mais longo do #66 levou ~20 min (`saida-impl-67.json`: 1.188 s).

## Pontos abertos

Escolhas de produto que card, decisões e argumento não respondem. Nenhuma trava F1, F2 ou F3.

- **P-A — publicar o `CLAUDE.md` do workspace `pessoal` neste repo público?** (trava a F5) O arquivo traz coordenadas e descrição de um repo privado de outro board. (a) **Versionar como está** — a F5 faz o `cherry-pick` e enxuga; o que hoje é só local fica público. (b) **Versionar sem o que é do repo privado** — a parte genérica no repo, o resto num arquivo local fora do git importado pelo `CLAUDE.md`; o import precisa ser medido antes. (c) **Não versionar** — a F5 sai do épico; o enxugar vira edição local, e o commit `f798e21` do `dev` local fica para ser descartado.
- **P-B — ligar o envio de spec ao Jev para este repo?** (M18) Sem isso, toda spec sai sensível e o merge na dev pelo fluxo nunca dispara nesta máquina: R3.1 fica provado só pelo teste. (a) ligar; (b) manter desligado e aceitar.

## Coding Standards

- Scripts: Node ≥ 20, ESM, só módulos nativos, como `skills/gm-spec/sensivel.mjs` e `scripts/skills-comum.mjs`; código `0` ok, `1` vermelho, `2` argumento ou leitura; mensagens em pt-BR; LF, sem BOM.
- Skills: instruções em inglês, o que o humano lê em pt-BR; blocos comuns só pelo carimbo; nenhum id de board nem regra de workspace dentro da skill.
- Testes nunca chamam `claude` nem `gh` de verdade nem escrevem fora de diretório temporário (`CLAUDE_CONFIG_DIR` do teste aponta para ele).
- Nada além do especificado; cada fase mexe só nos arquivos da sua linha em `## Fases`.
