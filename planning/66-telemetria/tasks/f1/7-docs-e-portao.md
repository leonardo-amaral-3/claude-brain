✅ Status: Complete

# Task 7: `docs/telemetria.md` e a suíte inteira do portão da F1

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Card**: phase F1 of epic #66 is sub-issue **#67**; its `<!-- gm:spec-ref -->` comment lists the gate suite. Commits carry `Card: #67`.
- **Premises this task leans on**: spec P8; breakdown summary M7, M8.

The code lives in the worktree `/home/leo/pessoal/claude-brain-67-telemetria-saude` — **its own git repository** (branch `feat/67-telemetria-saude`); run every git command from inside it. Never touch the main checkout, the sibling worktrees or the live installation. No `npm ci`/`npm install`.

This is task 7 of 7. Tasks 1–6 are already in the codebase.

## Scope

- `docs/telemetria.md` (new), per spec `### Docs e sincronia (F1)` — what is written, where, how to turn it on, the A/B, privacy, `npm run painel`, one line pointing to each future section. F2/F3 do not edit it, so write it complete for F1.
- Run the whole F1 gate suite from the card's `gm:spec-ref` comment and fix what is red inside F1's files only. F1 does not change `brain-mcp/src/`, so `npm run build`/`smoke`/`eval` are not part of this gate (spec, case `poluicao`); if anything in `brain-mcp/src/` ended up changed, that is a deviation → stop.
- NOT here: new behavior. Anything the suite reveals that the spec does not answer is a stop, not a fix.

## Verification

- Command(s) that must pass, all with code 0: `node brain-mcp/scripts/telemetria.mjs`; `node brain-mcp/scripts/telemetria.mjs --custo`; `node brain-mcp/scripts/painel-teste.mjs`; `cd brain-mcp && npm run jev`; `node scripts/classificar-parada-teste.mjs`; `node scripts/gm-triage-jev-teste.mjs`; `cd brain-mcp && npm run injecao -- --desde <d> --ate <d> --base origin/dev --portao jev` (the three last complete days); `git diff --stat origin/dev -- brain-mcp/src` empty.
- Acceptance criteria covered: CA1, CA3 (chave), CA4 — the whole F1 gate; R1–R4.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Every verification command green, with its output summarized for the PR body
- [ ] `ls ~/.claude/brain-telemetria` after the suite: still absent

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #67` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
