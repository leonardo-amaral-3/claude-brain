✅ Status: Complete

# Task 1: `uso` com sessão e `tool_use_id`

## Context

You are implementing part of a larger feature (phase F2, card #68, of epic #66). Read this first:
- **Spec**: [`planning/66-telemetria/spec.md`](../../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- Premises this task leans on (measured in the breakdown, 2026-11-24, on this worktree): P2/P3 (`CLAUDE_CODE_SESSION_ID` is in the env of the MCP server and of Bash), P5 (`@modelcontextprotocol/sdk` 1.30.0 passes `_meta: request.params?._meta` in the callback's `extra` — `shared/protocol.js:321`, `server/mcp.js:438` calls `cb(args, extra)`), P11 (`db.ts` `migrarUsoSemantica`/`temColuna`; `tools.ts` INSERT names its columns), `BRAIN_SOMENTE_CONSULTA` at `src/config.ts:124`, and `scripts/smoke.mjs` talks raw JSON-RPC over stdio (so a test can put `_meta` in `tools/call` params).

The code lives in this worktree (`/home/leo/pessoal/claude-brain-68-telemetria-ganho`, the `claude-brain` repo) — **its own git repository**; run every git command from inside it. Work happens on `feat/68-telemetria-ganho` (already checked out).

This is task 1 of 4.

## Scope

Spec sections: `### brain-mcp/src/db.ts e brain-mcp/src/tools.ts — uso com sessão (F2)`, `### De onde vêm a sessão e o prompt` (the MCP server row and the `/clear` limit), `## Migrations & compatibilidade` (`uso`), and the `uso com sessão` and `brain-mcp/src/` rows of `## Plano de testes`. Files:
- `brain-mcp/src/db.ts` — `migrarColuna`, three calls, the comment.
- `brain-mcp/src/tools.ts` — the `registerTool` wrapper writes `sessao` and `tool_use_id`.
- `brain-mcp/scripts/sem-jev.mjs` — also deletes `CLAUDE_CODE_SESSION_ID` (R4). This must land **in this task**, before running smoke/eval against the live index with the new `dist/`.
- `brain-mcp/scripts/concorrencia.mjs` — the `uso-pre-migracao-ganha-a-coluna` case checks the three columns.
- `brain-mcp/scripts/uso-sessao.mjs` — new test, exactly as the test plan row describes (temp DB with the old `uso` schema, temp config with no roots, `BRAIN_SOMENTE_CONSULTA=1`, never the live index).

NOT in scope: anything under `brain-mcp/scripts/painel/`, `package.json`, `scripts/uso.mjs`, hooks, `jev.js` (F1 owns them). No tool changes behavior or response.

## Verification

From `brain-mcp/`:
- `npm run build`
- `node scripts/uso-sessao.mjs` → code 0
- `npm run concorrencia` → code 0
- `npm run smoke` and `npm run eval -- --base origin/dev` with `BRAIN_DB=/home/leo/notoria/claude/brain-mcp/data/brain.db` and `BRAIN_CONFIG=/home/leo/notoria/claude/brain-mcp/brain.config.json` (read-only on the index). Code 1 or 2 is red.
- After smoke/eval: confirm no new row in the live `uso` carries a non-null `sessao` (R4) — a read-only `SELECT COUNT(*) FROM uso WHERE sessao IS NOT NULL` (the live DB may not have the column yet; then there is nothing to check, say so).
- Acceptance criteria covered: the `uso` criterion of card #68 (new rows carry `sessao` and `tool_use_id`; old DBs migrate without loss; old rows stay `NULL`); R4 for `uso.sessao`.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #68` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
