❌ Status: Not Started

# Task 5: Step 4b no `SKILL.md` da `gm-triage` e a frase no `CLAUDE.md`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/41-triagem-jev/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente, pilha, commits e regras do lote**: [`README.md`](README.md) desta pasta.

Seções da spec que governam esta task: `### Skill: skills/gm-triage/SKILL.md` (o texto exato do Step 4b, onde ele entra e as duas frases do Step 5), o R4, o `## File Change Summary` (a frase do `CLAUDE.md`) e `## Coding Standards` (o `SKILL.md` só muda nesses pontos). Premissas: as linhas de `## Premissas medidas` sobre a skill de hoje (Step 3 e Step 5) e sobre o carimbo, que só lê `SKILL.md`; do README, Q1 e Q6.

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-41-triagem-jev`, **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/41-triagem-jev` (already checked out).

This is task 5 of 5. Tasks 1–4 (`skills/gm-triage/jev-triagem.mjs` completo e `scripts/gm-triage-jev-teste.mjs` com todos os casos de código) are already in the codebase.

## Scope

- `skills/gm-triage/SKILL.md`: a seção `## Step 4b — Sugestão do Jev …` logo antes de `## Step 5 — Publish`, com o texto da spec; as duas frases no Step 5. Nenhuma outra linha muda: Step 3, comandos de gravação e os três blocos comuns ficam como estão.
- `CLAUDE.md` do repo: em `## A esteira`, item 3, a frase do `## File Change Summary`.
- `scripts/gm-triage-jev-teste.mjs`: o bloco R2/R3 do `## Plano de testes` (o `SKILL.md` contém `## Step 4b — Sugestão do Jev`, `jev-triagem.mjs" --estado` e `--entrada`).

NOT in scope: mudar `jev-triagem.mjs` (se o texto da skill pedir algo que o script não faz, é desvio → PARADA) · `skills/_comum/convencoes.md` e os blocos carimbados · `sync.sh push` e a instalação viva · a `## Verificação pós-deploy` (é de Leonardo, depois do `push`) · o R5, que espera o aval de Leonardo para o uso `triagem`.

## Verification

- `node scripts/skills-comum.mjs --check; echo $?` → `0` (R4).
- `node scripts/gm-triage-jev-teste.mjs; echo $?` → `0`, agora com todas as linhas do `## Plano de testes` menos a do R5.
- `git diff dev...HEAD -- skills/gm-triage/SKILL.md` (ou contra `feat/42-filtro-jev`) → só a seção nova e as duas frases.
- Acceptance criteria covered: **R4**; o **R1** e o **R2** no nível da instrução da skill (desligado não diz nada; ligado cola a tabela no Step 5; nada do Jev é gravado). O R5 fica fora da PR (`## Verificação pós-deploy`, item 6).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Os três blocos comuns do `SKILL.md` intactos
- [ ] Code runs; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, files by name, message ending with the trailer `Card: #41` and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
