✅ Status: Complete

# Task 2: `sugerir` e `renderizar`, com o cliente falso em processo

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/41-triagem-jev/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente, pilha, commits e regras do lote**: [`README.md`](README.md) desta pasta.

Seções da spec que governam esta task: `### O que esta spec usa do contrato` (a forma de `ligado(uso, env)`, de `decidir(estado, perguntas, { uso, timeoutMs })`, de `Pergunta`, `RespostaEscolha` e `Indisponivel`), `### Script: …` (`sugerir`, os passos 1 a 5, e `renderizar`, com o formato exato), `### Teste: …` (o cliente falso em processo, no molde de `brain-mcp/scripts/embeddings-falso.mjs`, que registra o `uso` de `ligado` e o estado, as perguntas e as `opcoes` de `decidir`) e as `## Technical Decisions` "proposta da sessão", "uma chamada `decidir`" e "tudo ou nada". Premissas: as linhas **(rev)** de `## Premissas medidas` sobre o contrato (escolha com probabilidade numa requisição, `opcoes.uso` obrigatório), as porcentagens e o ponto flutuante; do README, Q5 e a ressalva sobre `entrada_invalida`.

**Ressalva do contrato:** o falso em processo é do teste, não o `hooks/jev.js`. Nenhum caso desta task espera `entrada_invalida` do `hooks/jev.js` real; o `{}` de "resposta inválida" sai do falso em processo.

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-41-triagem-jev`, **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/41-triagem-jev` (already checked out).

This is task 2 of 5. Task 1 (constantes, `lerBoard`, `sensivel` e o esqueleto do teste) is already in the codebase.

## Scope

- `skills/gm-triage/jev-triagem.mjs`: `sugerir` e `renderizar`, exportados.
- `scripts/gm-triage-jev-teste.mjs`: o cliente falso em processo e os blocos que chamam `sugerir` e `renderizar` direto:
  - R1, linha 1 do `## Plano de testes` (`cliente: null`, `ligado` falso, `ligado` que lança);
  - R2, as linhas do caso principal byte a byte, arredondamento e limiar, uma opção só, campo ausente, proposta fora do `## Board`, proposta sem emoji e com U+FE0F, `indisponivel`, `decidir` que nunca resolve (`prazoMs: 50, folgaMs: 30`), falhas misturadas, `decidir` que lança, respostas inválidas (incluindo `null` e `{}`), e resumo vazio, de 801 pontos de código e com cada padrão de `sensivel` (agora o "falhou, sem `decidir`");
  - R3, a linha "chaves de `perguntas[campo].opcoes` = `lerBoard`" no caso principal.

NOT in scope: `principal` e a leitura de arquivos (task 3) · `carregarCliente` (task 3) · bloco de execução, `spawnSync` e o `hooks/jev.js` real (task 4) · `SKILL.md` e `CLAUDE.md` (task 5).

## Verification

- `node scripts/gm-triage-jev-teste.mjs; echo $?` → `0`, com os blocos das tasks 1 e 2 passando.
- Acceptance criteria covered: **R2** (a tabela, a marca `⚠ revisar`, a linha de falha e o tudo ou nada, no nível da função), **R1** no nível de `sugerir`, e o fecho do **R3** (as opções enviadas são as do `## Board`).

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Nenhum temporizador fica vivo depois de `sugerir` voltar (`clearTimeout`)
- [ ] Code runs; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, files by name, message ending with the trailer `Card: #41` and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
