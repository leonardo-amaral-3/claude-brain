---
name: gm-triage
description: Turn a raw report — a hospital's message, a stack trace, a loose idea — into qualified demand at the door of the team board (the team board declared in the workspace CLAUDE.md). Classifies type/severity/class/module with written criteria, deduplicates against open and closed issues before creating anything, fills the template for the type, records origin and requester, and parks the card in 📥 Triagem. Also routes away what is not demand. Use whenever something arrives from outside the board, before gm-card.
disable-model-invocation: true
model: claude-sonnet-5-5
argument-hint: [relato bruto — cole a mensagem, o erro ou a ideia]
---

# Triagem — a porta do board

Mission: **the board is born clean at the door.** Everything that gets in is typed, deduplicated and traceable back to whoever asked; everything that is not demand is answered or routed, never parked "por precaução".

Station 📥 Triagem, SLA 2 days. This skill does not decide *what done means* — that is G1, one station later, in `gm-card`.

## Como perguntar e como aprovar

This section is stamped from `_comum/convencoes.md` — the folder beside this skill's; in the
`claude-brain` repo, `skills/_comum/convencoes.md` — into every `gm-*` skill that has an interaction
point. Never edit this copy: edit the source there and run `node scripts/skills-comum.mjs` in that
repo (its `--check` catches a copy that drifted). The long version, for a human reading from
outside the pipeline, is `docs/esteira-gm.md` of the `claude-brain` repo, section
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
   The one exception is `## Modo despachado` below.

Tool limits, so a question is never rejected or silently cut: 2–4 options per question, `header`
up to 12 characters, `label` 1–5 words, "Other" appended automatically (never write it yourself).
Instructions in this file stay in English; **everything the human reads — the question, the labels
and every `description` — is written in pt-BR.**

## Hard rules

- **Dedup before create.** Never a second issue for a demand that already exists. Duplicate → comment on the existing issue with the new evidence and requester, then stop.
- **Not everything is demand.** A support question is answered; an infra incident is routed to whoever operates. "Isso não é demanda" is a legitimate, frequent outcome — creating a card for it is how a board fills with noise.
- **Origin is mandatory.** Who reported, through which channel, on what date. Without it, the release notice ("seu chamado saiu na v2026.09.15") cannot exist and the requester never learns the fix shipped.
- **No acceptance criteria here.** Triagem answers *what is this and how bad*; `gm-card` answers *what does pronto mean*. Writing criteria at the door skips the G1 conversation with the person who owns the direction.
- **No solutioning.** Do not diagnose the cause or propose a fix — record the evidence. If the report is impossible to classify without reading code, do the minimum read-only check to type it, and say what you checked.
- **Team-visible, so the human is the one who picks.** Every decision here — destino da demanda, publicar ou não — reaches the user through the choice mechanics of `## Como perguntar e como aprovar`, never as free text to type. The draft goes in the message; the *artefato* set decides what happens to it.
- Answer in pt-BR.

## Board reference — vem do workspace, nunca deste arquivo

As coordenadas do board (**project**, **owner**, **project-id**, field-ids, option-ids) e a lista de
**repos** estao na secao `## Board` do `CLAUDE.md` do workspace atual, ja carregado no seu contexto.
Use aquelas — nunca IDs escritos aqui ou lembrados de outra sessao.

**Se o CLAUDE.md do workspace nao tiver a secao `## Board`, pare e peca ao usuario.** Nao descubra
board sozinho e nao assuma o da Notoria: escrever card no board errado e pior que nao escrever.

Placeholders usados adiante: `<owner>`, `<project>`, `<project-id>`, `<repo>`, `<field:Nome>` (o
field-id do campo) e `<opt:Campo=Valor>` (o option-id da opcao).

## Step 1 — Is this demand at all?

Decide **before** writing anything:

| O que chegou | Destino |
|---|---|
| Pergunta cuja resposta encerra o assunto | responde; se exigir código, `/gm-explore`. Card ❓ Dúvida só se a resposta precisar virar conhecimento consultável do time |
| Incidente de infra (AWS fora, certificado, fila entupida) | roteia para quem opera. Card só para a **causa estrutural**, depois de estabilizado |
| Pedido de operação (rodar script, consultar banco, reprocessar) | trabalho operacional, fora da esteira — faz e reporta, sem card |
| Sistema faz o errado · falta capacidade · custo de mudar subiu | **demanda** → segue |

Ambiguous — it fits two rows, or none of them cleanly — → one `AskUserQuestion` call before
anything is written; header `Destino`, question and options in pt-BR:

> **O relato:** «<uma linha, na linguagem de quem trouxe>». Só o primeiro caminho abaixo vira card
> e gasta fila do board; os outros três resolvem sem deixar nada nele.
>
> - **É demanda, segue** — nasce card em 📥 Triagem, tipado e com origem registrada; o que conta
>   como "pronto" fica para o `/gm-card` decidir depois.
> - **Respondo e encerra** — a resposta fecha o assunto e nada vai para o board. Card ❓ Dúvida só
>   se ela precisar virar conhecimento consultável do time.
> - **Roteio para quem opera** — incidente de infra: quem opera estabiliza agora. Card depois, e
>   só para a causa estrutural, se ela existir.
> - **Faço e reporto** — pedido de operação (rodar script, consultar banco, reprocessar): sai
>   hoje, fora da esteira, e não deixa rastro no board.

