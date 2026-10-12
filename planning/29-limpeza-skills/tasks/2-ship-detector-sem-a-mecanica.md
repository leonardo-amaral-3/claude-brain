✅ Status: Complete

# Task 2: `gm-ship` fica com o detector, sem a mecânica da emenda

## Context

- **Spec**: [`planning/29-limpeza-skills/spec.md`](../spec.md) — ALL requirements and decisions. Follow it strictly; if reality contradicts it, STOP (deviation protocol).
- **Trecho normativo**: [`trechos/gm-ship-open-the-pr.md`](../trechos/gm-ship-open-the-pr.md) — copy **verbatim** what comes below the `---`.
- Repo `claude-brain`. Work only in the worktree `C:/Users/lokin/pessoal/claude-brain-29-limpeza`, branch `feat/29-limpeza-skills`. Never run `sync push`, never write to `~/.claude`, never touch the main checkout or the sibling worktrees.

This is task 2 of 4. Task 1 is in the codebase: the two common blocks are now **stamped** into `gm-ship` too, so every line below the first block sits one line lower than the spec's `origin/dev` numbers. Locate the text by quoting it, not by line number.

## Scope

Spec área **4** — requirement 2. Why it is split this way: the card #2 decision holds, `gm-ship` **detects** and `gm-implement` **executes**; the ship only loses the paragraphs that re-explain the mechanics.

- `skills/gm-ship/SKILL.md`, `## Open the PR`: replace the run from "**Antes de escrever o corpo**" through "**Não confunda com a precondição 2**" (inclusive — `:55-69` on `origin/dev`, `:56-70` after the stamp) with the trecho. It keeps the **mechanical detector** (a criterion that only passes by reinterpreting the spec) and points at `## Emenda pós-tasks` in `gm-implement` instead of repeating how the amendment works.
- Step 1 (`git push`) above and step 2 (the body) below stay where they are. The amendment comment inside the PR-body template (`:95-98` on `origin/dev`) stays.

NOT in scope: **`skills/gm-implement/SKILL.md` is not touched at all** — its `## Emenda pós-tasks` section is the single home of the mechanics and must come out of this task byte-identical. Nothing inside the two stamped blocks of `gm-ship` changes either (that is what keeps `--check` green).

## Verification

- Emenda intact in `gm-implement`, cut **by header** (the stamp moved it +1, so a line range would lie):
  `git show origin/dev:skills/gm-implement/SKILL.md > "$TEMP/impl-dev.md"; for f in "$TEMP/impl-dev.md" skills/gm-implement/SKILL.md; do awk '/^## Emenda pós-tasks/{f=1} f&&/^## Present for review/{exit} f' "$f" | md5sum; done` → two identical md5, both `024eed2007e0c482d55bd98bc7cfe41b`.
- `grep -n "nasce a task\|re-proporia\|que é autoria" skills/gm-ship/SKILL.md` → empty (lines 64-65 today).
- `grep -c "Emenda pós-tasks" skills/gm-ship/SKILL.md` → ≥ 1 (`0` today).
- The stamp survived: `node scripts/skills-comum.mjs --check; echo $?` → `0`.
- `git diff --stat` touches `skills/gm-ship/SKILL.md` and nothing else under `skills/`.

Acceptance criteria covered: **2**.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Every verification command above run, with its output pasted into the commit body
- [ ] `gm-implement` untouched (md5 proves it); `--check` still `0`
- [ ] The detector is still there — the mechanical trigger, not only a pointer

## Workflow

1. Implement; run the checklist.
2. Summarize: the verification result first, then a risk-ranked reading order.
3. Commit in the worktree with `git commit -F <file>`, trailer `Card: #29`, identity `leonardo-amaral-3 <frashdopredio2005@gmail.com>`.
4. Flip the first line of this file to `✅ Status: Complete` and tick item 2 in the card's `<!-- gm:tasks -->` comment.
