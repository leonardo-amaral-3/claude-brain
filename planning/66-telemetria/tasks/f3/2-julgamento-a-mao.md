❌ Status: Not Started

# Task 2: Julgamento à mão (`prova.julgar`)

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- Card: phase #69 (F3) of epic #66 (see its `<!-- gm:spec-ref -->` comment for scope and what belongs to F1/F2).
- Sections that bind this task: `### painel/prova.mjs — o gabarito, CA5` (item `julgar`, and the line format of the arquivo de amostra), `### Privacidade` (this is the only painel output that shows text: local, never to PR), `## Plano de testes` linha CA5, `## Coding Standards`.
- Premise measured in the breakdown: M3 under `claude -p` and in spawned children `process.stdin.isTTY` is `undefined`, so the test proves the no-TTY path and the interactive path is proven by Leonardo in the G5 of F3 (spec `## Verificação pós-deploy` › F3, item 2).

The code lives in the `claude-brain/` repo (this worktree, `/home/leo/pessoal/claude-brain-69-telemetria-gabarito`) — **its own git repository**; run every git command from inside it. Work happens on `feat/69-telemetria-gabarito` (already checked out by `/gm-implement`).

This is task 2 of 3. Task 1 is already in the codebase (`prova.mjs` with `amostrar`, the fixtures and `painel-prova-teste.mjs`).

## Scope

- Replace the `julgar(ctx, arquivo)` stub in `brain-mcp/scripts/painel/prova.mjs` with the spec's behaviour. Require a TTY. Loop over the lines with `julgamento: null`, answering `s/n/p/q`. Rewrite the whole file after each answer through a temp file + `rename`. Return `{ codigo, linhas }`.
- Add the `julgar` cases to `painel-prova-teste.mjs`. If the spec's `{ codigo: 2 }` on a missing or unreadable file needs a decision the spec does not make, STOP (deviation protocol). Any extra case you add must not invent behaviour beyond the spec.
- NOT in scope: `amostrar` (task 1, only fix it if a test of this task exposes a defect), the `Gabarito` section (task 3), any file of F1/F2.

## Verification

- `node brain-mcp/scripts/painel-prova-teste.mjs` → code 0, now including: `julgar` without a TTY → code 2 with the message, and the file left untouched.
- Acceptance criterion covered: the `julgar` part of CA5 (the interactive judging is the G5 step of Leonardo).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code loads; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #69`. Put that commit to the human as a choice (*ação irreversível*), never as consent to be typed. Dispatched mode decides it with the verification green.
4. Flip the first line of this file to `✅ Status: Complete`.
