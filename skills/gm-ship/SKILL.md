---
name: gm-ship
description: Close the implementation loop - verify every task complete, run the full suite, push, open the PR carrying the acceptance-criteria contract and the dev-validation checklist, referencing the board card, and move the card to code review. Use after the last gm-implement task is approved and committed.
disable-model-invocation: true
argument-hint: [feature-folder]
---

# Ship — PR + board

## Como perguntar e como aprovar

This section is stamped from `_comum/convencoes.md` — the folder beside this skill's; in the
`claude-brain` repo, `skills/_comum/convencoes.md` — into every `gm-*` skill that has an interaction
point. Never edit this copy: edit the source there and run `node scripts/skills-comum.mjs` in that
repo (its `--check` catches a copy that drifted). The long version, for a human reading from outside
the pipeline, is `docs/esteira-gm.md` of the `claude-brain` repo, section `## Como as skills perguntam`.

1. **Context before jargon.** Open with what is at stake and what changes down each path, in
   pt-BR. Spec section, file path, board field and option id come *after* that, when they add
   precision — never as the opening words. Whoever is deciding must not have to open the spec or
   the source just to understand what is being put to them.
2. **Every decision reaches the human through the `AskUserQuestion` tool, one question per call.**
   No batching, no `multiSelect`. Each answer arrives with the previous ones already settled, so
   nothing is decided on a premise that was still open. Five decisions is five calls, in order.
3. **Two standard sets, chosen by what is at stake.**
   - *Artefato* (spec, card body, PR body) → **Aprovar · Ajustar · Rejeitar**. The artifact itself
     goes in the message **before** the call: the tool renders no long body.
   - *Ação irreversível* (commit, merge that triggers a deploy, tag) → **Executar · Revisar antes
     de executar · Cancelar**, with the physical consequence spelled out in each `description`
     ("o deploy de produção começa sozinho"). "Ajustar" means nothing for a merge, and a dead
     option in a menu trains the reflex click this convention exists to kill.
4. **A list longer than four never becomes a silently truncated menu.** The tool takes 2–4
   options. When the real list is longer — pending folders, cards riding a train — the full list
   goes in the message, the options carry the likeliest candidates, and "Other" takes the rest.
   Never drop a candidate without saying that it was dropped.
5. **Silence is never a yes.** "Other" is always available, so free text is never taken away. Do
   not argue one option into being the obvious one. With no human in the session (`claude -p`, a
   subagent), **stop and report what was left to decide** — never assume a default and carry on. The one exception is
   `## Modo despachado` below.

Tool limits, so a question is never rejected or silently cut: 2–4 options per question, `header`
up to 12 characters, `label` 1–5 words, "Other" appended automatically (never write it yourself).
Instructions in this file stay in English; **everything the human reads — the question, the labels
and every `description` — is written in pt-BR.**

## Ambiente na entrada

Before the first test, build or commit — a broken environment found halfway costs the minutes
already spent. Read the item *Ambiente* of `## Convenções da esteira` in the workspace `CLAUDE.md`
and check, in this order; stop at the first failure with the reason and the output that proves it
(no human → `PARADA: ambiente — <o que falta>`):

1. **Disk.** Free space where the working tree lives (`df -Pk .`, column *Available*) is at least
   the minimum the item declares — 2 GB when it declares none.
2. **Dependencies.** Every package the diff touches that has a lockfile next to its `package.json`
   has its `node_modules/` (a folder or a junction). Missing → do what the item declares for
   providing them; nothing declared → stop. Never install by default: installing is what fills the
   disk.
3. **Services.** Each service the item declares, by the command it gives to prove it is up. None
   declared → nothing to check.

No *Ambiente* item at all → checks 1 and 2 with the defaults, and one line saying the workspace
declares none. Applies to `gm-correcao` only on the *Corrige* path, the one that needs a checkout.

## Preconditions