Then say the choice out loud in one line ("isso é suporte, não demanda — respondi X"), so it lives
in the transcript and not only in the tool's answer.

## Step 1b — Um escopo ou vários?

A report that carries more than one point (several defects, a test run with a list, several asks in one message) is decided **before** dedup:

- **One scope** — the points share the objective in one sentence (same flow, screen or feature) and are validated together → **one** card with the label `épico` and a `## Pontos` list in the body: one line per point, in the reporter's words, with its evidence. The phases are cut by `/gm-spec`, which owns slicing.
- **Separate card** only for a point that is independent for real: another flow or module, another severity (an S1 among improvements leaves alone, by the hotfix track), another requester with another deadline.
- **In doubt, one card**: merging cards later costs more than splitting a phase.

With a human, the full list of points goes in the message and one `AskUserQuestion` call decides; header `Escopo`, question and options in pt-BR:

> O relato traz <N> pontos: <lista curta>. Abrir um card por ponto espalha um objetivo só pelo
> board, e alguém precisa reuni-los depois.
>
> - **Um card épico** — nasce um card com `## Pontos`; o `/gm-spec` corta as fases depois.
> - **Cards separados** — cada ponto é independente de verdade (outro fluxo, outra severidade ou
>   outro solicitante) e nasce sozinho.

Then dedup (Step 2) runs once per card that will be born. The épico's Severidade is the highest among its points. The label may not exist in the repo yet: `gh label list --repo <owner>/<repo> --search épico` empty → `gh label create épico --repo <owner>/<repo> --description "Um escopo com vários pontos; as fases nascem no /gm-spec"`. Publish (Step 5) passes `--label épico`.

## Step 2 — Deduplicate

Search **open and closed** issues, 2–3 keyword variations in pt-BR (omit `--state` to search both — `--state all` is not a valid value):

```
gh search issues --owner <owner> "<palavras-chave>" --limit 20
gh issue view <n> --repo <owner>/<repo> --json title,state,body,projectItems
```

- **Open match** → comment the new evidence on it (`novo relato de <origem> em <data>: …`) and report "isso já é a #X (status: Y)". If the new report raises the severity, say so and update the Severidade field. **Do not create a card.**
- **Closed and shipped** → likely regression: create a new card whose title says so and whose body links the old one ("regressão da #X, fechada em <data>").
- **Nothing found** → continue.

## Step 3 — Classify with written criteria

**Tipo**
- 🐞 **Bug** — o sistema faz o errado, quebra, ou corrompe dado.
- ❓ **Dúvida** — a pergunta é "como isso funciona hoje"; a entrega é a resposta com evidência.
- ✨ **Melhoria** — o sistema faz o certo, mas deveria fazer mais ou melhor.
- 🧰 **Débito técnico** — sem efeito visível para o usuário, mas o custo de mudar naquela área subiu.

**Severidade** — critério escrito, não sensação:
- **S1** — faturamento parado ou dado corrompido em produção. Sem workaround, ou o workaround é reparar dado à mão. → Classe 🔴 Expedite, Rota Hotfix.
- **S2** — resultado errado ou fluxo travado, **com** workaround praticável.
- **S3** — incômodo, cosmético, ou dor sem prazo.

**O calendário do SISAIH pesa na severidade.** O mesmo bug não vale o mesmo em dias diferentes do mês: o que atrapalha o fechamento da competência perto da janela de envio sobe de faixa e cai de volta depois dela. Registre isso como data, não como urgência genérica — `S2 hoje; vira S1 se não sair antes do fechamento de <competência>`. Uma severidade que sobe por calendário é 📅 Data fixa na Classe.

**Classe** — 🔴 Expedite (S1 real) · 📅 Data fixa (prazo externo: fechamento de competência, contrato, obrigação DATASUS) · ⚪ Padrão · 🔧 Intangível (débito, sem dor externa hoje).

**Módulo** — Processos · Faturamento · OCI · ERP · Comum · Cursos.

## Step 4 — Draft in pt-BR, template by type

Title: short, imperative, in the user's vocabulary (someone searching for the duplicate next month must find it).

**🐞 Bug**
```markdown
## Comportamento esperado × observado
[o que deveria acontecer vs o que acontece — com evidência concreta: nº da AIH, competência, instituição, print, trecho do log]

## Reprodução
[passos mínimos; se não foi possível reproduzir, dizer isso e o que foi tentado]

## Impacto
[quem é afetado, quantos casos, existe workaround e qual]

## Severidade
[S1 | S2 | S3 — com o critério que a justifica; se depende do calendário do SISAIH, a data que vira o jogo]

## Origem
[quem reportou · canal · data]
```

**❓ Dúvida**
```markdown
## Pergunta
[a pergunta como ela foi feita]

## Contexto
[o que motivou a dúvida — o que a pessoa estava fazendo]

## Origem
[quem perguntou · canal · data]
```

