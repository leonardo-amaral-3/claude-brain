❌ Status: Not Started

# Task 4: O push pelo protocolo e a prova viva

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/21-modelo-por-estacao/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `claude-brain` repository of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/21-modelo-por-estacao`, in the worktree `claude-brain-21-modelo-por-estacao`, already checked out by `/gm-implement`). Shell: Git Bash, from the root of that worktree.

This is task 4 of 4. Tasks 1..3 are already in the codebase: the table, the frontmatter, and `scripts/prova-modelo.mjs` complete — but its live part has never run a probe.

## Scope

This repo's deploy and the proof that closes CA2:

- **The push**, by the three-step protocol of the spec's `## Execution`, and nothing looser: the status must list exactly the 12 `skills/gm-*/SKILL.md`; `--sobrescrever` only after the human picks it in the `Sync` question the spec describes (its consequence spelled out in the option's `description`); anything else in the list stops the push. Read `TD-10` and `TD-11`.
- **Moment 1 of `## Verificação pós-deploy`**, right after the push.
- **The evidence:** the output of T5, literal, in the `## Evidência` section at the end of this file.
- **Fixes to `scripts/prova-modelo.mjs`** that T5 reveals, when the script is what disagrees with the spec. If what disagrees is reality (auto mode, the transcript, the model), that is the deviation protocol, not a fix.

**Out of scope:** moment 2 of `## Verificação pós-deploy` (it happens after the merge into `dev`, outside any task); `brain-mcp/` of any card; editing `~/.claude` by hand; `npm run build` (nothing in `brain-mcp/` is part of this card).

**Known before you start — planning, 2026-09-14.** The spec's `## Estado atual` describes `origin/dev` at `74f97a2` with the #18 worktree open. At planning time `origin/dev` was at `396ddb6` (card #18 merged by PR #23), the #18 worktree no longer existed, and the installation matched `main` (`./sync.sh status` → `Tudo igual` from the `main` checkout). A branch cut from that `dev` carries 11 `brain-mcp/` files of #18 that are **not** installed, so step 1 of the protocol is expected to list them and **stop the push**. Re-check it — the machine may have changed since. If the list has anything besides the 12 skills: stop, show the list to the human, do not push, and follow the deviation protocol. Whether #18 goes to the installation together, or the spec is amended, is the human's decision — not yours.

## Verification

From `## Plano de testes` of the spec, after the push, as written there:

- **T2** — `./sync.sh status` contains `Tudo igual entre repo e maquina.`
- **T1** — `node scripts/prova-modelo.mjs`: exit `0`, 12 `ok` lines, `estática: 12 ok`.
- **T8**, now as written — against the real installation.
- **T5** — `node scripts/prova-modelo.mjs --viva`, from Git Bash: exit `0`, `bin: … (2.1.266)`, the three evidence lines `ok` the spec lists, `init auto` in all, `viva: 3 ok`. It spends quota and runs up to six headless sessions, so it can outlast a foreground tool call: run it in the background and wait for it. Paste the output, literal, in `## Evidência`.
- **T9** — after T5: `0` and `0`.
- **T11** — complete, as written, on the committed branch.

If T5 fails because of the script and you fix it, run **T6**, **T7** and **T12** again before running T5 once more — and say how many times T5 ran, since each run spends quota.

- Acceptance criteria covered: **CA1** (the installation half: repo and installation say the same) and **CA2** in full.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables
- [ ] `## Evidência` holds the literal output of T5

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the `claude-brain` worktree, message ending with the trailer `Card: #21` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.

## Evidência

_(vazia até o T5 rodar — a saída entra aqui literal, dentro de um bloco de código, e é daqui que o `/gm-ship` a leva para a PR)_
