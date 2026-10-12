❌ Status: Not Started

# Task 3: `gm-release` lê o ensaio do `CLAUDE.md`, e o template declara o campo

## Context

- **Spec**: [`planning/29-limpeza-skills/spec.md`](../spec.md) — ALL requirements and decisions. Follow it strictly; if reality contradicts it, STOP (deviation protocol).
- **Trechos normativos**: [`trechos/gm-release-ensaio.md`](../trechos/gm-release-ensaio.md) (five numbered substitutions) and [`trechos/template-docs-claude-md.md`](../trechos/template-docs-claude-md.md), **parte A only**. Copy verbatim what comes below each `---`.
- Repo `claude-brain`. Work only in the worktree `C:/Users/lokin/pessoal/claude-brain-29-limpeza`, branch `feat/29-limpeza-skills`. Never run `sync push`, never write to `~/.claude`, never touch the main checkout or the sibling worktrees.

This is task 3 of 4. Tasks 1 and 2 are in the codebase: `gm-release` is already stamped, so its lines below the first block sit one lower than the spec's `origin/dev` numbers — **locate by the quoted text**, which is why each `###` of the trecho names the sentence it replaces.

## Scope

Spec áreas **5 and 6** — requirement 3a and the `templates/` half of requirement 5. The point: a public skill must not assert a fact about one workspace's infrastructure. The ensaio becomes something the skill **reads from the workspace `CLAUDE.md`**, in the same mould as the typecheck of Fase 1.

- `skills/gm-release/SKILL.md`: the five substitutions of the trecho — the `## Hard rules` bullet (`:49`), the two opening paragraphs of `## Phase 3 — Ensaio` (`:135-137`, which become one), the first paragraph inside the quoted question (`:139-141`), the *Segurar o trem* bullet (`:143-144`), and at `:158` only `the design` → `this skill`. Declared → run it and record under `### Ensaio`; not declared or `não` → the same question as today, now saying "este workspace não declara um ambiente de ensaio". The empty `>` line (`:142`), the other two options, the *Promover assumindo o risco* paragraph and `### Ensaio` in the notes (`:180`, `:238`) **stay**.
- `templates/CLAUDE.example.md`, `## Convenções da esteira` (`:74-84`): parte A of the other trecho — the new *Ambiente de ensaio* bullet right after *Segundo humano*, and the *Despacho* bullet replaced so it recommends keeping the orchestrating session's instructions in a file only it reads. **This is the only place point 4 of the triagem lands**; the Notoria workspace `CLAUDE.md` is explicitly out of scope.

NOT in scope, and deliberately left as it is (spec decision 8 filed it for a card of its own): `gm-release:51` (`deploy.yml`, `yarn deploy -p`, Prisma), the detection heuristic with `prisma/` paths (`:121-125`), and `gm-hotfix:180`. Nothing inside the two stamped blocks changes. `docs/`, `CLAUDE.md` and `README.md` are task 4's.

## Verification

- `grep -n "does not exist yet\|CDK\|RDS\|Fase 3\|design calls for\|the design recommends" skills/gm-release/SKILL.md` → empty (lines 49, 135, 137, 158 today).
- `grep -n "Ambiente de ensaio" skills/gm-release/SKILL.md` → ≥ 2 (`0` today).
- `grep -n "Ambiente de ensaio\|orquestradora" templates/CLAUDE.example.md` → ≥ 2.
- The question still exists and still has three ways out: the `AskUserQuestion` call, `header` `Ensaio`, and the *Promover assumindo o risco* paragraph are all still in `## Phase 3 — Ensaio`.
- The stamp survived: `node scripts/skills-comum.mjs --check; echo $?` → `0`.
- `git diff --stat` touches only `skills/gm-release/SKILL.md` and `templates/CLAUDE.example.md`.

Acceptance criteria covered: **3a**, and the `templates/CLAUDE.example.md` part of **5**.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Every verification command above run, with its output pasted into the commit body
- [ ] `--check` still `0`; nothing outside the two files changed
- [ ] The skill now *reads* whether an ensaio exists; it neither asserts nor assumes one

## Workflow

1. Implement; run the checklist.
2. Summarize: the verification result first, then a risk-ranked reading order.
3. Commit in the worktree with `git commit -F <file>`, trailer `Card: #29`, identity `leonardo-amaral-3 <frashdopredio2005@gmail.com>`.
4. Flip the first line of this file to `✅ Status: Complete` and tick item 3 in the card's `<!-- gm:tasks -->` comment.
