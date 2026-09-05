---
name: gm-hotfix
description: Drive a real S1 production emergency — faturamento parado or corrupted data — down the expedite rail on the team board (the team board declared in the workspace CLAUDE.md). Proves the S1 criterion and the one-at-a-time limit, opens a minimal card carrying repro + risk + the verification query, branches release/hotfix-* from main (never from dev), implements with tests, opens the PR to main with mandatory AI + human review, runs the BLOCKING post-deploy verification, tags, back-merges into dev and files the post-mortem card. Use only for a genuine S1 in production.
disable-model-invocation: true
argument-hint: [#issue do card mínimo ou descrição do incidente]
---

# Hotfix — a linha vermelha

Mission: **give the emergency a rail.** Speed buys *priority*, never a bypass of quality. What a hotfix skips: Backlog, Especificação, Validação em Dev and the release train. What it does **not** skip: review (AI + human) and the post-deploy verification.

## Hard rules

- **S1 or nothing.** No S1 → say so and route back to the normal path (`/gm-triage`, `/gm-card`). "É urgente" is not S1; the criterion below is.
- **Branch from `main`, PR to `main`.** `dev` is far ahead of production (dozens of unvalidated commits). Fixing an emergency through `dev` would ship all of it alongside the fix. `pr-branch-check` already allows `release/*` into `main`.
- **Maximum 1 hotfix in the system.** Two simultaneous emergencies mean one of them is not S1, or production needs a rollback and not a fix.
- **Merging into `main` deploys to production immediately** (`deploy.yml`, `yarn deploy -p`), and Prisma migrations run on container boot. A hotfix carrying a migration is a hotfix that can make the incident worse — flag it explicitly and get a decision before merging.
- **Verification is blocking.** The card cannot close without evidence in production that the fix worked. Failed → the incident is still open.
- Nothing is committed, merged or tagged without explicit human approval.
- Answer in pt-BR.

## Board reference — vem do workspace, nunca deste arquivo

As coordenadas do board (**project**, **owner**, **project-id**, field-ids, option-ids) e a lista de
**repos** estao na secao `## Board` do `CLAUDE.md` do workspace atual, ja carregado no seu contexto.
Use aquelas — nunca IDs escritos aqui ou lembrados de outra sessao.

**Se o CLAUDE.md do workspace nao tiver a secao `## Board`, pare e peca ao usuario.** Nao descubra
board sozinho e nao assuma o da Notoria: escrever card no board errado e pior que nao escrever.

Placeholders usados adiante: `<owner>`, `<project>`, `<project-id>`, `<repo>`, `<field:Nome>` (o
field-id do campo) e `<opt:Campo=Valor>` (o option-id da opcao).

## Phase 0 — Prove the rail applies

**S1 criterion** (needs at least one, in **production**):
- faturamento parado — não é possível fechar, consistir, transmitir ou apresentar a competência; ou
- dado corrompido — o sistema gravou algo errado que exige reparo, e cada minuto aberto amplia o estrago.

Sem workaround praticável, ou o workaround **é** reparar dado à mão.

Not S1: erro em dev, erro com workaround, lentidão sem prazo, bug feio numa tela. Say it plainly and offer the normal route.

**One at a time** — check the board before anything:

```
gh project item-list <project> --owner <owner> --limit 200 --format json \
  --jq '.items[] | select(.rota=="Hotfix") | select(.status!="✅ Produção") | {number:.content.number,title:.title,status}'
```

Another hotfix open → **stop**. Show it and ask which of the two is the real emergency; the other goes back to the normal route.

**Contain first, fix second.** If there is a way to stop the bleeding now (disable an entry point, pause a queue, block the affected instituição), propose it before writing code, and record in the card that it was done — the fix stops being a race.

## Phase 1 — Minimal card

The argument may already be an issue (from `/gm-triage`). Otherwise create one — the emergency still gets an anchor, because review and verification need something to point at.

```markdown
## O que está acontecendo em produção
[o efeito visível, com evidência: instituição, competência, nº AIH, log, horário de início]

## Reprodução
[o mínimo que reproduz — ou "não reproduzido; evidência é <x>"]

## Contenção
[o que já foi feito para parar o sangramento, ou "nenhuma"]

## Risco da correção
[o que o fix toca, o que pode quebrar junto, se carrega migration ou tratamento de dados]

## Verificação pós-deploy
[a query/checagem que PROVA em produção que acabou — obrigatória; o hotfix pula a spec, não a prova]

## Origem
[quem reportou · canal · data e hora]
```

Publish (show first, approve, then):

```
gh issue create --repo <owner>/<repo> --title "..." --body-file <file>
gh project item-add <project> --owner <owner> --url <issue-url> --format json
# Status=<opt:Status=Implementacao> · Tipo=<opt:Tipo=Bug> · Severidade=<opt:Severidade=S1>
# Classe=<opt:Classe=Expedite> · Rota=<opt:Rota=Hotfix> · Módulo=<opt:Modulo=...>
gh project item-edit --project-id <project-id> --id <item-id> \
  --field-id <field-id> --single-select-option-id <option-id>
```

The hotfix goes straight to 🔨 Implementação — it skips 📋 Backlog and 🎯 Especificação by design.

## Phase 2 — Branch from `main`

Git runs **inside the module repo directory** (nested git repository — never from the workspace root).

```
git fetch origin
git status                       # árvore suja → pare e mostre
git checkout -b release/hotfix-<n>-<slug> origin/main
```

Confirm out loud that the base is `origin/main` and show how far ahead `dev` is (`git log --oneline origin/main..origin/dev | wc -l`) — that number is the reason this branch does not come from `dev`.

## Phase 3 — Fix, minimally, with a test

- **Smallest diff that stops the incident.** No refactor, no cleanup, no "já que estou aqui". Anything extra is a card in Triagem.
- **A test that reproduces the failure** and goes green with the fix. Impossible to test in the time available → say so explicitly and record why in the PR; that becomes a follow-up card, not a silent gap.
- Migration or data-repair script in the hotfix → flag it, describe rollback, and get an explicit decision. Repair scripts must be idempotent: production keeps receiving data while you work.
- Run the relevant suite **before** presenting. Present a risk-ranked script ("confira X, que é a decisão delicada"), not a changelog. Commit only after explicit approval, message ending with the trailer `Card: #<n>`.

## Phase 4 — PR to `main` (review is not skipped)

```
git push -u origin release/hotfix-<n>-<slug>
gh pr create --repo <owner>/<repo> --base main --title "hotfix: ..." --body-file <file>
```

Body — first line literal, machine-read by the CI review; never `Closes`:

```markdown
**Card:** #<n>

## Incidente
[o efeito em produção e desde quando]

## Correção
[o que muda, em 2–5 linhas, e por que é o menor diff possível]

## Risco
[o que pode quebrar junto · carrega migration? · como reverter]

## Verificação pós-deploy (bloqueante)
[a query/checagem do card, pronta para colar]

## Teste
[o teste que reproduz a falha e ficou verde — ou por que não há]
```

Move the card to 👀 Revisão (`<opt:Status=Revisao>`). **Wait for a human review** — the AI review comments on its own; the human approval is the one that gates the merge. An emergency does not merge on one pair of eyes.

## Phase 5 — Merge, deploy, verify (blocking)

1. Merge into `main` → `deploy.yml` deploys production (`ENVIRONMENT=prod`); migrations apply on container boot.
2. Wait for the deploy to finish: `gh run list --repo <owner>/<repo> --branch main --limit 3`.
3. **Run the card's verification query in production.** Show the result.
   - Green → continue.
   - Red → the incident is **not** over. Say it plainly, evaluate rollback (revert the merge commit and redeploy) before attempting a second fix.
4. Register the verification as a comment on the card, with the output — this is the evidence G5 demands.

## Phase 6 — Tag

Production is named, hotfixes included (a repository with zero tags is one of the measured failures this rail exists to end):

```
git checkout main && git pull
git tag -l 'v*' | tail -5                       # calver do dia já existe? sufixe .1, .2
git tag -a v<AAAA.MM.DD> -m "hotfix #<n>: <título>"
git push origin v<AAAA.MM.DD>
gh release create v<AAAA.MM.DD> --repo <owner>/<repo> --title "..." --notes-file <file>
```

Notes carry both audiences: the technical line and one sentence of "o que muda para você". Write the tag into the card's **Release** field (`<field:Release>`, `--text v<AAAA.MM.DD>`) and move the card to ✅ Produção (`<opt:Status=Producao>`).

## Phase 7 — Back-merge into `dev` (never skipped)

Without this, the next release re-deploys the bug over the fix.

```
git checkout -b chore/backmerge-hotfix-<n> origin/main
git push -u origin chore/backmerge-hotfix-<n>
gh pr create --repo <owner>/<repo> --base dev --title "chore: back-merge do hotfix #<n>" \
  --body "Traz para a dev o hotfix #<n> mergeado na main. Card: #<n>"
```

Conflicts with work in flight on `dev` → resolve **now**, with the user; a back-merge left for later is a back-merge that never happens.

## Phase 8 — Post-mortem card

Mandatory, in 📥 Triagem, asking the only question that improves the system:

```markdown
## Incidente
[o que aconteceu, hotfix #<n>, quanto tempo aberto]

## Qual gate deveria ter pego isso?
[G1 critérios · G2 spec criticada · G3 teste no DoD · G4 revisão da PR · G5 validação/verificação — e por que não pegou]

## Ajuste proposto no gate
[o que muda na skill, no checklist ou na política — o alvo é o gate, nunca a pessoa]
```

Then report: PR, tag, verification output, back-merge PR and post-mortem card. Offer exactly one follow-up: "`/gm-triage` para o post-mortem virar ajuste de gate na retro."
