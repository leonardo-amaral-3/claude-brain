# jev.mjs: o T4 limpa a pasta temporária e usa os imports do topo — Spec

Profundidade: **Rota curta** (o corpo técnico é um parágrafo; um script de teste, sem formato em disco nem tool).

## References
- Card: [#74](https://github.com/leonardo-amaral-3/claude-brain/issues/74) — repo `leonardo-amaral-3/claude-brain`
- Origem: achados 3 e 4 do G4 da PR #73 (card #51). Decisão do G1: cofre #3648.

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir `claude-brain/` no workspace)
- Base branch: `dev`
- Feature branch: `feat/74-jev-t4-tmp`

## Requisitos & critérios de aceite
- **R1 — sem lixo, no verde.** Dado `tmpdir()` com N pastas `jev-teste-*`, quando `npm run jev` (em `brain-mcp/`) termina com código 0, então continuam N.
- **R2 — sem lixo, no vermelho.** Dado um `confere` do T4 que falha (o script sai 1 com `FALHOU: T4 …`), então também continuam N pastas `jev-teste-*` em `tmpdir()`. Vale igualmente para exceção não tratada dentro do T4 e para a saída 2 (`NÃO MEDI`) de um caso posterior.
- **R3 — imports.** O bloco do T4 não tem `await import("node:fs")` nem `await import("node:os")`; `writeFileSync`, `mkdtempSync` e `tmpdir` vêm dos imports do topo (linhas 13 e 15), sem mudar essas linhas.
- **R4 — sem regressão.** `npm run jev` sai 0, também com `BRAIN_WORKSPACES=/nao/existe.json`, e imprime as mesmas linhas `jev: … OK` de hoje.

## Premissas medidas
Todas em 27/11/2026, nesta sessão, na worktree em `origin/dev` (`c407cf8`), Node v26.12.0, `tmpdir()` = `/tmp`.

- O T4 vaza uma `jev-teste-*` por rodada · `ls -d /tmp/jev-teste-* | wc -l` antes e depois de `npm run jev` e de `BRAIN_WORKSPACES=/nao/existe.json npm run jev` · 0 → 1 → 2, as duas com código 0; nenhuma `jev-hook-*`/`jev-t17-*` sobrou. As duas `jev-teste-*` dessas rodadas foram apagadas à mão depois (contagem de volta a 0).
- `confere` sai por `process.exit(1)` · `jev.mjs:22-25` (`fail`) e `jev.mjs:40-42` (`confere`) · confirmado.
- `try/finally` **não** limpa quando o corpo chama `process.exit` · script mínimo (`mkdtempSync` + `try { process.exit(1) } finally { rmSync }`) · saiu 1 e a pasta **ficou**. Por isso o padrão do T17 (`jev.mjs:361-471`) não serve para o R2.
- `process.on("exit", rmSync)` limpa nos três caminhos · mesmo script com handler de `exit`: `process.exit(1)` → 1, rejeição não tratada em top-level await → 1, fim normal → 0 · pasta apagada nos três. É o padrão da parte hook (`jev.mjs:504-505`).
- Os imports do topo já trazem tudo que o T4 reimporta · `jev.mjs:13` (`mkdtempSync`, `rmSync`, `writeFileSync`) e `jev.mjs:15` (`tmpdir`); o reimport está em `jev.mjs:154-155` · confirmado.

## Technical Overview
No bloco do T4 (`brain-mcp/scripts/jev.mjs`, hoje linhas 152-206), apagar as duas linhas de `await import` e registrar, logo depois do `mkdtempSync`, `process.on("exit", () => rmSync(pasta, { recursive: true, force: true }));` — o mesmo mecanismo da `pastaTemporaria` da parte hook. O handler, e não `try/finally`, porque `confere` sai por `process.exit`, que não roda `finally`.

## Implementation Details
### `brain-mcp/scripts/jev.mjs`, bloco `// ---- T4: roteiro e variacoes do falso`
- Remover `const { writeFileSync, mkdtempSync } = await import("node:fs");` e `const { tmpdir } = await import("node:os");`.
- Imediatamente após `const pasta = mkdtempSync(join(tmpdir(), "jev-teste-"));`, inserir:
  ```js
  // apagada na saida, tambem quando um confere falha: process.exit nao roda finally
  process.on("exit", () => rmSync(pasta, { recursive: true, force: true }));
  ```
