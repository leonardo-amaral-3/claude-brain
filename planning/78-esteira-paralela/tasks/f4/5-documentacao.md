❌ Status: Not Started

# Task 5: `docs/esteira-gm.md` com `## A frente`, `templates/CLAUDE.example.md` e `README.md`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). Nenhuma fase edita a spec (`## Execution`).
- **Card**: #82 (F4 do épico #78) — o `gm:spec-ref` dele diz o que esta fase cobre (`## Implementation Details` › *F4*; premissas M19–M21, M23) e o que fica com F1, F2, F3 e F5.
- **Premissas medidas no `/gm-plan-tasks`** (2026-11-27, origin/dev `f22693a`; os números de linha da spec envelheceram com F1–F3 na dev): M19 — a `linha` de `producao` está em `scripts/classificar-parada.mjs:70` e o teste usa "o merge na dev é do Leonardo" em `scripts/classificar-parada-teste.mjs:53` (e de novo em `:185`, `:206`, `:231`, `:356`, `:368`, `:444`); M20 — `## Ambiente na entrada` de `gm-ship` e `gm-correcao` com `diff` vazio; as reafirmações estão hoje em `skills/gm-ship/SKILL.md:93` e `skills/gm-release/SKILL.md:119-120`, `:135`, `:158`, mais `:234-235` (o mesmo teto do `header`, escrito pela F3); 9-gramas de `convencoes.md` fora dos blocos: 0; M21 — "todos ou nenhum" em `scripts/skills-comum.mjs` (bloco `presentes < secoesFonte.length`); M23 — `find /home/leo -name "fluxo-gm-desenvolvimento*"` vazio, citado em `CLAUDE.md:61`. Suíte de base toda verde.

The code lives at the root of this worktree (`/home/leo/pessoal/claude-brain-82-comum-docs`, repo `claude-brain`) — **its own git repository**; run every git command from inside it. Work happens on the branch `feat/82-comum-docs` (already checked out by `/gm-implement`). Mexa só nos arquivos da F4 (`## Fases` da spec).

This is task 5 of 6. Tasks 1–4 are already in the codebase.

## Scope

Spec, `### F4 — comum e documentação`, parágrafo de `docs/esteira-gm.md`, `templates/CLAUDE.example.md` e `README.md`: a seção nova `## A frente` (condutor, ondas, estado, retomada, o que cada sessão recebe — descrever o que F1, F2 e F3 já puseram na dev, lendo `skills/gm-frente/`, `skills/gm-plan-tasks/`, `skills/gm-implement/`, `skills/gm-ship/` e `skills/gm-release/`), as atualizações de `## O caminho`, `### Implementação`, `### Saída` e `## Modo despachado` (inclusive a paráfrase da linha de merge, hoje em `docs/esteira-gm.md:321`) com o merge na dev, o G4 do `gm-ship` e o G5 por trem; o item *Paralelo* em `## Convenções da esteira` do template; `gm-frente` na tabela de skills do `README.md`. `## O caminho` precisa poder ser o alvo do ponteiro de M23 (task 6).

**Não** faz: `CLAUDE.md` deste repo (task 6); nenhuma skill.

## Verification

- Command(s) that must pass: `grep -n "^## A frente" docs/esteira-gm.md` não vazio · `grep -n "Paralelo" templates/CLAUDE.example.md` não vazio · `grep -n "gm-frente" README.md` não vazio · `node scripts/skills-comum.mjs --check` (código `0`)
- Acceptance criteria covered: o terceiro critério do card #82, parte `docs/esteira-gm.md` com `## A frente`

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Documentation matches what is on `dev` (no feature described that F1–F3 did not build)

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #82` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
