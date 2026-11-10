# Tasks do #42 — filtro do Jev no hook de contexto e o cliente único do Jev

Spec: [`../spec.md`](../spec.md) (G2 em 10/11/2026, commit 4101a72; emenda 1, só aditiva, no mesmo dia). O contrato que os irmãos #41, #43,
#44, #45 e #46 leem é `### Contrato do cliente do Jev (estável)`: **nenhuma task o muda**. Divergência
com ele é desvio de spec → PARADA.

| # | Task | Fecha com |
|---|---|---|
| 1 | [Cliente do Jev](1-cliente-jev.md) | `npm run jev` (T1–T10) |
| 2 | [Filtro no hook](2-filtro-no-hook.md) | `npm run jev` (T1–T16) |
| 3 | [Portão `--portao jev` no `injecao.mjs`](3-portao-injecao.md) | `node scripts/injecao.mjs ... --portao jev` |
| 4 | [Sincronia, docs e suíte final](4-sync-docs-e-suite.md) | os dois comandos do `## Plano de testes` |

## Ambiente (já provido — não refaça)

- Worktree `/home/leo/pessoal/claude-brain-42-filtro-jev`, branch `feat/42-filtro-jev`. Não crie outra
  worktree nem outra branch; os irmãos #45 e #46 empilham nesta.
- `brain-mcp/node_modules` **já instalado localmente** com
  `PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm ci`
  (cofre #1424: a libvips do sistema faz o `sharp` tentar compilar). **Não** rode `npm install` nem
  `npm ci` de novo, e **não** use o symlink para o `node_modules` da instalação que o `## Execution` da
  spec sugeria: ele foi substituído por esta instalação local.
- Build e scripts com o Node 22: prefixe com `PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH`.
  O `node` padrão da máquina é o v26.12.0; os filhos que os scripts disparam usam `process.execPath`,
  logo o Node 22 também.
- Medição e verificação **só com o cliente falso** (`BRAIN_JEV_FALSO`), sem rede. A instalação viva
  (`/home/leo/notoria/claude/brain-mcp`, `~/.claude/hooks`, `~/.claude/brain-workspaces.json`) é **só
  leitura**: nada de `sync.sh push`, `npm run build` lá, ou escrita em `~/.claude`.
- Commits: arquivos por nome (nunca `git add -A`/`.`), trailer `Card: #42` e
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Premissas que as tasks usam

As da spec (`## Premissas medidas`, P1–P14) valem. Medidas a mais nesta quebra, em 2026-11-10, porque
o ambiente provido difere do da spec (Node 22 em vez do 26 de P7):

| # | Premissa | Prova | Resultado |
|---|---|---|---|
| Q1 | O Node 22 dos scripts tem `fetch` e `AbortController` | `node22 -e "console.log(process.version, typeof fetch, typeof AbortController)"` | `v22.23.4 function function` |
| Q2 | O hook atual roda sob o Node 22 contra o `dist/` e o índice da instalação | `echo "$P" \| node22 hooks/brain-contexto.js` (o `P` da `## Verificação pós-deploy`) | emite bloco `busca lexica automatica`, igual ao do Node 26 |
| Q3 | O prompt de prova de T11–T16 tem ≥ 6 candidatos no passo 5 | script fora do repo (`/tmp/m42p/cands.mjs`) repetindo `buscar(alvo, {}, 24)` + `daqui` + `relevante` com `cwd` `~/pessoal/claude-brain` | 9 candidatos (T16: `k = 4`). O índice vivo muda; o `jev.mjs` reconfere na hora e sai 2 se cair |
| Q4 | `brain-mcp/node_modules` existe na worktree | `ls -d brain-mcp/node_modules` | existe |

## Regras do lote Jev (repasse em qualquer despacho)

- O cliente do Jev nasce aqui e os cinco irmãos o reaproveitam: contrato estável, atrás de flag,
  desligado por padrão; sem chave, nada quebra.
- Não há chave da API nesta máquina e Leonardo **não** autorizou mandar corpus à TypeSafe AI. Nada
  chama a API de verdade. Precisão/latência reais e calibração do limiar são pendências declaradas.
- `mcp__brain__lembrar`: escopo sempre `claude-brain#42`, nunca o número puro.
- Repo público: nada de dado ou nome de cliente em código, teste, comentário, commit ou PR; a saída
  das medições só leva contagens e índices.
- PARADA e devolve a Leonardo: merge, `main`, tag, release, instalação viva, apagar, escolha de produto
  que card/spec/cofre não respondem, teste vermelho fora do escopo, desvio de spec.
