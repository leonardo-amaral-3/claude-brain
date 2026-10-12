# Template, CLAUDE.md deste repo, docs e README

Quatro partes; cada uma diz onde entra. Linhas da `origin/dev` de 2026-10-12.

## Parte A — `templates/CLAUDE.example.md`, `## Convenções da esteira`

Bullet **novo**, logo depois do bullet *Segundo humano*:

- **Ambiente de ensaio**: existe uma cópia de produção onde migration e tratamento de dado rodam
  antes de valer? `não`, ou o comando que o `/gm-release` roda contra ela e onde lê o resultado.
  Sem esta linha, trem sensível para e pergunta — nunca assume que ensaiou.

Bullet *Despacho* **substituído** por:

- **Despacho**: se sessões headless (`claude -p`) rodam a esteira, lembre que a última linha da
  resposta é `PROXIMO: /gm-<skill> <argumento>` ou `PARADA: <motivo>`. E se uma sessão orquestradora
  despacha as outras, as instruções dela — como despachar, os freios, o que decide sozinha — ficam
  num arquivo que só ela lê, **não neste `CLAUDE.md`**: ele é carregado por toda sessão despachada,
  e cada parágrafo aqui é pago em cada uma delas.

## Parte B — `CLAUDE.md` deste repo

Item **3**, novo, em `## A esteira`, depois do item 2 (o do `brain-mcp/src/`):

3. **Toda mudança em `skills/` fecha com os blocos comuns provados.** Os blocos `## Como perguntar e
   como aprovar` e `## Convenções de saída` são carimbados de `skills/_comum/convencoes.md` por
   `node scripts/skills-comum.mjs`; a suíte relevante para a precondição 4 do `/gm-ship` é
   `node scripts/skills-comum.mjs --check`. Código `1` é **vermelho**: a PR não abre. Mudou um bloco?
   Edite a fonte e rode o script sem `--check`; nunca a cópia.

Na abertura de `## A esteira` (linha 62), "e mais dois que são deste repo:" vira "e mais **três** que
são deste repo:" — o item 3 acima é o terceiro.

Em `## Onde ficam as coisas`, a linha de `skills/` ganha, depois de "uma pasta por skill":
"— e `skills/_comum/convencoes.md`, a fonte dos blocos comuns, carimbada por `scripts/skills-comum.mjs`".

## Parte C — `docs/esteira-gm.md`

Linhas 147-149 (o parágrafo de abertura de `## Como as skills perguntam`) **substituídas** por:

Toda skill `gm-*` com ponto de interação carrega, logo depois da prosa de missão, um bloco
`## Como perguntar e como aprovar` — carimbado byte a byte, a partir de `skills/_comum/convencoes.md`,
em toda skill que tem um. Esta é a versão longa dele, para ler de fora da esteira; se as duas
divergirem, a das skills é a que roda.

Linha 189 (a abertura de `## Convenções de saída`) **substituída** por:

Toda skill com ponto final (hoje todas menos `gm-tech-spec`) carrega o mesmo bloco no fim, carimbado
da mesma fonte:

Parágrafo **novo** no fim de `## Convenções de saída`, antes de `## Uma worktree por card` (linha 203):

**Uma fonte, várias cópias.** Os dois blocos vivem em `skills/_comum/convencoes.md`;
`node scripts/skills-comum.mjs` carimba cada seção na skill que tem o cabeçalho, e `--check` acusa
cópia divergente — é a suíte do `/gm-ship` para mudança em `skills/`. Carimbar, e não citar: medido
em 2026-10-12, nenhuma das 480 sessões `/gm-*` do mantenedor leu o doc que o bloco citava, e
`@arquivo` dentro de `SKILL.md` só expande com caminho absoluto ou relativo ao `cwd`, calando quando
não acha. Regra que a sessão precisa seguir fica no texto da skill; a fonte única garante que ela
seja escrita uma vez.

## Parte D — `README.md`, a árvore (linha ~310)

A árvore não é alfabética (brain-mcp, skills, hooks, templates, docs, install, sync). Logo abaixo da
linha `├── skills/                     15 skills → ~/.claude/skills/`, uma filha:
`│   └── _comum/                 fonte dos blocos comuns, carimbada por scripts/skills-comum.mjs`;
e logo abaixo dela, antes de `hooks/`, a entrada
`├── scripts/                    skills-comum.mjs — carimba e checa os blocos comuns das skills`.
Alinhamento da coluna de descrição igual ao das linhas vizinhas. "15 skills" fica: são 15 pastas com
`SKILL.md`.