1. Read the spec (`planning/$ARGUMENTS/spec.md`; older folders: `tech-spec.md`) → `## Execution`, `## Requisitos & critérios de aceite`, and the card reference. **Epic:** the card in flight is the phase child, not the parent — read its `gm:spec-ref` comment and treat the criteria it names as the ones this PR must close.
2. Every file in `tasks/` (epic: `tasks/<fase>/`, only the phase in flight) starts with `✅ Status: Complete`; otherwise stop and point to `/gm-implement $ARGUMENTS`.
3. Inside the module repo (nested git repository): on the feature branch, `git status` clean.
4. **Run the test gate the workspace declares** — the item *Portão de teste* of
   `## Convenções da esteira` in the workspace `CLAUDE.md`. It says what runs **locally before the
   PR** and **where the full suite runs**: `local` or `CI`. The local part always includes the
   typecheck the CI runs (item *Typecheck do CI*) — a looser local check has already broken `dev`;
   no such item → stop and ask.
   - `local` → the full relevant suite runs here.
   - `CI` → only the local part runs here; the PR body names the CI checks that are the gate, and
     "entregue" is still green CI (`## Report`). With no human, the CI is not waited on.
   - No *Portão de teste* item → the rule before it existed: the full relevant suite (tests +
     typecheck of the touched packages) runs here; say in one line that the workspace declares no
     gate.

   Red → stop and show; a PR never opens on red. **Verde não encerra a checagem** — leia o
   resultado contra as decisões da spec; se a suíte ou uma medição derruba alguma, vale a regra do
   `## Open the PR` abaixo.

## Open the PR

1. `git push -u origin <feature-branch>`.

**Antes de escrever o corpo: alguma decisão da spec caiu?** A pergunta vale da precondição 4 até o
`gh pr create`, e o gatilho é mecânico: ao escrever `## Critérios de aceite` no passo 2, confira cada
critério contra o que a suíte e as **medições desta sessão** mostraram — critério que só passa
reinterpretando a spec é decisão caída. Suíte verde não encerra a checagem: o caso que originou esta
regra foi uma medição, não um teste vermelho.

Se caiu: **não abra a PR.** PR contra spec sabidamente errada nasce mentindo para o revisor humano e
para a revisão de CI do G4, que revisa lendo o `gm:spec`. Pare e mande o humano para
`/gm-implement $ARGUMENTS`, nomeando **emenda pós-tasks**: a mecânica inteira — nota datada, task
N+1, os dois freios — está na seção `## Emenda pós-tasks` daquela skill, e só lá. A branch já
empurrada no passo 1 não atrapalha (branch sem PR não aparece no board nem dispara revisão); você
volta para cá pela precondição 3 quando a task estiver `✅`.

**Não confunda com a precondição 2:** aquela é task **pendente**; esta é tudo `✅` e a spec errada.

2. Body (scratchpad file; the literal `**Card:** #<n>` on the FIRST line is machine-read by the CI review — never use `Closes`, the card's lifecycle belongs to the board; the branch created by gm-implement is already linked to the issue, so this PR attaches to the card's Development field automatically):

   ```markdown
   **Card:** #<n>

   ## Resumo
   [2–6 linhas do que foi implementado]

   ## Critérios de aceite
   - [x] <critério 1 — como foi atendido, em meia linha>
   - [x] <critério 2 …>

   ## Validação em dev
   [checklist derivado dos critérios: o que conferir no ambiente dev, passo a passo, e quem valida]
   - [ ] <passo verificável 1>
   - [ ] <passo verificável 2>

   ## Contexto para revisão
   A especificação está no card #<n> (comentário `gm:spec`; cards antigos: `gm:prd` + `gm:tech-spec`).
   <!-- card de fase de um épico: o gm:spec está no PAI, e o card em voo tem um comentário
        `gm:spec-ref` que dá o link + o recorte. Copie AQUI as duas linhas dele — a seção
        "esta fase cobre" e a tabela "deliberadamente fora" — porque um revisor que só recebe
        "a spec está no card" encontra card vazio e revisa o diff no escuro. O que está fora de
        escopo de propósito é o que torna a detecção de escopo extra mecânica em vez de instintiva. -->
   <!-- houve emenda pós-tasks? uma linha por emenda:
        "Emenda AAAA-MM-DD: <a decisão que caiu, em meia linha> — nota completa no gm:spec"
        para o revisor humano ver que uma decisão do G2 caiu DEPOIS do planejamento, sem ter de
        diffar o comentário do card. -->

   ## Tasks
   - [x] 1 — <título>
   ```

