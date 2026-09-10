---
name: gm-hotfix
description: Drive a real S1 production emergency — faturamento parado or corrupted data — down the expedite rail on the team board (the team board declared in the workspace CLAUDE.md). Proves the S1 criterion and the one-at-a-time limit, opens a minimal card carrying repro + risk + the verification query, branches release/hotfix-* from main (never from dev), implements with tests, opens the PR to main with mandatory AI + human review, runs the BLOCKING post-deploy verification, tags, back-merges into dev and files the post-mortem card. Use only for a genuine S1 in production.
disable-model-invocation: true
argument-hint: [#issue do card mínimo ou descrição do incidente]
---

# Hotfix — a linha vermelha

Mission: **give the emergency a rail.** Speed buys *priority*, never a bypass of quality. What a hotfix skips: Backlog, Especificação, Validação em Dev and the release train. What it does **not** skip: review (AI + human) and the post-deploy verification.

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

- **S1 or nothing.** No S1 → say so and route back to the normal path (`/gm-triage`, `/gm-card`). "É urgente" is not S1; the criterion below is.
- **Branch from `main`, PR to `main`.** `dev` is far ahead of production (dozens of unvalidated commits). Fixing an emergency through `dev` would ship all of it alongside the fix. `pr-branch-check` already allows `release/*` into `main`.
- **Maximum 1 hotfix in the system.** Two simultaneous emergencies mean one of them is not S1, or production needs a rollback and not a fix.
- **Merging into `main` deploys to production immediately** (`deploy.yml`, `yarn deploy -p`), and Prisma migrations run on container boot. A hotfix carrying a migration is a hotfix that can make the incident worse, so it is never a detail decided in passing: it goes to the human as a choice, and the question is written out in `## Phase 3 — Fix, minimally, with a test` — that is the only place this decision is taken.
- **Verification is blocking.** The card cannot close without evidence in production that the fix worked. Failed → the incident is still open.
- Nothing is committed, merged or tagged unless the human chose it, and every one of those choices arrives by the mechanics of `## Como perguntar e como aprovar`: the *ação irreversível* set for the commit, for the merge into `main` and for the tag, the *artefato* set for the card body and for the release notes, hand-written options for the calls this rail takes under pressure (which emergency, whether to contain, what to do with a red verification). Never as free text to type — least of all here, where whoever is reading is in a hurry.
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

Another hotfix open → **stop**. Two emergencies at once mean one of them is not S1, and picking which is not a formality: the one that loses the rail waits. Both go in the message — number, title, what each one is bleeding and since when — and then one `AskUserQuestion` call, header `Emergência` (the tool caps `header` at 12 characters), question and options in pt-BR:

> Já existe um hotfix em voo: #<n> — <título>, <o que está parado por causa dele>, aberto há <tempo>.
> O novo é <o que está parado agora>. A linha vermelha comporta um de cada vez, então o que você
> escolhe aqui é qual dos dois fura a fila — o outro volta para a rota normal e espera o trem.
>
> - **Manter o hotfix #<n>** — o que já está em voo segue até produção; a demanda nova vai para
>   `/gm-triage` e entra pela rota normal, com o tempo de espera de um card comum.
> - **O novo é a emergência** — este assume a linha vermelha e o #<n> volta para a rota normal, com
>   o trabalho já feito preservado na branch dele. Só cabe se o que ele estanca é menor que isto.
> - **Os dois são S1 de verdade** — então produção está pior do que um hotfix resolve: o caminho é
>   avaliar rollback do que subiu por último, em vez de consertar duas coisas em paralelo às pressas.

**Contain first, fix second.** This is the decision taken at the worst moment of the whole rail — the incident is open, and containing feels like a detour when the fix is what everyone wants. Name the containment that can actually be applied now (disable an entry point, pause a queue, block the affected instituição), say what it costs while it is on, and then one `AskUserQuestion` call, header `Contenção`, question and options in pt-BR:

> Dá para estancar agora, antes de qualquer código: <a contenção concreta>. Enquanto ela estiver de
> pé, <o que para de funcionar para o usuário>. Sem ela, o estrago cresce <a que ritmo — por AIH,
> por competência, por minuto>.
>
> - **Conter agora** — o sangramento para em minutos e a correção deixa de ser corrida contra o
>   relógio: dá para escrever o teste e revisar o diff sem pressa. Fica registrado no card que foi
>   feito, e é isso que a revisão vai ler para saber que o tempo existia.
> - **Ir direto para a correção** — nada é contido; o dado segue sendo afetado enquanto o fix é
>   escrito, revisado, mergeado e deployado. Só cabe quando a contenção custa mais que o incidente.
> - **Não há contenção possível** — medido, não presumido: <por que não há>. O fix vira a única
>   saída, e isso vai escrito no card, porque muda o que se pode esperar do tempo de resposta.

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

The card is the only anchor this emergency will ever have — the PR points at it, the blocking verification is registered on it and the post-mortem is written from it. It goes **whole** in the message, the body exactly as it will be posted, and the decision comes back through the *artefato* set from `## Como perguntar e como aprovar`. *Aprovar* → run the commands below with that body, unchanged. *Ajustar* → fix what the human named (a contenção que foi feita e ficou de fora, uma verificação que não provaria nada) and show it again. *Rejeitar* → nothing is created, and the report says so plainly: um hotfix sem card não deixa nada para o post-mortem ler.

```
gh issue create --repo <owner>/<repo> --title "..." --body-file <file>
gh project item-add <project> --owner <owner> --url <issue-url> --format json
# Status=<opt:Status=Implementacao> · Tipo=<opt:Tipo=Bug> · Severidade=<opt:Severidade=S1>
# Classe=<opt:Classe=Expedite> · Rota=<opt:Rota=Hotfix> · Módulo=<opt:Modulo=...>
gh project item-edit --project-id <project-id> --id <item-id> \
  --field-id <field-id> --single-select-option-id <option-id>
```

The hotfix goes straight to 🔨 Implementação — it skips 📋 Backlog and 🎯 Especificação by design.

## Phase 2 — Branch from `main`, in a worktree of its own

Urgency buys priority, never a bypass: the hotfix branch lives in a worktree at
`<workspace>/<repo>-<n>-<slug>` — sibling to the repo, inside the workspace prefix — exactly like a
feature card (`gm-implement`, `## Guarantee the branch`). Under pressure it earns its keep twice:
whatever was open in the main checkout is neither disturbed nor dragged into the fix.

```
git fetch origin
git status                       # no checkout principal: o que estiver aberto ali fica ali, e você diz isso em voz alta
git worktree add <workspace>/<repo>-<n>-<slug> -b release/hotfix-<n>-<slug> origin/main
cd <workspace>/<repo>-<n>-<slug>
```

Confirm out loud that the base is `origin/main` and show how far ahead `dev` is (`git log --oneline origin/main..origin/dev | wc -l`) — that number is the reason this branch does not come from `dev`. **Every `git` command from here to the end of Phase 5 runs inside the worktree**, and every `gh` keeps `--repo <owner>/<repo>` explicit.

## Phase 3 — Fix, minimally, with a test

- **Smallest diff that stops the incident.** No refactor, no cleanup, no "já que estou aqui". Anything extra is a card in Triagem.
- **A test that reproduces the failure** and goes green with the fix. Impossible to test in the time available → say so explicitly and record why in the PR; that becomes a follow-up card, not a silent gap.
- **A migration or a data-repair script inside the hotfix is a decision, not a line in the diff** — this is the point the hard rule above sends here. Name what it does (which table, how much data, whether it rewrites or only adds) and how it would be undone, then one `AskUserQuestion` call, header `Migration`, question and options in pt-BR:

  > Esta correção carrega <a migration/o script, pelo nome e o que faz, contra quanto dado>. Ela roda
  > sozinha no boot do contêiner assim que o merge acontecer, sobre o dado de produção que está sendo
  > escrito agora, e sem ensaio nenhum — o hotfix pula a validação em dev por definição. Se ela
  > reescrever dado errado, o incidente fica maior do que já é.
  >
  > - **Subir com a migration** — o hotfix sobe inteiro e a migration roda em produção no deploy.
  >   Exige o rollback escrito de antemão, porque `git revert` do merge devolve o código e **não**
  >   devolve o dado que ela já reescreveu.
  > - **Separar a migration** — sobe hoje só a parte de código que estanca o incidente; a migration
  >   vira card próprio e passa pela esteira normal, com ensaio. Estanca menos agora, não arrisca o dado.
  > - **Parar e reavaliar** — nada sobe ainda. É o caminho quando não dá para dizer com segurança o
  >   que a migration toca; a contenção da fase 0 é o que segura o incidente enquanto se mede.

  Repair scripts must be idempotent whichever path is chosen: production keeps receiving data while you work.
- Run the relevant suite **before** presenting. Present a risk-ranked script ("confira X, que é a decisão delicada"), not a changelog. Then the commit — the first step that leaves a mark outside this session — goes to the human by the *ação irreversível* set from `## Como perguntar e como aprovar`: header `Commit`, options in pt-BR, and the physical consequence written into each `description`, never a bare verb.

  > - **Executar o commit** — <n> arquivos entram na branch `release/hotfix-<n>-<slug>` com o trailer
  >   `Card: #<n>`. O commit é local até o `git push` da fase 4; é exatamente isto que a PR para a
  >   `main` vai carregar.
  > - **Revisar antes de executar** — nada é gravado; volto com o diff do trecho que você apontar e
  >   pergunto de novo. Custa minutos, e o incidente segue aberto durante eles.
  > - **Cancelar** — nada é gravado. O código fica na árvore de trabalho, sem commit e sem PR, e
  >   produção continua exatamente como está agora, com o incidente de pé.

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

1. The merge is this rail's point of no return **and the only gate that happens in this session** — the human review of Phase 4 happens on GitHub, not here. So it goes to the human by the *ação irreversível* set from `## Como perguntar e como aprovar`: header `Merge`, options in pt-BR, and the physical consequence written into each `description`, never a bare verb.

   > - **Mergear e subir** — produção passa a rodar este código em minutos: o merge em `main` dispara
   >   o `deploy.yml` (`ENVIRONMENT=prod`) sozinho e as migrations rodam no boot do contêiner. **Não
   >   existe passo manual entre o merge e produção**, e desfazer é outro deploy, não um botão.
   > - **Revisar antes de mergear** — nada é mergeado agora; volto com o que você apontar (o diff, o
   >   resultado do CI, a revisão humana que ainda não veio) e pergunto de novo. O incidente segue aberto.
   > - **Cancelar** — nada sobe. A PR fica aberta, o card segue em 👀 Revisão e produção continua com
   >   o bug de pé — escolha legítima se o risco da correção passou a parecer maior que o do incidente.

   Only *Mergear e subir* continues to step 2.
2. Wait for the deploy to finish: `gh run list --repo <owner>/<repo> --branch main --limit 3`.
3. **Run the card's verification query in production.** Show the result.
   - Green → continue.
   - Red → the incident is **not** over, and saying that plainly comes first. The fix is already in
     production, so the question is no longer whether to act but which way out: what the query
     returned goes in the message, against what the card expected, and then one `AskUserQuestion`
     call, header `Verificação`, question and options in pt-BR:

     > A verificação pós-deploy voltou vermelha: <o que a query devolveu> contra <o que o card
     > esperava>. A correção já está em produção e o incidente continua aberto — <o dado ainda está
     > sendo afetado agora / o estrago parou de crescer, mas não foi desfeito>.
     >
     > - **Reverter o merge** — produção volta ao código anterior em minutos (`git revert` do merge
     >   commit + redeploy), o que significa voltar ao estado de antes, **com o bug original de pé**.
     >   Migration já aplicada não volta junto: se ela reescreveu dado, o dado fica como está.
     > - **Segunda correção por cima** — o código fica no ar e um diff novo sobe pela mesma branch de
     >   hotfix. Mais lento que reverter, e é o único caminho quando o estrago está no dado.
     > - **Medir antes de escolher** — nada é feito ainda; sigo investigando e volto com o
     >   diagnóstico. Só cabe se o dado não está sendo corrompido enquanto você espera.
4. Register the verification as a comment on the card, with the output — this is the evidence G5 demands.

## Phase 6 — Tag

Production is named, hotfixes included (a repository with zero tags is one of the measured failures this rail exists to end):

1. **The notes are the artifact**, and here they carry an incident: the technical line plus one
   sentence of "o que muda para você", written for whoever felt the bug. Both go **whole** in the
   message, exactly as they will be published, and the decision comes back through the *artefato*
   set from `## Como perguntar e como aprovar`. *Ajustar* → rewrite what the human named and show
   them again. *Rejeitar* → nothing is tagged and nothing is published, and the report says the fix
   is in production without a name.
2. Then the tag and the publication go to the human by the *ação irreversível* set from
   `## Como perguntar e como aprovar`: header `Tag`, options in pt-BR, and the physical consequence
   written into each `description`.

   > - **Publicar a release** — a tag `v<AAAA.MM.DD>` é empurrada para o GitHub e a release fica
   >   pública com estas notas. É ela que responde "o que subiu quando" e o que o post-mortem vai
   >   citar; quem reportou é avisado por este nome. Apagar depois exige mexer em tag pública.
   > - **Revisar antes de publicar** — nada é empurrado; volto com o que você apontar (o texto para
   >   quem reportou, o calver do dia) e pergunto de novo. O incidente já está estancado.
   > - **Cancelar** — nada é publicado. A correção fica em produção sem nome: o campo **Release**
   >   do card fica vazio e o post-mortem não tem o que citar.

   Only *Publicar a release* runs the commands below.

Os comandos abaixo rodam **no checkout principal**, não na worktree do hotfix — e a troca de
diretório é justamente o que passa despercebido às pressas. Dentro da worktree, `git checkout main`
ou é recusado (se `main` já estiver aberta no checkout principal) ou troca a branch por baixo do
hotfix que você acabou de subir.

```
cd <checkout-principal>
git checkout main && git pull
git tag -l 'v*' | tail -5                       # calver do dia já existe? sufixe .1, .2
git tag -a v<AAAA.MM.DD> -m "hotfix #<n>: <título>"
git push origin v<AAAA.MM.DD>
gh release create v<AAAA.MM.DD> --repo <owner>/<repo> --title "..." --notes-file <file>
```

Write the tag into the card's **Release** field (`<field:Release>`, `--text v<AAAA.MM.DD>`) and move the card to ✅ Produção (`<opt:Status=Producao>`).

## Phase 7 — Back-merge into `dev` (never skipped)

Without this, the next release re-deploys the bug over the fix. Still in the main checkout — the
back-merge is another branch, and it never belonged to the hotfix worktree.

```
git checkout -b chore/backmerge-hotfix-<n> origin/main
git push -u origin chore/backmerge-hotfix-<n>
gh pr create --repo <owner>/<repo> --base dev --title "chore: back-merge do hotfix #<n>" \
  --body "Traz para a dev o hotfix #<n> mergeado na main. Card: #<n>"
```

Conflicts with work in flight on `dev` are the normal case here, not the exception — the fix touched code someone else is editing. A back-merge left for later is a back-merge that never happens, so postponing is not the silent default: name the conflicting files and whose work is on the other side, then one `AskUserQuestion` call, header `Conflito`, question and options in pt-BR:

> Enquanto o back-merge não entrar, a `dev` segue carregando o bug que produção já não tem — e o
> próximo release re-deploya esse bug por cima da correção. Ele conflita em <arquivos>, contra
> <o trabalho em voo na `dev`>.
>
> - **Resolver agora, junto** — conflito a conflito, nesta sessão, com você decidindo cada lado. O
>   hotfix já está em produção, então o que está em jogo é o tempo desta sessão, não o incidente.
> - **Resolver eu e apresentar** — resolvo, mostro cada decisão de merge e você confere antes de
>   subir. Mais rápido, e o risco é eu escolher errado num arquivo que você conhece melhor.
> - **Abrir a PR conflitante** — a PR do back-merge sobe marcada como conflitante, para quem escreveu
>   o outro lado resolver. Só cabe se essa pessoa existe e vai olhar hoje; senão, é o back-merge que
>   nunca acontece.

With the back-merge PR open, the incident has no more code to write, so the hotfix worktree goes —
from outside it, `git worktree remove <workspace>/<repo>-<n>-<slug>` plus `git worktree prune`.
A refusal means uncommitted or untracked files are still in there: read it, never `--force` past
it. Under pressure is exactly where a diff nobody remembered to push gets thrown away.

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
