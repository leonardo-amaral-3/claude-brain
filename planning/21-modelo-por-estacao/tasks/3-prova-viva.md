✅ Status: Complete

# Task 3: `scripts/prova-modelo.mjs` — parte viva

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/21-modelo-por-estacao/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `claude-brain` repository of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/21-modelo-por-estacao`, in the worktree `claude-brain-21-modelo-por-estacao`, already checked out by `/gm-implement`). Shell: Git Bash, from the root of that worktree.

This is task 3 of 4. Tasks 1 and 2 are already in the codebase: the table and the frontmatter, and `scripts/prova-modelo.mjs` with the arguments and the static part.

## Scope

The **Parte viva** of `scripts/prova-modelo.mjs`, items 1 to 4 of the spec (executable, version, choosing the probes, each probe with its two rounds, transcript assertions, evidence line, cleanup in `finally`, final output), plus the whys of the live part in the top comment, per the spec's `## Coding Standards`. Read `TD-7`, `TD-8` and `TD-9` before starting: they are the reasons behind the details that look arbitrary.

**Out of scope:** `./sync.sh push` and any real probe. **Do not run `--viva` in a way that reaches a probe in this task** — it spends quota, and before the push the installation does not carry the models, so the proof would not mean anything. The probe code runs for real for the first time in task 4 (T5); a defect found there is fixed there. No edit to skills, the doc, or the static part beyond what the live part needs to hook in.

## Verification

Only the checks that stop **before** any probe. From `## Plano de testes` of the spec:

- **T7**, as written — red static part: exit `1`, `FALHA: repo gm-ship sem model:`, and no `BRAIN_CLAUDE_BIN aponta para` nor `bin:` line. (Before the push, installation failures also show up; the criterion still holds.)
- **T8**, on a copy — as written it runs against the real installation, whose static part is red until task 4, so here it has to run where the static part is green:
  ```bash
  T=$(mktemp -d); cp -R skills docs "$T/"; mkdir -p "$T/home"; cp -R skills "$T/home/"
  BRAIN_CLAUDE_BIN=/nao/existe CLAUDE_CONFIG_DIR="$T/home" node scripts/prova-modelo.mjs --viva --repo "$T"; echo "saiu $?"; rm -rf "$T"
  ```
  Exit `1`, `FALHA: BRAIN_CLAUDE_BIN aponta para`, `estática: 12 ok` before it, and no probe line. Task 4 runs T8 again as written.
- **T6** and **T12** again, as written — the static part and the arguments must not have regressed.

Plus one local check that is not in the plan and costs nothing: the version gate, against the old Claude Code 2.1.212 that exists on this machine (`~/.local/bin/claude.exe`, `## Estado atual` of the spec). It only runs `--version`:

```bash
T=$(mktemp -d); cp -R skills docs "$T/"; mkdir -p "$T/home"; cp -R skills "$T/home/"
BRAIN_CLAUDE_BIN="$HOME/.local/bin/claude.exe" CLAUDE_CONFIG_DIR="$T/home" node scripts/prova-modelo.mjs --viva --repo "$T"; echo "saiu $?"; rm -rf "$T"
```

Exit `1`, the FALHA about `2.1.212` below `2.1.257`, and no probe line. If that binary no longer exists, say so and skip the check — do not look for another one.

- Acceptance criteria covered: **CA2** — the code that proves it, and its guards (live part only with a green static part; executable and version checked before spending quota). The proof itself closes in task 4.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables (`node --check scripts/prova-modelo.mjs`)

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog. Say explicitly which parts of the live code no check has exercised yet: that is what task 4 will be the first to run.
3. Commit from inside the `claude-brain` worktree, message ending with the trailer `Card: #21` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
