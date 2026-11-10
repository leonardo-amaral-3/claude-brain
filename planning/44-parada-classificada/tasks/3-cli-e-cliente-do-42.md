❌ Status: Not Started

# Task 3: A CLI e a costura com o cliente do #42

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/44-parada-classificada/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the worktree `~/pessoal/claude-brain-44-parada-classificada` — **its own git repository** (the `claude-brain` repo); run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/44-parada-classificada`, already checked out by `/gm-implement`).

This is task 3 of 4. Tasks 1 and 2 are already in the codebase.

**Precondition — do not start without it (spec, `## Execution`).** Implementation only begins after the branch has been rebased onto `feat/42-filtro-jev`, and that branch must already carry the commit of the Jev client written to the contract of the #42 spec (the card #42 must have its `<!-- gm:spec -->` comment). If either is missing, stop with `PARADA` and say which one.

**This task depends on the real client of #42.** The #44 does not create a client: no HTTP, no key, no flag (spec, `### Premissa NÃO provada`). Read the #42 spec and its client module first, then apply the rule in that section without deciding anything yourself:
- *Same information, another shape* → adapt inside `daFormaDo42()` in `scripts/classificar-parada.mjs`. This is not a deviation.
- *Missing information* (no choice from a list, no network-free "is it on", fewer than eight options accepted, a per-consumer flag with none for #44) → this is an **amendment of the spec**. Stop with `PARADA`. Do not improvise.

The Jev API is never called. There is no key on this machine, and Leonardo has not authorized sending corpus excerpts to TypeSafe AI. C9b runs the real client **off**, in an isolated environment. Anything that would need the real API on is CA4 and is not part of this task.

## Scope

- `scripts/classificar-parada.mjs`: `daFormaDo42()`, the default `cliente` (a static import of the #42 module by a path relative to `scripts/`), the default `lerConvencoes` if task 2 left it inline, `rodarCli` (steps 1–5, the exit inside the write callback, unexpected exception → code `1`) and the entrypoint guard (`realpathSync`, lowercase on `win32`), as in `## Implementation Details`.
- `scripts/classificar-parada-teste.mjs`: add C9 (a)–(d) as in `## Plano de testes`. In C9b, neutralize **every** flag/key source the #42 spec names, whether environment variables or files, plus `HOME`, `USERPROFILE` and `CLAUDE_CONFIG_DIR` pointing at an empty `mkdtempSync` directory.
- **Out of scope:** any change to the #42 client or its module (it belongs to #42), a second Jev client, and the docs (task 4).

## Verification

- Command(s) that must pass: `node scripts/classificar-parada-teste.mjs` (exit `0`, with C1–C9 complete) and `node scripts/skills-comum.mjs --check` (exit `0`).
- Also run by hand the isolated `desligado` command from `## Verificação pós-deploy`, part 1, with the variable names the #42 spec fixed. The expected output is code `0` and the `desligado` line.
- Acceptance criteria covered: CA2 (the process half: the real client off answers `desligado` with code `0`, and the process ends even when the client ignores the abort) and R2 (the CLI exit codes and the empty stdout on `1`/`2`).
- **Depends on Leonardo's approval (not this task):** CA4, a real classification of the 19 `PARADA`s with latency. It stays as a PR pending item.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code runs; no unused imports/variables
- [ ] The summary names which #42 shape differences `daFormaDo42()` absorbs, or says there are none

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, message ending with the trailer `Card: #44` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
