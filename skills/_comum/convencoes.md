# Convenções comuns das skills `gm-*`

Este arquivo é a **fonte única** dos blocos que toda skill da esteira repete. Cada seção `##` daqui
é um bloco; `node scripts/skills-comum.mjs` o carimba, byte a byte, em toda `skills/gm-*/SKILL.md`
que já tenha o mesmo cabeçalho — a skill entra no bloco escrevendo o cabeçalho, e sai apagando-o.
`node scripts/skills-comum.mjs --check` compara e sai com `1` se alguma cópia divergiu; é a suíte
do `/gm-ship` para mudança em `skills/`, declarada no `CLAUDE.md` deste repo.

Por que carimbar, e não citar nem incluir — medido em 2026-10-12, no workspace do mantenedor: das
480 sessões que invocaram uma `/gm-*`, **nenhuma** leu o `docs/esteira-gm.md` do `claude-brain` que
o bloco citava (as 9 que tocaram no arquivo eram sessões editando as próprias skills); e `@arquivo`
dentro de um `SKILL.md` só expande com caminho absoluto ou relativo ao `cwd` — relativo à pasta da
skill e `~` são descartados **em silêncio**, e expandir não poupa contexto. Regra que a sessão
precisa seguir tem de estar no texto da skill; o que este arquivo garante é que ela seja escrita
uma vez.

As seções abaixo são instruções de skill: ficam em inglês, e o que o humano lê fica em pt-BR, como
nas skills. Seção nova = cabeçalho novo aqui, o mesmo cabeçalho nas skills que a recebem, e o script.
**Reservado para a Fase 2 do épico #30 (#28):** a tabela de portões do modo despachado — o que cada
skill decide sozinha numa sessão `claude -p` e onde para — entra aqui como terceira seção; até lá,
vale o item 5 do primeiro bloco e o item 4 do segundo.

## Como perguntar e como aprovar

This section is stamped from `_comum/convencoes.md` — the folder beside this skill's; in the
`claude-brain` repo, `skills/_comum/convencoes.md` — into every `gm-*` skill that has an interaction
point. Never edit this copy: edit the source there and run `node scripts/skills-comum.mjs` in that
repo (its `--check` catches a copy that drifted). The long version, for a human reading from outside
the pipeline, is `docs/esteira-gm.md` of the `claude-brain` repo, section `## Como as skills perguntam`.

1. **Context before jargon.** Open with what is at stake and what changes down each path, in
   pt-BR. Spec section, file path, board field and option id come *after* that, when they add
   precision — never as the opening words. Whoever is deciding must not have to open the spec or
   the source just to understand what is being put to them.
2. **Every decision reaches the human through the `AskUserQuestion` tool, one question per call.**
   No batching, no `multiSelect`. Each answer arrives with the previous ones already settled, so
   nothing is decided on a premise that was still open. Five decisions is five calls, in order.
3. **Two standard sets, chosen by what is at stake.**
   - *Artefato* (spec, card body, PR body) → **Aprovar · Ajustar · Rejeitar**. The artifact itself
     goes in the message **before** the call: the tool renders no long body.
   - *Ação irreversível* (commit, merge that triggers a deploy, tag) → **Executar · Revisar antes
     de executar · Cancelar**, with the physical consequence spelled out in each `description`
     ("o deploy de produção começa sozinho"). "Ajustar" means nothing for a merge, and a dead
     option in a menu trains the reflex click this convention exists to kill.
4. **A list longer than four never becomes a silently truncated menu.** The tool takes 2–4
   options. When the real list is longer — pending folders, cards riding a train — the full list
   goes in the message, the options carry the likeliest candidates, and "Other" takes the rest.
   Never drop a candidate without saying that it was dropped.
5. **Silence is never a yes.** "Other" is always available, so free text is never taken away. Do
   not argue one option into being the obvious one. With no human in the session (`claude -p`, a
   subagent), **stop and report what was left to decide** — never assume a default and carry on.

Tool limits, so a question is never rejected or silently cut: 2–4 options per question, `header`
up to 12 characters, `label` 1–5 words, "Other" appended automatically (never write it yourself).
Instructions in this file stay in English; **everything the human reads — the question, the labels
and every `description` — is written in pt-BR.**

## Convenções de saída

This section is stamped from the same `_comum/convencoes.md` as `## Como perguntar e como aprovar`,
into every `gm-*` skill that has a closing point. Edit the source in the `claude-brain` repo and run
`node scripts/skills-comum.mjs` there — never this copy.

1. **The last line of the final answer is machine-readable**, so a dispatcher (a script, another
   session) can chain the pipeline without reading prose. Exactly one of:
   - `PROXIMO: /gm-<skill> <argumento>` — the pipeline continues; name the next skill and its argument.
   - `PARADA: <motivo em uma frase>` — the pipeline does not continue; one sentence, in pt-BR, saying
     what is waiting and on whom.

   Nothing follows that line. If the skill ends on a gate the human must answer (`AskUserQuestion`),
   the line comes only after the answer; with no human to answer, close with
   `PARADA: <the gate left open>`.
2. **File content never travels inside a command argument.** New file → `Write`. Existing file →
   `Edit`. A heredoc only when short: if your workspace has a context-cost hook, it may deny one
   above 1500 characters. A long body (issue comment, PR body, commit message) goes to a file first,
   then `--body-file` (`gh`) or `-F` (`git commit`).
3. **A rule that belongs to one workspace never enters a skill.** Typecheck command, CI command,
   whether a second human exists: read them from the workspace `CLAUDE.md`, and stop to ask when it
   does not declare them — with no human in the session, that stop is
   `PARADA: <what the CLAUDE.md must declare>`.
4. **With no human in the session (`claude -p`, a dispatcher), do not wait for CI and do not schedule
   a wake-up** (`ScheduleWakeup`, `/loop`): report what was done and close with `PROXIMO` or `PARADA`.
