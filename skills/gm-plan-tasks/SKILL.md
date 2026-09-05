---
name: gm-plan-tasks
description: Break a spec into ordered, independent implementation tasks — each task file is the complete prompt for a fresh agent. Proposes the whole breakdown at once for the user to veto/adjust; enforces the 6-8 task ceiling; mirrors the task list on the card. Use after gm-spec, before /gm-implement.
disable-model-invocation: true
argument-hint: [feature-folder]
---

# Task Planner

You are a senior engineer breaking a planned implementation into discrete, ordered tasks, each executed by an independent agent in a fresh context window.

## Setup

Read `planning/$ARGUMENTS/spec.md` (older folders: `tech-spec.md` + `PRD.md`). Note `## Execution` (target repo, feature branch — branch management belongs to `/gm-implement`, not to the tasks) and `## Plano de testes`. Then explore the current state of the files that will change.

## Phase 1: Propose the breakdown — whole, at once

Present the **entire** proposed breakdown in one shot (numbered list: title + one-line scope + the test that closes it) and let the user veto or adjust. No question-by-question ceremony.

Rules of division:

- **Code must compile after each task** — no type errors, no broken builds. Primary constraint.
- **Each task names its verification** — the test command/suite that must pass, from the spec's test plan. "Compila" is not a Definition of Done.
- **Dependency order** — schema → backend → frontend (adapt); no task depends on a future task.
- **Ceiling: 6–8 tasks, per card in flight.** More than that means the card is an epic in disguise — stop, say so, and send it to **`/gm-spec` Phase 6** (slicing is gm-spec's job, not gm-card's: the phase structure is an output of specification). Don't paper over it with a longer list. Deliver what you can: if the first phase already fits the ceiling, propose *its* breakdown in the same breath, so the rebound arrives with work attached instead of empty-handed.
- **On an epic, you are planning the child card, not the parent.** Read the child's `<!-- gm:spec-ref -->` comment: it names the spec sections this phase covers and, just as importantly, what is deliberately out of scope. Task files live in `tasks/<fase>/`, point at the spec with `../../spec.md`, and carry the **child's** number in the `Card: #` trailer — the epic's number never goes in a commit.
- **A phase that was not promoted is not plannable — stop.** Every phase of an epic exists as a sub-issue from the slicing on, but a phase still carrying `<!-- gm:fase -->` (instead of `gm:spec-ref`), with no acceptance criteria, no declared route and no place on the board, is roadmap, not work. Say exactly that and send it back to `/gm-spec` Phase 6 for promotion — planning tasks against a thin phase would invent the acceptance criteria that the promotion exists to decide with a human.
- **Sizing is a guess, and guesses fail forward.** A task that turns out oversized during implementation is split there, by `gm-implement`'s slicing protocol, into suffixed sub-tasks (`3a`, `3b`) — the same 6–8 ceiling applies to the total, and blowing through it sends the card back here. So prefer a slightly coarser breakdown over inventing sub-tasks for work you cannot see yet: splitting later is cheap, and a task list padded with speculation is not.

## Phase 2: Write the task files

`planning/$ARGUMENTS/tasks/1-short-description.md`, `2-…` etc. — or `tasks/<fase>/1-…md` when the folder belongs to an epic, since later phases reuse the numbering.

### Task files are agent prompts

Each file is the ENTIRE prompt of a fresh agent — no surrounding context, no history. It defines **scope only**: which part to build, never how — implementation details, business rules and patterns live in the spec; the task points there. Never duplicate spec content.

### Structure

```markdown
❌ Status: Not Started

# Task [N]: [Title]

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/[feature-folder]/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `[repo]/` directory of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task [N] of [total]. Tasks 1..[N-1] are already in the codebase.

## Scope

[boundaries only — which spec sections/files this task covers, and what it does NOT]

## Verification

- Command(s) that must pass: `[test command for this task's area]`
- Acceptance criteria covered: [which items from "Requisitos & critérios de aceite"]

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from inside `[repo]/` with a clear message ending with the trailer `Card: #[issue]`.
4. Flip the first line of this file to `✅ Status: Complete`.
```

### Mirror on the card

Publish the task list as a checklist comment on the card (create-or-update, first line exactly `<!-- gm:tasks -->`):

```markdown
<!-- gm:tasks -->
### Tasks
- [ ] 1 — título
- [ ] 2 — título
```

`gm-implement` ticks the boxes as tasks complete — progress (n/m) visible on the board without opening anything.

### Quality checks before presenting

1. Tasks cover the whole spec — nothing missed. 2. Each leaves the code compilable. 3. No forward dependencies. 4. Each file works as a standalone prompt. 5. No duplication of spec content. 6. Every task names its verification command.

Then offer exactly one follow-up: `/gm-implement $ARGUMENTS` (uma task por sessão, de preferência com `/clear` entre elas).
