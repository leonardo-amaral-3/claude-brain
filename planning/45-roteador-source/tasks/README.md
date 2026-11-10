# Tasks do #45 — roteador de source no `search_context`

Spec: [`../spec.md`](../spec.md) (G2 emendado em 10/11/2026, cofre #1463, alinhado ao contrato do
cliente do Jev do #42). Toda regra, nome, caso de teste e decisão está lá. Estas tasks só recortam.
Se a realidade contradisser a spec, é desvio → PARADA.

| # | Task | Fecha com |
|---|---|---|
| 1 | [T0: negativo apodrecido do golden](1-golden-negativo-apodrecido.md) | portão de entrada + `npm run eval -- --base origin/dev` com código `0` |
| 2 | [`sem-jev.mjs` e a limpeza dos filhos (A8)](2-sem-jev-nos-scripts.md) | `concorrencia` verde, eval `0`, smoke só com o G2-F |
| 3 | [`src/roteador.ts` e a suíte `npm run roteador`](3-roteador-e-suite.md) | `npm run build` + `npm run roteador` com código `0` |
| 4 | [Handler do `search_context` e a linha de boot](4-handler-e-integracao.md) | `roteador` `0`, as duas formas do eval com `0`, `concorrencia`, smoke só com o G2-F |
| 5 | [README e o portão final](5-readme-e-portao-final.md) | o portão inteiro do `## Plano de testes` |

## Ambiente (a task 1 prové, e as outras reusam)

- Worktree `/home/leo/pessoal/claude-brain-45-roteador-source`, branch `feat/45-roteador-source`,
  empilhada sobre `feat/42-filtro-jev`. Não crie outra worktree nem outra branch. Não mexa no
  checkout principal nem nas worktrees dos outros cards.
- `brain-mcp/node_modules` **não existe** nesta worktree (Q6). A task 1 roda os passos 1–3 do
  `## Execution` › **Ambiente** da spec: `npm ci` com o Node 22 e `SHARP_IGNORE_GLOBAL_LIBVIPS=1`,
  a cópia do cache do modelo (só lê a instalação) e `npm run build`. As tasks seguintes não refazem o
  `npm ci`.
- Todo comando do portão roda com `PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH`.
  `smoke` e `eval` também levam `BRAIN_DB=$HOME/notoria/claude/brain-mcp/data/brain.db` e
  `BRAIN_CONFIG=$HOME/notoria/claude/brain-mcp/brain.config.json`, como manda o portão do `CLAUDE.md`
  do repo (regra 2 da esteira). Abreviação usada nas tasks: `N22="PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH"`
  e `VIVO="BRAIN_DB=... BRAIN_CONFIG=..."`, com esses valores.
- Instalação viva (`~/notoria/claude/brain-mcp/`, `~/.claude/hooks/`) **só leitura**: nada de
  `sync.sh push`, de `npm run build` lá nem de escrita em `~/.claude`.
- Commits: arquivos por nome (nunca `git add -A`/`.`), trailer `Card: #45` e
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Smoke vermelho conhecido (G2-F)

`npm run smoke` já sai `1` na base, com `FALHOU: feature_timeline sem documentos` (`smoke.mjs:78-82`;
cofre #1456/#1457), por um motivo alheio ao #45. Em toda task, esse vermelho **específico** não
bloqueia o commit: a verificação é que o smoke falhe **só** nele, e não antes (por exemplo, com
`FALHOU: cliente do Jev não encontrado…`). Ele bloqueia só a PR, e quem para é o `/gm-ship`.
Corrigir o `smoke.mjs` está fora do escopo (precisa de card próprio, decisão do Leonardo).

## Premissas que as tasks usam

As da spec (`## Premissas medidas`, P1–P24) valem. Medidas a mais nesta quebra, em 2026-11-10:

| # | Premissa | Prova | Resultado |
|---|---|---|---|
| Q1 | Onde a worktree está em relação à ponta do #42 | `git rev-parse HEAD feat/42-filtro-jev`; `git merge-base --is-ancestor HEAD feat/42-filtro-jev`; `git diff --stat HEAD feat/42-filtro-jev` | HEAD `686dd1d` é ancestral da ponta `3b01da2`. A diferença é só `planning/42-filtro-jev/spec.md` (`## Rollback`, fora do contrato). O rebase do `## Execution` é um fast-forward |
| Q2 | A P15 vale até a ponta nova | `git diff --stat 4101a72 HEAD -- brain-mcp/src brain-mcp/scripts/{eval,smoke,concorrencia}.mjs brain-mcp/scripts/golden.json brain-mcp/package.json` | só `package.json` (+ `"jev"`). `src/`, os três scripts e o golden não mudaram |
| Q3 | O `hooks/jev.js` da base exporta o que o #45 usa | leitura de `hooks/jev.js:84` e `:520-532` | `USOS` contém `roteador`. Exporta `ligado`, `decidir`, `julgar`, `envSemJev` e `MAX_ESTADO`, entre outros. A conferência formal de C1–C6 é o portão de entrada (task 1) |
| Q4 | A T0 continua necessária e o repo substituto continua vazio | `grep -n GetIndicadoresController brain-mcp/scripts/golden.json`; `node:sqlite` `readOnly` no índice vivo | o caso continua em `golden.json:206`. `modulo-erp`: 1607 docs. `extractor`: 0 docs |
| Q5 | A base ainda não traz a limpeza dos filhos | `grep -n "envSemJev\|semJev\|sem-jev" brain-mcp/scripts/{eval,smoke,concorrencia}.mjs` | nada. A task 2 faz a limpeza (a ressalva "se a base já trouxer" da spec não se aplica hoje) |
| Q6 | Ambiente | `ls` | sem `brain-mcp/node_modules` na worktree. Existem o Node `22.23.4`, o cache `~/notoria/claude/brain-mcp/node_modules/@huggingface/transformers/.cache` e os dois caminhos do `VIVO` |
| Q7 | As âncoras que a spec cita nos scripts | `grep -n` | `smoke.mjs:7` (o `spawn`), `concorrencia.mjs:21` (`const root`) e `:31` (`BRAIN_LEASE_TTL_MS`), `eval.mjs:669` (`async function main`) com o primeiro `lerArgumentos(` em `:670` e `naoMedi` em `:561` |

## Regras do lote (repasse em qualquer despacho)

- Não há chave da API do Jev nesta máquina, e o Leonardo não autorizou mandar trechos do corpus nem
  queries para a TypeSafe AI. **Nada chama a API.** Só o cliente falso (`BRAIN_JEV_FALSO`) e o Jev
  falso da suíte. O grupo B (B1) fica fora das tasks: não tem comando nesta PR (G2-E).
- `mcp__brain__lembrar`: escopo **sempre `claude-brain#45`**, nunca o número puro (o número puro já
  publicou decisões em cards da ICSF-Solutions).
- Não mexer nos comentários errados da triagem (`modulo-processos#45`, `processos-criticas#41/#44/#46`),
  em outros cards do lote nem no #42 (nem no `hooks/jev.js`: divergência com o contrato é PARADA,
  com emenda pedida).
- Repo público: nada de dado ou nome de cliente em código, teste, comentário, commit ou PR.
- PARADA: desvio da spec, premissa que a implementação desmente, escolha de produto que card, spec e
  cofre não respondem, teste vermelho que não seja o G2-F, merge, `main`, instalação viva, apagar.
