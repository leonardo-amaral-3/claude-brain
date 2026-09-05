# O workspace e o cofre Obsidian

Esta é a parte que nenhum arquivo de configuração explica: **como as pastas precisam estar
montadas** para o brain, as skills e os hooks se encontrarem.

## A regra única

> **A raiz do workspace é o cofre do Obsidian. Os repos ficam dentro dela.**

Não são duas coisas: você abre a raiz do workspace no Obsidian, e ela contém tanto as notas quanto
os repositórios de código. É isso que faz uma nota poder citar `processos-core/src/aih.ts` e o
brain saber que aquele arquivo existe — os dois vivem sob a mesma raiz.

Um workspace é qualquer pasta que tenha uma subpasta `claude/`. É por ela que os hooks reconhecem
onde estão.

## O desenho

```
~/meu-workspace/                    ← raiz do workspace = cofre do Obsidian
├── .obsidian/                      ← config do cofre (o Obsidian cria)
│   └── app.json                    ← userIgnoreFilters: esconde os repos da busca (ver abaixo)
├── CLAUDE.md                       ← as 2 regras + a seção ## Board que as skills gm-* leem
│
├── claude/                         ← tudo que o Claude escreve, num lugar só
│   ├── diario/                     ← notas de sessão      (hook SessionEnd + skill /diario)
│   │   └── Sessões.base            ← tabela do Obsidian sobre as notas
│   ├── decisoes/                   ← decisões registradas (tool lembrar)
│   ├── mapas/                      ← mapas de arquitetura (skill /mapear)
│   └── brain-mcp/                  ← opcional: o servidor pode morar aqui ou fora
│
├── planning/                       ← specs de feature, uma pasta por feature
│   ├── 1072-gestao-aihs-fragmento/
│   │   ├── spec.md                 ← a spec única (gm-spec)
│   │   └── tasks/                  ← uma task por arquivo (gm-plan-tasks)
│   └── _arquivo/                   ← features encerradas → indexadas como status=arquivado
│
├── notas/                          ← notas do produto que não são de repo nenhum
│
├── meu-repo/                       ← REPOS ficam dentro do cofre
│   ├── planning/                   ← um repo pode ter o planning dele
│   ├── docs/
│   └── src/
└── outro-repo/
```

O `claude/` junto num lugar só não é estética: é o que permite ao `.gitignore`, ao
`userIgnoreFilters` e às roots do brain tratarem "o que o Claude escreveu" como um bloco.

## Configurando o Obsidian

**1. Abra a raiz do workspace como cofre.** No Obsidian: *Open folder as vault* →
`~/meu-workspace`. Não aponte para `claude/diario` — o cofre precisa enxergar os repos para os
links funcionarem.

**2. Esconda os repos da busca.** Sem isso, cada busca no Obsidian devolve centenas de arquivos de
código e o grafo vira um borrão. Em *Settings → Files and links → Excluded files*, adicione cada
repo. Ou edite `.obsidian/app.json` direto:

```json
{
  "userIgnoreFilters": [
    "meu-repo/",
    "outro-repo/",
    "planning/_arquivo/"
  ]
}
```

Os arquivos continuam no cofre (links e menções seguem funcionando) — só saem da busca, do
switcher e do grafo. O brain indexa independentemente disso: `userIgnoreFilters` é do Obsidian,
`excludeDirs` é do brain, e um não conhece o outro.

**3. Ligue o plugin Bases** (core, já vem no Obsidian) e copie
[`templates/Sessões.base`](../templates/Sessões.base) para `claude/diario/`. Ele monta a tabela das
notas de sessão a partir do frontmatter — inclusive uma coluna *Retomar* que gera o
`claude --resume <id>` de cada sessão, e uma view *Sem resumo* que mostra as notas cujo
enriquecimento automático falhou.

**4. Crie as pastas** que os hooks e as skills esperam encontrar:

```sh
mkdir -p ~/meu-workspace/claude/{diario,decisoes,mapas} ~/meu-workspace/planning
```

Elas são criadas sozinhas na primeira escrita, mas criá-las antes evita a dúvida de "não apareceu
nada, será que quebrou?".

## Quem escreve onde

| Pasta | Quem escreve | Quando |
|---|---|---|
| `claude/diario/` | hook `SessionEnd` (`obsidian-diario.js`) | ao fim de toda sessão dentro do workspace |
| `claude/diario/` | skill `/diario` | quando você pede, ou para consertar nota que ficou pela metade |
| `claude/decisoes/` | tool `mcp__brain__lembrar` | na hora em que algo é decidido |
| `claude/mapas/` | skill `/mapear <repo>` | depois de mudança estrutural num repo |
| `planning/<n>-<slug>/` | skills `/gm-spec` e `/gm-plan-tasks` | ao especificar e quebrar uma feature |

Tudo isso é markdown comum, legível e editável à mão. Nada é banco de dados — o índice do brain é
derivado e pode ser reconstruído do zero a qualquer momento.

## As convenções de nome e frontmatter

