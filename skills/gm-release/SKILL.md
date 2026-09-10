---
name: gm-release
description: Cut the release train from the team board (the team board declared in the workspace CLAUDE.md) — read the validated queue in 🚂 Release, reconcile it against what is actually merged in dev, classify the train as trivial or sensitive (migrations / data treatment), open the dev→main PR, tag with calver, publish dual release notes, run the BLOCKING post-deploy verification for sensitive cards, move the cards to ✅ Produção and produce the list of requesters to notify. Use on the weekly train day, or whenever promoting dev to production.
disable-model-invocation: true
argument-hint: [vazio para o trem de hoje | dry-run]
---

# Release — o trem

Mission: turn release from a rare, scary event into a **Tuesday routine** — named, verified and communicated. A merge without a name is the reason nobody can answer "o que subiu quando"; a tag and a changelog answer it for free, forever.

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

- **The queue is what was validated; the diff is what actually ships.** Reconcile the two before anything else. Work merged into `dev` that never passed 🧪 Validação em Dev rides the same train — surface it, never let it board silently.
- **A sensitive train does not promote on hope.** Migration or data treatment → it needs the release environment (clone of prod). That environment does not exist yet (Fase 3). No pretending: stop and put the three ways out to the human as a choice — the question is written out in `## Phase 3 — Ensaio`, and that is the only place this decision is taken — then **record the chosen one in the release notes**.
- **Verification is blocking** for every card whose spec has a `## Verificação pós-deploy`. Red → the release is not done; it is an incident.
- Merging into `main` deploys production immediately (`deploy.yml`, `yarn deploy -p`) and applies Prisma migrations on container boot. There is no manual step between merge and production.
- Nothing is merged, tagged or published unless the human chose it, and every one of those choices arrives by the mechanics of `## Como perguntar e como aprovar`: the *ação irreversível* set for the merge and the tag, the *artefato* set for the PR body and the release notes, hand-written options for everything else. Never as free text for the human to type.
- `dry-run` argument → run every read-only step, print the whole plan (payload, notes, notification list), change nothing.
- Answer in pt-BR.

## Board reference — vem do workspace, nunca deste arquivo

As coordenadas do board (**project**, **owner**, **project-id**, field-ids, option-ids) e a lista de
**repos** estao na secao `## Board` do `CLAUDE.md` do workspace atual, ja carregado no seu contexto.
Use aquelas — nunca IDs escritos aqui ou lembrados de outra sessao.

**Se o CLAUDE.md do workspace nao tiver a secao `## Board`, pare e peca ao usuario.** Nao descubra
board sozinho e nao assuma o da Notoria: escrever card no board errado e pior que nao escrever.

Placeholders usados adiante: `<owner>`, `<project>`, `<project-id>`, `<repo>`, `<field:Nome>` (o
field-id do campo) e `<opt:Campo=Valor>` (o option-id da opcao).

## Phase 1 — Read the queue and reconcile with reality

1. The train's queue, plus the column right before it (that is where caronas usually have a name):

   ```
   gh project item-list <project> --owner <owner> --limit 200 --format json \
     --jq '.items[] | select(.status=="🚂 Release" or .status=="🧪 Validação em Dev")
           | {n:.content.number, repo:.content.repository, status, rota, titulo:.title}'
   ```

   (`item-list` keys are the lowercased field titles: `status`, `rota`, `tipo`, `severidade`, `classe`, `módulo`, plus `id` and `content`. A field that was never set is simply absent.)

2. Actual payload (inside the module repo):

   ```
   git fetch origin
   git log --oneline origin/main..origin/dev | wc -l
   gh pr list --repo <owner>/<repo> --base dev --state merged --limit 100 \
     --json number,title,mergedAt,body --jq '.[] | select(.mergedAt > "<data-da-última-tag-ou-corte>")'
   ```

3. **Reconcile and report the three sets, explicitly:**
   - cards in 🚂 Release **and** in the diff → the intended train;
   - cards in 🚂 Release **without** code in the diff → not ready, take them off the column;
   - code in the diff **without** a validated card → *carona*: unvalidated work riding along. The
     **full** list goes in the message first — card by card, or commit by commit when there is no
     card, saying what each one touches — and then the decision is taken **one carona at a time**:
     one `AskUserQuestion` call per item, header `Carona <k>/<N>` (`Carona 2/5` — the tool caps
     `header` at 12 characters, so keep the counter numeric), question and options in pt-BR:

     > `<PR/commit>` — <o que é> — toca <o quê>. Não passou por 🧪 Validação em Dev: ninguém
     > conferiu em ambiente nenhum que isto funciona, e mesmo assim já está na `dev`, dentro do payload.
     >
     > - **Aceitar a carona** — sobe junto no trem de hoje e sai anunciada nas release notes, com o
     >   registro de que subiu sem validação. Se quebrar em produção, quebra sem ninguém ter conferido.
     > - **Segurar o trem** — nada sobe hoje, nem os cards validados: eles esperam esta carona ser
     >   validada ou revertida da `dev`.
     > - **Reverter da `dev`** — a carona sai do payload (`git revert` na `dev`) e o resto do trem
     >   parte hoje. O trabalho revertido volta para quem o escreveu; não se perde.

     This is what rule 4 of `## Como perguntar e como aprovar` exists for: N caronas never get cut
     down to fit one menu of four. The list stays whole in the message, the loop gets longer instead
     of wider, and `multiSelect` is out by rule 2 — a batch would settle the fifth carona while
     nobody had yet looked at the first.

   With production far behind `dev`, the third set is the normal case, not the exception. Never omit it.

