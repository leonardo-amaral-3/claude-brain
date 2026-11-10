❌ Status: Not Started

# Task 2: Jev falso por hook, `juizJev.ts` provisório e o `lembrar` ligado

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/46-freio-contradicao/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `brain-mcp/` directory of the `claude-brain` repository — the worktree `~/pessoal/claude-brain-46-freio-contradicao`, **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (`feat/46-freio-contradicao`, already checked out by `/gm-implement`). Do not create another worktree or branch, and do not touch the main checkout.

This is task 2 of 4. Task 1 is already in the codebase: `contradicao.ts` exists with `julgarContradicoes`, `formatarAviso` and `criarJulgarPar`, and the 8 unit cases are in `concorrencia.mjs`.

Premissas medidas em que esta task se apoia (spec, `## Premissas medidas`): a ordem do `lembrar` (`tools.ts:546-566`); o hook `embeddings-falso-hook.mjs:14-26` e o fato de todo servidor dos testes subir com ele; o stub de embeddings e os cossenos que ele dá; o arnês `subirServidor`/`chamarCru`/`criarFixture(..., { comDecisoes: true })` do `concorrencia.mjs`; `hoje()` em UTC e o nome do `.md` saindo dos 60 primeiros caracteres do slug.

**O `juizJev.ts` desta task é provisório** (decisão #1418). O hook de resolução chama o `next(spec)` padrão antes de trocar `/dist/juizJev.js` pelo falso, e o resolvedor padrão falha se o arquivo não existe. Por isso os casos com o Jev falso precisam de um `dist/juizJev.js`, e o cliente do #42 ainda não tem código. O provisório tem só `import type { JulgarPar } from "./contradicao.js"`, uma `export async function obterJulgarPar(): Promise<JulgarPar | null>` que resolve `null` e um comentário dizendo que a task 4 o troca pelo da spec (`### Fronteira com o #42`). Ele não importa nada do #42 e não tem lógica. `null` é exatamente o comportamento de R1.

## Scope

- `### brain-mcp/scripts/jev-falso.mjs (novo)` da spec, inteiro.
- `### brain-mcp/scripts/embeddings-falso-hook.mjs` da spec, inteiro: a troca de `/dist/juizJev.js` e o porquê no cabeçalho. O nome do arquivo não muda.
- `brain-mcp/src/juizJev.ts` **provisório**, como descrito em `## Context`, e nada além disso.
- `### brain-mcp/src/tools.ts` da spec, inteiro: os dois imports e o bloco no lugar do `const aviso = ...`. O `return`, o `inputSchema` e a `description` não mudam.
- Em `brain-mcp/scripts/concorrencia.mjs`, os **4 casos de servidor** do `## Plano de testes`: `lembrar-com-jev-desligado-fica-como-hoje`, `lembrar-com-jev-falso-marca-a-contradicao`, `lembrar-com-jev-em-erro-grava-e-avisa-como-hoje`, `lembrar-com-jev-lento-respeita-o-prazo`. Siga as regras da spec para casos de servidor:
  - `envExtra` sempre com `BRAIN_JEV_FALSO` explícito e `BRAIN_JEV_FALSO_REGISTRO` em `join(fx.dir, "jev-falso.log")`;
  - escopo `freio`;
  - fatos com ≥ 20 palavras e ≤ 110 caracteres, diferindo em uma palavra entre as cinco primeiras;
  - `<hoje>` em UTC e a semelhança esperada calculada pelo próprio stub;
  - R4 afirmado em cada caso;
  - primeiro as vizinhas esperadas, depois a marca.

**Fora do escopo:** o `juizJev.ts` real e qualquer import do módulo do #42 (task 4), o `contradicao.mjs`, o caso `contradicao-mede-com-jev-falso`, o `package.json` e o `README.md` (task 3), e qualquer mudança em `contradicao.ts` além de um desvio, que é `PARADA`.

## Ambiente

- Todo `npm`/`node` desta task roda com o Node 22 do mise:
  `export PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH`. O Node v26.12.0 da máquina não compila o `sharp` no `npm ci`. O `ExperimentalWarning` do SQLite que o Node 22 imprime no stderr não é falha. Se ele aparecer no stderr de um servidor de teste, não confunda com uma linha `[brain] contradicao:`.
- `brain-mcp/node_modules` é **pré-condição fora desta task**: o braço direito o provê antes do `/gm-implement`. Se faltar, `PARADA` com o motivo. **Não rode `npm install` nem `npm ci`.**
- Nenhum processo chama a API do Jev: todo servidor de teste sobe com o hook, que troca o juiz pelo falso. Não rode o servidor fora do arnês com a flag do Jev ligada.
- Se gravar decisão com `mcp__brain__lembrar`, o escopo é **`claude-brain#46`**, nunca o número puro.

## Verification

- Command(s) that must pass, de dentro de `brain-mcp/`: `npm run build` e `npm run concorrencia` (os 4 casos novos verdes, os 8 da task 1 e todos os antigos também).
- `git diff` de `tools.ts` restrito aos imports e ao bloco do aviso. O `tools/list` não muda.
- Acceptance criteria covered: R1, R2, R3, R4, R5 (`.md` comparado com o literal) e R6 (registro do falso), nas provas de servidor.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables
- [ ] `juizJev.ts` provisório sem import do #42 e sem lógica, com o comentário apontando a task 4

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the repo, message ending with the trailer `Card: #46` and then the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
