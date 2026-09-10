---
name: gm-implement
description: Execute the next pending task of a planned feature - right branch in the right repo (created linked to the card via Development field), task file as the prompt, tests run BEFORE presenting, risk-ranked summary, commit only after explicit approval, deviation protocol when reality contradicts the spec. Use after gm-plan-tasks, once per task, preferably in a fresh session.
disable-model-invocation: true
argument-hint: [feature-folder]
---

# Task Executor

You operate the task files produced by `gm-plan-tasks`. Each invocation executes **one** task; recommend a fresh session (`/clear`) per task.

## Como perguntar e como aprovar

This section is identical in all eleven `gm-*` skills that have an interaction point — it is
copied, never rewritten, and any improvement to it lands in the eleven at once. The long version,
for a human reading from outside the pipeline, is in `docs/esteira-gm.md`, section
`## Como as skills perguntam`.

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
   subagent), **stop and report what was left to decide** — never assume a default and carry on.

Tool limits, so a question is never rejected or silently cut: 2–4 options per question, `header`
up to 12 characters, `label` 1–5 words, "Other" appended automatically (never write it yourself).
Instructions in this file stay in English; **everything the human reads — the question, the labels
and every `description` — is written in pt-BR.**

## Setup

1. Folder: `planning/$ARGUMENTS/`. No argument → put **every** folder that still has a pending
   (`❌`) task in the message — how many are left in each, and the title of the one that would run
   — then one `AskUserQuestion` call; header `Pasta`, question and options in pt-BR:

   > Cada pasta abaixo tem task esperando; esta sessão executa **uma**, a próxima da pasta que você
   > escolher.
   >
   > - **<pasta>** — faltam <n>; a próxima é «<título da task>».
   > - … (as demais na mesma forma)

   More than four folders → the options carry the ones with the most recent work, the **full** list
   stays in the message, and the message says out loud that the rest arrive through "Other". A
   folder dropped in silence is a task nobody remembers exists.
2. Read the spec (`spec.md`; older folders: `tech-spec.md`) → `## Execution` (repo, base, feature branch), `## Requisitos & critérios de aceite`, `## Plano de testes`, and the card reference.
3. Pick the lowest-numbered task whose first line is `❌ Status: Not Started`. A lower-numbered task not `✅` → stop and report; never guess. (Sub-tasks born from a split carry letter suffixes — `3a`, `3b` — and sort in place, before `4`.)
4. Todas as tasks `✅` → o humano veio por um de dois motivos e assumir errado custa caro nos dois
   sentidos: uma chamada `AskUserQuestion`, header `Fim da fila`, pergunta e opções em pt-BR:

   > As tasks desta feature estão todas fechadas e ainda não existe PR. Duas coisas cabem nesta
   > janela:
   >
   > - **Fechar e abrir a PR** — nada muda no código; a sessão termina apontando para
   >   `/gm-ship <pasta>`, que abre a PR e leva o card para 👀 Revisão.
   > - **Emendar a spec** — uma decisão da spec caiu depois da última task. Vira nota datada na
   >   spec e no card, mais **uma** task nova, escrita e executada aqui, antes de a PR existir.

   Só a segunda continua nesta skill, pela seção `## Emenda pós-tasks` abaixo.

## Guarantee the branch

**The card's branch lives in a worktree of its own, never in the main checkout.** The path is
`<workspace>/<repo>-<n>-<slug>` — sibling to the repo directory and **inside the workspace
prefix**, because the workspace `CLAUDE.md` (the `## Board`, the brain rules) and
`brain-workspaces.json` both resolve **by path prefix**: a worktree parked anywhere else belongs
to no workspace and reads no board, and nothing warns you. `<n>` is the card number and `<slug>`
the branch slug, so the folder name says which card is in flight without opening anything.

1. `git status` **in the main checkout**. Changes that are not this task's no longer block the
   branch — the worktree is born clean from `origin/<base>` and they simply stay where they are.
   That is the risk worth naming before the session walks away: uncommitted work in a checkout
   nobody opens again is work lost in silence. Name the exact files in the message, then one
   `AskUserQuestion` call; header `Árvore suja`, question and options in pt-BR:

   > O checkout principal tem alteração que não é desta task: <arquivos>. A worktree desta task
   > nasce limpa da `origin/<base>`, então esses arquivos ficam para trás — fora da branch, fora da
   > PR, e fora do que esta sessão vai olhar de novo.
   >
   > - **Levar junto** — `git stash` aqui e `git stash pop` dentro da worktree: as alterações vão
   >   para a branch da task e entram na PR dela; a revisão vai ver código que a spec não pediu.
   > - **Deixar onde estão** — nada é mexido; seguem no checkout principal, sem commit, e esta
   >   sessão trabalha só dentro da worktree. Quem retomar depois precisa lembrar que elas existem.
   > - **Parar aqui** — nem worktree nem branch. A task espera a árvore ser resolvida à mão.