3. Team-visible, and the PR body is an artifact, not a formality: repo, title and the **whole** body go in the message — the tool renders no long body — and the decision comes back through the *artefato* set from `## Como perguntar e como aprovar`. *Aprovar* → create it. *Ajustar* → rewrite the part the human named (a criterion described loosely, a validation step nobody could follow) and present it again. *Rejeitar* → nothing is created; the branch stays pushed, which the board does not show, and the card does not move. Title: short, imperative, close to the card title.
4. `gh pr create --repo <owner>/<repo> --base <base> --title "..." --body-file <file>`

## Board

Move the card to 👀 Revisão on the team board (project-id `<project-id>`, Status field `<field:Status>`, option `<opt:Status=Revisao>`; item-id via `gh api graphql` on the issue's projectItems, node with `project.number == <project>`). Missing `project` scope → `! gh auth refresh -s project`.

## Fechar a worktree

The card's branch had a worktree of its own at `<workspace>/<repo>-<n>-<slug>` (`gm-implement`,
`## Guarantee the branch`). With the PR open and the card in 👀 Revisão, this card has no more code
to write in this session, so the folder goes — the branch does not, it is pushed and it carries the
PR:

```
cd <checkout-principal>          # nunca remova a worktree de dentro dela
git worktree remove <workspace>/<repo>-<n>-<slug>
git worktree prune
```

`git worktree remove` refuses while the folder still holds uncommitted or untracked files, and that
refusal is information, not an obstacle: something was left out of the PR. **Never `--force` past
it** — show what is in there and leave the worktree standing. A folder sitting around is cheap; a
diff nobody knew existed is not.

If the parecer of the CI review later asks for code, `/gm-correcao` recreates the worktree by this
same convention. And a card that started before the rule, working in the main checkout, has no
worktree to remove: `git worktree list` says so, and nothing in this section applies to it.

## Report

PR URL + board move. **"Entregue" means green CI and the review handled — not an open PR**; until then say "PR aberta, CI/revisão pendentes". If the CI review workflow is active in the repo, mention it will comment using the card's spec; if not, the "Validação em dev" checklist is the reviewer's guide.

Then say what happens next, so the card does not stall in 👀 Revisão: merged into `dev` → the card goes to 🧪 Validação em Dev, where a **named person** runs the checklist above (SLA 7 dias); validated in dev → this Report does not close the card, because nothing runs at validation time: the session that receives the person's "validado" closes it (`gh issue close <n> --repo <owner>/<repo> --reason completed`). The card **stays in 🧪 Validação em Dev** (it does not wait for 🚂 Release, ✅ Produção or `/gm-release`), but the board's *Item closed* workflow, when enabled, may move it on close: re-read its Status afterwards and, if it moved, set it back with `updateProjectV2ItemFieldValue` (Status option id from the workspace `CLAUDE.md`). The train is cut later with `/gm-release`.

## Convenções de saída

This section is stamped from the same `_comum/convencoes.md` as `## Como perguntar e como aprovar`,
into every `gm-*` skill that has a closing point. Edit the source in the `claude-brain` repo and run
`node scripts/skills-comum.mjs` there — never this copy.

1. **The last line of the final answer is machine-readable**, so a dispatcher (a script, another
   session) can chain the pipeline without reading prose. Exactly one of:
   - `PROXIMO: /gm-<skill> <argumento>` — the pipeline continues; name the next skill and its argument.
   - `PARADA: <motivo em uma frase>` — the pipeline does not continue; one sentence, in pt-BR, saying
     what is waiting and on whom.

   Nothing follows that line. If the skill ends on a gate the human must answer (`AskUserQuestion`),
   the line comes only after the answer; with no human to answer, close with
   `PARADA: <the gate left open>`. Under `## Modo despachado`, a gate in its **decide** rows is
   answered, not left open.
