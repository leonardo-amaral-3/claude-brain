❌ Status: Not Started

# Task 3: O portão `--portao jev` no `injecao.mjs`

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/42-filtro-jev/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente e regras do lote**: [`README.md`](README.md) desta pasta — Node 22, só cliente falso, instalação viva só leitura, saída da medição sem texto do corpus.

Seção que governa esta task: `### brain-mcp/scripts/injecao.mjs — --portao jev (CA3, CA4, CA5)` (inteira: argumento, carga do cliente, ambiente dos filhos por modo, passos 0–3 do `jev`, cabeçalho). Também CA3 (última frase), CA4, CA5 e as decisões *Medição: `--portao jev` intercalado…*, *O oráculo vem do `golden.json`…* e *A saída da medição não leva texto do corpus*. Premissas: P5, P6, P13, P14 da spec.

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-42-filtro-jev` — **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/42-filtro-jev` (already checked out).

This is task 3 of 4. Tasks 1 (`hooks/jev.js`, `npm run jev` T1–T10) and 2 (filtro no `brain-contexto.js`, T11–T16) are already in the codebase.

## Scope

- `brain-mcp/scripts/injecao.mjs`:
  - `--portao <ca2|jev>` (padrão `ca2`; valor desconhecido e `--portao` com `--caso` → `fail`);
  - a carga de `hooks/jev.js` ao lado do `cfg`;
  - `rodar(hookPath, prompt, cwd, env)` devolvendo também a stdout crua, com o `env` de cada modo (o `--caso` repõe só `BRAIN_JEV`, `BRAIN_JEV_FALSO` e `BRAIN_JEV_LIMIAR_CONTEXTO`; a chave nunca passa), e o comentário do porquê;
  - o modo `jev`: pré-condições (exit `2`), corpus intercalado com repetição dos divergentes, golden com o roteiro-oráculo em `mkdtemp` nos dois workspaces, (b1)/(b2), códigos `0`/`1`/`2`, e o temporário do base apagado só no fim, num `finally`;
  - o cabeçalho do arquivo com o uso de `--portao` e a regra de que a saída não vai para PR nem card, salvo as linhas de contagem.
- O `ca2` (sem `--portao` ou `--portao ca2`) fica como está, inclusive as constantes do CA-2 e o portão do fim do arquivo; a única diferença é o `env` saneado.

NOT in scope: mudar `hooks/jev.js` ou `hooks/brain-contexto.js` · modo com o Jev real (`--jev-real` é proibido pela spec) · sync e docs (task 4) · `eval.mjs`/`smoke.mjs`.

## Verification

Todos com `PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH`, de dentro de `brain-mcp/`:
- `node scripts/injecao.mjs --desde 2026-11-03 --ate 2026-11-09 --base origin/dev --portao jev; echo $?` → `0` e `Portão do #42 OK`; `Saídas diferentes com a flag desligada: 0`; preservados `n/n` com `n ≥ 1`; precisão depois 100%; negativos vazios depois. Exit `2` não é verde: diga o motivo e pare.
- A saída do comando acima não traz texto de prompt nem de bloco: só contagens e índices.
- `node scripts/injecao.mjs --portao jev; echo $?` (sem janela) → `2`. `node scripts/injecao.mjs --portao xyz` → `FALHOU`. `node scripts/injecao.mjs --portao jev --caso "x"` → `FALHOU`.
- `node scripts/injecao.mjs --desde 2026-11-03 --ate 2026-11-09 --base origin/dev; echo $?` (o `ca2`) → aplica o CA-2 e **sai `1`**. É o esperado: hook mudado com a flag desligada não sobe a taxa (`## Plano de testes`). A taxa "depois" fica igual à "antes".
- `BRAIN_JEV=contexto BRAIN_JEV_FALSO=nao node scripts/injecao.mjs --caso "como o hook de contexto filtra os trechos que injeta" --cwd ~/pessoal/claude-brain` → nenhuma saída (o `--caso` repassa o falso).
- Acceptance criteria covered: **CA5** (inteiro), a parte de corpus do **CA3**, a parte dos filhos do **CA4**.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Nenhuma linha impressa com texto do corpus ou do golden
- [ ] Code runs; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, files by name, message ending with the trailer `Card: #42` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
