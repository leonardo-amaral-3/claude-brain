# Tasks do #41 — sugestão do Jev na classificação da gm-triage

Spec: [`../spec.md`](../spec.md) (G2 revisto em 10/11/2026, cofre #1460). O contrato do cliente do Jev
que ela consome é a seção `### Contrato do cliente do Jev (estável)` de
[`../../42-filtro-jev/spec.md`](../../42-filtro-jev/spec.md), com a emenda 1. **Nenhuma task do #41
altera `hooks/jev.js` nem `planning/42-filtro-jev/`.** Divergência entre o `hooks/jev.js` e um item de
`### O que esta spec usa do contrato` é desvio de spec → PARADA.

| # | Task | Depende de | Fecha com |
|---|---|---|---|
| 1 | [Base do script: `lerBoard`, `sensivel` e constantes](1-base-lerboard-sensivel.md) | `hooks/jev.js` do #42 (já na branch) | `node scripts/gm-triage-jev-teste.mjs` |
| 2 | [`sugerir` e `renderizar`](2-sugerir-renderizar.md) | 1 | `node scripts/gm-triage-jev-teste.mjs` |
| 3 | [`principal` e `carregarCliente`](3-principal.md) | 2 | `node scripts/gm-triage-jev-teste.mjs` |
| 4 | [Bloco de execução e a CLI de ponta a ponta](4-carregar-cli.md) | 3 | `node scripts/gm-triage-jev-teste.mjs` |
| 5 | [Step 4b no `SKILL.md` e a frase no `CLAUDE.md`](5-skill-e-claude-md.md) | 4 | `node scripts/skills-comum.mjs --check` **e** `node scripts/gm-triage-jev-teste.mjs` |

O teste `scripts/gm-triage-jev-teste.mjs` cresce a cada task: cada uma acrescenta os blocos dela, e os
blocos das anteriores continuam verdes.

## Base, pilha e o que vem do #42

- Worktree `/home/leo/pessoal/claude-brain-41-triagem-jev`, branch `feat/41-triagem-jev`, avançada por
  fast-forward até `14fee0c` (= `origin/feat/42-filtro-jev`, task 1 do #42), que traz `hooks/jev.js`.
  Não crie outra worktree nem outra branch.
- A PR do #41 tem base `feat/42-filtro-jev`, ou `dev` se a PR do #42 já tiver entrado nela. **O rebase
  sobre a ponta nova do #42 é do braço direito**, não de uma task.
- **Nenhuma task do #41 depende das tasks 2 a 4 do #42.** As tasks usam só `ligado`, `decidir`,
  `envSemJev` e o falso do `hooks/jev.js`, que estão no `14fee0c` (task 1 do #42). A task 2 do #42 mexe
  em `hooks/brain-contexto.js`, que o #41 não usa. A task 3 do #42 mexe em `brain-mcp/scripts/injecao.mjs`,
  que o #41 também não usa. A task 4 do #42 põe o `jev.js` no `HOOKS_VERSIONADOS` do `sync.sh`: isso só
  importa para o item 1 da `## Verificação pós-deploy` da spec (o `jev.js` chegar à instalação), que é de
  Leonardo depois do `push`, e não para uma task.
- **`planning/42-filtro-jev/` é do #42: não edite.**

## Ambiente

- `node` do sistema (v26.12.0). O teste é script avulso, só com módulos `node:`: **não precisa de
  `brain-mcp/node_modules`**, que não existe nesta worktree. Nenhuma task roda `npm`. Se alguma
  precisar, é desvio de spec, porque nada vai para `brain-mcp/` (`## Execution`). Para referência, o
  modo de prover registrado é, dentro de `brain-mcp/`,
  `PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm ci`
  (cofre #1424).
- Estado "ligado" só pelo falso (`BRAIN_JEV_FALSO`). Nenhuma task define `TYPESAFE_API_KEY` nem chama a
  API de verdade.
- **Ressalva do contrato (repasse da dona do #42), revista em 2026-11-10 pela emenda 2 do #42**
  (cofre #1502): a ordem de decisão agora é uso inválido → desligado → validação da entrada → falso →
  `sem_chave` → real. Com `BRAIN_JEV_FALSO` definida, entrada torta volta `entrada_invalida`, igual ao
  real; antes da emenda, o falso respondia antes da validação. Nenhum caso do `## Plano de testes`
  depende de nenhuma das duas ordens: o `{}` de "resposta inválida" sai do falso **em processo** do
  teste (task 2). A suíte passou com o `hooks/jev.js` da emenda 2 (cofre #1512).
- A instalação viva (`~/.claude`, `~/notoria/claude/brain-mcp`) é **só leitura**: nada de `sync.sh push`
  nem de escrita lá. O teste isola o `CLAUDE_CONFIG_DIR` numa pasta temporária.

## Commits

- Na `feat/41-triagem-jev`, arquivos por nome (nunca `git add -A` nem `git add .`), mensagem terminada
  pelo trailer `Card: #41` e por `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **A spec e esta pasta `tasks/` entram num commit `docs(planning)` próprio, feito pela task 1 antes do
  commit de código dela** (no molde de `4101a72` e `cc510cc` do #42): `planning/41-triagem-jev/spec.md` e
  `planning/41-triagem-jev/tasks/`. Cada task seguinte commita o próprio arquivo de task com o ✅.

## Premissas que as tasks usam

As da spec (`## Premissas medidas`) valem. Ela as mediu com a worktree em `3c3b92c`. Medidas de novo
nesta quebra, em 2026-11-10, com a worktree em `14fee0c`:

| # | Premissa | Prova | Resultado |
|---|---|---|---|
| Q1 | O fast-forward até `14fee0c` não mexeu em nada que a spec cita fora do #42 | `git diff 3c3b92c 14fee0c --stat` | só `hooks/jev.js`, `brain-mcp/scripts/jev.mjs`, `brain-mcp/package.json` e `planning/42-filtro-jev/`. `skills/gm-triage/SKILL.md`, `sync.sh`, `CLAUDE.md` e `scripts/` intactos |
| Q2 | O `hooks/jev.js` da HEAD exporta o que a spec usa e carrega em silêncio | script em `/tmp/m41g3/p.mjs` com `createRequire` | exporta `ligado, decidir, julgar, envSemJev, …`; carregar e chamar escreveu 0 bytes no stderr e nada fora do que o script imprimiu; único `require` é `fs` (`:60`) |
| Q3 | `ligado` com a lista de usos | o mesmo script | `triagem`+falso → `true`; `1`+falso → `false`; `" Contexto , TRIAGEM "`+falso → `true`; `triagem` sem chave nem falso → `false` |
| Q4 | `envSemJev` tira as variáveis do Jev | o mesmo script | `{BRAIN_JEV, TYPESAFE_API_KEY, BRAIN_JEV_FALSO, PATH}` → `{PATH}` |
| Q5 | O falso por roteiro, o `lento` e o uso obrigatório | o mesmo script, `decidir` com `{uso:"triagem", timeoutMs, env}` | regra sem `confianca` → 0,95; `confianca:0.75` em 3 opções → 0,125 nas outras; sem regra nem `padrao` → `{indisponivel, resposta_invalida, roteiro}`; `lento` com 300 ms → `{timeout, falso}` em 300 ms; sem `uso` → `entrada_invalida`, com ou sem falso |
| Q6 | O carimbo dos blocos comuns está verde antes do card | `node scripts/skills-comum.mjs --check` | código 0, "11 skills × 3 blocos iguais à fonte" |
| Q7 | Não há chave nem flag nesta máquina | `env \| grep -E '^(BRAIN_\|TYPESAFE)'` | vazio |

## Regras do lote (repasse em qualquer despacho)

- Não há chave da API do Jev, e Leonardo **não** autorizou mandar trechos do corpus nem o relato da
  triagem para a TypeSafe AI. A medição do R5 (critério 5 do card) fica **fora das tasks**, pendente do
  aval de Leonardo para o uso `triagem`.
- Repo público: nada de dado nem nome de cliente em código, teste, fixture, comentário, commit ou PR.
  Fixtures com ids inventados.
- `mcp__brain__lembrar`: escopo sempre `claude-brain#41`, nunca o número puro. Toda decisão gravada
  numa task repassa esta regra.
- Não mexa em outros cards, nos comentários de triagem de outros repos nem em outras worktrees do lote.
- PARADA e devolve: merge, `main`, tag, release, instalação viva, apagar fora da árvore temporária do
  teste, escolha de produto que card, spec e cofre não respondem, teste vermelho fora do escopo, desvio
  de spec.