2. **File content never travels inside a command argument.** New file → `Write`. Existing file →
   `Edit`. A heredoc only when short: if your workspace has a context-cost hook, it may deny one
   above 1500 characters. A long body (issue comment, PR body, commit message) goes to a file first,
   then `--body-file` (`gh`) or `-F` (`git commit`).
3. **A rule that belongs to one workspace never enters a skill.** Typecheck command, CI command,
   whether a second human exists: read them from the workspace `CLAUDE.md`, and stop to ask when it
   does not declare them — with no human in the session, that stop is
   `PARADA: <what the CLAUDE.md must declare>`.
4. **With no human in the session (`claude -p`, a dispatcher), do not wait for CI and do not schedule
   a wake-up** (`ScheduleWakeup`, `/loop`), and do nothing in the background: report what was done and close with `PROXIMO` or `PARADA`.

## Modo despachado

This section is stamped from the same `_comum/convencoes.md` as the two above. Edit the source in
the `claude-brain` repo and run `node scripts/skills-comum.mjs` there — never this copy.

**When it applies:** no human in the session (`claude -p`, a subagent) **and** the argument hands
over the front in words ("você decide sozinho o G2, o G3, o commit e o ship"). Both, or it does not
apply: no human and no handover → item 5 of `## Como perguntar e como aprovar` (stop and report).
A human in the session → never, whatever the argument says. When it applies, it replaces item 5
for the rows marked **decide**; the rest of the skill runs as written. The argument may add stops;
it never turns a **para** into a **decide**.

| Ponto de decisão | Exemplo (skill · header) | Despachado |
|---|---|---|
| Aprovar artefato do próprio card: critérios, card, spec, tasks, corpo da PR, comentário | `gm-card`, `gm-spec`, `gm-plan-tasks`, `gm-ship`, `gm-explore`, `gm-prd` | **decide** — Aprovar, depois da crítica que a skill exige |
| Caminho entre os que a skill oferece: rota, profundidade, recorte, escopo, abordagem | `gm-card` · `Rota`; `gm-spec` · `Profundidade`, `Recorte`; `gm-triage` · `Escopo` | **decide** pela regra da própria skill |
| Segundo revisor de spec sensível | `gm-spec` · `2º revisor` | **decide**: seguir sem; o revisor de IA independente roda igual |
| Commit e push na branch do card | `gm-implement` · `Commit`; `gm-correcao` | **decide**, com a verificação verde |
| Fila no fim, sem decisão da spec caída | `gm-implement` · `Fim da fila` | **decide**: fechar e abrir a PR |
| Checkout principal com alteração | `gm-implement` · `Árvore suja` | **decide**: deixar onde estão |
| Alvo ambíguo: repo, card, pasta, PR | `Repo`, `Card`, `Pasta`, `PR alvo`, `Destino` | **para** — o argumento nomeia o alvo |
| Escolha de produto que card, spec, argumento e decisões registradas não respondem | qualquer | **para** |
| Desvio da spec, decisão que caiu, emenda | `gm-implement`, `gm-ship`, `gm-correcao` | **para** |
| Teste vermelho, ambiente quebrado, `CLAUDE.md` que não declara o que a skill exige | qualquer | **para**, com a saída que prova |
| Merge, `main`, tag, release, deploy, produção, instalação viva, apagar | `gm-release` e `gm-hotfix` inteiras; qualquer | **para**, sempre |
| Esperar CI, agendar retorno, rodar em segundo plano | qualquer | **não faz** |
| Perguntar o que o card, a spec, o argumento ou o cofre já respondem | qualquer | **não pergunta** — lê |
| Devolver comando `/gm-*` para alguém digitar | qualquer | **não faz** — vai na linha `PROXIMO:` |

**Every decide is recorded on the spot:** the decision tool of the workspace
(`mcp__brain__lembrar` where the `brain` MCP runs) with what, why and what was discarded, and one
comment on the card per stage, with the prefix the argument gives.

**What the argument still carries — only what belongs to the card:** card and repo; where to work
(worktree, branch, PR base when stacked); the recorded decisions that bind it; stops beyond this
table; environment facts the workspace `CLAUDE.md` does not declare. What this table says is not
repeated there.
