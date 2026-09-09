---
name: gm-spec
description: Create the single specification (requirements + technical) for a board card — the contract that makes AI implementation safe. Seeded by the card, built through codebase exploration and focused Q&A, hardened by an adversarial critique, and gated by explicit human approval. Publishes the spec as a comment on the card. Replaces the old gm-prd + gm-tech-spec pair as the default path (gm-prd remains only for genuinely new product areas).
disable-model-invocation: true
argument-hint: [#issue]
---

# Spec — o contrato da implementação

Mission: close **every** decision before code exists. The spec will be executed literally by AI agents and reviewed against by the CI — if the implementing agent would need to decide or assume anything, the spec has failed. Err on the side of explicit.

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

## Setup: resolve the card

The argument is an issue number (`#1072` / `1072`) or an existing planning folder.

1. Fetch the card: `gh issue view <n> --repo <owner>/<repo> --json title,body,url,comments` (`<repo>`: one of the repos listed in `## Board` of the workspace CLAUDE.md — infer, ask if ambiguous).

**First branch, before anything else: is this card a phase of an epic awaiting promotion?** If its comments carry `<!-- gm:fase -->`, the spec already exists — it lives in the parent epic and covers every phase. Do **not** run Phases 1–5: exploring and re-writing `spec.md` would overwrite an approved contract. Jump straight to **Phase 6's promotion path** (item 4), which is a short human-facing exchange, not a specification:

   a. Read the parent's `gm:spec` comment and the phase's `gm:fase` comment (what it covers, what is out of scope, the note left for promotion by whoever sliced).
   b. Check the predecessor phase is actually closed — its card closed **and** its PRs merged. If not, say so and stop: promoting early is how a phase inherits work that is still moving.
   c. Re-cut the phase in light of what the predecessor revealed, with the user — including splitting it into two cards when the note says so.
   d. Propose 1–3 verifiable acceptance criteria carved from the spec's `## Requisitos & critérios de aceite`, plus the **declared route**, and get explicit human approval for both.
   e. Apply: replace `gm:fase` with the full `<!-- gm:spec-ref -->` comment, add the card to the board with the board fields, and move it to 🎯 Especificação.
   f. Offer exactly one follow-up: `/gm-plan-tasks <folder>` for this phase.
2. Planning folder: `planning/<issue>-<slug>/` (short kebab slug from the title; reuse the folder if it already exists).
3. Seed from the card: Estado atual (verify load-bearing `file:line` claims in the code — they may be stale), Direção, Por quê, Fora do escopo.
4. **Critérios de aceite are mandatory.** If the card lacks a `## Critérios de aceite` section (older cards), derive 1–3 verifiable "pronto quando…" bullets from the Direção and confirm them with the user **before anything else** — they are the seed of the requirements, the test plan and the validation checklist.
5. If a PRD exists (comment `<!-- gm:prd -->` or `planning/<folder>/PRD.md`), read it — it exists only for genuinely new product areas (via `gm-prd`).

## Choose the depth (proportional to risk — suggest, user decides)

- **Completa** — changes behavior, contracts, schema or business rules broadly. Full Q&A, full document.
- **Lite** — contained change (one screen, one filter, one rule). Same skeleton, short sections; a non-applicable section becomes `N/A — <por quê>` (never silently omitted).
- **Rota curta** (the card says so) — the spec is a single paragraph; still passes the critique and the approval below, published on the card, and feeds a single task.

## Phase 1: Explore, then Q&A

Explore the codebase **before** asking anything: structure, conventions, the code the card points at, related patterns. Then resolve every open decision with the user:

- One question at a time, direct, no filler.
- Multiple valid approaches → present them with trade-offs and let the user decide. Never decide silently.
- Default to existing project patterns; confirm when deviating.
- Stop only when zero decisions remain for the implementer.

## Phase 2: Write the spec

Write `planning/<folder>/spec.md`. Keep the exact section names — downstream skills machine-read them:

```markdown
# [Título] — Spec

## References
- Card: [#<n>](<issue-url>) — repo `<owner>/<repo>`
- PRD: (só se houver)

## Execution
- Repo: `<owner>/<repo>` (working dir `<repo>/` no workspace)
- Base branch: `dev`
- Feature branch: `feat/<issue>-<slug>`

## Requisitos & critérios de aceite
[a versão canônica e verificável dos critérios do card — Dado/Quando/Então onde couber. O review de IA, o plano de testes e a validação em dev leem DAQUI.]

## Technical Overview
[abordagem e decisões-chave em poucas linhas]

## Implementation Details
### [Área]
[arquivos exatos, tipos/estruturas exatas, padrões a seguir com referência a código existente]

## File Change Summary
[todo arquivo criado/alterado/removido, com uma linha do que muda]

## Migrations & compatibilidade
[migration? destrutiva? expand/contract? janela de risco? — ou N/A + por quê]

## Rollback
[como reverter se der errado em prod — ou N/A + por quê]

## Verificação pós-deploy
[query/checagem que prova que funcionou; obrigatória quando toca dados ou regra de faturamento — ou N/A + por quê]

## Plano de testes
[qual teste prova cada critério de aceite — nome do arquivo/suíte e o caso]

## Technical Decisions
[decisões tomadas no Q&A, com o porquê]

## Coding Standards
[padrões do projeto que se aplicam; simplicidade; nada além do especificado]
```

## Phase 3: Adversarial critique (before showing the final spec)

Put on the critic hat (or spawn a fresh review pass) and attack the draft:

- Contradictions between sections; requirements without a covering test; acceptance criteria not verifiable.
- **Claims about the current code without verified evidence** — every "hoje o sistema faz X" needs `file:line` checked in this session.
- Missing edge cases the card or the code imply; migrations/rollback/verificação declared N/A without a defensible reason.

Fix what the critique finds; what can't be resolved alone goes to the user as an open point.

## Phase 4: Human gate

Present the spec plus a short list of what the critique caught and how it was resolved. **Explicit approval required** — never proceed on silence. When the change is sensitive (touches data, faturamento rules, or migrations), recommend a second human reviewer with a 24h timebox; the user decides whether to wait.

## Phase 5: Publish on the card

Team-visible — show before posting. First line of the comment exactly `<!-- gm:spec -->`, then the full spec. Create-or-update, never stack:

```
gh api --paginate repos/<owner>/<repo>/issues/<n>/comments \
  --jq '.[] | select(.body | startswith("<!-- gm:spec -->")) | .id'
# id → PATCH repos/.../issues/comments/<id> -F body=@<file>   |   sem id → gh issue comment <n> --body-file <file>
```

**Spec viva:** emendas aprovadas durante a implementação (protocolo de desvio do gm-implement) atualizam `spec.md` E este comentário, com nota datada — a spec publicada nunca vira mentira histórica. Isso inclui a **emenda pós-tasks**, quando a decisão cai entre a última task e a PR.

Board (the team board): ao INICIAR a fase 1, mover o card para 🎯 Especificação — é o ponto de compromisso:
```
gh api graphql -f query='{repository(owner:"<owner>",name:"<repo>"){issue(number:<n>){projectItems(first:10){nodes{id project{number}}}}}}'
# usar o node com project.number == <project>; se o card não está no board, adicionar antes: gh project item-add <project> --owner <owner> --url <issue-url>
gh project item-edit --project-id <project-id> --id <item-id> \
  --field-id <field:Status> --single-select-option-id <opt:Status=Especificacao>
```

## Phase 6: Slice, if it is an epic

A spec whose implementation cannot fit **6–8 tasks** is an epic, and slicing it is this skill's job — not `gm-card`'s (before the spec, nobody knew the phases existed; the phase structure is an *output* of specification) and not `gm-plan-tasks`'s (it is downstream, and its job is tasks). Signals: the spec declares phases; `## Execution` wants more than one feature branch; one section alone would fill the whole ceiling.

The spec is **not** split — one feature, one `spec.md`, one folder. Only the **card** is.

1. **The parent becomes the epic.** Label `épico`, and a `## Fases` table appended to its body: one row per phase, each with a one-line *pronto quando…* objective and the number of its sub-issue. It keeps the `gm:spec` comment. Its `gm:tasks` comment becomes a pointer to the child in flight — an epic has no tasks of its own. It does not move through the 8 stations and does not consume WIP.
2. **EVERY phase becomes a sub-issue, right now — thin.** Create one issue per phase and link them all with `addSubIssue`, so `Sub-issues progress` tracks the epic and the roadmap is legible to someone who was not in the conversation. Each is born with title, the *pronto quando…* objective, **why this phase exists**, what is deliberately out of scope (naming which phase owns each excluded piece) and the link to the parent's spec — carried in a `<!-- gm:fase -->` comment. **No acceptance criteria, no route, no tasks**: writing those today for a phase nobody has touched is speculation, and a phase's real shape changes with what the previous one reveals.
3. **Only the phase in flight goes on the board.** A sub-issue does not need to be on the board to exist or to feed `Sub-issues progress`. Off the board it consumes no WIP, does not clutter the kanban and **does not age** — which is what kills the honest-backlog objection (card idle ≥90 days is promoted or closed) without inventing a column or a `Classe` option. Add the phase to the board only when it is promoted. **Not adding it is not enough** when the workspace has auto-add boards: the `## Board` section of the workspace CLAUDE.md lists them under `auto-add` — those boards swallow every new issue in the repo, so right after creating each phase, delete its item from each one with `deleteProjectV2Item`, reading the item ids from `issue.projectItems`. No `auto-add` line in that section → nothing to clean up.
4. **Promotion is the step that has an owner.** When the previous phase closes, promote the next one: put it on the board in 🎯 Especificação, give it 1–3 verifiable acceptance criteria carved from the spec's `## Requisitos & critérios de aceite`, a **declared route — never inherited** (a test-infrastructure phase and a migration phase are not the same risk), and replace `gm:fase` with the full `<!-- gm:spec-ref -->` comment. Promotion is also where the phase gets re-cut in light of what the previous one revealed — including splitting it into two cards. **Without promotion, `gm-plan-tasks` refuses to plan.**
5. **The `<!-- gm:spec-ref -->` comment** is what keeps the G4 CI review from degrading in silence: the PR trailer names the *child*, the child has no spec of its own, and a reviewer that finds an empty card reviews the diff blind. It must give: the link to the parent's `gm:spec` comment · which spec sections and decisions this phase covers · which acceptance criteria it closes · and a **deliberately-out-of-scope** table saying which phase owns each excluded piece. That last part is what makes scope-creep detection mechanical instead of instinctive.
6. **The spec is never split.** One feature, one `spec.md`, one folder — each sub-issue only names the sections it covers. `tasks/` gains one subfolder per phase (`tasks/fase-0/1-…md`), and later phases reuse the numbering.

Board: the promoted child gets the fields (`Status`, `Tipo`, `Classe`, `Rota`, `Módulo`) per `gm-card`'s reference; the parent keeps whatever it had; the phases not yet promoted get **nothing** — they stay off the project. **Do not add a `🧭 Épico` option to `Classe` or a 9th `Status` column** — editing single-select options via the API regenerates the option IDs hardcoded in `gm-card`, `gm-hotfix` and `gm-triage`. The `épico` label plus a saved board view filtered on it gives the same roadmap at no risk.

Report paths and offer exactly one follow-up: `/gm-plan-tasks <folder>` (for an epic, aimed at the phase you just promoted — the others are roadmap, not work).
