✅ Status: Complete

# Task 1: Regra e linha

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/43-portao-spec-sensivel/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Task index**: [`README.md`](README.md) — stacking on `feat/42-filtro-jev`, environment and the rules of the batch. They bind this task.

The code lives in the `claude-brain` repository — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/43-portao-spec-sensivel`, in the worktree `~/pessoal/claude-brain-43-portao-spec-sensivel`, already checked out by `/gm-implement`).

This is task 1 of 5. Nothing of this card is in the codebase yet.

Premises this task leans on (spec, `## Premissas medidas`): "Nenhuma skill embarca script hoje", "Node e padrão de teste do repo", "Não existe cliente, chave nem menção ao Jev hoje", "Arquivo novo na pasta da skill chega à instalação".

## Scope

Create `skills/gm-spec/sensivel.mjs` with the pure part of `### skills/gm-spec/sensivel.mjs`: the header comment, the exported constants, the JSDoc types, `optInLigado`, `normalizar`, `decidir`, `unir`, `montarLinha`, and `carregarJev` **as the stub** the spec describes at the end of `### Fronteira com o cliente do #42` (returns `null`, with the comment that marks it).

Create `scripts/gm-spec-sensivel-teste.mjs` (pattern of `scripts/skills-comum-teste.mjs`: exits 0/1, no framework, everything in a temp dir) with these rows of `## Plano de testes`: every `decidir` row, the `montarLinha` row, the `unir` row and the **Estático** row. Tasks 2–4 add their rows to this same script.

**Out of scope:** `classificar` (task 2), the CLI and `sensibilidade.json` (task 3), any markdown (task 4), the real `carregarJev` (task 5). No network, no API, no change to `brain-mcp/` or `hooks/`.

If you record a decision: `mcp__brain__lembrar` with scope `claude-brain#43` (never the bare number), copied to the card as a `<!-- gm:decisao -->` comment on `leonardo-amaral-3/claude-brain#43`.

## Verification

- Command(s) that must pass: `node scripts/gm-spec-sensivel-teste.mjs` → exit 0.
- Acceptance criteria covered: CA1 (rule and inversion), CA2 (the `linha` text), the `unir` half of CA9, the static half of CA6.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside `claude-brain/`, message ending with the trailer `Card: #43` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
