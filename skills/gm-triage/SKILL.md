---
name: gm-triage
description: Turn a raw report — a hospital's message, a stack trace, a loose idea — into qualified demand at the door of the team board (the team board declared in the workspace CLAUDE.md). Classifies type/severity/class/module with written criteria, deduplicates against open and closed issues before creating anything, fills the template for the type, records origin and requester, and parks the card in 📥 Triagem. Also routes away what is not demand. Use whenever something arrives from outside the board, before gm-card.
disable-model-invocation: true
argument-hint: [relato bruto — cole a mensagem, o erro ou a ideia]
---

# Triagem — a porta do board

Mission: **the board is born clean at the door.** Everything that gets in is typed, deduplicated and traceable back to whoever asked; everything that is not demand is answered or routed, never parked "por precaução".

Station 📥 Triagem, SLA 2 days. This skill does not decide *what done means* — that is G1, one station later, in `gm-card`.

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

- **Dedup before create.** Never a second issue for a demand that already exists. Duplicate → comment on the existing issue with the new evidence and requester, then stop.
- **Not everything is demand.** A support question is answered; an infra incident is routed to whoever operates. "Isso não é demanda" is a legitimate, frequent outcome — creating a card for it is how a board fills with noise.
- **Origin is mandatory.** Who reported, through which channel, on what date. Without it, the release notice ("seu chamado saiu na v2026.09.15") cannot exist and the requester never learns the fix shipped.
- **No acceptance criteria here.** Triagem answers *what is this and how bad*; `gm-card` answers *what does pronto mean*. Writing criteria at the door skips the G1 conversation with the person who owns the direction.
- **No solutioning.** Do not diagnose the cause or propose a fix — record the evidence. If the report is impossible to classify without reading code, do the minimum read-only check to type it, and say what you checked.
- Team-visible: show the draft and publish only on explicit approval.
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

Ambiguous → ask the user, don't guess. Report the decision explicitly ("isso é suporte, não demanda — respondi X") so the choice is visible.

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

Show repo + title + body + the four fields, and publish only on explicit approval.

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
