✅ Status: Complete

# Task 1: A seção `## Emenda pós-tasks` e a entrada do `gm-implement`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/2-emenda-pos-tasks/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the **root of this repository** (`claude-brain`) — there is **no nested module repo**; run every git command from the repo root. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 1 of 3.

**Passo 0 do `## Execution` — antes de qualquer outra coisa.** A base branch `dev` não existe; sem ela o `## Guarantee the branch` do `/gm-implement` não consegue criar a branch de feature. Rode `git branch dev main && git push -u origin dev` **antes** do checkout da feature branch.

**Untracked no repo.** `git status` traz `?? CLAUDE.md` e `?? planning/`. Ambos entram no commit desta task: `planning/` é o que o `## File Change Summary` manda versionar junto, e o `CLAUDE.md` da raiz é o arquivo que governa este repo e está fora do git. Não é escopo extra — é o setup que destrava o `git status` limpo exigido pelas skills seguintes.

## Scope

Somente a **Área 1** do `## Implementation Details` da spec, inteira, em `skills/gm-implement/SKILL.md`: os itens **1a**, **1b** e **1c**. Os três juntos porque 1a e 1c apontam para a seção que 1b cria.

O bloco de 1b é **cópia verbatim** de [`../trechos/gm-implement-emenda-pos-tasks.md`](../trechos/gm-implement-emenda-pos-tasks.md) — copie o arquivo, não transcreva. Ele vai entre o fim do protocolo de achado e `## Present for review`.

**Fora desta task:** `skills/gm-ship/SKILL.md` (task 2) e a vizinhança do CA4 — `gm-spec`, `gm-correcao`, `docs/esteira-gm.md` (task 3). Nenhum `.ts`, `.json` ou hook. Nenhum `./sync.sh push` ainda (task 3).

Atenção ao que a spec proíbe: a linha `4.` do `## Close the task` **fica intacta** (é outra frase, e está correta), e nada fora do `## File Change Summary` é reescrito.

## Verification

Command(s) that must pass — da raiz do repo:

```bash
set -e
I=skills/gm-implement/SKILL.md
falha() { echo "FALHA: $1" >&2 ; exit 1 ; }

SEC=$(mktemp)
sed -n '/^## Emenda pós-tasks/,/^## Present for review/p' "$I" > "$SEC"
test -s "$SEC" || falha "CA1: seção Emenda pós-tasks ausente"

for p in 'N+1' 'Uma emenda, uma task' 'gm-plan-tasks' 'gm-spec' \
         'exceção nomeada ao teto' 'Segunda emenda' ; do
  grep -q "$p" "$SEC" || falha "CA1: '$p' fora da seção"
done

if grep -qF 'All tasks `✅` → offer `/gm-ship <folder>`.' "$I" ; then
  falha "CA1: a saída única antiga sobrou no Setup"
fi
grep -q 'emenda pós-tasks' "$I"                          || falha "CA1: Setup não cita a seção"
grep -qF 'All `✅` → offer `/gm-ship <folder>`.' "$I"     || falha "CA1: :91 foi alterada à toa"

for p in 'aprovação humana explícita' 'Emenda AAAA-MM-DD' 'gm:spec' 'spec.md' \
         'gm:tasks' 'gm:spec-ref' 'superada pela emenda' ; do
  grep -q "$p" "$SEC" || falha "CA3: '$p' fora da seção"
done

git ls-remote --exit-code --heads origin dev >/dev/null || falha "passo 0: branch dev"
grep -q 'disable-model-invocation: true' "$I" || falha "frontmatter gm-implement"

rm -f "$SEC" ; echo OK
```

Mais uma checagem de leitura, que `grep` não faz e que entra na apresentação da revisão:

- **CA1, coerência interna:** leia o item 3 do protocolo de fatiamento (teto 6–8) e o passo 3 da seção nova **juntos**, e confirme que a exceção está nomeada nos **dois** lugares, não só num.

Acceptance criteria covered: **CA1** inteiro e **CA3** na parte que mora no `gm-implement` (o rastro exigido pela seção nova). CA3 fecha de vez na task 2, com a linha da PR.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] A leitura de coerência `:52` × passo 3 apresentada na revisão
- [ ] Frontmatter intocado; nenhum arquivo fora do `## File Change Summary` tocado

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from the repo root with a clear message ending with the trailer `Card: #2`.
4. Flip the first line of this file to `✅ Status: Complete`.
