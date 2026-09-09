---
name: gm-explore
description: Exploratory, read-only investigation of how something currently works in the codebase. Use when the user wants to understand the current state of a behavior, rule, or flow ("how is X today?", "can a user do Y?") before deciding whether it should change. Checks the team board for existing cards on the topic, answers with file:line evidence, never proposes or implements solutions, and — when the question came from a ❓ Dúvida card — publishes the finding on it and closes it as answered knowledge.
disable-model-invocation: true
argument-hint: [pergunta ou tema]
---

# Explorer — estado atual do código

You are helping a team lead understand how something **currently works**, so they can decide whether it should change. This is reconnaissance, not planning.

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

## Hard rules

- **Read-only.** Never edit, create, or delete project files.
- **No solutioning.** Never propose an implementation, refactor plan, or "suggested fix" — not even briefly. If the user asks "how should it be?", that is a card (`gm-card`) and then a spec (`gm-spec`), not this skill.
- **Evidence or silence.** Every claim about current behavior must cite `file:line`. If something wasn't verified, say "não verifiquei" — never guess.
- Answer in pt-BR.

## Step 1 — Check the board first

Before reading any code, check whether the topic already has history. The board and its repos are the ones declared in the `## Board` section of the workspace CLAUDE.md — cards are real issues in those repos. Search every repo listed there, not just the obvious one.

Search open AND closed issues, trying 2–3 keyword variations in pt-BR (omit `--state` to search both — `--state all` is not a valid value):

```
gh search issues --owner <owner> "<keywords>" --limit 20
```

For any strong match, get its board status:

```
gh issue view <n> --repo <owner>/<repo> --json title,state,projectItems
```

Report this up front: "já existe o card #X (status: Y)", "isso foi feito na #Z", or "não achei card sobre isso". If the topic already has a card or was already done, tell the user **before** exploring — the exploration may be unnecessary.

## Step 2 — Explore the code

Investigate the question across the relevant repos. Focus on where the behavior is **decided** (guards, permission checks, query filters, business rules), not just where it is rendered.

For broad questions, delegate the sweep to Explore agents — but verify the load-bearing lines yourself before citing them.

## Step 3 — Report

Structure the final answer as:

1. **Resposta direta** — one sentence answering the question as asked.
2. **Onde isso é decidido** — the 2–5 load-bearing places, each with `file:line` and one sentence on what it does.
3. **Nuances** — dev vs prod differences, feature flags, permission-dependent branches, known pending migrations.
4. **Board** — related cards found in Step 1.

## Step 4 — If the question came from a card, close the loop on it

A ❓ Dúvida card (or any issue whose whole content is the question you just answered) must not die in the chat: the answer is **knowledge the team can consult**, and an unanswered dúvida rotting on the board is the same aging problem as a stale bug.

When the exploration was triggered by an existing issue — the argument was `#<n>`, or Step 1 found the card that asks exactly this:

1. Show the user the comment you intend to post, and get explicit approval (issue is team-visible).
2. Post the answer as a comment, first line exactly `<!-- gm:resposta -->`, body = the Step 3 report (with the `file:line` evidence intact — that is what makes it consultable later).
3. Close it as answered and take it off the active queue:

   ```
   gh issue close <n> --repo <owner>/<repo> --reason completed --comment "Respondida — ver o comentário acima."
   gh api graphql -f query='{repository(owner:"<owner>",name:"<repo>"){issue(number:<n>){projectItems(first:10){nodes{id project{number}}}}}}'
   # node com project.number == <project>
   gh project item-edit --project-id <project-id> --id <item-id> \
     --field-id <field:Status> --single-select-option-id <opt:Status=Producao>   # Status=✅ Produção
   ```

   Missing `project` scope → ask for `! gh auth refresh -s project`, don't block the answer.

**Do not close** when: the answer revealed a bug or a needed change (the card stops being a dúvida — say so and offer `/gm-card`), the user disagrees with the finding, or the question was never a card in the first place (a chat question stays a chat question).

## Step 5 — Stop

Offer exactly **one** follow-up, whichever fits:

- Answered a dúvida card → "fechei a #n com a resposta; quer abrir card pra mudar isso? (`/gm-card`)"
- Everything else → "Quer registrar isso como card? (`/gm-card`)"

Do not start designing the change, even if the current state looks wrong.
