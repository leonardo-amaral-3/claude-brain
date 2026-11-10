# Tasks do #43: portão da spec sensível

Spec: [`../spec.md`](../spec.md). Card: `leonardo-amaral-3/claude-brain#43`. G3 fechado pelo braço
direito em 2026-11-10, no modo despachado (cofre #1414).

| # | Task | Depende do #42? | Fecha com |
|---|---|---|---|
| 1 | [Regra e linha](1-regra-e-linha.md) | não | `node scripts/gm-spec-sensivel-teste.mjs` |
| 2 | [classificar com Jev falso](2-classificar-com-jev-falso.md) | não | `node scripts/gm-spec-sensivel-teste.mjs` |
| 3 | [CLI e registro](3-cli-e-registro.md) | não | `node scripts/gm-spec-sensivel-teste.mjs` |
| 4 | [Texto: Fase 4, docs, template, CLAUDE.md](4-texto-fase-4-e-docs.md) | não | teste + `node scripts/skills-comum.mjs --check` |
| 5 | [Fronteira com o cliente do #42](5-fronteira-com-o-42.md) | **sim**: só começa com o `gm:spec` do #42 publicado no card | teste + `--check` (é a task que fecha) |

## Empilhamento

A implementação **empilha em `feat/42-filtro-jev`** (worktree `~/pessoal/claude-brain-42-filtro-jev`;
cofre #1387). O braço direito rebaseia `feat/43-portao-spec-sensivel` sobre ela **antes** do
`/gm-implement`. As tasks 1 a 4 não tocam o cliente do #42 e não esperam por ele. A task 5 liga
`carregarJev` ao contrato publicado do #42 (R1–R4 de `### Fronteira com o cliente do #42`). A PR
só abre com a task 5 feita, nunca com o stub que devolve `null` (cofre #1406).

## Ambiente

- Nenhuma task precisa de `brain-mcp/node_modules`: o `sensivel.mjs` e o teste usam só módulos `node:`,
  e rodam no Node da máquina (v26.12.0). Nada em `brain-mcp/` nem em `hooks/` muda.
- Se alguma task acabar precisando das dependências do `brain-mcp` (não deveria; seria desvio), use o
  Node 22 do mise, em `/home/leo/.local/share/mise/installs/node/22.23.4/bin`, porque o `npm ci` falha
  compilando o `sharp` no Node v26. **Isso ainda não foi provado no `brain-mcp`.**

## Regras do lote (valem para toda task)

- **Nenhuma task chama a API do Jev.** Não há chave, e o Leonardo não autorizou mandar texto de spec
  para a TypeSafe AI. A prova com a API real (CA8) fica em `## Verificação pós-deploy` e depende do aval
  dele.
- O repo é público: nada de dado de cliente nem nome de cliente, nem nas fixtures do teste.
- Decisão gravada no `mcp__brain__lembrar` usa sempre o escopo `claude-brain#43`, nunca o número puro,
  e é copiada no card com um comentário `<!-- gm:decisao -->` em `leonardo-amaral-3/claude-brain#43`.
- Não mexa nos comentários errados da triagem (modulo-processos#45, processos-criticas#41/#44/#46),
  em outros cards nem em outras worktrees do lote.
