---
name: gm-ship
description: Close the implementation loop - verify every task complete, run the full suite, push, open the PR carrying the acceptance-criteria contract and the dev-validation checklist, referencing the board card, and move the card to code review. Use after the last gm-implement task is approved and committed.
disable-model-invocation: true
argument-hint: [feature-folder]
---

# Ship — PR + board

## Preconditions

1. Read the spec (`planning/$ARGUMENTS/spec.md`; older folders: `tech-spec.md`) → `## Execution`, `## Requisitos & critérios de aceite`, and the card reference. **Epic:** the card in flight is the phase child, not the parent — read its `gm:spec-ref` comment and treat the criteria it names as the ones this PR must close.
2. Every file in `tasks/` (epic: `tasks/<fase>/`, only the phase in flight) starts with `✅ Status: Complete`; otherwise stop and point to `/gm-implement $ARGUMENTS`.
3. Inside the module repo (nested git repository): on the feature branch, `git status` clean.
4. **Run the full relevant suite** (api/web tests + typecheck of the touched packages). Red → stop and show; a PR never opens on red.

## Open the PR

1. `git push -u origin <feature-branch>`.
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

   ## Tasks
   - [x] 1 — <título>
   ```

3. Team-visible: show repo + title + body and only create after explicit approval. Title: short, imperative, close to the card title.
4. `gh pr create --repo <owner>/<repo> --base <base> --title "..." --body-file <file>`

## Board

Move the card to 👀 Revisão on the team board (project-id `<project-id>`, Status field `<field:Status>`, option `<opt:Status=Revisao>`; item-id via `gh api graphql` on the issue's projectItems, node with `project.number == <project>`). Missing `project` scope → `! gh auth refresh -s project`.

## Report

PR URL + board move. If the CI review workflow is active in the repo, mention it will comment using the card's spec; if not, the "Validação em dev" checklist is the reviewer's guide.

Then say what happens next, so the card does not stall in 👀 Revisão: merged into `dev` → the card goes to 🧪 Validação em Dev, where a **named person** runs the checklist above (SLA 7 dias); validated → 🚂 Release, and the train is cut with `/gm-release`.
