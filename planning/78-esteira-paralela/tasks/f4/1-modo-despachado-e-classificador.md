❌ Status: Not Started

# Task 1: Linhas novas do `## Modo despachado` e o classificador da `PARADA`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). Nenhuma fase edita a spec (`## Execution`).
- **Card**: #82 (F4 do épico #78) — o `gm:spec-ref` dele diz o que esta fase cobre (`## Implementation Details` › *F4*; premissas M19–M21, M23) e o que fica com F1, F2, F3 e F5.
- **Premissas medidas no `/gm-plan-tasks`** (2026-11-27, origin/dev `f22693a`; os números de linha da spec envelheceram com F1–F3 na dev): M19 — a `linha` de `producao` está em `scripts/classificar-parada.mjs:70` e o teste usa "o merge na dev é do Leonardo" em `scripts/classificar-parada-teste.mjs:53` (e de novo em `:185`, `:206`, `:231`, `:356`, `:368`, `:444`); M20 — `## Ambiente na entrada` de `gm-ship` e `gm-correcao` com `diff` vazio; as reafirmações estão hoje em `skills/gm-ship/SKILL.md:93` e `skills/gm-release/SKILL.md:119-120`, `:135`, `:158`, mais `:234-235` (o mesmo teto do `header`, escrito pela F3); 9-gramas de `convencoes.md` fora dos blocos: 0; M21 — "todos ou nenhum" em `scripts/skills-comum.mjs` (bloco `presentes < secoesFonte.length`); M23 — `find /home/leo -name "fluxo-gm-desenvolvimento*"` vazio, citado em `CLAUDE.md:61`. Suíte de base toda verde.

The code lives at the root of this worktree (`/home/leo/pessoal/claude-brain-82-comum-docs`, repo `claude-brain`) — **its own git repository**; run every git command from inside it. Work happens on the branch `feat/82-comum-docs` (already checked out by `/gm-implement`). Mexa só nos arquivos da F4 (`## Fases` da spec).

This is task 1 of 6. Leans on M19.

## Scope

Spec, `### F4 — comum e documentação`: os itens de `skills/_comum/convencoes.md` (as quatro mudanças na tabela do `## Modo despachado` e a ressalva do item 4 de `## Convenções de saída`) e o parágrafo de `scripts/classificar-parada.mjs` / `classificar-parada-teste.mjs` / `jev-falso.mjs` (linha `producao` nova, exemplo de merge na `main` no lugar do "merge na dev", caso `gate-aberto` da `PARADA` de spec sensível). Depois, o recarimbo de toda `skills/gm-*/SKILL.md` com `node scripts/skills-comum.mjs` — a tabela e o classificador mudam juntos porque a guarda do teste compara os dois.

**Não** faz: `opcionais.md` e o bloco opcional (task 2), o detector de 9-gramas e a limpeza das reafirmações (task 3), `gm-spec` (task 4), documentação (tasks 5 e 6).

## Verification

- Command(s) that must pass: `node scripts/skills-comum.mjs --check` (código `0`) · `node scripts/classificar-parada-teste.mjs` (código `0`) · `node scripts/skills-comum-teste.mjs` (código `0`)
- Acceptance criteria covered: o segundo critério do card #82 (classificador com a linha `producao` nova e o caso `gate-aberto`); a parte de convencoes.md de R4.1

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #82` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
