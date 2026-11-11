❌ Status: Not Started

# Task 1: T16 exclui os candidatos que colidem, com caso sintético sem índice

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/51-t16-independente/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `claude-brain` repository, worktree `/home/leo/pessoal/claude-brain-51-t16-independente` — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`fix/51-t16-independente`, already checked out by `/gm-implement`).

This is task 1 of 1.

Premises this task leans on (spec, `## Premissas medidas`): the defect reproduces on the base (exit 2 in the T16 `NÃO MEDI`); today's 10 candidates (8, 9 and 10 repeat 1, 2 and 3); the prototype of the new rule approves positions 6 and 7 with header `2 de 10`; the fake matches by substring of the normalized path, first rule wins; `norm` equals `normalizarCaminho`; `jev.julgar` takes env and script by options, with no network; where today's `NÃO MEDI` lives (`brain-mcp/scripts/jev.mjs:517-536`).

## Scope

Only `brain-mcp/scripts/jev.mjs`, exactly the four changes in the spec's `## Implementation Details`:
- `aprovadosDoT16` and `roteiroDoT16`, between `naoMedi` and `const repo`;
- the synthetic case (CA3), right after them and before the index pre-flight, printing `jev: T16 escolha sintetica OK (sem indice)`;
- the live T16 block replaced by the one in the spec (CA1, CA2);
- line 2 of the header comment.

Does NOT touch: `hooks/`, `brain-mcp/scripts/injecao.mjs`, `brain-mcp/src/`, `brain-mcp/package.json`, `PROMPT_DE_PROVA`, T1-T15, `skills/`, docs. Nothing calls the Jev API: no `TYPESAFE_API_KEY`, fake client only, no network. Do not touch the main checkout, the sibling worktrees or the live install (`~/.claude`, `/home/leo/notoria/claude/brain-mcp`); no `sync.sh push`; no `npm ci`/`install`.

## Verification

Node 22: `PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH`, with no `BRAIN_JEV`, `TYPESAFE_API_KEY` or `BRAIN_JEV_FALSO` in the env.

- Command(s) that must pass, from `brain-mcp/`:
  - `npm run jev` → exit `0`, last line `jev: T11-T16 OK (parte hook; cliente falso, sem rede)` (CA1, CA2, regression T1-T15).
  - `BRAIN_WORKSPACES=/nao/existe.json node scripts/jev.mjs` → stdout has `jev: T16 escolha sintetica OK (sem indice)`, then exit `2` on the pre-flight `NÃO MEDI: sem lista de workspaces utilizavel …` (CA3).
- Manual checks, **not committed** (spec, `## Plano de testes`): temporarily swap `esperados` for `esperados.slice(1)` → exit `1`, then revert; read the code to confirm the T16 `NÃO MEDI` only remains in `if (!aprovados.length)`.
- Sanity of the batch (spec, `## Plano de testes`; the script is not touched): `node scripts/injecao.mjs --desde 2026-11-03 --ate 2026-11-09 --base origin/dev --portao jev` (the window of `planning/42-filtro-jev/spec.md`; the gate requires `--desde`, `--ate` and `--base` explicit) still exits 0. Its output does not go to PR or card, only the count lines. Anything other than 0 is out of scope → stop.
- Acceptance criteria covered: CA1, CA2, CA3.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables (no duplicated imports: `mkdtempSync`, `rmSync`, `writeFileSync`, `tmpdir`, `join` already exist)

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, only `brain-mcp/scripts/jev.mjs` added by name (never `git add -A`), message `fix(jev): … (#51)` ending with the trailers `Card: #51` and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
