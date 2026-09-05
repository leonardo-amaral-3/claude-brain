---
name: diario
description: Save or enrich this session's note in the Obsidian vault of the current workspace (`<workspace>/claude/diario`) — a summary of what was done and decided, links to artifacts/PRs/cards/planning files, open items and how to resume the session. Use when the user asks to save the session to Obsidian ("salva no obsidian", "registra essa sessão") or when wrapping up significant work.
argument-hint: [título opcional]
---

# Diário — nota da sessão no Obsidian

O **workspace** e a pasta que contem `claude/` e engloba o diretorio de trabalho atual (os workspaces da maquina estao listados em `~/.claude/brain-workspaces.json`). Cada um tem seu proprio cofre; nunca escreva no cofre do outro.

O cofre e a raiz do workspace (o repo mora dentro dela, entao caminho de repo serve de caminho de cofre). Notas de sessao: `<workspace>/claude/diario/`.

1. **Identify the session.** Session id = the UUID at the end of your scratchpad directory path. Web link = the `Claude-Session:` URL in your instructions, if present. Project = basename of the working directory.
2. **Find the note by session_id no frontmatter** (varra `claude/diario/*.md`); o hook de SessionEnd pode já ter criado um stub. Preserve o frontmatter e o bloco `<!-- auto:inicio -->…<!-- auto:fim -->`; escreva abaixo deles (substituindo um `## Resumo` pendente). Se não existir, crie com nome `AAAA-MM-DD <título curto>.md`.
3. **Write in pt-BR**, keeping the note under one screen — it exists to re-find the work, not to replace the artifacts:
   - `# <título>` — do argumento, ou um nome curto do que a sessão foi.
   - `## Resumo` — 3–10 bullets, decisões acima de atividades.
   - `## Artefatos e links` — artifact URLs, PRs e issues com link completo, pastas de planning como caminho (`processos/planning/...`), wikilinks para outras notas do cofre quando existirem — planning SEMPRE por caminho completo em código (`processos/planning/<pasta>/spec.md`), **não** como wikilink — o cofre aberto no Obsidian é `claude/diario`, então `[[processos/planning/...]]` vira link quebrado; e nunca por nome curto (`spec.md`/`PRD.md` colidem entre features).
   - `## Pendências / próximos passos` — o que ficou aberto e o próximo comando concreto (ex.: `/gm-spec 1072` numa sessão nova).
   - `## Retomar` — `claude --resume <session-id>` no diretório certo + o link web da sessão.
4. **Frontmatter é o índice**: garanta `resumo:` (UMA frase, ate ~160 chars, entre aspas, dizendo o que a sessão fez ou decidiu — refine o que o hook gerou se estiver raso) e `tags:` (além de `claude-sessao`, acrescente as da esteira e do domínio: `gm-spec`, `deploy`, `migrations`, `designacao-aih`…). É disso que a `Sessões.base` monta a tabela — o `index.md` **não** lista mais sessão a sessão, não escreva lá.
5. **Nomes são resumos**: `AAAA-MM-DD <título de 3–6 palavras>.md` — nunca ids ou nome de projeto. Ao ENRIQUECER um stub cujo nome não descreve a sessão, renomeie para o título bom (esse é o único momento em que renomear é permitido; depois disso, nunca mais — outras notas podem linkar para ele).

Report the note path when done.
