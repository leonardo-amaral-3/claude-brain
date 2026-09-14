✅ Status: Complete

# Task 6: `eval.mjs --base <ref>` — o portão

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/18-eval-portao-uso-real/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

The code lives in the `brain-mcp/` directory of the `claude-brain/` repository of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

**Onde rodar os comandos: na instalação, nunca no checkout.** Leia `## Execution` da spec. Esta task é a que faz disso um problema de desenho: o eval roda na instalação, que **não é repositório git**, e precisa alcançar o git do checkout por caminho explícito.

Um detalhe da máquina, para não te custar uma hora: o marcador `~/.claude/brain-sync-origem.txt` guarda a branch do último `sync push`. Enquanto você não rodar `./sync.ps1 push` da branch de feature, ele diz `branch=main` e a guarda de branch vai recusar — corretamente.

This is task 6 of 7. Tasks 1..5 are already in the codebase — o `eval.mjs` já mede nDCG@5 sobre snapshot, com aquecimento e invalidação.

## Scope

`### scripts/eval.mjs — o --base <ref>` da spec, tudo menos o snapshot (item 1, já feito na task 5), mais a linha `brain-mcp/dist-base/` no `.gitignore`.

- Resolução do checkout na ordem que a spec fixa (`--repo` → `BRAIN_REPO` → `worktree=` do marcador), com código `2` nomeando as três saídas quando nenhuma resolve.
- As **duas guardas**, ambas antes de qualquer trabalho: branch e frescor do build. A decisão técnica 10 explica por que elas são parte do portão e não conveniência — sem elas o portão devolve "não caiu" com toda a confiança, que é a pior falha possível.
- Compilação do ref base. Os **dois detalhes de caminho são obrigatórios** e cada um evita um modo de falha concreto que a spec descreve: extrair dentro da instalação (não em `tmpdir`), e usar `-p <tsconfig>` (não `--rootDir`/`--outDir` soltos). Não invente uma terceira forma.
- As duas rodadas contra o mesmo snapshot, a comparação com o épsilon — que é contra ruído de ponto flutuante e **não deve virar faixa de tolerância** —, a impressão da tabela base/head com o delta e os casos que mudaram de posição, e a limpeza de `dist-base/`, `.eval-base/` e do snapshot **inclusive em erro**.

**Fora do escopo desta task:** `README.md` e `CLAUDE.md` — a declaração do portão é a task 7.

## Verification

- Command(s) that must pass, na instalação: `npm run concorrencia`
- Casos novos em `scripts/concorrencia.mjs` (via `caso(nome, fn)`): marcador com `branch=X` e checkout em `Y` → código `2` **sem compilar nada**; `dist/` mais velho que um `src/*.ts` → código `2` mandando rodar `npm run build`; sem `--repo`, sem `BRAIN_REPO` e sem marcador → código `2` nomeando as três saídas.
- **A prova do CA3, que vai registrada na PR:** um commit descartável com a ordenação final de `Buscador.buscar` invertida (`src/search.ts:301`), e `npm run eval -- --base <ref>` saindo com código **`1`**. Cole a saída no resumo — é ela que fecha o critério.
- Acceptance criteria covered: **CA3 inteiro**.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside `claude-brain/`, message ending with the trailer `Card: #18` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
