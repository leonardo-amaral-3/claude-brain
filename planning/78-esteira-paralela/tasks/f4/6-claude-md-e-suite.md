❌ Status: Not Started

# Task 6: `CLAUDE.md` — norma em `docs/esteira-gm.md` e a suíte dos testes novos

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/78-esteira-paralela/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). Nenhuma fase edita a spec (`## Execution`).
- **Card**: #82 (F4 do épico #78) — o `gm:spec-ref` dele diz o que esta fase cobre (`## Implementation Details` › *F4*; premissas M19–M21, M23) e o que fica com F1, F2, F3 e F5.
- **Premissas medidas no `/gm-plan-tasks`** (2026-11-27, origin/dev `f22693a`; os números de linha da spec envelheceram com F1–F3 na dev): M19 — a `linha` de `producao` está em `scripts/classificar-parada.mjs:70` e o teste usa "o merge na dev é do Leonardo" em `scripts/classificar-parada-teste.mjs:53` (e de novo em `:185`, `:206`, `:231`, `:356`, `:368`, `:444`); M20 — `## Ambiente na entrada` de `gm-ship` e `gm-correcao` com `diff` vazio; as reafirmações estão hoje em `skills/gm-ship/SKILL.md:93` e `skills/gm-release/SKILL.md:119-120`, `:135`, `:158`, mais `:234-235` (o mesmo teto do `header`, escrito pela F3); 9-gramas de `convencoes.md` fora dos blocos: 0; M21 — "todos ou nenhum" em `scripts/skills-comum.mjs` (bloco `presentes < secoesFonte.length`); M23 — `find /home/leo -name "fluxo-gm-desenvolvimento*"` vazio, citado em `CLAUDE.md:61`. Suíte de base toda verde.

The code lives at the root of this worktree (`/home/leo/pessoal/claude-brain-82-comum-docs`, repo `claude-brain`) — **its own git repository**; run every git command from inside it. Work happens on the branch `feat/82-comum-docs` (already checked out by `/gm-implement`). Mexa só nos arquivos da F4 (`## Fases` da spec).

This is task 6 of 6. Tasks 1–5 are already in the codebase. Leans on M23.

## Scope

Spec, `### F4 — comum e documentação`, frase do `CLAUDE.md` deste repo: a norma de `## A esteira` deixa de citar o arquivo que não existe (M23) e aponta para `docs/esteira-gm.md` › `## O caminho`; a suíte do item 3 soma `node scripts/skills-comum-teste.mjs`, `node scripts/gm-frente-teste.mjs`, `node scripts/gm-ship-merge-teste.mjs` e `node scripts/gm-release-trem-teste.mjs`, cada um com o gatilho que a spec dá. Se `## Onde ficam as coisas` lista os blocos comuns só por `convencoes.md`, ele passa a citar também `opcionais.md`. Só `CLAUDE.md`. Esta é a última task: roda a suíte inteira que o `CLAUDE.md` passa a declarar para a área que a F4 tocou.

**Não** faz: o `CLAUDE.md` do workspace (F5); nenhuma skill, script ou doc.

## Verification

- Command(s) that must pass, todos código `0`: `node scripts/skills-comum.mjs --check` · `node scripts/skills-comum-teste.mjs` · `node scripts/classificar-parada-teste.mjs` · `node scripts/gm-spec-sensivel-teste.mjs` · `node scripts/gm-triage-jev-teste.mjs` · `node scripts/gm-frente-teste.mjs` · `node scripts/gm-ship-merge-teste.mjs` · `node scripts/gm-release-trem-teste.mjs` — e `grep -c "fluxo-gm-desenvolvimento" CLAUDE.md` → `0`. Nenhum chama `claude` nem `gh` de verdade (falsos da F1/F3).
- Acceptance criteria covered: o terceiro critério do card #82, parte `CLAUDE.md` com a norma apontando para `docs/esteira-gm.md` e a suíte dos testes novos de F1, F3 e F4

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Every suite line in `CLAUDE.md` names a script that exists

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #82` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