## Phase 2 — Classify the train

**Sensitive** if the payload contains any of:

```
git diff --name-only origin/main...origin/dev -- 'prisma/migrations/**' | sort -u
git diff --name-only origin/main...origin/dev | grep -iE 'scripts/|seed|backfill|tratamento' | sort -u
git diff --stat origin/main...origin/dev -- 'prisma/schema.prisma'
```

…or any card in the train whose spec declares a migration, a data treatment, or a `## Verificação pós-deploy` that is not `N/A`.

**Trivial** = none of the above. Trivial promotes straight through.

For a sensitive train, list every migration by name and say what each does — a train carrying accumulated migrations against a 10 GB table is the difference between a Tuesday and an outage.

## Phase 3 — Ensaio (sensitive trains only)

The design calls for a **release environment**: prod snapshot restored into a `release` stack, accumulated migrations plus the data treatment run there, and acceptance queries comparing faturamento before and after. Only what passes gets promoted.

**That environment does not exist yet** (Fase 3 of the rollout: CDK stack with `ENVIRONMENT=release` + RDS snapshot). Do not pretend it happened. Stop: name every migration and data treatment in the payload in the message — what each one does, against which table, how much data — and then one `AskUserQuestion` call, header `Ensaio` (the tool caps `header` at 12 characters), question and options in pt-BR:

> Este trem carrega <as migrations/tratamentos, pelo nome>, e o ambiente de ensaio — a cópia de
> produção onde isto rodaria antes de valer — ainda não existe. Não há como provar hoje como a
> migration se comporta contra o dado real; o que você escolhe aqui é o que fazer sem essa prova.
>
> - **Segurar o trem** — nada sobe; os cards ficam em 🚂 Release até a stack de ensaio existir.
>   É o caminho correto quando o trem toca faturamento ou reescreve dado.
> - **Partir o trem** — a parte trivial sobe hoje por uma branch `release/<data>` (cherry-pick a
>   partir de `origin/main`; o `pr-branch-check` aceita `release/*` em `main`) e os cards sensíveis
>   ficam parados. Sobe menos, e o que sobe não carrega migration.
> - **Promover assumindo o risco** — a migration roda direto em produção, sobre dado que ninguém
>   testou antes. Exige rollback ensaiado de antemão, e fica registrado por escrito que subiu assim.

*Promover assumindo o risco* → the sentence goes verbatim into the release notes and into every
affected card: `promovido sem ensaio em ambiente release — decisão registrada na PR do trem #<pr> em
<AAAA-MM-DD>`. It names the PR and the date, not a person: a choice hands back a label and no
identity, and the train PR carries the identity better anyway — whoever approved and merged it is
recorded by GitHub, checkable months later, which a name typed into release notes never is.

Never argue one option into being the obvious one. When the train touches data or faturamento, say
in the message that holding or splitting is what the design recommends — as information, before the
call, never as pressure inside it.

## Phase 4 — Open the train PR

```
gh pr create --repo <owner>/<repo> --base main --head dev --title "release v<AAAA.MM.DD>" --body-file <file>
```

```markdown
## Trem v<AAAA.MM.DD>

### Cards validados
- #<n> — <título> (<módulo>)

### Carona (sem card validado)
- <PR/commit> — <o que é> — decisão: <segurar | reverter da dev | aceito, sem validação>

### Migrations
- <nome-da-migration> — <o que faz> — <destrutiva? janela de risco?>
- (ou "nenhuma")

### Ensaio
[resultado no ambiente release · ou "não ensaiado — <opção escolhida na fase 3>"]

### Verificação pós-deploy (bloqueante)
- #<n> — <query/checagem tirada da spec do card>
```

The body is the artifact, and it is the only place where what ships today is written down: it goes **whole** in the message — the tool renders no long body — and the decision comes back through the *artefato* set from `## Como perguntar e como aprovar`. *Aprovar* → open the PR with that body, exactly as shown. *Ajustar* → fix what the human named (a carona missing from the list, a migration described as harmless when it is not) and present it again. *Rejeitar* → no PR, and the train does not leave the station today. Check CI green (`gh pr checks`) before proposing the merge — and remember that a red check does not physically block the merge in these repos, so a green CI is **your** responsibility to confirm.

