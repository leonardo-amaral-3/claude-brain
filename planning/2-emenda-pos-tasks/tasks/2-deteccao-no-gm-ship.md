❌ Status: Not Started

# Task 2: A detecção no `gm-ship` — regra, ponteiro e linha da PR

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/2-emenda-pos-tasks/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the **root of this repository** (`claude-brain`) — there is **no nested module repo**; run every git command from the repo root. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 2 of 3. Task 1 is already in the codebase: `skills/gm-implement/SKILL.md` já tem a seção `## Emenda pós-tasks`, e a branch `dev` já existe.

## Scope

Somente a **Área 2** do `## Implementation Details` da spec, inteira, em `skills/gm-ship/SKILL.md`: os itens **2a**, **2b** e **2c**.

O bloco de 2a é **cópia verbatim** de [`../trechos/gm-ship-decisao-caiu.md`](../trechos/gm-ship-decisao-caiu.md) — copie o arquivo, não transcreva. A **posição é a decisão**, não um detalhe: dentro de `## Open the PR`, entre o passo 1 (`git push`) e o passo 2 (corpo da PR), nunca nas precondições. A decisão nº 6 do `## Technical Decisions` explica por quê.

**Fora desta task:** `skills/gm-implement/SKILL.md` (task 1, já feito — não reabra) e a vizinhança do CA4 — `gm-spec`, `gm-correcao`, `docs/esteira-gm.md` (task 3). Nenhum `./sync.sh push` ainda (task 3). O frontmatter não muda.

## Verification

Command(s) that must pass — da raiz do repo:

```bash
set -e
S=skills/gm-ship/SKILL.md
falha() { echo "FALHA: $1" >&2 ; exit 1 ; }

SHIP=$(mktemp)
awk '/^## Open the PR/,/^## Board/' "$S" > "$SHIP"
test -s "$SHIP" || falha "CA2: seção Open the PR não encontrada"

for p in 'emenda pós-tasks' 'não abra a PR' 'medições' 'precondição 2' ; do
  grep -q "$p" "$SHIP" || falha "CA2: '$p' fora de Open the PR"
done
grep -q 'Emenda AAAA-MM-DD' "$S" || falha "CA3: corpo da PR não nomeia a emenda"
grep -q 'disable-model-invocation: true' "$S" || falha "frontmatter gm-ship"

rm -f "$SHIP" ; echo OK
```

Mais uma checagem de leitura, que `grep` não faz e que entra na apresentação da revisão:

- **CA2, leitura adversarial:** leia o bloco novo **ao lado da precondição 2** e confirme que um agente consegue dizer em qual dos dois está — task **pendente** *versus* tudo `✅` e a spec errada.

Acceptance criteria covered: **CA2** inteiro; **CA3** fecha aqui, com a linha que a PR passa a carregar (2c).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] A leitura adversarial contra a precondição 2 apresentada na revisão
- [ ] A regra está em `## Open the PR`, não nas precondições; frontmatter intocado

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from the repo root with a clear message ending with the trailer `Card: #2`.
4. Flip the first line of this file to `✅ Status: Complete`.
