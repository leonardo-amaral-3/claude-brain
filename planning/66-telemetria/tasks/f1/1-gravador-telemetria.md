✅ Status: Complete

# Task 1: O gravador `hooks/telemetria.js`, o esqueleto de `telemetria.mjs` e a sincronia

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). The event contract (`### Contrato do evento`) is shared with phases F2 (#68) and F3 (#69), which are being built in parallel against it: never change it without an amendment.
- **Card**: phase F1 of epic #66 is sub-issue **#67** (read its `<!-- gm:spec-ref -->` comment for what is in and out of scope). Commits carry `Card: #67`, never `#66`.
- **Premises this task leans on**: spec `## Premissas medidas` P8, P12; breakdown summary M3, M4, M8, M10 (in the card #67 `[despacho]` comment of `/gm-plan-tasks`).

The code lives in the worktree `/home/leo/pessoal/claude-brain-67-telemetria-saude` — **its own git repository** (branch `feat/67-telemetria-saude`, base `dev`); run every git command from inside it. Never touch the main checkout `/home/leo/pessoal/claude-brain`, the sibling worktrees of #68/#69, or the live installation (`~/.claude/hooks`, `~/.claude/skills`, `~/notoria/claude/brain-mcp`). Do not run `npm ci`/`npm install` (`brain-mcp/node_modules` is already provided; a new dependency is a stop).

This is task 1 of 7. No earlier task.

## Scope

- `hooks/telemetria.js` (new), exactly as spec `### hooks/telemetria.js — o gravador (F1)` and the `Lugar e nome`, `Rotação e retenção`, `Versão` and `Tamanho` paragraphs of `### Contrato do evento`.
- `brain-mcp/scripts/telemetria.mjs` (new): the script skeleton (named cases, exit codes 0/1/2, every child env built from `envSemJev(process.env)` as `### Isolamento dos testes` says) with **only the `gravador` case** of spec `### brain-mcp/scripts/telemetria.mjs`. Later tasks add `eventos`, `stdout`, `ab`, `poluicao`, `--custo` and `--conferir` to this same file — leave a clear place for them, do not stub them as passing.
- `brain-mcp/package.json`: the `telemetria` script only (`painel` comes in task 6).
- `sync.sh:87` and `sync.ps1:136`: `telemetria.js` enters the versioned hook lists (spec `### Docs e sincronia`).
- NOT here: any change to `brain-contexto.js` or `jev.js`, the painel, docs.

Tests write only to temporary directories, never to `~/.claude/brain-telemetria` (R4).

## Verification

- Command(s) that must pass: `node brain-mcp/scripts/telemetria.mjs` (code 0, case `gravador` green) and `bash -n sync.sh`; `./sync.sh status` lists `telemetria.js` as a repo-only hook (read-only command — never `push`/`pull`).
- Acceptance criteria covered: CA1 (gravação, parte do gravador), CA4 (destino indisponível → `false`, sem saída), R3, R4.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code loads cleanly (`node -e "require('./hooks/telemetria.js')"` prints nothing); no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #67` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
