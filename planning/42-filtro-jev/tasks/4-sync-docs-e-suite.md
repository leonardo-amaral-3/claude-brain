❌ Status: Not Started

# Task 4: Sincronia, docs e a suíte final

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/42-filtro-jev/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).
- **Ambiente e regras do lote**: [`README.md`](README.md) desta pasta — Node 22, só cliente falso, instalação viva só leitura (o `sync.sh status` lê, o `push` é de Leonardo).

Seção que governa esta task: `### Docs e sincronia`. Também `## Plano de testes` (a suíte do card) e `### O que sai da máquina` (o que o parágrafo do README resume). Premissa: P10 da spec (um hook novo precisa entrar nas duas listas fixas).

The code lives in the repo root of the worktree `/home/leo/pessoal/claude-brain-42-filtro-jev` — **its own git repository**; run every git command from inside it. Work happens on the feature branch `feat/42-filtro-jev` (already checked out).

This is task 4 of 4. Tasks 1–3 (`hooks/jev.js`, o filtro no hook, `npm run jev` T1–T16 e o `--portao jev`) are already in the codebase.

## Scope

- `sync.sh`: `jev.js` em `HOOKS_VERSIONADOS`, logo depois de `brain-config.js`. `sync.ps1`: o mesmo em `$hooksVersionados`.
- `README.md`: a árvore de `hooks/` passa a 8 arquivos com a linha do `jev.js`; a linha de `brain-mcp/scripts/` ganha `jev`.
- `brain-mcp/README.md`: `## Comandos` ganha `npm run jev` e `node scripts/injecao.mjs ... --portao jev`; o parágrafo curto "Jev (opcional, desligado)", com as quatro variáveis, a lista de usos, a frase obrigatória e o apontador para o contrato da spec.
- Rodar a suíte inteira do card e reportar só as linhas de contagem.

NOT in scope: `sync.sh push`, `install.sh` (que já copia `hooks/` inteiro, P10), `templates/`, `skills/`, `brain-mcp/src/` · a `## Verificação pós-deploy` (é de Leonardo, depois do `push`) · mudar código das tasks 1–3 (se a suíte reprovar por causa delas, PARADA com a saída).

## Verification

Com `PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH`:
- `cd brain-mcp && npm run jev; echo $?` → `0`.
- `cd brain-mcp && node scripts/injecao.mjs --desde 2026-11-03 --ate 2026-11-09 --base origin/dev --portao jev; echo $?` → `0`.
- `bash -n sync.sh` → sem erro; `grep -n "jev.js" sync.sh sync.ps1 README.md` → uma ocorrência em cada lista e a linha da árvore; `grep -n "TYPESAFE_API_KEY\|BRAIN_JEV_FALSO\|BRAIN_JEV_LIMIAR_CONTEXTO\|npm run jev\|--portao jev" brain-mcp/README.md` → todas presentes.
- `./sync.sh status` (só leitura) → na parte de hooks, lista `jev.js` como novo e `brain-contexto.js` como divergente da instalação (o `push` fica com Leonardo). A saída já traz, antes deste card, skills da instalação que não são do repo (órfãs, `aws-*` etc.): isso é preexistente, não reprova e não se corrige aqui.
- `git status --short` → nada fora do `## File Change Summary` (o `brain-mcp/node_modules` provido localmente é ignorado ou fica *untracked*; nunca entra no commit).
- Acceptance criteria covered: fecha a suíte de **CA1–CA5**; o critério próprio desta task é a instalação conseguir receber o `jev.js` pelo `sync` (CA2: "instalado com os outros hooks").

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] Docs sem dado nem nome de cliente; o parágrafo do Jev diz que está desligado por padrão
- [ ] Code runs; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary: the verification result first, then a risk-ranked reading order — what deserves a careful look and why, not a changelog.
3. Commit from inside the worktree, files by name, message ending with the trailer `Card: #42` — and put that commit to the human as a choice (*ação irreversível*), never as consent to be typed.
4. Flip the first line of this file to `✅ Status: Complete`.
