✅ Status: Complete

# Task 2: parte hook do jev.mjs sobre um índice de prova montado pelo teste

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/51-t16-independente/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently). **What governs this task are the blocks dated `Emenda 2026-11-24`**: where they contradict the rest of the spec (the original CA1/CA2, the Implementation Details of 11/11, task 1), the amendment wins.

The code lives in the `claude-brain` repository, worktree `/home/leo/pessoal/claude-brain-51-t16-sem-indice` — **its own git repository**; run every git command from inside it. The amendment's `## Execution` names the branch: `fix/51-t16-sem-indice`, created with `git switch -c fix/51-t16-sem-indice origin/dev` (a88e7a8) by `/gm-implement`. The worktree starts detached with the amended `spec.md` modified and an untracked `sensibilidade.json` (written by `/gm-spec`); `git switch -c` carries both.

This is task 2 of 2. Task 1 (PR #56) is already in `origin/dev`: `aprovadosDoT16`, `roteiroDoT16` and the synthetic case (CA3) exist and do not change.

Premises this task leans on (spec, `## Premissas medidas`, block `Emenda 2026-11-24: premissas do índice de prova`): the defect reproduces on a88e7a8 (T16 `NÃO MEDI`, exit 2); the hook finds the `.db` through `BRAIN_WORKSPACES` and the `dist/` at `dirname(db)/../dist`, so the hook itself does not change; from the `dist/` the hook uses only `openDb`, `Buscador`, `tokensDe` and `normalizar`; the entity path reads only `entidades`, `arestas`, `docs` and `chunks`; `node:sqlite` loads on Node 26.12.0 and 22.23.5; the amendment's code, applied as written in `/tmp/prova51c`, exits 0 in both runs of CA1' and the two sabotages exit 1 and 2.

## Scope

Exactly items 1-10 of the spec's `### Emenda 2026-11-24 — índice de prova`:
- `brain-mcp/scripts/jev.mjs`: header; removal of the live-index pre-flight and of `CWD_DE_PROVA` under `~/pessoal`; the proof index (item 3, code as written); `rodarHook` pinning `BRAIN_WORKSPACES`; no more repetitions in `parIgual`, T13 and T16; texts of the T11/probe/T15 preconditions; T16 over the probe's `enviados` expecting `7,8,9,10`; last line; no dead import.
- `brain-mcp/README.md:282` — the `npm run jev` line (item 10).

Does NOT touch: `hooks/` (so `node scripts/classificar-parada-teste.mjs` does not apply), `brain-mcp/src/` (no build/smoke/eval), `brain-mcp/scripts/injecao.mjs`, `brain-mcp/package.json`, `skills/`, `PROMPT_DE_PROVA`, `aprovadosDoT16`, `roteiroDoT16`, the synthetic case, T1-T10, anything in T11-T15 beyond what the amendment lists. No Jev API, no `TYPESAFE_API_KEY`, fake client only. No new dependency (→ stop); no `npm ci`/`install`. Never the main checkout `/home/leo/pessoal/claude-brain`, the #66 worktrees, the `fix/51-t16-independente` worktree, or the live install (`~/.claude`, `/home/leo/notoria/claude/brain-mcp`); no `sync.sh push`.

## Verification

From `brain-mcp/`, with no `BRAIN_JEV`, `TYPESAFE_API_KEY` or `BRAIN_JEV_FALSO` in the env, Node from the PATH (26.12.0):

- CA1' (a): `npm run jev 2>&1 | grep -E '^(jev:|FALHOU|NÃO MEDI)'; echo ${PIPESTATUS[0]}` → `0`, with `jev: T1-T10 OK …`, `jev: T16 escolha sintetica OK (sem indice)` and `jev: T11-T16 OK (parte hook; cliente falso, indice de prova, sem rede)`, in that order.
- CA1' (b): the same with `BRAIN_WORKSPACES=/nao/existe.json` in front → same three lines, `0`.
- CA1' (a) once more with `PATH=/home/leo/.local/share/mise/installs/node/22.23.5/bin:$PATH` → `0` (the `ExperimentalWarning` on stderr is not a failure).
- CA2', manual and **not committed**: (a) `esperados.slice(1)` in T16 → exit `1`; (b) 6th name of the results list `"e"` → `"e2"` → exit `2` on `NÃO MEDI … aprovados 6,7,8,9,10 de 10`. *(Amendment 2026-11-24, G4 finding 1: now exit `1` on `FALHOU: T16 pre-condicao: aprovados 6,7,8,9,10 de 10 …`.)* Revert both and confirm `git diff` shows neither.
- CA4: `grep -n "brain-workspaces\|cfgDoHook\|carregar()\|homedir(), \"pessoal\"" scripts/jev.mjs` finds nothing.
- Acceptance criteria covered: CA1', CA2', CA3 (unchanged, regression), CA4.

Any exit other than 0 in CA1' that you cannot resolve within the spec → stop with the output.

## Completion Checklist

- [ ] Items 1-10 of the amendment implemented as written
- [ ] Verification green (both CA1' runs, Node 22 run, both sabotages reverted, CA4 grep empty)
- [ ] No unused imports (`existsSync`, `dirname`, `homedir` still used, per item 9); no duplicated ones

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first (the grep lines and exit codes of the three runs), then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, adding by name only `brain-mcp/scripts/jev.mjs`, `brain-mcp/README.md`, `planning/51-t16-independente/spec.md` and this task file (never `git add -A`; `sensibilidade.json` stays untracked, as in every other planning folder), message `fix(jev): …(#51)` ending with the trailers `Card: #51` and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