## Phase 5 — Merge, deploy, verify

1. The merge is this skill's point of no return, so it goes to the human by the *ação irreversível* set from `## Como perguntar e como aprovar`: header `Merge` (12-character cap), options in pt-BR, and the physical consequence written into each `description` — never a bare verb.

   > - **Mergear e subir** — o faturamento passa a rodar este código em minutos: o merge em `main`
   >   dispara o `deploy.yml` sozinho e as migrations rodam no boot do contêiner. **Não existe passo
   >   manual entre o merge e produção**, e desfazer é outro deploy, não um botão.
   > - **Revisar antes de mergear** — nada é mergeado agora; volto com o que você apontar (o diff de
   >   uma migration, o payload, o resultado do CI) e pergunto de novo.
   > - **Cancelar** — nada sobe. A PR do trem fica aberta, os cards seguem em 🚂 Release, e o
   >   trem parte outro dia.

   Only *Mergear e subir* continues to step 2.
2. Follow it: `gh run list --repo <owner>/<repo> --branch main --limit 3` and the deploy job's logs.
3. **Smoke, always:** the API answers, the web loads, migrations applied (compare the latest `prisma/migrations` folder against `_prisma_migrations` in the prod database).
4. **Blocking verification, for every sensitive card:** run the `## Verificação pós-deploy` query from its spec against production and paste the output as a comment on the card.
   - Red → **stop the closing ritual**: no tag, no notes, no card moved to ✅ Produção. The code is
     already in production by now, so the question is not whether to act but which way out — what the
     query returned goes in the message, against what the spec expected, and then one
     `AskUserQuestion` call, header `Verificação`, question and options in pt-BR:

     > A verificação pós-deploy do card #<n> voltou vermelha: <o que a query devolveu> contra <o que
     > a spec esperava>. O código já está em produção e <o dado está sendo afetado agora / o estrago
     > está parado>.
     >
     > - **Reverter o merge** — produção volta ao código anterior em minutos (`git revert` do merge
     >   commit + redeploy). Migration já aplicada **não** volta com ele: se ela reescreveu dado,
     >   reverter o código deixa o dado como está.
     > - **Consertar para frente** — o código fica no ar e a correção sobe por cima, por
     >   `/gm-hotfix` (branch `release/hotfix-*` direto em `main`). Mais lento que reverter, e é o
     >   único caminho quando o estrago está no dado.
     > - **Medir antes de escolher** — nada é feito ainda; sigo investigando e volto com o
     >   diagnóstico. Só cabe se o dado não está sendo corrompido enquanto você espera.

     A red verification is an incident, never a card silently reopened: whatever is chosen goes as a
     comment on the card, with the query output, before this session ends.

## Phase 6 — Tag and notes

```
git checkout main && git pull
git tag -l 'v*' | tail -5                      # tag do dia já existe? sufixe .1, .2
git tag -a v<AAAA.MM.DD> -m "release v<AAAA.MM.DD>"
git push origin v<AAAA.MM.DD>
gh release create v<AAAA.MM.DD> --repo <owner>/<repo> --title "v<AAAA.MM.DD>" --notes-file <file>
```

Dual notes, both generated from the cards — one document, two audiences:

```markdown
## O que muda para você
- <em linguagem de hospital: o que o faturista vai notar na tela, sem jargão técnico>

## Técnico
- #<n> — <título> — <PR>
- Migrations: <nomes ou "nenhuma">
- Verificação: <resultado>
- Ensaio: <resultado ou a decisão registrada>
```

Use calver (`v<AAAA.MM.DD>`) from the real date — read it with `date +%Y.%m.%d`, never assume.

## Phase 7 — Close the board

For each card in the train:

```
gh project item-edit --project-id <project-id> --id <item-id> \
  --field-id <field:Status> --single-select-option-id <opt:Status=Producao>   # Status=✅ Produção
gh project item-edit --project-id <project-id> --id <item-id> \
  --field-id <field:Release> --text "v<AAAA.MM.DD>"
gh issue close <n> --repo <owner>/<repo> --reason completed \
  --comment "Subiu em produção na v<AAAA.MM.DD> — <link da release>. Verificação: <resultado>."
```

Cards held back stay in 🚂 Release with a comment saying why and what they are waiting for. A card parked without a stated reason is exactly the metadata rot that made 39 cards unreadable.

## Phase 8 — Notify the requesters

Read `## Origem` from each shipped card and produce the list — person, channel, and the sentence to send:

```
<nome> (<canal>) — "seu chamado #<n> (<título curto>) saiu na v<AAAA.MM.DD>"
```

Hand the list to the user; sending is theirs. This is the loop that makes triage's mandatory origin field worth its cost — and the last thing between "we shipped it" and the requester knowing.

## Report

Tag, release URL, PR, verification output, cards closed, cards held, notification list. Offer exactly one follow-up: "quer registrar o que ficou de fora como carga do próximo trem?"
