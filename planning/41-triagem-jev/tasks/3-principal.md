❌ Status: Not Started

# Task 3: `principal` e `carregarCliente`, testados com o `carregar` injetado

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/41-triagem-jev/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente, pilha, commits e regras do lote**: [`README.md`](README.md) desta pasta.

Seções da spec que governam esta task: `### Script: …`, a parte `principal(argv, { carregar, stdout, stderr })` (validação do `argv` antes de tudo; `--estado`; o modo `--claude-md … --entrada …` nos passos 1 a 5, com a ordem de leitura e o apagamento da `--entrada`) e `carregarCliente()` (a ordem de dois lugares, o `require` em `try` que não cai no outro caminho), mais a linha *Skills com script* de `### O que esta spec usa do contrato`, o R1 (o que o stdout e o stderr mostram desligado) e a `## Technical Decision` "desligado é tudo o que não prova `ligado("triagem") === true`". Premissas: a linha **(rev)** de `## Premissas medidas` sobre como o contrato liga um uso; do README, Q3.

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-41-triagem-jev`, **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/41-triagem-jev` (already checked out).

This is task 3 of 5. Tasks 1–2 (constantes, `lerBoard`, `sensivel`, `sugerir`, `renderizar` e os blocos de teste deles) are already in the codebase.

## Scope

- `skills/gm-triage/jev-triagem.mjs`: `principal` e `carregarCliente`, exportados, com `carregar = carregarCliente` como na spec. A ordem de resolução de `carregarCliente` só se prova por processo filho numa árvore temporária, e isso é da task 4: aqui o teste injeta `carregar` em todo caso.
- `scripts/gm-triage-jev-teste.mjs`: os blocos que chamam `principal` direto, com `carregar`, `stdout` e `stderr` injetados e arquivos numa pasta temporária:
  - R1, linhas 2 e 3 do `## Plano de testes` (`--estado` com cliente indisponível; o modo completo desligado, que apaga a `--entrada` sem lê-la e não chama `decidir`);
  - a validação do `argv` no nível da função: sem `--entrada`, argumento desconhecido e argumento a mais → código 2, sem chamar `carregar`. A linha de CLI dessa regra (com `CARREGOU`) é da task 4;
  - `--estado` ligado → stdout exatamente `ligado\n`, código 0;
  - R2, "arquivo de entrada com JSON inválido" → `Sem a sugestão do Jev: não consegui ler <nome>`, e a `--entrada` apagada;
  - R3, "`--claude-md` sem `## Board`" → `Sem a sugestão do Jev: não achei o ## Board em <nome>`;
  - o modo completo ligado, com o falso em processo da task 2: o markdown no stdout com `\n` final e `jev-triagem: <n> ms` no stderr.

NOT in scope: o bloco de execução, `sair` e qualquer `spawnSync`, inclusive os casos da ordem de resolução (task 4) · `SKILL.md` e `CLAUDE.md` (task 5).

## Verification

- `node scripts/gm-triage-jev-teste.mjs; echo $?` → `0`, com os blocos das tasks 1 a 3 passando.
- Acceptance criteria covered: **R1** no nível de `principal` (stdout vazio, diagnóstico no stderr, código 0, nada escrito, entrada apagada sem leitura) e as falhas de arquivo do **R2** e do **R3**.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Nenhum diagnóstico vai ao stdout; a `--entrada` some em todo caminho do modo completo
- [ ] Code runs; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, files by name, message ending with the trailer `Card: #41` and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
