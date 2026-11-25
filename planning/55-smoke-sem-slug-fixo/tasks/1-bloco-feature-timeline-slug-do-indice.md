✅ Status: Complete

# Task 1: Bloco do `feature_timeline` com o slug tirado do índice

## Context

Você vai implementar um card inteiro, que cabe numa task só. Leia isto primeiro:
- **Spec**: [`planning/55-smoke-sem-slug-fixo/spec.md`](../spec.md). Ela tem TODOS os requisitos, o
  bloco exato, as regras do bloco, os comandos de prova e as decisões. Siga a spec à risca e não
  desvie dela. Se a realidade contradisser a spec, PARE e siga o protocolo de desvio. Não improvise
  em silêncio.

O código fica no repo `claude-brain`, que é **o seu próprio repositório git**. Neste card ele está
na worktree `/home/leo/pessoal/claude-brain-55-smoke-sem-slug-fixo`, na branch
`feat/55-smoke-sem-slug-fixo`, já em checkout. Rode todo comando git de dentro dela. Não crie outra
worktree nem outra branch.

Esta é a task 1 de 1.

Premissas da spec `## Premissas medidas` em que esta task se apoia:
- **"O smoke de `origin/dev` falha só por causa do slug fixo"** e **"O índice vivo tem features"**:
  o CA1 só fica verde se o slug fixo for o único vermelho.
- **"A linha do `list_features` tem o formato `- <slug> [<repo ou ?>]…`"** e **"Nenhum slug tem
  espaço ou colchete"**: o regex do bloco depende das duas.
- **"Numa worktree fria, o smoke estoura o timeout no `recent_activity`"** e **"O aquecimento evita
  esse timeout"**. A borda lenta é o sync do `gh` (~150 s). Por isso o passo 0 vem antes, e os passos
  1 a 5 rodam dentro dos 30 min do `syncIntervalMin`. Passou disso, repita o passo 0.
- **"O smoke grava no índice que lê"**: toda rodada vai contra um snapshot. Nunca contra o índice
  vivo (`/home/leo/notoria/claude/brain-mcp/data/brain.db`, só leitura com `mode=ro`) e nunca contra
  a instalação.
- **"A `origin/dev` andou, mas sem mexer no que esta spec usa"**: o CA3 compara contra a merge-base,
  não contra a ponta.

Ambiente: Node 22. Todo comando de node/npm leva
`PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH`, como nos comandos da spec.
`node_modules`, `brain-mcp/dist/` e o cache do modelo já estão providos, então **nada de
`npm install`/`npm ci`**. Se `brain-mcp/dist/index.js` faltar, `npm run build` em `brain-mcp/`,
como diz a spec. Se faltar outra coisa, é ambiente quebrado: PARE.

## Scope

Dentro:
- `brain-mcp/scripts/smoke.mjs`: trocar as linhas 76–82 da base pelo bloco de
  `## Implementation Details` da spec, respeitando as `Regras do bloco` dela. As duas strings que os
  `sed` do Plano de testes procuram aparecem uma única vez, e as mensagens de `fail` ficam literais.
- O commit desta task leva junto `planning/55-smoke-sem-slug-fixo/` (spec e esta pasta `tasks/`),
  que ainda não está versionada.

Fora (não toque):
- `brain-mcp/src/`, `brain-mcp/dist/`, o `jev.mjs` (#51), e as outras checagens do `smoke.mjs`: o
  bloco `nFeats < 5`, `search_context('subfaturamento')`, `vizinhanca('1072')`, a busca em linguagem
  natural e o `recent_activity`.
- O timeout de worktree fria em `src/` (#1648): só o aquecimento do passo 0 o contorna aqui.
- O índice vivo, a instalação (`~/.claude/`, `~/notoria/claude/brain-mcp/`) e o `sync.sh`.
- `README.md`, `install.*` e qualquer outro arquivo.

## Verification

- Comandos que precisam passar: os **passos 0 a 6 do `## Plano de testes` da spec**, nesta ordem e
  cada um exatamente como está escrito lá. Todos com cwd na raiz da worktree e timeout de shell de
  600 s. Os resultados esperados de cada passo estão na spec.
- O que fazer se o passo 1 sair diferente de `0` também está na spec. Em resumo: um `FALHOU` de
  outra checagem, ou um `timeout em …` sem `FALHOU`, é **PARADA** com o log. Não se mexe na outra
  checagem.
- Antes do `rm -rf /tmp/smoke55` do fim, anote no resumo o exit e as linhas `FALHOU`/`SMOKE OK` de
  cada passo, junto com o slug do CA1 e a contagem dele no snapshot. O corpo da PR cita esses
  números.
- Critérios de aceite cobertos: **CA1, CA2a, CA2b, CA2c, CA3**, ou seja, todos.

## Completion Checklist

- [ ] O bloco da spec está no lugar das linhas 76–82, e nada mais mudou em `brain-mcp/`
- [ ] Passos 0 a 6 verdes, com os resultados anotados
- [ ] `node --check brain-mcp/scripts/smoke.mjs` limpo. Nenhuma variável sem uso. Nenhum
      `smoke-sabotado-55.mjs` sobrou em `brain-mcp/scripts/`
- [ ] `/tmp/smoke55` removido depois de anotar os resultados

## Workflow

1. Implemente e rode o checklist.
2. Apresente o resumo. Primeiro o resultado da verificação (passo a passo: exit e linha-chave).
   Depois, a ordem de leitura por risco: o que merece um olhar atento e por quê. Não é changelog.
3. Faça o commit de dentro da worktree, incluindo `planning/55-smoke-sem-slug-fixo/`. A mensagem
   termina com o trailer `Card: #55` e, na última linha, com
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Mensagem longa vai num arquivo e entra
   com `git commit -F`. O commit é posto ao humano como escolha (*ação irreversível*). Em modo
   despachado, a tabela `## Modo despachado` da skill decide.
4. Troque a primeira linha deste arquivo para `✅ Status: Complete`.

Decisões tomadas no caminho vão para o `mcp__brain__lembrar` na hora, **sempre com
`escopo: "claude-brain#55"`**, e nunca com o número puro `55`.
