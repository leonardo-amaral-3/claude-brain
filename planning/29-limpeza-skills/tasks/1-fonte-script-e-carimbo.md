✅ Status: Complete

# Task 1: A fonte, o script e o carimbo nas 11 skills

## Context

- **Spec**: [`planning/29-limpeza-skills/spec.md`](../spec.md) — ALL requirements, decisions and the per-area detail. Follow it strictly; if reality contradicts it, STOP (deviation protocol), do not improvise.
- **Trechos normativos**: [`planning/29-limpeza-skills/trechos/`](../trechos/) — copy them **verbatim**, never retype. In each file, what is above the `---` (or between the `###` and the `---`) is meta; the content to copy is what comes below.
- Repo `claude-brain` (**public**: no customer data in `planning/`). Work only in the worktree `C:/Users/lokin/pessoal/claude-brain-29-limpeza`, branch `feat/29-limpeza-skills`. Never run `sync push`, never write to `~/.claude`, never touch the main checkout or the sibling worktrees.

This is task 1 of 4. It comes first because the stamp shifts every line below the first block by +1 in all 11 skills — tasks 2 and 3 locate their text **after** that shift.

## Scope

Spec areas **1, 2 and 3** — requirements 1, 3b, 3c (the `skills/` half) and 4.

- `skills/_comum/convencoes.md` (new, spec Área 1): preâmbulo verbatim from `trechos/convencoes-preambulo.md` (the whole file, title included), then the two `##` sections lifted from `skills/gm-card/SKILL.md` on `origin/dev` — `:14-47` (md5 `bdfba0e2ee2c0b75f638504e9b71f3fe`) and `:166-190` (md5 `9cc7f4db5f20dc9a57bf52224d7433c1`) — each with its **first paragraph** replaced by the matching `###` of `trechos/cabecalhos-blocos.md`. Exactly two `## ` sections; the Fase 2 table (#28) is **named in the preâmbulo and not written**.
- `scripts/skills-comum.mjs` (new, spec Área 2): stamps by default, compares with `--check`. The fence rule, the one-block-only guard, the three exit codes, the output format and the idempotence requirement are all specified — read Área 2 whole before writing it. `scripts/` does not exist yet.
- The 11 skills (spec Área 3): the two blocks arrive **by running the script**, never by hand. No other line of those files changes in this task.
- Include `planning/29-limpeza-skills/` (spec, `trechos/`, `tasks/`) in this commit.

NOT in scope: `gm-tech-spec` (it has neither block — the script must say `sem bloco` and carry on); `gm-ship`'s `## Open the PR` (task 2); `gm-release` (task 3); `docs/`, `CLAUDE.md`, `README.md`, `templates/` (tasks 3 and 4). The `grep -n "onze" docs/esteira-gm.md` half of CA3c is task 4's.

## Verification

The repo has no suite for skills — the proof is mechanical and goes in the commit body and the `gm:tasks` comment. Run the whole CA1 block of the spec's `## Plano de testes`, which is:

- `node scripts/skills-comum.mjs --check; echo $?` → `0`, last line `11 skills × 2 blocos iguais à fonte`.
- Negative in the **body**: `sed -i 's/one question per call/one question per call!/' skills/gm-explore/SKILL.md` → `--check` exits `1` naming `gm-explore · Como perguntar e como aprovar · divergente`. Restore with `node scripts/skills-comum.mjs` — **not** `git checkout`, which before the commit would give back the unstamped copy.
- Negative in the **header**: `sed -i 's/^## Convenções de saída$/## Convencoes de saida/' skills/gm-explore/SKILL.md` → `--check` exits `1` naming `gm-explore: um bloco só`. Undo with the inverse `sed` and stamp again.
- Idempotence: stamp twice in a row — the second prints only `igual` and `git status --short` does not move.
- `grep -L "_comum/convencoes.md" skills/gm-*/SKILL.md` → only `gm-tech-spec`.
- `grep -rn "eleven" skills/` → empty (44 lines today); `grep -rn "esteira-gm.md" skills/ | grep -v "claude-brain"` → empty (11 today).
- `grep -c "^## " skills/_comum/convencoes.md` → `2`; `grep -n "#28" skills/_comum/convencoes.md` → ≥ 1.
- Char count: `wc -c skills/gm-*/SKILL.md | tail -1` before is **183.391** (12 files; 182.696 in the 11). Note the after-value and the delta — the difference is small, and the spec's decision 3 says so out loud rather than hiding it.

Acceptance criteria covered: **1, 3b, 3c (skills), 4**.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Every verification command above run, with its output pasted into the commit body
- [ ] `--check` exits `0`; the two negatives exit `1` and were undone
- [ ] Skill frontmatter untouched; no line outside the two blocks changed in the 11
- [ ] No workspace-specific name leaked into a skill or into `_comum/`

## Workflow

1. Implement; run the checklist.
2. Summarize: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit in the worktree with `git commit -F <file>` (long body never inside an argument), trailer `Card: #29`, identity `leonardo-amaral-3 <frashdopredio2005@gmail.com>`.
4. Flip the first line of this file to `✅ Status: Complete` and tick item 1 in the card's `<!-- gm:tasks -->` comment.
