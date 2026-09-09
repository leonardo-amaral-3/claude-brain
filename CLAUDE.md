# claude-brain

O setup que este repo **distribui**: o servidor MCP `brain` (índice híbrido sobre specs, docs,
diário, decisões, cards, PRs, commits e código), as 14 skills `gm-*` da esteira, os hooks de
briefing/diário e os templates. Público, de Leonardo, e é o que roda nos dois workspaces desta
máquina — `pessoal` e `notoria`.

Este arquivo governa **este repo**. O `../CLAUDE.md` governa o workspace `pessoal` inteiro e traz o
board do `operations-center`; quando o diretório de trabalho for aqui, **vale a seção `## Board`
deste arquivo**, não a de lá.

## Regra 1: a cópia que roda não é esta pasta

Esta pasta é o **repositório**. O que o Claude Code carrega é a **instalação**, em outro lugar:

- skills e hooks → `~/.claude/skills/`, `~/.claude/hooks/`
- servidor MCP → o caminho registrado em `~/.claude.json` (`mcpServers.brain.args[0]`), hoje
  `~/notoria/claude/brain-mcp/` — que **não é repositório git**, é alvo de instalação

Editar direto na instalação é o erro fácil: funciona na hora e não vira commit nunca. O fluxo é
`sync.sh`/`sync.ps1`, que descobre o destino sozinho lendo o `args[0]` do MCP registrado:

```
./sync.sh status   o que está diferente, sem escrever nada
./sync.sh pull     instalação → repo   (antes de commitar)
./sync.sh push     repo → instalação   (depois de um git pull)
```

Mudou `brain-mcp/src/`? Depois do `push` é preciso `npm run build` **na instalação** — é o `dist/`
que roda, e nada avisa quando ele fica velho.

Nunca entram na sincronia, porque são de cada máquina: `brain.config.json`,
`~/.claude/brain-workspaces.json` e `brain-mcp/data/` (o índice, que se reconstrói).

## Board

Coordenadas deste repo. As skills `gm-*` leem **daqui**. Mudou campo ou opção no Project? Atualize
esta seção, nunca a skill. (São as coordenadas do board do mantenedor; quem clonar o repo tem o seu.)

- Project: number `3` ("Claude Brain"), owner `leonardo-amaral-3`, project-id `PVT_kwHODZRy6M4Bi3la`
- **Status** field `PVTSSF_lAHODZRy6M4Bi3lazhhuDJQ`:
  📥 Triagem=`a3944402` · 📋 Backlog=`d6d3862b` · 🎯 Especificação=`37d8c103` · 🔨 Implementação=`f45552b2` · 👀 Revisão=`c3961a0b` · 🧪 Validação em Dev=`d616725c` · 🚂 Release=`36ba4912` · ✅ Produção=`c4437f0c`
- **Tipo** field `PVTSSF_lAHODZRy6M4Bi3lazhhuDhg`: 🐞 Bug=`db1ed6ad` · ❓ Dúvida=`0336e85e` · ✨ Melhoria=`e8be0d7e` · 🧰 Débito técnico=`22a5f765`
- **Severidade** field `PVTSSF_lAHODZRy6M4Bi3lazhhuDhk`: S1=`e84ccea5` · S2=`7c4e6f06` · S3=`2a8258a8`
- **Classe** field `PVTSSF_lAHODZRy6M4Bi3lazhhuDho`: 🔴 Expedite=`74d1cc76` · 📅 Data fixa=`83c35674` · ⚪ Padrão=`5e0249bd` · 🔧 Intangível=`4461f685`
- **Rota** field `PVTSSF_lAHODZRy6M4Bi3lazhhuDhs`: Completa=`046fc734` · Curta=`28aca719` · Hotfix=`32b4d1c6`
- **Módulo** field `PVTSSF_lAHODZRy6M4Bi3lazhhuDhw`: brain-mcp=`a699e07d` · hooks=`ad7c0fe9` · skills=`ed43b0b2` · docs=`f9cf9726`
  — aqui o módulo é real, e não um `Comum` de espera: as quatro partes têm ciclos de vida distintos
  (o servidor recompila, as skills são markdown, os hooks rodam fora do processo, docs não quebram nada)
- **Campos TEXT**: Objetivo `PVTF_lAHODZRy6M4Bi3lazhhuDh0` · Release `PVTF_lAHODZRy6M4Bi3lazhhuDh4` · Bloqueado `PVTF_lAHODZRy6M4Bi3lazhhuDjs`
- **repos** (cards são issues reais): `claude-brain` — **público**, owner `leonardo-amaral-3`
- **auto-add**: o workflow embutido **"Auto-add sub-issues to project" nasce LIGADO** em todo Project
  novo — é ele, e não uma esquisitice do `addSubIssue`, que faz a sub-issue herdar o Project do pai.
  Os outros cinco (item added, item closed, PR merged…) vêm desligados. Consequência: depois de fatiar
  um épico, releia `issue.projectItems` de cada fase e remova com `deleteProjectV2Item` (project-id
  `PVT_kwHODZRy6M4Bi3la`) toda fase que não seja a promovida — ou desligue o workflow na UI do board.

## A esteira

A mesma rota completa e os mesmos 5 gates da norma
(`../../notoria/planning/fluxo-gm-desenvolvimento.md`), com os **mesmos deltas do workspace
`pessoal`** — G2 sem segundo humano, release sem trem semanal, G4 só com revisão de IA — e mais dois
que são deste repo:

1. **Rota Curta é o padrão aqui.** PRD e tech-spec pressupõem produto com usuários e trade-off de
   negócio; este é ferramenta de uma pessoa. Rota Completa só quando a mudança altera o **formato em
   disco** (o índice, o `conversations.json` da instalação, o formato das decisões) ou a superfície
   pública das tools — aí a migração é o assunto, e ela merece spec.
2. **Toda mudança em `brain-mcp/src/` fecha com o índice provado, não com o `tsc` verde.** Há
   `npm run smoke` e `npm run eval` (com `scripts/golden.json`) — é isso que responde se a busca
   ainda acha o que achava.

Regras duras que **não** mudam: skills `gm-*` têm `disable-model-invocation: true` (peça o comando ao
usuário, nunca reimplemente a skill na mão) · sem card não há implementação · nada de commit sem
aprovação explícita · o PR nasce com `Card: #n` na primeira linha e **nunca** com `Closes`.

## Branches

Hoje só existe `main`, com 2 commits. A esteira pressupõe `dev` como base de integração: **crie a
`dev` a partir da `main` antes da primeira branch de feature**, e a partir daí `main` é produção e
recebe PR da `dev` no release.

## Onde ficam as coisas

- `brain-mcp/` — o servidor MCP (15 módulos TypeScript, ~3.200 linhas) e os `scripts/` de smoke/eval
- `skills/` — as 14 skills, uma pasta por skill; `hooks/` — os 4 hooks
- `docs/`, `templates/`, `install.*`, `sync.*` — o que faz o setup instalável por outra pessoa
- Specs desta feature em diante: `planning/<feature>/spec.md` **dentro deste repo** (é público —
  nada de dado de cliente ali)
- Diário e decisões: cofre do workspace `pessoal`, em `../claude/` — porque o `doCwd` resolve por
  prefixo de caminho, e esta pasta está sob `~/pessoal`
