✅ Status: Complete

# Task 3: Detector de 9-gramas no `--check` e limpeza das reafirmações

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). Nenhuma fase edita a spec (`## Execution`).
- **Card**: #82 (F4 do épico #78) — o `gm:spec-ref` dele diz o que esta fase cobre (`## Implementation Details` › *F4*; premissas M19–M21, M23) e o que fica com F1, F2, F3 e F5.
- **Premissas medidas no `/gm-plan-tasks`** (2026-11-27, origin/dev `f22693a`; os números de linha da spec envelheceram com F1–F3 na dev): M19 — a `linha` de `producao` está em `scripts/classificar-parada.mjs:70` e o teste usa "o merge na dev é do Leonardo" em `scripts/classificar-parada-teste.mjs:53` (e de novo em `:185`, `:206`, `:231`, `:356`, `:368`, `:444`); M20 — `## Ambiente na entrada` de `gm-ship` e `gm-correcao` com `diff` vazio; as reafirmações estão hoje em `skills/gm-ship/SKILL.md:93` e `skills/gm-release/SKILL.md:119-120`, `:135`, `:158`, mais `:234-235` (o mesmo teto do `header`, escrito pela F3); 9-gramas de `convencoes.md` fora dos blocos: 0; M21 — "todos ou nenhum" em `scripts/skills-comum.mjs` (bloco `presentes < secoesFonte.length`); M23 — `find /home/leo -name "fluxo-gm-desenvolvimento*"` vazio, citado em `CLAUDE.md:61`. Suíte de base toda verde.

The code lives at the root of this worktree (`/home/leo/pessoal/claude-brain-82-comum-docs`, repo `claude-brain`) — **its own git repository**; run every git command from inside it. Work happens on the branch `feat/82-comum-docs` (already checked out by `/gm-implement`). Mexa só nos arquivos da F4 (`## Fases` da spec).

This is task 3 of 6. Tasks 1–2 are already in the codebase. Leans on M20.

## Scope

Spec, `### F4 — comum e documentação`: o detector de R4.1 no `--check` de `scripts/skills-comum.mjs` (9-gramas de **cada** fonte — `convencoes.md` e `opcionais.md` — contra cada skill fora dos blocos carimbados; `skill:linha` e o trecho, código `1`), o caso *trecho duplicado → 1* em `scripts/skills-comum-teste.mjs`, e o parágrafo *Limpeza*: a frase de `gm-ship` e, em `gm-release`, as explicações do teto do `header` e do `multiSelect` — as três que a spec nomeia e a quarta, de mesma natureza, que a F3 escreveu no G5 por trem (`:234-235`); ficam as referências à regra. Se o detector acusar outro trecho além desses, ele sai da skill do mesmo jeito, ficando a referência ao bloco; trecho cuja remoção mudaria o comportamento da skill → STOP (desvio).

**Não** faz: mudar o texto das fontes do `_comum` para fugir do detector.

## Verification

- Command(s) that must pass: `node scripts/skills-comum-teste.mjs` (código `0`, com o caso de duplicação) · `node scripts/skills-comum.mjs --check` (código `0`) · `grep -n "CI is not waited" skills/gm-ship/SKILL.md` vazio · `grep -n "12 characters\|caps .header" skills/gm-release/SKILL.md` vazio
- Acceptance criteria covered: R4.1 inteiro (detector + `--check` verde + casos novos)

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #82` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
