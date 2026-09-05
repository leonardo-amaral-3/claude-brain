# claude-brain

Setup de Claude Code que dá memória e método a um time: um **servidor MCP local** que indexa todo
o contexto do produto, uma **esteira de skills** que leva demanda de "chegou uma mensagem do
cliente" até "está em produção", e **hooks** que fazem a sessão começar situada e terminar
registrada.

As três peças resolvem o mesmo problema — o de sempre começar do zero:

| Peça | O que resolve |
|---|---|
| **[brain-mcp](brain-mcp/)** | O Claude não sabe por que aquele código existe. Indexa specs, docs, decisões, cards, PRs, commits e código-fonte num índice híbrido (BM25 + embeddings) e devolve isso em uma busca, em vez de dez `Grep`. |
| **[skills `gm-*`](docs/esteira-gm.md)** | Cada dev conduz uma feature de um jeito. A esteira dá uma estação por vez, com portão explícito entre elas e o board do GitHub como fonte da verdade. |
| **[hooks](hooks/)** | O que se decide numa sessão morre com ela. O `SessionStart` injeta o briefing do que mudou; o `SessionEnd` escreve a nota da sessão no cofre Obsidian. |

Tudo roda **local**. O índice é um SQLite na sua máquina; os embeddings são gerados na CPU por um
modelo que roda offline. Nada é enviado para lugar nenhum além do que você já manda para o Claude.

---

## Pré-requisitos

