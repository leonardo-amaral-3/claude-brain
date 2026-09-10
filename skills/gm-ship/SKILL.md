---
name: gm-ship
description: Close the implementation loop - verify every task complete, run the full suite, push, open the PR carrying the acceptance-criteria contract and the dev-validation checklist, referencing the board card, and move the card to code review. Use after the last gm-implement task is approved and committed.
disable-model-invocation: true
argument-hint: [feature-folder]
---

# Ship — PR + board

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

## Preconditions

1. Read the spec (`planning/$ARGUMENTS/spec.md`; older folders: `tech-spec.md`) → `## Execution`, `## Requisitos & critérios de aceite`, and the card reference. **Epic:** the card in flight is the phase child, not the parent — read its `gm:spec-ref` comment and treat the criteria it names as the ones this PR must close.
2. Every file in `tasks/` (epic: `tasks/<fase>/`, only the phase in flight) starts with `✅ Status: Complete`; otherwise stop and point to `/gm-implement $ARGUMENTS`.
3. Inside the module repo (nested git repository): on the feature branch, `git status` clean.
4. **Run the full relevant suite** (api/web tests + typecheck of the touched packages). Red → stop and show; a PR never opens on red. **Verde não encerra a checagem** — leia o resultado contra as decisões da spec; se a suíte ou uma medição derruba alguma, vale a regra do `## Open the PR` abaixo.

## Open the PR

1. `git push -u origin <feature-branch>`.

**Antes de escrever o corpo: alguma decisão da spec caiu?** A pergunta vale da precondição 4 até o
`gh pr create`, e o gatilho é mecânico: ao escrever `## Critérios de aceite` no passo 2, confira cada
critério contra o que a suíte e as **medições desta sessão** mostraram — critério que só passa
reinterpretando a spec é decisão caída. Foi assim que o caso que originou esta regra apareceu: uma
medição, não um teste vermelho, então suíte verde não encerra a checagem.

Se caiu: **não abra a PR.** PR contra spec sabidamente errada nasce mentindo para o revisor humano e
para a revisão de CI do G4, que revisa lendo o `gm:spec`. Pare e mande o humano para
`/gm-implement $ARGUMENTS`, nomeando **emenda pós-tasks** — é lá que a emenda datada é aprovada e
escrita em `spec.md` + `gm:spec`, e é lá que nasce a task N+1, sem `/gm-spec` (que é autoria) e sem
`/gm-plan-tasks` (que re-proporia as tasks já feitas). A branch já empurrada no passo 1 não
atrapalha: branch sem PR não aparece no board nem dispara revisão, e você volta para cá pela
precondição 3 quando a task estiver `✅`.

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

## Report

PR URL + board move. If the CI review workflow is active in the repo, mention it will comment using the card's spec; if not, the "Validação em dev" checklist is the reviewer's guide.

Then say what happens next, so the card does not stall in 👀 Revisão: merged into `dev` → the card goes to 🧪 Validação em Dev, where a **named person** runs the checklist above (SLA 7 dias); validated → 🚂 Release, and the train is cut with `/gm-release`.
