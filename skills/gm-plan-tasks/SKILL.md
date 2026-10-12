---
name: gm-plan-tasks
description: Break a spec into ordered, independent implementation tasks — each task file is the complete prompt for a fresh agent. Proposes the whole breakdown at once for the user to veto/adjust; enforces the 6-8 task ceiling; mirrors the task list on the card. Use after gm-spec, before /gm-implement.
disable-model-invocation: true
argument-hint: [feature-folder]
---

# Task Planner

You are a senior engineer breaking a planned implementation into discrete, ordered tasks, each executed by an independent agent in a fresh context window.

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

## Setup

Read `planning/$ARGUMENTS/spec.md` (older folders: `tech-spec.md` + `PRD.md`). Note `## Execution` (target repo, feature branch — branch management belongs to `/gm-implement`, not to the tasks) and `## Plano de testes`. Then explore the current state of the files that will change.

**The spec's premises are measured, or there is no plan.** The spec has a `## Premissas medidas` section, and every line in it carries its proof and result (or the section is `N/A` with a reason). Missing section, or a line without proof → stop and point to `/gm-spec <n>`: planning on an unmeasured premise is how a task stops halfway on a deviation. The same when the breakdown reveals a premise the section does not list. Each task's `Context` names the lines of `## Premissas medidas` it leans on.

## Phase 1: Propose the breakdown — whole, at once

Present the **entire** proposed breakdown in one message — numbered list, each task with title +
one-line scope + the test that closes it — because a division cannot be judged without both sides
of every cut on the table. Then run the *artefato* set from `## Como perguntar e como aprovar`
**once**, over the whole list: *Ajustar* comes back here with the correction and re-presents the
list entire; *Rejeitar* writes no task file at all and closes by saying what would have to change
first — the spec, or the size of the card.

What stays banned is the drip: proposing task 1, closing it with the human, and only then
inventing task 2. That is not the "one question per call" of rule 2 — that is asking N times what
a single choice closes, and it hides the shape of the whole from the only person who can judge it.

Rules of division:

- **Code must compile after each task** — no type errors, no broken builds. Primary constraint.
- **Each task names its verification** — the test command/suite that must pass, from the spec's test plan. "Compila" is not a Definition of Done.
- **Dependency order** — schema → backend → frontend (adapt); no task depends on a future task.
- **Ceiling: 6–8 tasks, per card in flight.** More than that means the card is an epic in disguise — stop, say so, and send it to **`/gm-spec` Phase 6** (slicing is gm-spec's job, not gm-card's: the phase structure is an output of specification). Don't paper over it with a longer list. Deliver what you can: if the first phase already fits the ceiling, propose *its* breakdown in the same breath, so the rebound arrives with work attached instead of empty-handed.
- **On an epic, you are planning the child card, not the parent.** Read the child's `<!-- gm:spec-ref -->` comment: it names the spec sections this phase covers and, just as importantly, what is deliberately out of scope. Task files live in `tasks/<fase>/`, point at the spec with `../../spec.md`, and carry the **child's** number in the `Card: #` trailer — the epic's number never goes in a commit.
- **A phase that was not promoted is not plannable — stop.** Every phase of an epic exists as a sub-issue from the slicing on, but a phase still carrying `<!-- gm:fase -->` (instead of `gm:spec-ref`), with no acceptance criteria, no declared route and no place on the board, is roadmap, not work. Say exactly that and send it back to `/gm-spec` Phase 6 for promotion — planning tasks against a thin phase would invent the acceptance criteria that the promotion exists to decide with a human.
- **Sizing is a guess, and guesses fail forward.** A task that turns out oversized during implementation is split there, by `gm-implement`'s slicing protocol, into suffixed sub-tasks (`3a`, `3b`) — the same 6–8 ceiling applies to the total, and blowing through it sends the card back here. So prefer a slightly coarser breakdown over inventing sub-tasks for work you cannot see yet: splitting later is cheap, and a task list padded with speculation is not.

## Phase 2: Write the task files

`planning/$ARGUMENTS/tasks/1-short-description.md`, `2-…` etc. — or `tasks/<fase>/1-…md` when the folder belongs to an epic, since later phases reuse the numbering.

### Task files are agent prompts

Each file is the ENTIRE prompt of a fresh agent — no surrounding context, no history. It defines **scope only**: which part to build, never how — implementation details, business rules and patterns live in the spec; the task points there. Never duplicate spec content.

### Structure

```markdown
❌ Status: Not Started

# Task [N]: [Title]

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/[feature-folder]/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `[repo]/` directory of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task [N] of [total]. Tasks 1..[N-1] are already in the codebase.

## Scope

[boundaries only — which spec sections/files this task covers, and what it does NOT]

## Verification

- Command(s) that must pass: `[test command for this task's area]`
- Acceptance criteria covered: [which items from "Requisitos & critérios de aceite"]

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside `[repo]/`, message ending with the trailer `Card: #[issue]` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
```

### Mirror on the card

Publish the task list as a checklist comment on the card (create-or-update, first line exactly `<!-- gm:tasks -->`):

```markdown
<!-- gm:tasks -->
### Tasks
- [ ] 1 — título
- [ ] 2 — título
```

`gm-implement` ticks the boxes as tasks complete — progress (n/m) visible on the board without opening anything.

### Quality checks before presenting

1. Tasks cover the whole spec — nothing missed. 2. Each leaves the code compilable. 3. No forward dependencies. 4. Each file works as a standalone prompt. 5. No duplication of spec content. 6. Every task names its verification command. 7. An e2e task simulates a slow external system at the edge, and a premise inherited from a catalog is checked against the environment, not assumed.

Then offer exactly one follow-up: `/gm-implement $ARGUMENTS` (uma task por sessão, de preferência com `/clear` entre elas).

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
