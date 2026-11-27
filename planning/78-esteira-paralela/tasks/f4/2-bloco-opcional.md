❌ Status: Not Started

# Task 2: Fonte opcional `skills/_comum/opcionais.md` e `## Ambiente na entrada` carimbado

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). Nenhuma fase edita a spec (`## Execution`).
- **Card**: #82 (F4 do épico #78) — o `gm:spec-ref` dele diz o que esta fase cobre (`## Implementation Details` › *F4*; premissas M19–M21, M23) e o que fica com F1, F2, F3 e F5.
- **Premissas medidas no `/gm-plan-tasks`** (2026-11-27, origin/dev `f22693a`; os números de linha da spec envelheceram com F1–F3 na dev): M19 — a `linha` de `producao` está em `scripts/classificar-parada.mjs:70` e o teste usa "o merge na dev é do Leonardo" em `scripts/classificar-parada-teste.mjs:53` (e de novo em `:185`, `:206`, `:231`, `:356`, `:368`, `:444`); M20 — `## Ambiente na entrada` de `gm-ship` e `gm-correcao` com `diff` vazio; as reafirmações estão hoje em `skills/gm-ship/SKILL.md:93` e `skills/gm-release/SKILL.md:119-120`, `:135`, `:158`, mais `:234-235` (o mesmo teto do `header`, escrito pela F3); 9-gramas de `convencoes.md` fora dos blocos: 0; M21 — "todos ou nenhum" em `scripts/skills-comum.mjs` (bloco `presentes < secoesFonte.length`); M23 — `find /home/leo -name "fluxo-gm-desenvolvimento*"` vazio, citado em `CLAUDE.md:61`. Suíte de base toda verde.

The code lives at the root of this worktree (`/home/leo/pessoal/claude-brain-82-comum-docs`, repo `claude-brain`) — **its own git repository**; run every git command from inside it. Work happens on the branch `feat/82-comum-docs` (already checked out by `/gm-implement`). Mexa só nos arquivos da F4 (`## Fases` da spec).

This is task 2 of 6. Task 1 is already in the codebase. Leans on M20 and M21.

## Scope

Spec, `### F4 — comum e documentação`: o parágrafo de `skills/_comum/opcionais.md` (novo, primeiro bloco `## Ambiente na entrada` com o texto atual de `gm-ship`) e, do parágrafo de `scripts/skills-comum.mjs`, só a leitura das duas fontes (cabeçalho nas duas → código `2`; bloco opcional carimbado em toda skill que já tem o cabeçalho, sem "todos ou nenhum" — que continua valendo para `convencoes.md`). Em `scripts/skills-comum-teste.mjs`, os casos *bloco opcional carimbado só onde há o cabeçalho* e *cabeçalho nas duas fontes → 2*. Rodar o carimbo, que alcança `gm-ship` e `gm-correcao`.

**Não** faz: o detector de 9-gramas e o caso *trecho duplicado → 1* (task 3).

## Verification

- Command(s) that must pass: `node scripts/skills-comum-teste.mjs` (código `0`, com os dois casos novos) · `node scripts/skills-comum.mjs --check` (código `0`, listando `Ambiente na entrada` igual em `gm-ship` e `gm-correcao`)
- Acceptance criteria covered: R4.1 — a parte "`skills/_comum/opcionais.md` carimbando `## Ambiente na entrada`" e parte dos casos novos do teste

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #82` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
