❌ Status: Not Started

# Task 2: `gm-spec` exige premissas medidas e `gm-plan-tasks` recusa sem elas

## Context

- **Spec**: [`planning/28-processo-esteira/spec.md`](../spec.md) — ALL requirements and decisions. Follow it strictly; if reality contradicts it, STOP (deviation protocol).
- **Trechos normativos**: [`trechos/epico-e-premissas.md`](../trechos/epico-e-premissas.md), trechos **A, B, C** — copy verbatim.
- Repo `claude-brain`. Work only in the worktree `C:/Users/lokin/pessoal/claude-brain-28-processo`, branch `feat/28-processo-esteira`. Never run `sync push`, never write to `~/.claude`, never touch the main checkout or the sibling worktrees.

This is task 2 of 5. Task 1 is in the codebase: every skill now ends with the stamped `## Modo despachado` (appended at EOF, so nothing above it moved). Locate text by quoting it.

## Scope

Spec **Área 2** — requirement 1. Premissas it depends on: row 1 (`--check` as the invariant).

- `skills/gm-spec/SKILL.md`: trecho A in the Phase 2 skeleton, trecho B as the first bullet of Phase 3, and the Phase 4 "no human" sentence replaced as Área 2 states (without it the skill contradicts the *Aprovar artefato* row of `## Modo despachado`).
- `skills/gm-plan-tasks/SKILL.md`: trecho C as the paragraph after the `## Setup` one.

NOT in scope: Phase 6 of `gm-spec` (task 3), anything inside the stamped blocks.

## Verification

- `grep -n "## Premissas medidas" skills/gm-spec/SKILL.md skills/gm-plan-tasks/SKILL.md` → hits in both; in `gm-spec` the line sits between `## Requisitos & critérios de aceite` and `## Technical Overview` of the skeleton.
- `grep -n "Unmeasured premises" skills/gm-spec/SKILL.md` → the first bullet of Phase 3.
- `grep -n "no handover" skills/gm-spec/SKILL.md` → the new Phase 4 sentence; `grep -c "closes with \`PARADA: spec aguardando o gate\`\.$" skills/gm-spec/SKILL.md` → `0`.
- `node scripts/skills-comum.mjs --check; echo $?` → `0`.
- `git diff --stat HEAD` touches only those two skills.

Acceptance criteria covered: **1**.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Every verification command above run, with its output pasted into the commit body
- [ ] Trechos verbatim; new prose lines ≤ 100 columns

## Workflow

1. Implement; run the checklist.
2. Summarize: the verification result first, then a risk-ranked reading order.
3. Commit in the worktree with `git commit -F <file>`, trailer `Card: #28`, identity `leonardo-amaral-3 <frashdopredio2005@gmail.com>`.
4. Flip the first line of this file to `✅ Status: Complete` and tick item 2 in the card's `<!-- gm:tasks -->` comment.
