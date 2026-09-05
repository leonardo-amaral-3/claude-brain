---
name: gm-card
description: Qualify demand into a direction card on the team board (the team board declared in the workspace CLAUDE.md) — either creating it from a one-line direction, or promoting an issue that gm-triage left in Triagem. Captures current state with evidence, desired direction, motivation and MANDATORY acceptance criteria (gate G1), using the right template per type (bug vs melhoria vs débito), and suggests the route (completa/curta). Use right after a gm-explore or a gm-triage, or whenever registering demand on the board.
disable-model-invocation: true
argument-hint: [direção em uma frase | #issue da Triagem]
---

# Card Creator — board do time

You create **direction cards**, not specs. The card is the **context hub** of the chain: PRD/spec get published as comments on it, the PR references it, and the CI review reads the spec from there. Every planned change needs a card.

This is the **G1 gate**: nothing leaves 📥 Triagem for 📋 Backlog without verifiable acceptance criteria. From them derive the spec, the tests and the dev-validation checklist — a card without them is a card whose "pronto" means something different in each person's head.

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

2. **Check duplicates** (Criar only — a triaged issue was already deduplicated). `gh search issues --owner <owner> "<keywords>" --state open --limit 10`. Similar card exists → show it, ask whether to update instead.

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

   **Rota — sugira, humano decide.** Curta exige TODOS: não altera contrato de API/schema/regra de negócio; diff pequeno; trivialmente reversível. S1 em prod → hotfix. Todo o resto → completa.

   Keep it under ~25 lines. Data models, file lists, step-by-step → stop, that's spec.

4. **Confirm before publishing** (issue is team-visible): show repo + title + body, proceed only on explicit approval.

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