O brain lê o frontmatter para classificar e ordenar. Respeitar o formato é o que faz a busca
filtrar por data e escopo.

**`claude/diario/AAAA-MM-DD Título da sessão.md`**

```yaml
---
data: 2026-09-01
projeto: meu-repo                  # basename do cwd da sessão
session_id: 8793cff1-32cc-...      # a chave real; o nome do arquivo pode mudar
resumo: "uma linha do que aconteceu"
tags:
  - claude-sessao                  # é o que a Sessões.base filtra
---
```

O `session_id` é a chave, não o nome: o hook reconhece a nota por ele e reescreve só o bloco entre
`<!-- auto:inicio -->` e `<!-- auto:fim -->`. O que você escrever fora desse bloco sobrevive a
qualquer reexecução.

**`claude/decisoes/AAAA-MM-DD-slug-do-fato.md`**

```yaml
---
data: 2026-09-05
tipo: descoberta                   # decisao | descoberta | restricao
escopo: 1098                       # card, feature ou módulo a que se aplica
---
```

**`claude/mapas/<repo>.md`** — ou `<repo>-<modulo>.md` para módulos grandes. Sem frontmatter; a
estrutura de seções está em [`templates/mapas-README.md`](../templates/mapas-README.md), que vale
copiar para `claude/mapas/README.md`.

**`planning/<numero-do-card>-<slug>/`** — o prefixo numérico não é decoração: é por ele que o grafo
liga a feature ao card do GitHub e, através dele, aos PRs e commits. Uma pasta sem número fica
órfã no grafo.

## Como as peças se encontram

Vale ter o encadeamento na cabeça, porque quando algo "não aparece" é sempre um elo dele:

```
cwd da sessão
   │  ~/.claude/brain-workspaces.json  (qual prefixo contém este cwd?)
   ▼
workspace  ──────────►  <workspace>/claude/{diario,decisoes,mapas}   ← hooks e skills escrevem aqui
   │
   │  <workspace>/CLAUDE.md, seção ## Board
   ▼
board do GitHub  ────►  as skills gm-* sabem onde criar card e mover coluna
   │
   │  brain-mcp/brain.config.json, lista de roots
   ▼
índice (data/brain.db)  ──►  search_context, vizinhanca, feature_timeline
```

Três configurações, três papéis distintos, e é comum confundi-los:

- **`brain-workspaces.json`** diz aos **hooks** onde estão os workspaces. Não afeta a busca.
- **`brain.config.json`** diz ao **servidor** o que indexar. Não afeta os hooks.
- **`CLAUDE.md`** diz às **skills `gm-*`** qual é o board. Não afeta nenhum dos dois.

Mudou de lugar uma pasta? Provavelmente precisa atualizar os três.

## Dois workspaces na mesma máquina

Funciona, e é o arranjo de quem separa trabalho de projeto pessoal: dois cofres independentes, um
único índice do brain cobrindo os dois.

```
~/trabalho/          claude/{diario,decisoes,mapas} + repos do trabalho
~/pessoal/           claude/{diario,decisoes,mapas} + repos pessoais
```

Liste os dois em `brain-workspaces.json` e acrescente as roots dos dois no `brain.config.json`. Os
hooks e as skills `/diario` e `/mapear` resolvem o cofre pelo `cwd` — sessão aberta em `~/pessoal`
nunca escreve em `~/trabalho`.

> **Uma exceção conhecida:** a tool `lembrar` **não** faz esse roteamento. Ela grava sempre no
> primeiro root com `source: "decisao"` do `brain.config.json`, qualquer que seja o workspace da
> sessão. Se você mantém dois cofres, todas as decisões vão parar no primeiro deles — o que
> funciona (o índice acha tudo), mas não é o que a estrutura sugere. Ponha primeiro o cofre onde
> você prefere que elas se acumulem.

## Do zero, em ordem

```sh
mkdir -p ~/meu-workspace/claude/{diario,decisoes,mapas} ~/meu-workspace/planning
cd ~/meu-workspace
git clone <seu-repo>                      # os repos ficam DENTRO do workspace
cp ~/claude-brain/templates/CLAUDE.example.md CLAUDE.md
cp ~/claude-brain/templates/Sessões.base claude/diario/
cp ~/claude-brain/templates/mapas-README.md claude/mapas/README.md
```

1. Preencha a seção `## Board` do `CLAUDE.md` (o template traz os comandos `gh` que descobrem os IDs).
2. Abra `~/meu-workspace` como cofre no Obsidian e adicione os repos ao `userIgnoreFilters`.
3. Aponte as roots do `brain.config.json` para as pastas acima.
4. Registre o workspace no `~/.claude/brain-workspaces.json`.
5. `cd <brain-mcp> && npm run index && npm run embed && npm run grafo`.
6. Abra o Claude Code em `~/meu-workspace` — o briefing deve aparecer no primeiro turno.

Se o briefing não aparecer, o elo quebrado é o passo 4. Teste direto:

```sh
echo '{"cwd":"/caminho/do/workspace","source":"startup"}' | node ~/.claude/hooks/brain-briefing.js
```
