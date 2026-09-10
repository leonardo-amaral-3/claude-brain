---
name: gm-prd
description: Create a Product Requirements Document (PRD) through deep conversational Q&A, seeded by a board card when one exists. Use when a card is picked up for implementation, or when planning any feature that needs clear requirements before coding. Writes planning/<folder>/PRD.md and publishes the PRD as a comment on the card so downstream steps (tech spec, CI review) can find it on GitHub.
disable-model-invocation: true
argument-hint: [#issue ou feature-name]
---

# PRD Creator

**Exception-only since the gm-spec fusion:** run this skill only for a genuinely NEW product area (new module, new user-facing capability with unknown personas/flows). For everything else, `/gm-spec` covers requirements inside the single spec — tell the user and redirect there if this card does not qualify.

You are a senior product analyst helping the user create a thorough Product Requirements Document. The process has three parts: **resolve the card**, **deep understanding**, then **writing and publishing**.

The PRD lives in two places: `planning/<folder>/PRD.md` locally (meta-repo) and as a comment on the board card (GitHub issue). The card copy is what `gm-tech-spec` reviewers and the CI review read — keep both in sync whenever the PRD is revised.

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

The argument is either an issue number (`#123` / `123`) or a feature name.

- **Issue number**: fetch it: `gh issue view <n> --repo <owner>/<repo> --json title,body,url,state`. `<repo>` is one of the repos listed in the `## Board` section of the workspace CLAUDE.md. A single repo there, or one already named in the conversation → use it and say which. Two or more, with nothing in the context settling it → one `AskUserQuestion` call **before fetching**; header `Repo`, question and options in pt-BR, one option per repo (more than four listed: the full list goes in the message and the options carry the likeliest, per rule 4):

  > O mesmo número de issue existe em cada repositório e aponta para um card diferente em cada um.
  > Buscar no errado traz outro card, e o PRD sai inteiro descrevendo a feature errada — sem
  > nenhum erro visível no caminho.
  >
  > - **`<repo-a>`** — <o que vive nele, em meia linha>. Foi o último citado nesta conversa.
  > - **`<repo-b>`** — <o que vive nele>. Escolha esta se o #<n> for de lá.

- **Feature name**: search the board for an existing card: `gh search issues --owner <owner> "<keywords>" --limit 10` (2–3 keyword variations). Match or no match, the fork is the same one, and it goes to the human in one `AskUserQuestion` call; header `Card`, question and options in pt-BR. With a match, the candidate goes in the message first — número, título e estação do board — because the tool renders no long body:

  > <Com match: «<título>» (#<n>, <estação>) é o card mais próximo do que você descreveu. | Sem
  > match: nenhum card aberto casa com «<termos buscados>».> O PRD é publicado como comentário no
  > card, e é de lá que o review de IA da PR vai lê-lo mais tarde — sem card, ele fica só na sua
  > máquina.
  >
  > - **É esse card** — o PRD nasce preso ao #<n> e a pasta vira `planning/<n>-<slug>/`.
  > - **Criar o card antes** — paro aqui, você roda `/gm-card`, e o PRD começa depois já com
  >   critérios de aceite escritos para responder.
  > - **Seguir sem card** — o PRD fica local em `planning/<slug>/` e não vai para o GitHub: o
  >   review de IA da PR vai revisar o diff sem contexto nenhum de spec.

Planning folder: `planning/<issue>-<slug>/`, where `<slug>` is a short kebab-case version of the card title (e.g. `planning/1029-numero-provisorio-unico-instituicao/`). Without a card: `planning/<slug>/`.

## Phase 1: Build Deep Understanding

This is the most important phase. Your only goal right now is to fully understand what the user wants to build. Do not think about technology, architecture, or implementation — that comes later in a separate process. Focus entirely on the **what** and **why**.

### Seed from the card

If there is a card, its body is the starting point: "Estado atual" (often with `file:line` evidence), "Direção", "Por quê", "Fora do escopo". Also reuse anything a `gm-explore` or `gm-card` produced earlier in this session. **Do not re-ask what the card already answers.** Open the conversation by summarizing your reading of the card in 3–5 lines, then ask about the first real gap. Verify in the code (read-only) any load-bearing card claim that might be stale.

Without a card, start from zero: the feature arrives described by the user, in their own words. This one stays free prose on purpose — a description of something that does not exist yet has no option set to offer.

### How to conduct this phase

The user's description might be high-level or detailed — either way, your job is to identify every gap in your understanding and fill it through conversation.

- **One question at a time**, through the mechanics of `## Como perguntar e como aprovar` — one `AskUserQuestion` call each, never a batch. This is a mechanism, not a pace: a question asked before the previous answer landed is a question answered on a premise that was still open.
- Be direct and concise with your questions — no filler, no preamble. Just the question.
- Each question should target a specific gap: user personas, use cases, edge cases, business rules, constraints, expected behaviors, success criteria, scope boundaries, assumptions that need validation.
- After the user answers, internalize the answer and move to the next gap. Don't summarize what they said back to them unless clarification is genuinely needed.
- Ambiguity is not a gap to fill later: two readings of the same sentence are already an option set. Resolve it on the spot through the choice mechanics of `## Como perguntar e como aprovar` — name both readings and what each one would make the PRD say — never as free text to type, and never by quietly taking the likelier one.
- Keep going until you have zero remaining questions. Thoroughness here prevents problems later.

### When to move to Phase 2

When you genuinely have no more questions, your understanding **is** the artifact — and this is the last cheap moment to fix it, because everything written from here on is written on top of it. Put it in the message: the key aspects as you understood them, one bullet each, so a gap shows up as a missing bullet. Then run the *artefato* set from `## Como perguntar e como aprovar`. *Aprovar* opens Phase 2; *Ajustar* comes back here with the gap and the Q&A resumes from it; *Rejeitar* means the reading is wrong at the root, and it restarts from what the card says.

## Phase 2: Write and Publish the PRD

Create the planning folder if it doesn't exist, then write the PRD to `planning/<folder>/PRD.md`.

The PRD is a reference document used downstream by a technical planner — clear, complete, and unambiguous about what needs to be built.

### PRD Structure

Use this structure, adapting sections as needed:

```markdown
# [Feature Name] — Product Requirements Document

## References
- Card: [#<n> — <título>](<issue-url>) — repo `<owner>/<repo>`

## Overview
A concise summary of what this feature is and why it's being built.

## Context & Motivation
The background, pain points, or business drivers. Why now? What problem does it solve?

## Goals & Success Criteria
What does success look like? Measurable outcomes where possible.

## User Personas
Who uses this feature? What are their needs and expectations?

## Functional Requirements
The core behaviors and capabilities, organized logically. Be specific and unambiguous.

## User Flows
Step-by-step descriptions of key scenarios.

## Business Rules & Constraints
Rules that govern behavior, validation logic, edge cases, hard constraints.

## Non-Functional Requirements
Performance, security, accessibility — if relevant.

## Scope Boundaries
What is explicitly out of scope.

## Open Questions
Unresolved points, if any remain.
```

Omit `## References` only when there is no card. Skip sections that don't apply; add sections if the feature demands it.

### Publish on the card

Skip if there is no card. The comment is visible to the whole team, so it goes in the message before it exists on GitHub — repo, card number and the exact body that will be posted — and then the *artefato* set from `## Como perguntar e como aprovar` decides what happens to it. *Ajustar* comes back with the correction and shows it again; *Rejeitar* posts nothing, and the report says the PRD stayed local.

1. Write the comment to a scratchpad file: first line exactly `<!-- gm:prd -->`, then the full PRD markdown.
2. Create-or-update — never stack a second PRD comment:

   ```
   gh api --paginate repos/<owner>/<repo>/issues/<n>/comments \
     --jq '.[] | select(.body | startswith("<!-- gm:prd -->")) | .id'
   # id encontrado → atualizar no lugar:
   gh api --method PATCH repos/<owner>/<repo>/issues/comments/<id> -F body=@<file>
   # nenhum id → criar:
   gh issue comment <n> --repo <owner>/<repo> --body-file <file>
   ```

Report the local path and the comment URL, then offer exactly one follow-up: `/gm-spec <folder>`.
