---
name: gm-card
description: Qualify demand into a direction card on the team board (the team board declared in the workspace CLAUDE.md) — either creating it from a one-line direction, or promoting an issue that gm-triage left in Triagem. Captures current state with evidence, desired direction, motivation and MANDATORY acceptance criteria (gate G1), using the right template per type (bug vs melhoria vs débito), and suggests the route (completa/curta). Use right after a gm-explore or a gm-triage, or whenever registering demand on the board.
disable-model-invocation: true
argument-hint: [direção em uma frase | #issue da Triagem]
---

# Card Creator — board do time

You create **direction cards**, not specs. The card is the **context hub** of the chain: PRD/spec get published as comments on it, the PR references it, and the CI review reads the spec from there. Every planned change needs a card.

This is the **G1 gate**: nothing leaves 📥 Triagem for 📋 Backlog without verifiable acceptance criteria. From them derive the spec, the tests and the dev-validation checklist — a card without them is a card whose "pronto" means something different in each person's head.

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

## Board reference — vem do workspace, nunca deste arquivo

As coordenadas do board (**project**, **owner**, **project-id**, field-ids, option-ids) e a lista de
**repos** estao na secao `## Board` do `CLAUDE.md` do workspace atual, ja carregado no seu contexto.
Use aquelas — nunca IDs escritos aqui ou lembrados de outra sessao.

**Se o CLAUDE.md do workspace nao tiver a secao `## Board`, pare e peca ao usuario.** Nao descubra
board sozinho e nao assuma o da Notoria: escrever card no board errado e pior que nao escrever.

Placeholders usados adiante: `<owner>`, `<project>`, `<project-id>`, `<repo>`, `<field:Nome>` (o
field-id do campo) e `<opt:Campo=Valor>` (o option-id da opcao).

## Two modes

- **Promover** — the argument is an issue number (`#1090` / `1090`), typically one `gm-triage` left in 📥 Triagem. The demand already exists, typed and deduplicated: you are adding what G1 requires (estado atual com evidência, direção, critérios de aceite, rota) and moving it to 📋 Backlog. **Edit the issue body in place** — never open a second issue for the same demand.
- **Criar** — the argument is a direction in one sentence, or the conversation carries it (usually right after a `gm-explore`). Full workflow below.

Both end with the same product: a card that satisfies G1.

## Workflow

1. **Gather.** Promover → `gh issue view <n> --repo <owner>/<repo> --json title,body,url,comments` and keep everything the triage recorded (reprodução, severidade, **origem/solicitante** — the release notice depends on it). Criar → from the argument and conversation; reuse gm-explore evidence from this session (never re-explore). Unverified "estado atual" claims: verify quickly (read-only) or mark "(a confirmar)".

2. **Check duplicates** (Criar only — a triaged issue was already deduplicated). `gh search issues --owner <owner> "<keywords>" --state open --limit 10`. A similar card exists → show it (number, title, board status) and put the fork to the human in one `AskUserQuestion` call; header `Duplicata`, question and options in pt-BR:

   > Já existe card cobrindo quase isso: «<título>» (#<n>, <status>). Duas demandas para o mesmo
   > problema é o que faz duas pessoas consertarem a mesma coisa sem saber.
   >
   > - **Atualizar o card existente** — direção e critérios entram na issue que já está lá; o
   >   histórico fica num lugar só e o board não cresce.
   > - **Criar card separado** — são problemas diferentes apesar da semelhança. O novo cita o #<n>
   >   no corpo, para o próximo leitor não tropeçar na mesma dúvida.

3. **Draft in pt-BR, template by type.** Title short and imperative.

   **Melhoria / Direção / Débito:**
   ```markdown
   ## Estado atual
   [como funciona hoje; arquivo:linha quando houver evidência]

   ## Direção
   [como deveria ser — 1 a 3 frases, sem solução técnica]

   ## Por quê
   [motivação / dor]

   ## Critérios de aceite
   - [pronto quando… — 1 a 3 bullets verificáveis]

   ## Rota
   [completa | curta — sugestão; ver critério abaixo]

   ## Fora do escopo
   [opcional]
   ```

   **Bug:**
   ```markdown
   ## Comportamento esperado × observado
   [o que deveria acontecer vs o que acontece; evidência: nº AIH, competência, print, arquivo:linha]

   ## Reprodução
   [passos mínimos]

   ## Severidade e origem
   [S1 (faturamento parado/dado corrompido em prod) · S2 (errado com workaround) · S3 · quem reportou/canal]

   ## Critérios de aceite
   - [pronto quando…]

   ## Rota
   [curta | completa | hotfix se S1]
   ```

   **Rota — you suggest, the human picks.** Curta requires ALL of: no change to API contract, schema or business rule; small diff; trivially reversible. S1 in production → hotfix. Everything else → completa. Say in one sentence which one the criteria point at and why, then one `AskUserQuestion` call; header `Rota`, question and options in pt-BR:

   > <por que os critérios apontam para X, em uma frase>. A rota decide quanto documento vem antes
   > do código:
   >
   > - **Curta** — a spec vira um parágrafo e alimenta **uma** task; a crítica adversarial e o
   >   portão humano continuam. Ganha dias, e aposta que a mudança é mesmo pequena e reversível.
   > - **Completa** — spec inteira, requisitos e técnica, quebrada em 6–8 tasks independentes.
   >   Custa dias, e é o que protege mudança que toca contrato de API, schema ou regra de negócio.
   > - **Hotfix** — sai de `main` sem passar por `dev`, com verificação pós-deploy bloqueante. Só
   >   com faturamento parado ou dado corrompendo em produção agora.

   Keep it under ~25 lines. Data models, file lists, step-by-step → stop, that's spec.

4. **The body is the artifact**, and the issue is team-visible — nothing lands on it by inertia. Show repo, title and the full body in the message — the tool renders no long body — and then run the *artefato* set from `## Como perguntar e como aprovar`. *Ajustar* returns here with the correction; *Rejeitar* leaves the board untouched and says so.

5. **Publish** (body via scratchpad file).

   Criar:
   ```
   gh issue create --repo <owner>/<repo> --title "..." --body-file <file> --assignee @me
   gh project item-add <project> --owner <owner> --url <issue-url> --format json
   ```

   Promover (issue already exists and is already on the board):
   ```
   gh issue edit <n> --repo <owner>/<repo> --body-file <file> --add-assignee @me
   gh api graphql -f query='{repository(owner:"<owner>",name:"<repo>"){issue(number:<n>){projectItems(first:10){nodes{id project{number}}}}}}'
   # usar o node com project.number == <project>
   ```

   Then, both modes — Status to Backlog, and the fields the route/module decision just produced (skip a field that is already right):
   ```
   gh project item-edit --project-id <project-id> --id <item-id> \
     --field-id <field:Status> --single-select-option-id <opt:Status=Backlog>   # Status=📋 Backlog
   gh project item-edit --project-id <project-id> --id <item-id> \
     --field-id <field:Modulo> --single-select-option-id <módulo>
   gh project item-edit --project-id <project-id> --id <item-id> \
     --field-id <field:Rota> --single-select-option-id <rota>
   ```
   Missing `project` scope → `! gh auth refresh -s project`.

6. **Report** the issue URL + board placement. Offer exactly one follow-up, by route: rota completa → "Quer já detalhar pra implementação? (`/gm-spec #<issue>`)"; rota curta → "A rota curta pula a spec longa, mas o parágrafo ainda passa pelo gate: `/gm-spec #<issue>`"; hotfix → "`/gm-hotfix #<issue>`".

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
