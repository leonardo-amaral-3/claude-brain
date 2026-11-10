❌ Status: Not Started

# Task 3: Script de medição do critério 4 e README

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/46-freio-contradicao/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `brain-mcp/` directory of the `claude-brain` repository — the worktree `~/pessoal/claude-brain-46-freio-contradicao`, **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/46-freio-contradicao`, already checked out by `/gm-implement`). Do not create another worktree or branch, and do not touch the main checkout.

This is task 3 of 4. Tasks 1 and 2 are already in the codebase: `contradicao.ts`, `LIMIAR_MESMO_ASSUNTO` exportado, `jev-falso.mjs`, o hook que troca `/dist/juizJev.js` pelo falso, um `juizJev.ts` **provisório** que resolve `null` (a task 4 o troca; decisão #1418) e o `lembrar` ligado, com 12 casos no `concorrencia.mjs`.

Premissas medidas em que esta task se apoia (spec, `## Premissas medidas`):
- `eval.mjs` exporta `tirarSnapshot` sem efeito ao ser importado e termina com `process.exit` (`eval.mjs:11-38, 249-265, 755-776`);
- a lista de vizinhas e o `LIMIT 300` (`memoria.ts:65-109`);
- as 100 decisões com `substitui:` no cofre;
- o stub de embeddings e os seus cossenos.

## Scope

- `### brain-mcp/scripts/contradicao.mjs (novo) e package.json` da spec, inteiro: os dois portões (flag **e** `--enviar`), o snapshot só de leitura apagado no `finally`, o `process.exit` no fim, o formato exato do relatório e as contagens.
- O caso de script `contradicao-mede-com-jev-falso` do `## Plano de testes`, em `brain-mcp/scripts/concorrencia.mjs`, com o `spawnSync` que a spec dá logo abaixo da tabela: as três rodadas e as duas guardas, a contagem de `decisoes` e os diretórios `brain-eval-*`. O caso confere os cossenos pelo stub antes de rodar o script.
- `### brain-mcp/README.md` da spec, inteiro: `## Memória ativa`, a linha em `## Comandos` e a variável `BRAIN_CONTRADICAO_PRAZO_MS`. O README fala da "flag do Jev (#42)" sem inventar nome de variável que o #42 ainda não fixou.

**Fora do escopo:** `brain-mcp/src/` inteiro (nenhum `.ts` muda nesta task) e o `juizJev.ts` real (task 4).

**Proibido:** rodar `npm run contradicao -- --enviar` fora do caso do `concorrencia` (que sobe o script com o hook). Sem o hook, o script resolveria o `juizJev.js` de verdade. O critério 4 com pares reais **não é desta task nem de nenhuma**: fica pendente do aval de Leonardo (chave do Jev e autorização de mandar trechos do cofre à TypeSafe AI).

## Ambiente

- Todo `npm`/`node` desta task roda com o Node 22 do mise:
  `export PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH`. O Node v26.12.0 da máquina não compila o `sharp` no `npm ci`. Esse Node 22 tem `node:sqlite` com `readOnly` (o `VACUUM INTO` do `tirarSnapshot` e a abertura só de leitura funcionam; medido no planejamento, 2026-11-10). O caso usa `process.execPath`, então o script roda no mesmo Node. O `ExperimentalWarning` do SQLite no stderr não é falha.
- `brain-mcp/node_modules` é **pré-condição fora desta task**: o braço direito o provê antes do `/gm-implement`. Se faltar, `PARADA` com o motivo. **Não rode `npm install` nem `npm ci`.**
- Nenhum passo chama a API do Jev nem manda trecho do cofre para a TypeSafe AI.
- Se gravar decisão com `mcp__brain__lembrar`, o escopo é **`claude-brain#46`**, nunca o número puro.

## Verification

- Command(s) that must pass, de dentro de `brain-mcp/`: `npm run build` (o script importa do `dist/`) e `npm run concorrencia` (o caso novo verde e os 12 anteriores, além dos antigos).
- Acceptance criteria covered: R7 (a mecânica). A medição com pares reais, que é o critério 4, fica registrada como não medida.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables
- [ ] `git diff --stat` sem nenhum arquivo em `brain-mcp/src/`

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #46` and then the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
