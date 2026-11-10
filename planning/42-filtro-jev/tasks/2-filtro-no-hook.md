❌ Status: Not Started

# Task 2: O filtro no passo 5 do hook — `brain-contexto.js` e T11–T16

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/42-filtro-jev/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente e regras do lote**: [`README.md`](README.md) desta pasta — Node 22, só cliente falso, instalação viva (o `dist/` e o índice que o hook importa) só leitura.

Seções que governam esta task: `### hooks/brain-contexto.js — o filtro (CA1, CA3)` (inteira, inclusive o comentário obrigatório no topo do passo 5 e o formato fixo da linha de debug) e, de `### brain-mcp/scripts/jev.mjs`, a *Parte hook*. Os casos T11–T16 estão na tabela do `## Plano de testes`. Premissas: P1, P2, P3, P4 da spec e Q2, Q3 do README (o prompt de prova tinha 9 candidatos; o script reconfere na hora).

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-42-filtro-jev` — **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/42-filtro-jev` (already checked out).

This is task 2 of 4. Task 1 (`hooks/jev.js`, T1–T10 no `jev.mjs`, script `npm run jev`) is already in the codebase.

## Scope

- `hooks/brain-contexto.js`: as constantes ao lado de `LIMITE_FINAL`, `usaJev()`, `limiarJev()`, `filtrarComJev` antes do `(async () => {`, a troca da linha do `achados` no passo 5 e o cabeçalho/fecho do bloco filtrado. **Sem a flag, o arquivo se comporta byte a byte como o de `origin/dev`**: as duas strings atuais do bloco ficam intactas, os passos 1–4 (entidade) não mudam e não carregam o cliente.
- `brain-mcp/scripts/jev.mjs`: a parte hook, T11–T16, com o pré-voo mínimo (exit `2` com `NÃO MEDI:`), a referência por `git show origin/dev` num temporário, base e worktree em seguida com uma repetição se divergir, e as pré-condições do prompt de prova (exit `2` "troque o prompt de prova").

NOT in scope: `injecao.mjs` (task 3) · sync e docs (task 4) · mudar `hooks/jev.js` (se o hook precisar de algo que o contrato não dá, é desvio → PARADA) · reordenar por probabilidade, trocar o piso de tokens, recorte por workspace.

## Verification

- `cd brain-mcp && PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH npm run jev; echo $?` → `0`, T1–T16 passando. Exit `2` (pré-voo ou prompt de prova) não é verde: diga o motivo e pare.
- `git diff origin/dev -- hooks/brain-contexto.js` → só acréscimos e a troca da linha do `achados`; as duas strings atuais do bloco aparecem intactas (o T11 é a prova byte a byte; isto é a leitura que a acompanha).
- Acceptance criteria covered: **CA1** (inteiro), **CA3** no hook (flag ausente, sem chave, `indisponivel`, `lento` dentro de 2200 + 1000 ms, `jev.js` quebrado coberto pelo `try` e pelo prazo próprio).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Erro novo só sob `BRAIN_HOOK_DEBUG=1`, na stderr
- [ ] Code runs; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, files by name, message ending with the trailer `Card: #42` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
