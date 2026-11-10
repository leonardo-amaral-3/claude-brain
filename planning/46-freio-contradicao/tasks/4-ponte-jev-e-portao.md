❌ Status: Not Started

# Task 4: A ponte com o cliente do Jev do #42 (`juizJev.ts`) e o portão do `/gm-ship`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/46-freio-contradicao/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `brain-mcp/` directory of the `claude-brain` repository — the worktree `~/pessoal/claude-brain-46-freio-contradicao`, **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/46-freio-contradicao`, already checked out by `/gm-implement`). Do not create another worktree or branch, and do not touch the main checkout.

This is task 4 of 4. Tasks 1..3 are already in the codebase. Todo o #46 está lá, menos a ponte. `brain-mcp/src/juizJev.ts` é hoje **provisório**: resolve `null` sem importar o #42 (decisão #1418). Esta task o troca pelo da spec.

**Esta task depende do código do #42** (`leonardo-amaral-3/claude-brain#42`, branch `feat/42-filtro-jev`). O braço direito faz o rebase da `feat/46-freio-contradicao` sobre ela antes desta task.

## Scope

### Passo 0: conferir D1-D5 antes de escrever qualquer linha

Leia `### Fronteira com o #42` da spec e confira **cada um** de D1, D2, D3, D4 e D5 contra o código e a spec do #42 que estão na branch. Para cada um, anote a prova (arquivo e linha, ou trecho da spec do #42) e o resultado. Isso vai no resumo da task.

- A branch não contém o código do #42, porque o rebase não aconteceu ou o #42 ainda não tem cliente → **`PARADA`**: o #46 espera o código do #42.
- Qualquer um de D1-D5 não fecha → **`PARADA`** (desvio da spec, protocolo de desvio do `gm-implement`). Isso vale também para:
  - o #42 não dizer se a probabilidade é a da resposta dada ou a de "sim" (D2);
  - ligar o #42 a `ClienteJev` exigir mais do que ligar nomes.

  Não improvise adaptador, não mexa em `contradicao.ts` para acomodar o #42, não mexa no código do #42.
- O desejável (`AbortSignal`) não é condição. Só diga se o #42 o aceita.

### Passo 1: a ponte

- `### Fronteira com o #42: brain-mcp/src/juizJev.ts (novo)` da spec, inteiro: import dinâmico dentro do `try`, o corpo só ligando nomes (o `&&` de D3 e a conversão de D2, se forem necessários) e o `console.error` no `catch`. Substitui o provisório inteiro, comentário incluído.
- Nada mais em `brain-mcp/src/`.

### Passo 2: o portão do `/gm-ship`

Rode o portão que a spec lista em `## Execution` e o CLAUDE.md do repo em `## A esteira`, item 2: `npm run build`, `npm run concorrencia`, `npm run smoke` e `npm run eval -- --base origin/dev`. O `dist/` deve estar recompilado. No `smoke` e no `eval`, `BRAIN_DB`/`BRAIN_CONFIG` apontam para o índice vivo, **só leitura** (o `eval` mede um snapshot; o `smoke` não chama o `lembrar`). O que o `eval` exige para medir (resolução do checkout, guardas de branch e de frescor) está em `brain-mcp/README.md`, `## Qualidade da busca`: leia antes de rodar. Código `1` ou `2` em qualquer um é vermelho: a PR não abre. Não "conserte" o portão, reporte a saída.

- O `smoke` sobe o servidor real com o `juizJev.ts` real. Ele prova que o boot não depende do módulo do #42. Rode-o **com a flag do Jev desligada** no ambiente: ele não chama o `lembrar`, mas nada nesta task deve poder alcançar o Jev real.

**Fora do escopo:** `sync.sh push`, `npm run build` na instalação e a verificação pós-deploy (são da 🧪 Validação em Dev, com Leonardo). Também fora: o critério 4 com pares reais (`npm run contradicao -- --enviar`), pendente do aval de Leonardo e que não roda aqui em hipótese nenhuma. E qualquer mudança no código do #42.

## Ambiente

- Todo `npm`/`node` desta task roda com o Node 22 do mise:
  `export PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH`. O Node v26.12.0 da máquina não compila o `sharp` no `npm ci`. O `ExperimentalWarning` do SQLite no stderr não é falha.
- `brain-mcp/node_modules` é **pré-condição fora desta task**: o braço direito o provê antes do `/gm-implement`. Depois do rebase sobre o #42, se o `package.json` do #42 trouxer dependência nova que o `node_modules` não tem, isso é ambiente quebrado: `PARADA` com o motivo. **Não rode `npm install` nem `npm ci`.**
- Sem chave da API do Jev e sem autorização para mandar trechos do cofre à TypeSafe AI: nenhum passo chama a API do Jev.
- Se gravar decisão com `mcp__brain__lembrar` (por exemplo, o resultado de D1-D5), o escopo é **`claude-brain#46`**, nunca o número puro.

## Verification

- Command(s) that must pass, de dentro de `brain-mcp/`: `npm run build`, `npm run concorrencia`, `npm run smoke` e `npm run eval -- --base origin/dev`, todos com código `0`.
- `git diff` desta task restrito a `brain-mcp/src/juizJev.ts`.
- Acceptance criteria covered: a fronteira com o #42 (D1-D5) e o portão inteiro. R1-R6 continuam provados pelo `concorrencia`, porque o hook troca o `juizJev.js` real pelo falso. O critério 4 (R7 com pares reais) fica **não medido**, pendente do aval, e o resumo diz isso.

## Completion Checklist

- [ ] D1-D5 conferidos, cada um com prova e resultado no resumo
- [ ] `juizJev.ts` igual ao da spec, só ligando nomes
- [ ] Verification command(s) green, com a saída do `smoke` e do `eval` no resumo
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: D1-D5 first, then the verification result, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #46` and then the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
