❌ Status: Not Started

# Task 4: o bloco de execução e a CLI de ponta a ponta

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/41-triagem-jev/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente, pilha, commits e regras do lote**: [`README.md`](README.md) desta pasta.

Seções da spec que governam esta task: `### O que esta spec usa do contrato` (a linha *Skills com script*, o silêncio ao carregar, o falso com `sim`, `lento` e roteiro), `### Script: …` (o bloco de execução e `sair`; `carregarCliente`, já implementado, é o que estes casos provam), `### Teste: …` (a árvore temporária no layout da instalação, `<tmp>/casa/` como `CLAUDE_CONFIG_DIR`, o env de todo filho e as guardas do `spawnSync`), `## Migrations & compatibilidade` e a `## Technical Decision` sobre a ordem de dois lugares. Premissas: as linhas **(rev)** de `## Premissas medidas` sobre a ordem de resolução, `../../hooks/jev.js` a partir de `skills/gm-triage/`, o falso por roteiro e as porcentagens; do README, Q2 a Q5.

**Ressalva do contrato (repasse da dona do #42):** com `BRAIN_JEV_FALSO` definida, o falso responde antes da validação das perguntas. Nenhum caso aqui pode esperar `entrada_invalida` do `hooks/jev.js` real com o falso ligado. O `## Plano de testes` não pede isso; não acrescente.

O `hooks/jev.js` é do #42: o teste o **copia** para a árvore temporária e nunca o altera. Nenhum filho recebe `TYPESAFE_API_KEY`, e nada escreve em `~/.claude`.

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-41-triagem-jev`, **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/41-triagem-jev` (already checked out).

This is task 4 of 5. Tasks 1–3 (constantes, `lerBoard`, `sensivel`, `sugerir`, `renderizar`, `principal`, `carregarCliente` e os blocos de teste deles) are already in the codebase.

## Scope

- `skills/gm-triage/jev-triagem.mjs`: o bloco de execução com a guarda por `realpathSync` e o `sair` único. Se um caso da ordem de resolução reprovar por causa do `carregarCliente` da task 3, a correção é aqui e segue a spec.
- `scripts/gm-triage-jev-teste.mjs`: a árvore temporária e todos os casos de CLI por `spawnSync` do `## Plano de testes`:
  - R1: árvore sem `hooks/` e com `casa/` vazio; passo 2 (`PASSO2`); passo 1 vence; `jev.js` quebrado, que não cai no passo 2; `jev.js` sem a função; o `--import` que proíbe a rede, nos quatro envs × dois modos; o `argv` inválido com `CARREGOU`, nos seis; o `import()` por `node -e`;
  - R2: o caso de ponta a ponta com o `hooks/` real e o roteiro, byte a byte; o `--estado` com `BRAIN_JEV=" Contexto , TRIAGEM "`; o `padrao: {indisponivel:"http"}`; o roteiro sem `padrao`; o `lento` em menos de 12 s; o `jev.js` de mentira com `setInterval` vivo, que sai em menos de 3 s.

NOT in scope: `SKILL.md` e `CLAUDE.md` (task 5) · mudar `hooks/jev.js`, `sync.sh` ou `planning/42-filtro-jev/` · qualquer chamada à API de verdade.

## Verification

- `node scripts/gm-triage-jev-teste.mjs; echo $?` → `0`, com os blocos das tasks 1 a 4 passando. Isso cobre todas as linhas do `## Plano de testes`, exceto a do `SKILL.md` (R2/R3) e a do R4, que são da task 5.
- `git status --short` → nada fora de `skills/gm-triage/jev-triagem.mjs`, `scripts/gm-triage-jev-teste.mjs` e este arquivo de task: a árvore temporária é apagada pelo teste.
- Acceptance criteria covered: **R1** inteiro (Jev fora da lista, sem chave nem falso, `jev.js` ausente ou quebrado, sem rede), **R2** de ponta a ponta com o cliente real do #42 e o falso dele.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Todo `spawnSync` com `{ timeout: 15000, killSignal: "SIGKILL" }`, afirmando `r.error === undefined` e `r.signal === null`
- [ ] Todo filho com `CLAUDE_CONFIG_DIR` em `<tmp>/casa`; nenhum com `TYPESAFE_API_KEY`
- [ ] Code runs; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, files by name, message ending with the trailer `Card: #41` and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