| Ferramenta | Versão | Obrigatório? |
|---|---|---|
| [Node.js](https://nodejs.org) | **22 ou mais novo** | Sim — o índice usa `node:sqlite`, que não existe antes do 22 |
| [Claude Code](https://claude.com/claude-code) | atual | Sim |
| [`git`](https://git-scm.com) | qualquer | Para indexar o histórico de commits (fonte `git`) |
| [`gh`](https://cli.github.com) autenticado | qualquer | Para indexar cards e PRs (fonte `github`) e para as skills `gm-*` |

Para as skills `gm-*` o `gh` precisa do escopo `project`:

```sh
gh auth refresh -s project,repo,read:org
```

---

## Instalação

```sh
git clone https://github.com/leonardo-amaral-3/claude-brain.git
cd claude-brain
```

**Windows (PowerShell):**

```powershell
.\install.ps1
```

**macOS / Linux / Git Bash:**

```sh
./install.sh
```

Quer ver antes de escrever? `.\install.ps1 -DryRun` (ou `./install.sh --dry-run`).

O instalador:

1. confere Node 22+, avisa sobre `gh`/`git`/`claude` ausentes;
2. roda `npm ci` e `npm run build` no `brain-mcp/`;
3. copia as skills para `~/.claude/skills/` e os hooks para `~/.claude/hooks/`;
4. liga os hooks no `~/.claude/settings.json` (fazendo backup em `.bak` antes);
5. registra o MCP: `claude mcp add --scope user brain -- node .../dist/index.js`;
6. cria `brain-mcp/brain.config.json` e `~/.claude/brain-workspaces.json` a partir dos exemplos.

É idempotente: rodar de novo não duplica hook nem sobrescreve configuração pessoal.

---

## Como as pastas precisam estar

Antes de configurar, o desenho — é o que faz as peças se encontrarem. **A raiz do workspace é o
cofre do Obsidian, e os repos ficam dentro dela:**

```
~/meu-workspace/              ← raiz do workspace = cofre do Obsidian
├── CLAUDE.md                 ← as 2 regras + a seção ## Board que as skills gm-* leem
├── claude/
│   ├── diario/               ← notas de sessão      (hook SessionEnd + /diario)
│   ├── decisoes/             ← decisões             (tool lembrar)
│   └── mapas/                ← mapas de arquitetura (/mapear)
├── planning/<card>-<slug>/   ← spec.md + tasks/     (gm-spec, gm-plan-tasks)
├── meu-repo/                 ← os REPOS ficam dentro do cofre
└── outro-repo/
```

Um workspace é qualquer pasta com uma subpasta `claude/` — é por ela que os hooks reconhecem onde
estão. O prefixo numérico das pastas de `planning/` também não é decoração: é por ele que o grafo
liga a feature ao card do GitHub.

**[`docs/workspace-e-obsidian.md`](docs/workspace-e-obsidian.md)** cobre isso inteiro: como abrir o
cofre e esconder os repos da busca do Obsidian, o frontmatter que cada tipo de nota precisa ter,
quem escreve em qual pasta, como montar dois workspaces na mesma máquina, e a checklist de criar um
workspace do zero.

## Configuração

São **dois** arquivos, e nenhum dos dois é versionado — cada máquina tem os seus.

### 1. `brain-mcp/brain.config.json` — o que indexar

O modelo é uma lista de `roots`. Cada root é uma pasta + o `source` que classifica o que tem
dentro. É o `source` que a busca usa para filtrar depois.

```jsonc
{
  "vars": { "WS": "${HOME}/meu-workspace" },   // suas variáveis
  "roots": [
    { "path": "${WS}/meu-repo/planning", "source": "planning", "repo": "meu-repo" },
    { "path": "${WS}/meu-repo",          "source": "code",     "repo": "meu-repo", "kind": "code" },
    { "path": "${WS}/claude/diario",     "source": "diario",   "repo": null }
  ]
}
```

Variáveis embutidas nos caminhos: `${HOME}`, `${CLAUDE_HOME}` (`~/.claude`), `${BRAIN_ROOT}` (a
pasta do brain-mcp), qualquer chave de `vars` e qualquer variável de ambiente. Caminho absoluto
continua funcionando — a variável só evita reescrever o arquivo em cada máquina.

Mais dois campos moldam o servidor ao seu domínio, sem tocar em código:

```jsonc
"produto":   "Meu Produto (o que ele faz em 3 palavras)",  // aparece na descrição das tools
"sinonimos": { "nfe": ["nota", "fiscal"] }                 // vocabulário do seu domínio
```

Os sinônimos entram **só na passada OR** da busca — é o que faz a pergunta do usuário alcançar o
jeito que o documento foi escrito, sem estragar a precisão da passada AND.

Os `source` disponíveis:

| `source` | Aponte para | Serve para |
|---|---|---|
| `planning` | pastas de spec por feature (PRD, tech-spec, tasks) | "o que essa feature deveria fazer" |
| `docs` | documentação, CHANGELOG, README dos repos | "como isso funciona" |
| `code` | a raiz do repo (com `"kind": "code"`) | achar o arquivo pelo comportamento |
| `github` | `${BRAIN_ROOT}/data/github/docs` | cards e PRs — preenchido pelo sync do `gh` |
| `git` | `${BRAIN_ROOT}/data/git/docs` | histórico de commits — preenchido pelo sync do `git` |
| `diario` | `<workspace>/claude/diario` | notas de sessão (o hook escreve aqui) |
| `decisao` | `<workspace>/claude/decisoes` | decisões gravadas pela tool `lembrar` |
| `mapa` | `<workspace>/claude/mapas` | mapas de arquitetura (skill `/mapear`) |
| `memoria` | `~/.claude/projects/<slug>/memory` | memória do Claude naquele projeto |
| `notas` | notas soltas do produto | tudo que não é de um repo |

> **O `<slug>` da memória** é o caminho do projeto com `\` e `:` virando `-`. `C:\Users\voce\ws`
> vira `C--Users-voce-ws`. Confira rodando `ls ~/.claude/projects`.

As seções `github.repos` (lista `owner/repo`) e `git.repos` (caminho local + nome) dizem de onde
puxar cards/PRs e histórico de commits.

### 2. `~/.claude/brain-workspaces.json` — onde ficam seus workspaces

Este é lido pelos **hooks**, não pelo servidor. Um *workspace* é a pasta que contém `claude/`
(o cofre Obsidian) e os repos dentro dela.

```jsonc
{
  "db": "${HOME}/claude-brain/brain-mcp/data/brain.db",
  "workspaces": [
    { "nome": "trabalho", "prefixo": "${HOME}/meu-workspace", "exceto": ["projeto-pessoal"] },
    { "nome": "pessoal",  "prefixo": "${HOME}/pessoal",       "repos": ["projeto-pessoal"] }
  ]
}
```

O hook só age quando o `cwd` da sessão está dentro de um `prefixo` — sessão fora de todos não
recebe briefing nem gera nota, de propósito. `repos` (só estes) ou `exceto` (todos menos estes)
filtram as fontes cujo caminho no índice não diz a que workspace pertencem: cards, PRs e commits
moram todos sob `data/` do brain, então precisam ser separados pelo nome do repo.

### 3. O `CLAUDE.md` do workspace

As skills `gm-*` **não têm ID de board escrito dentro delas** — leem tudo da seção `## Board` do
`CLAUDE.md` do workspace. Copie [`templates/CLAUDE.example.md`](templates/CLAUDE.example.md) para a
raiz do workspace e preencha; o próprio template traz os comandos `gh` que descobrem cada ID.

Sem essa seção, as skills `gm-*` param e pedem — escrever card no board errado é pior que não
escrever.

---

## Primeira indexação

```sh
cd brain-mcp
npm run index     # varre as roots e indexa (segundos a poucos minutos)
npm run embed     # gera os embeddings — a 1ª vez baixa o modelo (~120 MB) e demora
npm run grafo     # monta o grafo card ↔ PR ↔ spec ↔ arquivo ↔ commit

node dist/cli.js --github   # puxa cards e PRs (precisa de gh autenticado)
node dist/cli.js --git      # lê o histórico de commits dos repos
npm run index               # reindexa para o que veio acima entrar no índice
```

O `embed` é **retomável**: se parar no meio, rode de novo e ele continua de onde estava.

Confira que ficou de pé:

```sh
npm run smoke     # sobe o servidor por stdio e chama as tools de verdade
```

Depois reinicie o Claude Code e abra numa pasta do workspace. Você deve ver o briefing do cérebro
no começo da sessão e as tools `mcp__brain__*` disponíveis.

---

## Uso no dia a dia

### O cérebro

Oito tools, mas na prática o fluxo é `search_context` → `read_doc`, e `lembrar` sempre que algo for
decidido:

| Tool | Para quê |
|---|---|
| `search_context` | busca híbrida em tudo. O ponto de partida quase sempre. |
| `read_doc` | lê o documento (ou uma seção) que a busca apontou |
| `vizinhanca` | o que está ligado a um card, PR, feature ou arquivo — use **antes de mexer** em algo |
| `lembrar` | grava uma decisão (o quê, **por quê**, o que foi descartado) no cofre e no grafo |
| `feature_timeline` | em que pé está uma feature e o que já foi decidido nela |
| `list_features` | o que já existe, antes de propor algo novo |
| `recent_activity` | briefing do que mudou |
| `reindex` | re-varredura manual, quando você não quer esperar o watcher |

A busca é híbrida, então tanto o termo exato quanto a pergunta inteira funcionam. Se a primeira
tentativa vier fraca, **reformule antes de cair no `Grep`** — o vocabulário de cada produto é
específico, e é isso que a passada semântica cobre.

Detalhes de ranking, grafo e frescor do índice: [`brain-mcp/README.md`](brain-mcp/README.md).

### A esteira `gm-*`

Uma estação por vez, cada uma com um portão explícito. Detalhe completo em
[`docs/esteira-gm.md`](docs/esteira-gm.md).

| Skill | Estação |
|---|---|
| `/gm-triage` | 📥 relato bruto → demanda qualificada, deduplicada e tipada |
| `/gm-card` | 📋 direção vira card com **critérios de aceite** (portão G1) |
| `/gm-spec` | 🎯 a especificação única — requisitos + técnica, com crítica adversarial e aprovação humana |
| `/gm-plan-tasks` | 🎯 spec vira 6-8 tasks independentes, cada uma um prompt completo |
| `/gm-implement` | 🔨 executa **uma** task: branch certo, testes antes de apresentar, commit só após aprovação |
| `/gm-ship` | 👀 fecha o loop: suíte completa, PR com o contrato de aceite, card para revisão |
| `/gm-correcao` | 👀 parecer do review vira decisão registrada — corrigido, refutado ou promovido a card |
| `/gm-release` | 🚂 o trem: fila validada → PR dev→main → tag calver → notas de release |
| `/gm-hotfix` | 🔴 trilho expedite para S1 real, com branch a partir de `main` |
| `/gm-explore` | investigação read-only: "como isso funciona hoje?", com evidência `arquivo:linha` |

E fora da esteira: `/mapear` (mapa de arquitetura de um repo), `/diario` (nota da sessão),
`/defuddle` (ler página web limpa).

> `gm-tech-spec` está no repo apenas como redirecionamento — foi substituída por `/gm-spec`.

---

## Mantendo atualizado

O ponto do repo é este: você edita, os devs puxam.

### Você (quem mantém)

Continue editando skills e hooks direto em `~/.claude`, como sempre. Quando quiser publicar:

```powershell
.\sync.ps1 status    # o que mudou desde o último commit
.\sync.ps1 pull      # traz suas edições da máquina para o repo
git add -A && git commit -m "..." && git push
```

O `sync` descobre sozinho onde o `brain-mcp` está instalado (lê o MCP registrado no
`~/.claude.json`), e nunca toca em `brain.config.json`, `brain-workspaces.json` ou `data/` — que
são pessoais de cada máquina.

Criou uma skill nova? O `sync status` avisa que ela existe em `~/.claude/skills` mas não está no
repo; copie a pasta para `skills/` e commite.

### Os devs

```sh
git pull
./install.sh --skip-build      # só skills e hooks
```

Mudou o `brain-mcp/src`? Aí sem `--skip-build`:

```sh
git pull
./install.sh                   # recompila e reinstala
```

Configuração pessoal deles nunca é sobrescrita. Se um campo novo aparecer no
`brain.config.example.json`, o instalador não mexe no config existente — compare os dois na mão.

Alternativa ao instalador, se preferirem explícito: `.\sync.ps1 push` copia repo → máquina e diz o
que recompilar.

---

## Estrutura do repo

```
claude-brain/
├── brain-mcp/                  servidor MCP (TypeScript)
│   ├── src/                    15 módulos: indexer, search, grafo, memoria, hooks de sync
│   ├── scripts/                smoke, eval (golden set), uso
│   └── brain.config.example.json
├── skills/                     15 skills → ~/.claude/skills/
├── hooks/                      4 arquivos → ~/.claude/hooks/
│   ├── brain-config.js         lê o brain-workspaces.json (compartilhado pelos outros)
│   ├── brain-briefing.js       SessionStart: injeta o briefing
│   ├── obsidian-diario.js      SessionEnd: escreve a nota (em milissegundos)
│   └── obsidian-diario-titulo.js   processo destacado que enriquece a nota depois
├── templates/                  para copiar no seu workspace
│   ├── CLAUDE.example.md       o CLAUDE.md do workspace, com a seção ## Board
│   ├── Sessões.base            tabela do Obsidian sobre as notas de sessão
│   ├── mapas-README.md         a convenção dos mapas de arquitetura
│   ├── brain-workspaces.example.json
│   └── settings.hooks.json
├── docs/
│   ├── workspace-e-obsidian.md  estrutura de pastas e setup do cofre
│   └── esteira-gm.md            a esteira em detalhe
├── install.ps1 / install.sh
└── sync.ps1 / sync.sh
```

**Não incluídas** (são de terceiros, instale por fora): `tlc-spec-driven` e `obsidian-bases`.

---

## Problemas comuns

**As tools `mcp__brain__*` não aparecem.**
`claude mcp list` mostra o `brain`? Se sim mas está falhando, rode `npm run smoke` no `brain-mcp/`
— ele sobe o servidor por stdio e mostra o erro real. Causa mais comum: `dist/` não existe
(faltou `npm run build`) ou o `brain.config.json` aponta para pasta que não existe.

**`Error: variavel ${X} nao definida`.**
Um caminho do `brain.config.json` usa `${X}` que não está em `vars` nem no ambiente. As embutidas
são `HOME`, `CLAUDE_HOME` e `BRAIN_ROOT`.

**A busca não acha nada.**
`npm run index` reporta quantos documentos entraram — se for zero, as `roots` apontam para o lugar
errado. Se achar por palavra exata mas não por pergunta, faltou `npm run embed`.

**Não recebo o briefing no começo da sessão.**
O hook só age quando o `cwd` está dentro de um `prefixo` do `brain-workspaces.json`. Teste na mão:

```sh
echo '{"cwd":"/caminho/do/workspace","source":"startup"}' | node ~/.claude/hooks/brain-briefing.js
```

Saída vazia = `cwd` fora dos workspaces, ou o `db` do arquivo não existe. Os hooks falham em
silêncio de propósito: hook de contexto nunca pode atrapalhar o boot da CLI.

**A nota da sessão não aparece no Obsidian.**
Ela é escrita no fim da sessão e enriquecida por um processo destacado, que leva ~30 s. Se ficar
presa em "_Resumo automático em andamento…_", o enriquecedor morreu — rode `/diario` na mão. Se não
aparece nota nenhuma, o `cwd` estava fora dos `prefixo` do `brain-workspaces.json`, ou o cofre foi
aberto na pasta errada: o vault é a **raiz do workspace**, não `claude/diario`. Ver
[`docs/workspace-e-obsidian.md`](docs/workspace-e-obsidian.md).

**A busca do Obsidian devolve código em vez de notas.**
Falta pôr os repos no `userIgnoreFilters` do cofre (*Settings → Files and links → Excluded files*).
Isso é config do Obsidian e não tem relação com o `excludeDirs` do brain — um não conhece o outro.

**As decisões do workspace B aparecem no cofre do workspace A.**
É o comportamento atual: a tool `lembrar` grava sempre no **primeiro** root com `source: "decisao"`
do `brain.config.json`, sem olhar o `cwd` (diferente dos hooks e das skills `/diario` e `/mapear`,
que roteiam por workspace). Ponha primeiro o cofre onde você prefere que elas se acumulem.

**As skills `gm-*` param pedindo o board.**
Falta a seção `## Board` no `CLAUDE.md` do workspace. Veja
[`templates/CLAUDE.example.md`](templates/CLAUDE.example.md).

---

## Licença

MIT — veja [LICENSE](LICENSE).
