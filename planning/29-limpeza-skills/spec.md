# Skills gm-*: fonte única dos blocos comuns, emenda num lugar só e texto vencido — Spec

## References
- Card: [#29](https://github.com/leonardo-amaral-3/claude-brain/issues/29) — repo `leonardo-amaral-3/claude-brain` (Fase 3 do épico [#30](https://github.com/leonardo-amaral-3/claude-brain/issues/30))
- Fase 1, modelo de forma: `planning/27-esteira-despachada/spec.md` (PR #31)
- Decisão que repartiu a emenda entre `gm-ship` e `gm-implement`: `planning/2-emenda-pos-tasks/spec.md`, `## Technical Decisions` 1 e 6
- Trechos normativos desta spec (copiar, não transcrever): `planning/29-limpeza-skills/trechos/`

## Execution
- Repo: `leonardo-amaral-3/claude-brain` — working dir **só** a worktree `C:/Users/lokin/pessoal/claude-brain-29-limpeza`
- Base branch: `dev`
- Feature branch: `feat/29-limpeza-skills` (a Fase 2, #28, empilha nesta branch depois)
- Profundidade: **Rota curta** (markdown de skill/doc/template e um script de desenvolvimento; sem formato em disco, sem superfície de tool, sem `brain-mcp/`)
- Nunca: `sync push`, escrita em `~/.claude`, toque no checkout principal ou nas outras worktrees

## Requisitos & critérios de aceite
1. **Fonte única e check.** Dado `skills/_comum/convencoes.md` com exatamente duas seções `## Como perguntar e como aprovar` e `## Convenções de saída`, quando se roda `node scripts/skills-comum.mjs --check`, então sai `0` e informa 11 skills × 2 blocos iguais à fonte; quando o **corpo** de qualquer cópia é alterado em 1 byte, sai `1` e nomeia skill e bloco; quando o **cabeçalho** de um dos dois blocos de uma skill é alterado (a skill fica com um bloco só), sai `1` e nomeia a skill. O primeiro parágrafo de cada cópia cita a fonte (`_comum/convencoes.md`) e o script; nenhuma skill contém a palavra `eleven`. A forma escolhida (carimbo + check, não citação nem `@include`) está registrada com as duas medições em `skills/_comum/convencoes.md`, em `docs/esteira-gm.md` e em `## Technical Decisions` abaixo.
2. **Emenda num lugar só.** Dado `skills/gm-implement/SKILL.md`, então a seção `## Emenda pós-tasks` está **inalterada**: recortada por cabeçalho (`awk '/^## Emenda pós-tasks/{f=1} f&&/^## Present for review/{exit} f'`), tem o mesmo md5 na `origin/dev` e no HEAD — por cabeçalho, não por faixa de linhas, porque o carimbo desloca a seção em +1. Dado `skills/gm-ship/SKILL.md`, então `## Open the PR` mantém o **detector** (gatilho mecânico: critério que só passa reinterpretando a spec) e aponta para `## Emenda pós-tasks` do `gm-implement` sem repetir a mecânica: as frases "nasce a task N+1", "re-proporia" e "que é autoria" não existem mais no arquivo.
3. **Texto vencido.**
   - (a) `gm-release` não afirma que o ambiente de ensaio não existe nem nomeia infraestrutura de um workspace: `grep -n "does not exist yet\|CDK\|RDS\|Fase 3" skills/gm-release/SKILL.md` vazio. Em vez disso, lê do `CLAUDE.md` do workspace (`## Convenções da esteira`, item *Ambiente de ensaio*) se há ambiente e como rodar; declarado → roda e registra em `### Ensaio`; não declarado ou `não` → a mesma pergunta de hoje, com "este workspace não declara um ambiente de ensaio".
   - (b) Toda menção a `esteira-gm.md` dentro de `skills/` nomeia o repo na mesma linha: `grep -rn "esteira-gm.md" skills/ | grep -v "claude-brain"` vazio.
   - (c) `grep -rn "eleven" skills/` vazio; `grep -n "onze" docs/esteira-gm.md` vazio.
4. **Lugar reservado para a Fase 2.** `skills/_comum/convencoes.md` nomeia `#28` e "tabela de portões do modo despachado" no preâmbulo, e `grep -c "^## " skills/_comum/convencoes.md` devolve `2` — a tabela **não** é escrita.
5. **Template, docs e CLAUDE.md coerentes.** `templates/CLAUDE.example.md` declara o item *Ambiente de ensaio* e recomenda que as instruções da sessão orquestradora fiquem em arquivo que só ela lê; `docs/esteira-gm.md` descreve carimbo + check e a medição; o `CLAUDE.md` deste repo declara `node scripts/skills-comum.mjs --check` como suíte do `/gm-ship` para mudança em `skills/`; o README lista `skills/_comum/` e `scripts/` na árvore. Leitura cruzada sem contradição.
6. **Nenhum link quebrado.** Todo caminho relativo citado em `skills/_comum/convencoes.md`, nos dois cabeçalhos carimbados, no `CLAUDE.md`, no README e em `docs/esteira-gm.md` existe no repo: `docs/esteira-gm.md`, `scripts/skills-comum.mjs`, `skills/_comum/convencoes.md`, `templates/CLAUDE.example.md`.

## Technical Overview
Os dois blocos comuns deixam de ser 11 cópias mantidas à mão e passam a ser **carimbados** de uma fonte: `skills/_comum/convencoes.md` guarda o texto; `scripts/skills-comum.mjs` o escreve em toda `skills/gm-*/SKILL.md` que já tenha o cabeçalho e, com `--check`, compara. A fonte mora **dentro de `skills/`** porque `install.*` e `sync.*` copiam a subárvore inteira (`install.sh:98`, `sync.sh` monta um par por `skills/<nome>` sem lista de arquivos): a citação "`_comum/convencoes.md`, a pasta ao lado desta skill" resolve onde a skill roda, e a pasta sem `SKILL.md` sobe sem aviso (probe em 2026-10-12, projeto de teste, `claude -p --debug`). O conteúdo continua inline nas skills — é regra que a sessão precisa seguir, e a medição mostrou que citação não é lida e `@include` cala quando falha.

A emenda pós-tasks mantém a repartição do card #2 (`gm-ship` detecta, `gm-implement` executa): o ship perde os parágrafos que re-explicam a mecânica e fica com detector + ponteiro. O texto vencido de `gm-release` vira leitura do `CLAUDE.md` do workspace, no molde do typecheck da Fase 1. Os cabeçalhos dos blocos perdem a contagem fixa e o caminho solto.

Sugestão de fatiamento para o `/gm-plan-tasks` (4 tasks, como a Fase 1): fonte + script + carimbo (CA1, 3b, 3c, 4) · `gm-ship` (CA2) · `gm-release` + template (CA3a, parte do CA5) · docs + `CLAUDE.md` + README (CA5, CA6).

## Implementation Details

Números de linha são da `origin/dev` (`8175cd7`) **antes do carimbo**: o carimbo (Área 3) troca um primeiro parágrafo de 4 linhas por um de 5 e desloca tudo abaixo em +1 em cada skill. Localize **pelo texto citado**; o número é orientação. Nos trechos, o que vem acima do `---` de cada arquivo (ou de cada `###`) é meta; o conteúdo a copiar é o que vem abaixo.

### Área 1 — `skills/_comum/convencoes.md` (novo)
- Preâmbulo = `trechos/convencoes-preambulo.md`, verbatim — o arquivo inteiro, inclusive o título `# ` (pt-BR, para o mantenedor). Nenhuma linha do preâmbulo começa com `## `.
- Seção `## Como perguntar e como aprovar`: o texto de `skills/gm-card/SKILL.md:14-47` da `origin/dev` (md5 `bdfba0e2…` nas 11), com o **primeiro parágrafo** (linhas 16-19) substituído pelo trecho homônimo de `trechos/cabecalhos-blocos.md`.
- Seção `## Convenções de saída`: o texto de `skills/gm-card/SKILL.md:166-190` (md5 `9cc7f4db…` nas 11), primeiro parágrafo (linhas 168-169) substituído pelo trecho homônimo. As quebras tortas do item 2 ("above 1500 / characters. A long / body") podem ser reenfileiradas a ≤100 colunas — **só espaço em branco muda**: `tr -s ' \n' ' '` do corpo (sem o primeiro parágrafo) igual antes e depois.
- As seções ficam em inglês, o que o humano lê em pt-BR, como nas skills. Sem terceira seção.

### Área 2 — `scripts/skills-comum.mjs` (novo; Node ≥ 18, sem dependência; `scripts/` não existe ainda na raiz)
- Resolve a raiz do repo a partir de `import.meta.url` (pai da pasta do script): roda de qualquer cwd. Lê e escreve UTF-8; arquivo com BOM ou com `\r\n` → mensagem e `exit 2` (o repo é LF por `.gitattributes`; nada se normaliza em silêncio).
- **Cerca de código:** linha que casa `^\s*(```|~~~)` alterna o estado "dentro de cerca", qualquer que seja o marcador (um fecha o outro; não há cerca mista no repo — as cercas indentadas de `gm-release:72-87` contam); linha de citação (`> `) não abre nem fecha cerca. Cabeçalho só conta fora de cerca.
- **Fonte:** tudo antes do primeiro `^## ` (o preâmbulo) é ignorado. Seção = linha do cabeçalho + corpo até o próximo `^## ` fora de cerca ou EOF, com espaço em branco final removido. Zero seções, ou cabeçalho repetido na fonte → `exit 2`.
- **Alvo:** cada `skills/gm-*/SKILL.md`, em ordem alfabética, e cada seção: a linha **igual** ao cabeçalho, fora de cerca. Duas vezes → `exit 2`. Região = do cabeçalho até a linha anterior ao próximo `^## ` fora de cerca, ou EOF — `# ` e `---` no meio não encerram a região (não ocorre hoje; fica dito). Substituição = seção + `"\n\n"` quando há próximo cabeçalho, seção + `"\n"` no EOF. (Hoje: `gm-card:14-47` termina em linha vazia antes de `## Board reference…`; `:166-190` termina em `\n` único no EOF — a regra reproduz os dois.)
- **Guarda da skill com um bloco só:** `gm-*` com exatamente um dos cabeçalhos da fonte → `exit 1` nos dois modos, linha `gm-x: um bloco só (falta <cabeçalho>)` — é o que pega cabeçalho digitado errado, que senão viraria "sem bloco" calado. Nenhum dos dois → `gm-x: sem bloco`, informativo nos dois modos (`gm-tech-spec` é o caso esperado).
- **Modos e saída.** Uma linha por skill e bloco: `gm-card · Como perguntar e como aprovar · igual` (ou `carimbado` / `divergente`). Sem flag: escreve só o que mudou; `exit 0`, ou `2` nos erros acima. `--check`: não escreve; algum `divergente` → `exit 1`; senão a última linha é `N skills × 2 blocos iguais à fonte` (N = skills com os dois blocos; hoje 11) e `exit 0`. Idempotente: carimbar duas vezes, a segunda imprime só `igual` e não escreve.
- Padrão de código: o dos `brain-mcp/scripts/*.mjs` (ESM, `node:fs`/`node:path`, mensagens em pt-BR, sem framework).

### Área 3 — as 11 skills (carimbo)
`gm-card`, `gm-correcao`, `gm-explore`, `gm-hotfix`, `gm-implement`, `gm-plan-tasks`, `gm-prd`, `gm-release`, `gm-ship`, `gm-spec`, `gm-triage` recebem os dois blocos **pelo script**, nunca à mão. Nenhuma outra linha dessas skills muda nesta área. Nota do carimbo: sete skills têm `## ` dentro de cerca (`gm-correcao:167`, `gm-hotfix:117-132,207-219,335-341`, `gm-plan-tasks:88-112`, `gm-prd:116-146`, `gm-release:168,231,234`, `gm-spec:139-176`, `gm-triage:137-173`) — todas fora dos blocos; a regra de cerca da Área 2 existe por isso.

### Área 4 — `skills/gm-ship/SKILL.md`, `## Open the PR`
Linhas 55-69 da `origin/dev` (do "**Antes de escrever o corpo**" até "**Não confunda com a precondição 2**", inclusive; depois do carimbo, 56-70) → `trechos/gm-ship-open-the-pr.md`, verbatim. Passo 1 (`git push`) e passo 2 (corpo) ficam onde estão; linhas 95-98 (o comentário de emenda no template do corpo da PR) ficam. `gm-implement/SKILL.md:178-227` **não é tocado**.

### Área 5 — `skills/gm-release/SKILL.md`, ensaio
Cinco substituições, em `trechos/gm-release-ensaio.md`: o bullet da linha 49 (`## Hard rules`); os dois parágrafos de abertura de `## Phase 3 — Ensaio` (linhas 135-137, inclusive a linha em branco 136, que viram um parágrafo); dentro da pergunta, o parágrafo das linhas 139-141 e o bullet *Segurar o trem* (143-144); e, na linha 158, `the design recommends` → `this skill recommends`, porque sem o parágrafo 135 o "design" ficaria órfão. A linha `>` vazia (142), as outras duas opções, o parágrafo *Promover assumindo o risco* e `### Ensaio` das notas (linhas 180, 238) ficam. Fora do escopo e deixado como está: a heurística de detecção com caminhos `prisma/` (121-125) e a linha 51 (`deploy.yml`, `yarn deploy -p`, Prisma) — achado registrado para card próprio, ver `## Technical Decisions`.

### Área 6 — `templates/CLAUDE.example.md`, `## Convenções da esteira` (linhas 74-84)
`trechos/template-docs-claude-md.md`, parte A: bullet novo *Ambiente de ensaio* depois de *Segundo humano*; bullet *Despacho* substituído (ganha a recomendação do arquivo da orquestradora — é o ponto 4 do relato, só aqui).

### Área 7 — `docs/esteira-gm.md`
Parte C do mesmo trecho: linhas 147-149 (sem "onze", com a fonte), linha 189 (idem) e parágrafo novo **Uma fonte, várias cópias** no fim de `## Convenções de saída` (antes de `## Uma worktree por card`, linha 203). `grep -n "não existe\|ensaio" docs/esteira-gm.md` verificado vazio em 2026-10-12: nada a alinhar com a Área 5.

### Área 8 — `CLAUDE.md` deste repo e `README.md`
Parte B do trecho: item 3 novo em `## A esteira` (depois do item 2, que termina na linha 77), "e mais dois que são deste repo" (linha 62) vira "três", e a menção a `skills/_comum/` em `## Onde ficam as coisas` (linha 97). Parte D: no README, a árvore (linha 310) ganha `_comum/` sob `skills/` e uma entrada `scripts/` logo abaixo — a árvore não é alfabética.

## File Change Summary
- `skills/_comum/convencoes.md` — **novo**: fonte dos dois blocos + preâmbulo com a medição e a reserva da Fase 2
- `scripts/skills-comum.mjs` — **novo**: carimba (`default`) e compara (`--check`)
- `skills/gm-{card,correcao,explore,hotfix,implement,plan-tasks,prd,release,ship,spec,triage}/SKILL.md` — blocos carimbados (cabeçalho novo nos dois)
- `skills/gm-ship/SKILL.md` — `## Open the PR`: detector + ponteiro, sem a mecânica
- `skills/gm-release/SKILL.md` — ensaio lido do `CLAUDE.md`; sem "does not exist yet", CDK, RDS, "Fase 3"
- `templates/CLAUDE.example.md` — *Ambiente de ensaio*; *Despacho* com o arquivo da orquestradora
- `docs/esteira-gm.md` — sem "onze"; parágrafo do carimbo com a medição
- `CLAUDE.md` — check como suíte de `skills/`; "mais dois" → "três"; `_comum/` em "Onde ficam as coisas"
- `README.md` — árvore com `skills/_comum/` e `scripts/`
- `planning/29-limpeza-skills/` — esta spec, `trechos/`, `tasks/`

## Migrations & compatibilidade
N/A — texto e um script de desenvolvimento; nenhum formato em disco, nenhuma tool. A instalação viva só muda no `sync push` do Leonardo; quando mudar, `~/.claude/skills/_comum/` nasce sem `SKILL.md` — comportamento conferido num projeto de teste (sem aviso), não na instalação de usuário.

## Rollback
`git revert` da PR na `dev`. Se a instalação já recebeu `sync push`: `sync push` de novo depois do revert; a pasta `_comum/` sobra na instalação (o sync não apaga) e é inofensiva.

## Verificação pós-deploy
N/A — não toca dado nem faturamento. Única verificação na instalação, do Leonardo depois do `sync push`: uma sessão qualquer sobe sem aviso de skill inválida para `_comum/`.

## Plano de testes
Sem suíte para skills no repo; a prova é mecânica e cada task a anota.
- CA1: `node scripts/skills-comum.mjs --check; echo $?` → `0`, última linha `11 skills × 2 blocos iguais à fonte`. Negativo no corpo: `sed -i 's/one question per call/one question per call!/' skills/gm-explore/SKILL.md; node scripts/skills-comum.mjs --check; echo $?` → `1` com `gm-explore · Como perguntar e como aprovar · divergente`; restaurar com `node scripts/skills-comum.mjs` (**não** `git checkout`, que antes do commit devolveria a cópia sem carimbo). Negativo no cabeçalho: `sed -i 's/^## Convenções de saída$/## Convencoes de saida/' skills/gm-explore/SKILL.md; node scripts/skills-comum.mjs --check; echo $?` → `1` com `gm-explore: um bloco só`; desfazer com o `sed` inverso e carimbar. Idempotência: carimbar duas vezes seguidas — a segunda imprime só `igual` e `git status --short` não muda. `grep -L "_comum/convencoes.md" skills/gm-*/SKILL.md` → só `gm-tech-spec`; `grep -rn "eleven" skills/` vazio (hoje 44 linhas).
- CA2: `git show origin/dev:skills/gm-implement/SKILL.md > "$TEMP/impl-dev.md"; for f in "$TEMP/impl-dev.md" skills/gm-implement/SKILL.md; do awk '/^## Emenda pós-tasks/{f=1} f&&/^## Present for review/{exit} f' "$f" | md5sum; done` → dois md5 iguais; `grep -n "nasce a task\|re-proporia\|que é autoria" skills/gm-ship/SKILL.md` vazio (hoje 64-65); `grep -c "Emenda pós-tasks" skills/gm-ship/SKILL.md` ≥ 1 (hoje 0).
- CA3: `grep -n "does not exist yet\|CDK\|RDS\|Fase 3\|design calls for\|the design recommends" skills/gm-release/SKILL.md` vazio (hoje 49, 135, 137, 158); `grep -n "Ambiente de ensaio" skills/gm-release/SKILL.md` ≥ 2; `grep -rn "esteira-gm.md" skills/ | grep -v "claude-brain"` vazio (hoje 11); `grep -n "onze" docs/esteira-gm.md` vazio (hoje 148, 189).
- CA4: `grep -c "^## " skills/_comum/convencoes.md` = 2; `grep -n "#28" skills/_comum/convencoes.md` ≥ 1.
- CA5: `grep -n "Ambiente de ensaio\|orquestradora" templates/CLAUDE.example.md` ≥ 2; `grep -n "skills-comum" CLAUDE.md docs/esteira-gm.md README.md` ≥ 1 cada; `grep -n "mais dois que são deste repo" CLAUDE.md` vazio; leitura cruzada.
- CA6: extrair todo caminho em crase que comece por `skills/`, `scripts/`, `docs/` ou `templates/` em `skills/_comum/convencoes.md`, `CLAUDE.md`, `README.md`, `docs/esteira-gm.md` e `skills/gm-card/SKILL.md` (`grep -ohE` com a classe `[A-Za-z0-9_./-]+` entre crases, `sort -u`) e `test -e` em cada um → nenhum `FALTA`.
- Contagem: `wc -c skills/gm-*/SKILL.md | tail -1` antes (182.696 nas 11, 183.391 nas 12) e depois, anotado no `gm:tasks` — a diferença esperada é pequena e isso é dito, não escondido.

## Technical Decisions
1. **Carimbo + check, não citação nem `@include`.** Medido em 2026-10-12: (i) das 480 sessões com `<command-name>/gm-` em `~/.claude/projects`, **9** têm `tool_use` tocando `esteira-gm.md`, e as 9 são sessões de manutenção editando as skills (`claude-brain-27…`, `c30.md`, esta) — **zero** seguiram a citação; (ii) probe `claude -p "/teste-ref"` num projeto de teste (haiku, n=1): `@referencia-rel.md` (relativo à pasta da skill) e `@~/…` **não** expandem e nada avisa; `@.claude/skills/_comum/…` (relativo ao cwd) e `@C:/…` (absoluto) expandem. Para skill instalada em `~/.claude/skills/` só sobraria caminho absoluto — por máquina, num repo público — e a expansão não poupa contexto, só mantém. Logo o texto fica inline; o que vira único é a **fonte**, e a garantia é o `--check`.
2. **A fonte mora em `skills/_comum/`**, não em `docs/`: `install.*`/`sync.*` copiam a subárvore inteira de `skills/`, então a citação do cabeçalho resolve onde a skill roda (critério 3 do card). Descartado: skill `gm-comum` com `SKILL.md` — entraria na lista de skills de **toda** sessão da máquina (Regra 3 do workspace).
3. **O ganho por sessão é pequeno e fica dito.** Cada sessão carrega **uma** skill; a duplicação custa manutenção (11 edições por correção, e a PR #31 provou), não contexto. O "18%" da triagem era do texto em disco. O que cai de contexto é o trecho do ship e pouco mais.
4. **`gm-ship` detecta, `gm-implement` executa** — mantida a decisão 1 do card #2; o ship só perde a re-explicação. Descartado: mover o detector para o implement (a decisão cai ao ler a suíte no ship, decisão 6 do #2).
5. **O ensaio é lido do `CLAUDE.md`**, no molde do typecheck da Fase 1. Descartado: apagar a Phase 3 (perde o freio em trem sensível); manter "não existe (Fase 3)" (afirma fato de um workspace dentro de skill pública).
6. **O script é `.mjs` na raiz**, não `.sh`+`.ps1`: Node já é pré-requisito do `brain-mcp`, e um arquivo só não diverge em dois. Sem CI no repo (`.github/` não existe): o portão é o `CLAUDE.md`, como o do `smoke`/`eval`.
7. **Opt-in pelo cabeçalho**: a skill recebe o bloco por ter o `## `; nada de lista das 11 no script. É o que apaga "eleven" de verdade — a contagem passa a ser saída do check.
8. **Achados fora do escopo**, para card próprio (não é deste): `gm-release:51` e `:121-125` nomeiam `deploy.yml`, `yarn deploy -p`, Prisma e `prisma/migrations/**` — regra de workspace dentro de skill, igual ao que esta fase tira do ensaio; `gm-hotfix:180` ("passa pela esteira normal, com ensaio") pressupõe o ensaio; `install.sh:101` e `install.ps1:124-128` contam pastas de `skills/` e vão dizer "16 skills" com `_comum/` — cosmético, o README continua certo com 15.

## Coding Standards
Instruções de skill em inglês; o que o humano lê em pt-BR. Arquivo existente → `Edit` (ou o script, nas 11); arquivo novo → `Write`. Corpo longo (comentário, commit) por arquivo + `--body-file`/`-F`. Commits com trailer `Card: #29`. Nada além do especificado; frontmatter das skills intocado.