2. `git fetch origin`, then `git worktree list` — the branch may already have a home:
   - **A worktree already at `<workspace>/<repo>-<n>-<slug>`** → that is the one; continue inside
     it, fast-forwarding to origin if the branch is there.
   - **The branch checked out in the main checkout** — a card that started before this rule, like
     the one that wrote it. **Do not move it.** Migrating a card in flight swaps the ground under a
     session that may still be open; say out loud that this card finishes where it is and that the
     rule holds from the next card on, then carry on in the main checkout.
   - **The branch exists (local or origin), with no worktree** →
     `git worktree add <workspace>/<repo>-<n>-<slug> feat/<n>-<slug>`. A branch that lives only on
     origin gets a local one tracking it, same as a checkout would.
   - **The branch does not exist** → create it REMOTELY first, linked to the card, so it appears in
     the issue's **Development** field and the future PR attaches to the card automatically:

     ```
     gh api graphql -f query='{repository(owner:"<owner>",name:"<repo>"){id issue(number:<n>){id} ref(qualifiedName:"refs/heads/<base>"){target{oid}}}}'
     gh api graphql -f query='mutation{createLinkedBranch(input:{issueId:"<issue-node-id>",repositoryId:"<repo-node-id>",oid:"<oid-da-base>",name:"feat/<n>-<slug>"}){linkedBranch{ref{name}}}}'
     git fetch origin && git worktree add <workspace>/<repo>-<n>-<slug> feat/<n>-<slug>
     ```

     If the mutation fails (scope/permission), fall back to
     `git worktree add -b feat/<n>-<slug> <workspace>/<repo>-<n>-<slug> origin/<base>` and tell the
     user the Development link takes 2 clicks in the UI (issue → Development → Link a branch).
3. **From here on the working directory is the worktree, and saying so once is what keeps the rest
   of the session honest.** Print the path, then run every `git` and `gh` command of this task from
   inside it (`cd` once, or `git -C <path>`). `gh` reads the repo from the remote of the current
   directory, so keep `--repo <owner>/<repo>` explicit and the question never arises. The main
   checkout is not touched again by this task.
4. **`planning/` lives inside the repo, so the worktree carries its own copy of the spec and of the
   task files — and that copy is the authoritative one.** It sits on the card's branch; it is what
   the commits and the PR will carry. The copy in the main checkout is whatever `<base>` had at the
   last merge: from task 2 on it still shows the earlier tasks as `❌` and knows nothing about any
   emenda. So the reading done in `## Setup` is provisional — **re-read `spec.md` and re-pick the
   lowest-numbered `❌` task from inside the worktree** before implementing anything. Which copy is
   under you is one command away: `git rev-parse --show-toplevel` plus `git branch --show-current`,
   and the card's branch means the right copy.

## Board (task 1 only)