- Nada mais muda: o prefixo `jev-teste-`, os casos e as mensagens do T4 ficam iguais; os imports do topo não mudam.

## File Change Summary
- `brain-mcp/scripts/jev.mjs` — alterado: T4 sem reimport e com limpeza no `exit`.
- `planning/74-jev-t4-tmp/spec.md` — criado (esta spec).

## Migrations & compatibilidade
N/A — script de teste; nenhum formato em disco, índice, tool ou instalação é tocado.

## Rollback
`git revert` do commit; o único efeito de voltar é o lixo em `/tmp` reaparecer.

## Verificação pós-deploy
N/A — não há deploy: o `jev.mjs` só roda no repo (portão do `/gm-ship`), não na instalação. A prova é a do Plano de testes, na worktree.

## Plano de testes
- **R1 e R4:** em `brain-mcp/`, sem outro `npm run jev` rodando na máquina, guardar a lista de nomes `jev-teste-*`, `jev-hook-*` e `jev-t17-*` em `tmpdir()`; rodar `npm run jev` e `BRAIN_WORKSPACES=/nao/existe.json npm run jev`; os dois saem 0, a lista depois é idêntica à de antes (comparação de nomes, não só contagem), e as linhas `jev: … OK` são as de hoje.
- **R2 (três provas manuais, nenhuma commitada; mesma comparação de listas do R1):**
  1. trocar a condição do primeiro `confere` do T4 por `false` → código 1, `FALHOU: T4 regra por pergunta + trechoId …`, lista inalterada;
  2. inserir `throw new Error("prova R2");` logo depois do registro do handler no T4 → código 1, lista inalterada;
  3. trocar a condição do `if` do T17 (`jev.mjs:358`) por `true` → código 2, `NÃO MEDI: …`, lista inalterada.
  Depois de cada uma, reverter a troca; ao fim, `git diff` em `brain-mcp/scripts/jev.mjs` tem só a mudança do Implementation Details. Registrar as três saídas no corpo da PR. Não se cria gancho de falha injetável no script: seria superfície nova só para o teste.
- **R3:** `grep -nE "await import\(['\"](node:)?(fs|os)['\"]\)" brain-mcp/scripts/jev.mjs` não devolve nada, e o `git diff` de `jev.mjs` não tem hunk nas linhas 13 nem 15.

## Technical Decisions
- **Handler de `exit`, não `try/finally`** — medido: `finally` não roda sob `process.exit`, e é por ele que `confere` sai. Descartado: `try/finally` (falha o R2) e trocar `confere` por `throw` (muda o contrato de saída do script inteiro).
- **Só o handler, sem `rmSync` adiantado no fim do bloco** — um mecanismo só, igual ao da parte hook; a pasta vive o resto da rodada, o que é inofensivo.
- **Sem gancho de falha injetável** — o R2 é provado manualmente no ship; o mecanismo está provado pela premissa medida.

## Fora do escopo
- O código 2 da parte viva (#72).
- O `readFileSync` do import do topo, que está em uso (T17, `jev.mjs:366`).
- **Interrupção por sinal** (Ctrl-C, SIGTERM, SIGKILL): o handler de `exit` não roda e a pasta fica, o mesmo limite aceito para a `jev-hook-*` (`jev.mjs:505`). Fica como está.
- **`rmSync` que lança no handler** (EACCES/EBUSY; ENOENT o `force` absorve): impediria o handler seguinte de rodar. Improvável e o mesmo risco que a parte hook já aceita; sem tratamento.
- **O T17 vaza `jev-t17-*` quando um `confere` dele falha** (`try/finally` em `jev.mjs:361-471`, mesmo motivo medido acima). Não está nos critérios deste card; fica registrado para um card próprio.

## Coding Standards
Comentários sem acento, como o resto do arquivo; mudança mínima, nada além do especificado.