**✨ Melhoria / 🧰 Débito técnico**
```markdown
## O que chegou
[o pedido ou o incômodo, na linguagem de quem trouxe]

## Dor
[o que custa hoje — tempo, retrabalho, risco; número quando houver]

## Origem
[quem pediu · canal · data]
```

Keep it under ~20 lines. Diagnosis, direction, acceptance criteria and technical design **do not** belong here — the first two go to `gm-card`, the last to `gm-spec`.

## Step 5 — Publish

The card is the artifact. Put repo, title, the whole body and the four field values in the message
— the tool renders no long body, so whatever stays out of the message will not be read — and then
run the *artefato* set from `## Como perguntar e como aprovar`. *Ajustar* comes back here with the
correction and asks again; *Rejeitar* creates nothing, and the report says the demand was dropped
at the door.

Épico (Step 1b) → `gh issue create` also takes `--label épico`, and the body carries `## Pontos` after the report.

```
gh issue create --repo <owner>/<repo> --title "..." --body-file <file> --assignee @me
gh project item-add <project> --owner <owner> --url <issue-url> --format json
gh project item-edit --project-id <project-id> --id <item-id> \
  --field-id <field:Status> --single-select-option-id <opt:Status=Triagem>   # Status=📥 Triagem
gh project item-edit --project-id <project-id> --id <item-id> \
  --field-id <field:Tipo> --single-select-option-id <tipo>
gh project item-edit --project-id <project-id> --id <item-id> \
  --field-id <field:Severidade> --single-select-option-id <severidade>
gh project item-edit --project-id <project-id> --id <item-id> \
  --field-id <field:Classe> --single-select-option-id <classe>
gh project item-edit --project-id <project-id> --id <item-id> \
  --field-id <field:Modulo> --single-select-option-id <módulo>
```

S1 → also set Rota=Hotfix (`<opt:Rota=Hotfix>`). Missing `project` scope → `! gh auth refresh -s project`.

## Step 6 — Report and hand over

Issue URL, the classification with its justification in one line, and exactly **one** follow-up:

- **S1** → "isso é S1: `/gm-hotfix #<n>` agora — máximo 1 hotfix no sistema por vez."
- **❓ Dúvida** → "`/gm-explore #<n>` responde e fecha o card como conhecimento."
- **Everything else** → "dentro do SLA de 2 dias, qualificar com `/gm-card #<n>` (é lá que nascem os critérios de aceite)."

Nothing stays in 📥 Triagem longer than the SLA. A card parked there without a decision is exactly the demand-rot the station exists to prevent.

## Convenções de saída

This section is stamped from the same `_comum/convencoes.md` as `## Como perguntar e como aprovar`,
into every `gm-*` skill that has a closing point. Edit the source in the `claude-brain` repo and run
`node scripts/skills-comum.mjs` there — never this copy.

1. **The last line of the final answer is machine-readable**, so a dispatcher (a script, another
   session) can chain the pipeline without reading prose. Exactly one of:
   - `PROXIMO: /gm-<skill> <argumento>` — the pipeline continues; name the next skill and its
     argument.
   - `PARADA: <motivo em uma frase>` — the pipeline does not continue; one sentence, in pt-BR,
     saying what is waiting and on whom.

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
4. **With no human in the session (`claude -p`, a dispatcher), do not wait for CI and do not
   schedule a wake-up** (`ScheduleWakeup`, `/loop`), and do nothing in the background: report what
   was done and close with `PROXIMO` or `PARADA`.

## Modo despachado

This section is stamped from the same `_comum/convencoes.md` as the two above. Edit the source in
the `claude-brain` repo and run `node scripts/skills-comum.mjs` there — never this copy.

**When it applies:** no human in the session (`claude -p`, a subagent) **and** the argument hands
over the front in words ("você decide sozinho o G2, o G3, o commit e o ship"). Both, or it does not
apply: no human and no handover → item 5 of `## Como perguntar e como aprovar` (stop and report).
A human in the session → never, whatever the argument says. When it applies, it replaces item 5
for the rows marked **decide**; the rest of the skill runs as written. The argument may add stops;
it never turns a **para** into a **decide** — except the one row below that says so, and only by
naming it.

| Ponto de decisão | Exemplo (skill · header) | Despachado |
|---|---|---|
| Aprovar artefato do próprio card: critérios, card, spec, tasks, corpo da PR, comentário | `gm-card`, `gm-spec`, `gm-plan-tasks`, `gm-ship`, `gm-explore`, `gm-prd` | **decide** — Aprovar, depois da crítica que a skill exige |
| Caminho entre os que a skill oferece: rota, profundidade, recorte, escopo, abordagem | `gm-card` · `Rota`; `gm-spec` · `Profundidade`, `Recorte`; `gm-triage` · `Escopo` | **decide** pela regra da própria skill |
| Segundo revisor de spec sensível | `gm-spec` · `2º revisor` | **para** — salvo quando o argumento autoriza seguir sem ele, por nome; aí o revisor de IA independente roda igual. Workspace que declara não ter segundo humano: a pergunta nem existe |
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
