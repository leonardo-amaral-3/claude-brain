# Convenções comuns das skills `gm-*`

Este arquivo é a **fonte única** dos blocos que toda skill da esteira repete. Cada seção `##` daqui
é um bloco; `node scripts/skills-comum.mjs` o carimba, byte a byte, em toda `skills/gm-*/SKILL.md`
que já tenha os mesmos cabeçalhos — a skill entra nos blocos escrevendo os cabeçalhos, e sai
apagando-os. **Todos ou nenhum:** skill com parte dos cabeçalhos sai com `1` nos dois modos e não é
escrita, porque cabeçalho faltando é cabeçalho digitado errado, não opção.
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
nas skills. Seção nova = cabeçalho novo aqui, o mesmo cabeçalho em **toda** skill que já tem os blocos, e o
script. Seção que só valha para algumas skills não entra aqui.
**Modo despachado** (Fase 2 do épico #30, #28): a terceira seção diz o que cada skill decide
sozinha numa sessão `claude -p` que recebeu a frente, onde para e o que não faz. Ela vale para as 11
como as outras duas.

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
   subagent), **stop and report what was left to decide** — never assume a default and carry on. The one exception is
   `## Modo despachado` below.

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
   `PARADA: <the gate left open>`. Under `## Modo despachado`, a gate in its **decide** rows is
   answered, not left open.
2. **File content never travels inside a command argument.** New file → `Write`. Existing file →
   `Edit`. A heredoc only when short: if your workspace has a context-cost hook, it may deny one
   above 1500 characters. A long body (issue comment, PR body, commit message) goes to a file first,
   then `--body-file` (`gh`) or `-F` (`git commit`).
3. **A rule that belongs to one workspace never enters a skill.** Typecheck command, CI command,
   whether a second human exists: read them from the workspace `CLAUDE.md`, and stop to ask when it
   does not declare them — with no human in the session, that stop is
   `PARADA: <what the CLAUDE.md must declare>`.
4. **With no human in the session (`claude -p`, a dispatcher), do not wait for CI and do not schedule
   a wake-up** (`ScheduleWakeup`, `/loop`), and do nothing in the background: report what was done and close with `PROXIMO` or `PARADA`.

## Modo despachado

This section is stamped from the same `_comum/convencoes.md` as the two above. Edit the source in
the `claude-brain` repo and run `node scripts/skills-comum.mjs` there — never this copy.

**When it applies:** no human in the session (`claude -p`, a subagent) **and** the argument hands
over the front in words ("você decide sozinho o G2, o G3, o commit e o ship"). Both, or it does not
apply: no human and no handover → item 5 of `## Como perguntar e como aprovar` (stop and report).
A human in the session → never, whatever the argument says. When it applies, it replaces item 5
for the rows marked **decide**; the rest of the skill runs as written. The argument may add stops;
it never turns a **para** into a **decide**.

| Ponto de decisão | Exemplo (skill · header) | Despachado |
|---|---|---|
| Aprovar artefato do próprio card: critérios, card, spec, tasks, corpo da PR, comentário | `gm-card`, `gm-spec`, `gm-plan-tasks`, `gm-ship`, `gm-explore`, `gm-prd` | **decide** — Aprovar, depois da crítica que a skill exige |
| Caminho entre os que a skill oferece: rota, profundidade, recorte, escopo, abordagem | `gm-card` · `Rota`; `gm-spec` · `Profundidade`, `Recorte`; `gm-triage` · `Escopo` | **decide** pela regra da própria skill |
| Segundo revisor de spec sensível | `gm-spec` · `2º revisor` | **decide**: seguir sem; o revisor de IA independente roda igual |
| Commit e push na branch do card | `gm-implement` · `Commit`; `gm-correcao` | **decide**, com a verificação verde |
| Fila no fim, sem decisão da spec caída | `gm-implement` · `Fim da fila` | **decide**: fechar e abrir a PR |
| Checkout principal com alteração | `gm-implement` · `Árvore suja` | **decide**: deixar onde estão |
| Alvo ambíguo: repo, card, pasta, PR | `Repo`, `Card`, `Pasta`, `PR alvo`, `Destino` | **para** — o argumento nomeia o alvo |
| Escolha de produto que card, spec, argumento e decisões registradas não respondem | qualquer | **para** |
| Desvio da spec, decisão que caiu, emenda | `gm-implement`, `gm-ship`, `gm-correcao` | **para** |
| Teste vermelho, ambiente quebrado, `CLAUDE.md` que não declara o que a skill exige | qualquer | **para**, com a saída que prova |
| Merge, `main`, tag, release, deploy, produção, instalação viva, apagar | `gm-release` e `gm-hotfix` inteiras; qualquer | **para**, sempre |
| Esperar CI, agendar retorno, rodar em segundo plano | qualquer | **não faz** |
| Perguntar o que o card, a spec, o argumento ou o cofre já respondem | qualquer | **não pergunta** — lê |
| Devolver comando `/gm-*` para alguém digitar | qualquer | **não faz** — vai na linha `PROXIMO:` |

**Every decide is recorded on the spot:** the decision tool of the workspace
(`mcp__brain__lembrar` where the `brain` MCP runs) with what, why and what was discarded, and one
comment on the card per stage, with the prefix the argument gives.

**What the argument still carries — only what belongs to the card:** card and repo; where to work
(worktree, branch, PR base when stacked); the recorded decisions that bind it; stops beyond this
table; environment facts the workspace `CLAUDE.md` does not declare. What this table says is not
repeated there.
