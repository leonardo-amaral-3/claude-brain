Meta: trechos normativos das Áreas 2 e 3 da spec. O que vem abaixo de cada `---` é o conteúdo a
copiar, verbatim; o que vem acima é meta.

### A — `## Premissas medidas` no esqueleto da Phase 2 do `gm-spec`

Posição: dentro do bloco de código do esqueleto, logo depois de `## Requisitos & critérios de aceite`
e do seu colchete, antes de `## Technical Overview`.

---

## Premissas medidas
[toda premissa sobre dado, ambiente, rota ou código existente de que o desenho depende, uma linha cada: a premissa · a consulta, rota ou comando que a prova, rodado NESTA sessão contra o ambiente que a spec nomeia (dados da `dev`, o repo na base branch) · o resultado · a data. Premissa que não deu para medir é ponto aberto do G2, não premissa. Desenho que não depende de nenhuma → N/A + por quê]

### B — bullet novo da Phase 3 do `gm-spec`

Posição: primeiro bullet da lista da Phase 3, antes de "Contradictions between sections".

---

- **Unmeasured premises.** Every premise the design leans on — a data shape, an empty month, a field some route exposes, how a profile sees a dialog — is a line of `## Premissas medidas` whose proof ran in this session against the environment the spec names. Proved only on paper or on a fixture, when the spec is about real data → it is an open point, not a premise. About ten cards needed a post-tasks amendment because a premise was right on paper and wrong against `dev`.

### C — `gm-plan-tasks`, parágrafo novo em `## Setup`

Posição: logo depois do parágrafo que hoje começa com "Read `planning/$ARGUMENTS/spec.md`".

---

**The spec's premises are measured, or there is no plan.** The spec has a `## Premissas medidas` section, and every line in it carries its proof and result (or the section is `N/A` with a reason). Missing section, or a line without proof → stop and point to `/gm-spec <n>`: planning on an unmeasured premise is how a task stops halfway on a deviation. The same when the breakdown reveals a premise the section does not list. Each task's `Context` names the lines of `## Premissas medidas` it leans on.

### D — `gm-triage`, seção nova `## Step 1b — Um escopo ou vários?`

Posição: entre `## Step 1 — Is this demand at all?` e `## Step 2 — Deduplicate`.

---

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

### E — `gm-card`, item novo do `## Workflow`, no modo Criar

Posição: novo item logo depois do item 2 (Check duplicates), numerado `2b.` para não renumerar os seguintes.

---

2b. **One scope or several** (Criar only). A direction that carries more than one point follows the rule of `gm-triage`, Step 1b: the points share the objective in one sentence and are validated together → **one** card, label `épico`, with `## Pontos` (one line per point) after `## Direção`; a point independent for real (another flow or module, another severity, another requester) → its own card; in doubt, one card. With a human, the same `Escopo` call as there. **Promover** an `épico` keeps `## Pontos` as it is — G1 does not split it — and leaves the `Rota` field empty: the route belongs to each phase, declared at its promotion.

### F — `gm-spec`, Phase 6, parágrafo novo

Posição: logo depois do parágrafo que lista os sinais ("Signals: the spec declares phases; …").

---

**An épico from triage.** A card that arrives with the label `épico` and `## Pontos` was declared one scope at the door; slicing starts from its points, whatever the size. Each point goes to a phase — or several points to one — and the `## Fases` table gains a `Pontos` column naming which. If every point fits one phase within 6–8 tasks, there are no sub-issues: remove the label, keep `## Pontos` as the checklist of the single card, and say so in one line.
