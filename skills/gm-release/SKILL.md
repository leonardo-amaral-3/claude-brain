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
- **A sensitive train does not promote on hope.** Migration or data treatment → it needs the release environment (clone of prod). That environment does not exist yet (Fase 3). No pretending: stop, present the options, let the human decide, and **record the decision in the release notes**.
- **Verification is blocking** for every card whose spec has a `## Verificação pós-deploy`. Red → the release is not done; it is an incident.
- Merging into `main` deploys production immediately (`deploy.yml`, `yarn deploy -p`) and applies Prisma migrations on container boot. There is no manual step between merge and production.
- Nothing is merged, tagged or published without explicit human approval.
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
   - code in the diff **without** a validated card → *carona*: unvalidated work riding along. List it card by card (or commit by commit when there is no card) and ask the user to decide: hold the train, or accept and record it in the notes.

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

**That environment does not exist yet** (Fase 3 of the rollout: CDK stack with `ENVIRONMENT=release` + RDS snapshot). Do not pretend it happened. Stop and present the options:

1. **Segurar o trem** até a stack release existir — correct for anything touching faturamento or rewriting data.
2. **Partir o trem** — promote the trivial part now through a `release/*` branch (cherry-pick onto `release/<data>` from `origin/main`; `pr-branch-check` accepts `release/*` into `main`) and hold the sensitive cards in 🚂 Release.
3. **Promover assumindo o risco** — only with an explicit human decision, a rehearsed rollback, and the sentence recorded verbatim in the release notes and in each affected card: `promovido sem ensaio em ambiente release — decisão de <nome> em <data>`.

Never choose for the user. Recommend (1) or (2) when the train touches data or faturamento.

## Phase 4 — Open the train PR

```
gh pr create --repo <owner>/<repo> --base main --head dev --title "release v<AAAA.MM.DD>" --body-file <file>
```

```markdown
## Trem v<AAAA.MM.DD>

### Cards validados
- #<n> — <título> (<módulo>)

### Carona (sem card validado)
- <PR/commit> — <o que é> — decisão: <segurar | aceito por <nome>>

### Migrations
- <nome-da-migration> — <o que faz> — <destrutiva? janela de risco?>
- (ou "nenhuma")

### Ensaio
[resultado no ambiente release · ou "não ensaiado — <opção escolhida na fase 3>"]

### Verificação pós-deploy (bloqueante)
- #<n> — <query/checagem tirada da spec do card>
```

Show it and create only on approval. Check CI green (`gh pr checks`) before proposing the merge — and remember that a red check does not physically block the merge in these repos, so a green CI is **your** responsibility to confirm.

## Phase 5 — Merge, deploy, verify

1. Merge on explicit approval → production deploy starts automatically.
2. Follow it: `gh run list --repo <owner>/<repo> --branch main --limit 3` and the deploy job's logs.
3. **Smoke, always:** the API answers, the web loads, migrations applied (compare the latest `prisma/migrations` folder against `_prisma_migrations` in the prod database).
4. **Blocking verification, for every sensitive card:** run the `## Verificação pós-deploy` query from its spec against production and paste the output as a comment on the card.
   - Red → **stop the closing ritual.** Assess rollback (revert the merge commit → redeploy) versus `/gm-hotfix`. A red verification is an incident, never a card silently reopened.

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
