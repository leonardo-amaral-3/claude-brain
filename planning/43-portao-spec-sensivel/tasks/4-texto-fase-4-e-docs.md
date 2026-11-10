❌ Status: Not Started

# Task 4: Texto — Fase 4, docs, template, CLAUDE.md

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/43-portao-spec-sensivel/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Task index**: [`README.md`](README.md) — stacking on `feat/42-filtro-jev`, environment and the rules of the batch. They bind this task.

The code lives in the `claude-brain` repository — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/43-portao-spec-sensivel`, in the worktree `~/pessoal/claude-brain-43-portao-spec-sensivel`, already checked out by `/gm-implement`).

This is task 4 of 5. Tasks 1–3 are already in the codebase: `skills/gm-spec/sensivel.mjs` complete except the real `carregarJev`, and `scripts/gm-spec-sensivel-teste.mjs`.

Premises this task leans on (spec, `## Premissas medidas`): "A Fase 4 cita três categorias, sem `deploy`", "A norma lista quatro", "Docs e template repetem as três", "O doc diverge da skill sobre quando o revisor roda", "O `--check` só lê `SKILL.md`", "O `--check` está verde na base". Anchors re-measured at planning time (2026-11-10): `SKILL.md:203/208/216/224`, `docs/esteira-gm.md:88`, `templates/CLAUDE.example.md:86` still hold. Re-check before editing; anchors that moved are not a deviation, missing text is.

## Scope

Markdown only, the spec sections `### skills/gm-spec/SKILL.md — Fase 4` (the five items, in order) and `### Docs` (the three bullets: `docs/esteira-gm.md`, `templates/CLAUDE.example.md`, and item 3 of `## A esteira` in the repo's `CLAUDE.md`).

Never touch the stamped sections of any `SKILL.md` (`## Como perguntar e como aprovar`, `## Convenções de saída`, `## Modo despachado`) nor `skills/_comum/convencoes.md`.

Add the **Strings** row of `## Plano de testes` to `scripts/gm-spec-sensivel-teste.mjs`. The `--check` row is not added there; it is its own command, below.

**Out of scope:** any `.mjs` logic, the real `carregarJev` (task 5), other skills, `brain-mcp/`, `hooks/`, `gm-release`. Never edit the installation (`~/.claude/skills/…`) — `CLAUDE.md`, Regra 1.

If you record a decision: `mcp__brain__lembrar` with scope `claude-brain#43` (never the bare number), copied to the card as a `<!-- gm:decisao -->` comment on `leonardo-amaral-3/claude-brain#43`.

## Verification

- Command(s) that must pass:
  - `node scripts/gm-spec-sensivel-teste.mjs` → exit 0 (Strings row included).
  - `node scripts/skills-comum.mjs --check` → exit 0.
- Acceptance criteria covered: CA7; the skill half of CA3, CA4, CA5 and CA9 (steps 1b–1f and 5), checked again at G4 against `## Plano de testes`.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] No stamped section changed

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside `claude-brain/`, message ending with the trailer `Card: #43` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
