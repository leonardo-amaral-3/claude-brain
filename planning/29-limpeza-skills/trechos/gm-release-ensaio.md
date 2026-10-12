# gm-release — o ensaio deixa de ser afirmado e passa a ser lido do `CLAUDE.md`

Cinco substituições em `skills/gm-release/SKILL.md`. Linhas da `origin/dev` de 2026-10-12 **antes do
carimbo** (depois dele, +1); localize pelo texto. Em cada `###`, o conteúdo a copiar é o que vem
abaixo do `---`; entre o `###` e o `---` é meta. Tudo o mais em `## Hard rules` e em
`## Phase 3 — Ensaio` fica como está — inclusive a linha `>` vazia (142), as outras duas opções da
pergunta e o parágrafo *Promover assumindo o risco*.

### 1. Linha 49 — o bullet de `## Hard rules` que começa com "**A sensitive train does not promote on hope.**", inteiro

---

- **A sensitive train does not promote on hope.** Migration or data treatment → it needs the release
  environment (a copy of prod). Whether one exists, and how to run the payload against it, is read
  from the workspace `CLAUDE.md` (`## Convenções da esteira`, item *Ambiente de ensaio*); none
  declared → no pretending: stop and put the three ways out to the human as a choice — the question
  is written out in `## Phase 3 — Ensaio`, and that is the only place this decision is taken — then
  **record the chosen one in the release notes**.

### 2. Linhas 135-137 — os dois parágrafos de abertura de `## Phase 3 — Ensaio` ("The design calls for…" e "**That environment does not exist yet**…"), inclusive a linha em branco 136 entre eles; viram um parágrafo só

---

A **release environment** is a copy of production where the accumulated migrations and the data
treatment run before they count, with acceptance queries comparing faturamento before and after;
only what passes gets promoted. The workspace `CLAUDE.md` says whether one exists and how to run the
payload against it (`## Convenções da esteira`, item *Ambiente de ensaio*). **Declared:** run it as
declared, put the result under `### Ensaio` in the release notes, and a red result holds the train.
**Not declared, or declared `não`:** do not pretend it happened. Stop: name every migration and data
treatment in the payload in the message — what each one does, against which table, how much data —
and then one `AskUserQuestion` call, header `Ensaio` (the tool caps `header` at 12 characters),
question and options in pt-BR:

### 3. Linhas 139-141 — o primeiro parágrafo da pergunta citada

---

> Este trem carrega <as migrations/tratamentos, pelo nome>, e este workspace não declara — ou declara
> que não há — um ambiente de ensaio, a cópia de produção onde isto rodaria antes de valer. Não há
> como provar hoje como a migration se comporta contra o dado real; o que você escolhe aqui é o que
> fazer sem essa prova.

### 4. Linhas 143-144 — o bullet *Segurar o trem*

---

> - **Segurar o trem** — nada sobe; os cards ficam em 🚂 Release até um ambiente de ensaio ser
>   declarado no `CLAUDE.md` do workspace. É o caminho correto quando o trem toca faturamento ou
>   reescreve dado.

### 5. Linha 158 — na frase "holding or splitting is what the design recommends", só a troca `the design` → `this skill`

Sem conteúdo abaixo: é a troca de duas palavras. Motivo: sem o parágrafo 135 ("The design calls
for…"), o "design" da linha 158 ficaria órfão.