Board the team board: move the card to 🔨 Implementação (project-id `<project-id>`, Status field `<field:Status>`, option `<opt:Status=Implementacao>`; item-id via `gh api graphql` on the issue's projectItems, node with `project.number == <project>`; card fora do board → `gh project item-add <project>` antes). Missing `project` scope → ask for `! gh auth refresh -s project`, don't block.

## Execute the task

The task file is your prompt: implement only its Scope, following the spec strictly.

Three protocols cover what goes wrong mid-task. Pick by **what changed**: the decision (desvio), the slicing (fatiamento), or nothing in this task at all (achado).

**Deviation protocol — the spec's decision was wrong.** Reality in the code contradicts it (wrong assumption, missing case, better path that changes a decision):
1. STOP implementing that part. 2. The amended wording is the artifact: put in the message what the spec decided, what the code showed, and the exact note you propose to write — then run the *artefato* set from `## Como perguntar e como aprovar`. 3. *Aprovar* → write the dated note ("Emenda AAAA-MM-DD: …") in `spec.md` **and** in the `<!-- gm:spec -->` comment on the card, and continue under the amended spec. *Rejeitar* → the spec stands as written and the task stops here rather than being bent to fit. Never deviate silently — the spec must never become historical fiction.

**Slicing protocol — the spec is right, the task is too big.** The scope holds 2+ independent parts, each with its own test; or the diff is growing into something nobody can review as one unit; or you are about to commit something you would not want to review yourself. The spec did **not** change — only its slicing did, so this is not an emenda.

1. **STOP before writing more code.** A task noticed to be oversized at 80% is a task that gets rubber-stamped.
2. Propose the split: N sub-tasks, each with title + one-line scope + the test that closes it, keeping the two invariants — **code compiles after each**, and **no sub-task depends on a later one**. The first sub-task absorbs whatever is already implemented.
3. **The ceiling decides who owns it:** if the split pushes the feature past **6–8 tasks total**, this is not a task problem — the card is an epic in disguise. Stop and send it back to `/gm-card` + `/gm-spec` for slicing into cards; do not paper over it with a longer list. (A task da **emenda pós-tasks** é exceção nomeada a este teto — ver a seção homônima abaixo.)
4. The split proposal is the artifact — the N sub-tasks go in the message whole, then the *artefato* set from `## Como perguntar e como aprovar`. *Aprovar* → write them as **suffixed files**: `3-x.md` becomes `3a-….md`, `3b-….md`, `3c-….md`, so later tasks keep their numbers and nothing has to be renamed. Delete the original file only after its scope is fully covered by the sub-tasks.
5. Mirror the new lines in the card's `<!-- gm:tasks -->` comment (`- [ ] 3a — título`) and continue with the first sub-task in this session.

**Findings protocol — it is real, and it is not this task.** A pre-existing bug, adjacent debt, an unforeseen dependency, a second front the spec never saw. You have the context in your hands right now; ten minutes from now nobody does.

1. **Do not fix it.** Not even "já que estou aqui" — that is exactly the extra scope the PR review is built to catch.
2. Sort it:
   - **Blocks this task** → it is not a finding, it is a dependency the spec must decide → deviation protocol.
   - **S1 live in production** (faturamento parado or corrupted data) → stop everything and tell the user to run `/gm-hotfix`; the feature waits.
   - **Everything else** → register it before continuing.
3. Registering costs two lines, not an investigation — it is a triage entry, and it carries the `file:line` evidence *because you have it now*. The entry is the artifact and the issue is team-visible: it goes whole in the message, then the *artefato* set from `## Como perguntar e como aprovar`. *Rejeitar* → nothing is created, and the finding still goes in the closing summary, so it dies on the record instead of in silence. *Aprovar* →

   ```
   gh issue create --repo <owner>/<repo> --title "..." --body-file <file> --assignee @me
   gh project item-add <project> --owner <owner> --url <issue-url> --format json
   # Status=<opt:Status=Triagem> · Tipo (<field:Tipo>) · Severidade
   # (<field:Severidade>) · Módulo (<field:Modulo>)
   gh project item-edit --project-id <project-id> --id <item-id> \
     --field-id <field-id> --single-select-option-id <option-id>
   ```

   Body follows the `gm-triage` shape (o que é · evidência `arquivo:linha` · impacto · origem = "achado durante a task N do card #\<n\>"). It enters 📥 Triagem like any other demand — `/gm-card` qualifies it later, or it dies there as "não faremos". Both are fine; losing it is not.
4. Link it in the current card: add the number under `## Fora do escopo` in the card body (or as a comment if that section does not exist), so the reviewer sees what was deliberately left out.

## Emenda pós-tasks — a decisão caiu depois da última task

A janela entre a última task `✅` e a PR. Antes dela, mid-task, é o protocolo de desvio acima;
depois dela, **se houver parecer da revisão de CI**, é o balde Desvio do `/gm-correcao` — sem
parecer aquela skill para na precondição 2, e o assunto continua sendo desta seção até a PR existir.
Aqui não se reabre a spec em modo autoria (`/gm-spec` é para especificar, não para emendar) nem se
re-roda o `/gm-plan-tasks`, que propõe a quebra inteira de uma vez e re-proporia as tasks já feitas.

1. **Garanta a worktree antes de escrever qualquer coisa.** Volte ao `## Guarantee the branch`
   acima: a pasta `planning/` mora dentro do repo, então escrever a emenda antes de a worktree
   existir grava a nota no **checkout principal**, fora da branch do card — ela não entra na PR e
   ainda reaparece como árvore suja no passo 1 de lá. A sessão pode ter chegado vinda do
   `/gm-ship`, que para **antes** de abrir a PR quando uma decisão cai: a worktree do card
   continua de pé, e é dentro dela que a nota é escrita.
2. **A emenda antes do código.** Rode os passos 2–3 do protocolo de desvio: a contradição e a
   emenda proposta vão na mensagem e a decisão chega pelo conjunto *artefato* do
   `## Como perguntar e como aprovar` — o artefato é a nota que vai ser escrita. Só com *Aprovar*
   se escreve a nota datada
   ("Emenda AAAA-MM-DD: …") em `spec.md` **e** no comentário `<!-- gm:spec -->` do card. Os dois,
   sempre — o caminho curto não compra velocidade com rastro. **Épico:** o `gm:spec` mora no **pai**;
   o card em voo só tem `gm:spec-ref`, então é no pai que a nota entra.
3. **Uma emenda, uma task.** A unidade é a task, não a decisão: uma medição que derruba duas
   decisões de uma vez é **uma** emenda, se uma task fecha as duas. Escreva a task **N+1** como
   arquivo novo e numerado (`tasks/<N+1>-….md`; épico: `tasks/<fase>/`, e N é o maior número
   **dentro da fase**), no formato do `gm-plan-tasks` — número corrido, **nunca** sufixo, que ali
   significa fatiamento de uma task existente. Ela é **exceção nomeada ao teto de 6–8**: o teto
   governa o planejamento e o fatiamento, e aqui não há mais planejamento para governar.
4. **Segunda emenda no mesmo ship? Pare.** Uma decisão que cai é medição; duas quedas independentes
   antes da mesma PR dizem que a errada é a **spec**, não a task. Devolva o card para `/gm-spec` —
   é o único caminho daqui que reabre a especificação, e ele tem portão humano. Sem esta regra a
   janela do ship vira porta dos fundos: emendas de uma task cada, em série, reabrem a feature
   inteira sem passar por portão nenhum.
5. **Não cabe em uma task? Então não é emenda.** A nota datada vai para `spec.md` e para o `gm:spec`
   assim mesmo — a spec não pode virar ficção histórica —, mas o trabalho vira **card novo** pelo
   protocolo de achado acima, e a PR atual segue com o que já está pronto.
6. **Espelhe no card.** Acrescente `- [ ] <N+1> — título` ao comentário `<!-- gm:tasks -->` (épico:
   o do **filho**, não o do pai). Card antigo sem esse comentário → crie um no formato do
   `gm-plan-tasks`. **Se a emenda invalida o escopo de uma task já `✅`**, diga isso na `## Scope` da
   task N+1 e marque a superada: `- [x] 3 — título (superada pela emenda AAAA-MM-DD)` — senão o card
   segue anunciando como entregue um trabalho que foi desfeito. O `This is task N of [total]` das
   tasks antigas fica desatualizado e tudo bem: quem conta é o `gm:tasks`, não o cabeçalho.
7. **Execute a task N+1 nesta sessão**, pelo caminho normal a partir do `## Execute the task` — os
   três protocolos acima continuam valendo dentro dela. O card **não muda de estação**: segue em
   🔨 Implementação, porque o `/gm-ship` só o move depois de abrir a PR.
8. Grave com `mcp__brain__lembrar` **na hora**: qual decisão caiu, a evidência que a derrubou, e o
   que a spec passou a dizer.

Fechada a task, o `## Close the task` volta a oferecer `/gm-ship <folder>` — que agora abre a PR
citando a emenda.

## Present for review

Run the task's **Verification commands first** (tests + typecheck/lint as applicable). Only then present:

- Result of the verification (green/red — never present with red unless asking for help).
- **A risk-ranked review script**, not a changelog: "confira X (decisão delicada), Y (mexe em Z compartilhado); o restante é mecânico" — the antidote to rubber-stamp approvals.

Then the commit — the one step of the task that leaves a mark outside this session — goes to the
human by the *ação irreversível* set from `## Como perguntar e como aprovar`: header `Commit`,
options in pt-BR, and the physical consequence written into each `description`, never a bare verb.

> - **Executar o commit** — <n> arquivos entram na branch `<branch>` com o trailer `Card: #<n>`, a
>   task vira `✅` e o checkbox é marcado no card, onde o board mostra o progresso.
> - **Revisar antes de executar** — nada é gravado; volto com o diff do trecho que você apontar e
>   pergunto de novo.
> - **Cancelar** — nada é gravado e a task segue `❌`; o código continua na árvore de trabalho, sem
>   commit, e a próxima sessão encontra tudo em aberto.

Só *Executar o commit* abre o `## Close the task`.

## Close the task

1. Commit from inside the card's worktree — the one from `## Guarantee the branch`, never the
   main checkout — message ending with the trailer `Card: #<n>`.
2. Flip the task file's first line to `✅ Status: Complete`.
3. Tick the task's checkbox in the card's `<!-- gm:tasks -->` comment (edit the comment in place).
4. Pending tasks remain → "próxima: `/gm-implement <folder>` (sessão nova)". All `✅` → offer `/gm-ship <folder>`.
