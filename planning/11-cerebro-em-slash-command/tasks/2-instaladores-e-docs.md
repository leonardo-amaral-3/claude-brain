✅ Status: Complete

# Task 2: Instaladores, template e docs passam a ligar o hook

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/11-cerebro-em-slash-command/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

Seções que governam esta task: `## Implementation Details` → `install.sh` e `install.ps1`, `templates/settings.hooks.json`, e `README.md` e `docs/`.

The code lives in the `claude-brain/` directory of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 2 of 6. Task 1 já está no código: `hooks/brain-contexto.js` está versionado e coberto pela sincronia.

## Scope

Fazer com que **quem clona o repo e instala receba o hook ligado**, não só copiado. Quatro arquivos:

1. `install.sh` — terceira entrada no array `desejados`.
2. `install.ps1` — terceira entrada no `$desejados`. **A spec destaca que a chave é `status`, não `statusMessage`, e que a sintaxe é hashtable PowerShell**: copiar o trecho JS do `install.sh` para cá dá erro de parse. Leia a subseção antes de escrever.
3. `templates/settings.hooks.json` — o caminho de instalação manual, que hoje discorda dos instaladores.
4. `README.md` — a contagem, a quinta linha da árvore de hooks, e as duas frases que descrevem os hooks como sendo só de início e fim de sessão.

**Fora do escopo**: `docs/workspace-e-obsidian.md` — a spec verificou e determina explicitamente **não mexer**, porque a tabela dela é sobre quem *escreve* no cofre e este hook só lê. Não "conserte" por simetria.

## Verification

- `./install.sh --dry-run` e `pwsh ./install.ps1 -DryRun` → anunciam `UserPromptSubmit -> brain-contexto.js`
- Instalação real contra um diretório temporário (`CLAUDE_CONFIG_DIR=$(mktemp -d)` para o `.sh`; equivalente para o `.ps1`) → o `settings.json` gerado tem o bloco `UserPromptSubmit` com `timeout` 10 e o `statusMessage`
- **Idempotência**: rodar o instalador duas vezes seguidas → o hook **não** é duplicado no `settings.json` (a comparação por nome de arquivo que os dois já fazem deve cobrir isso)
- `node -e "JSON.parse(require('fs').readFileSync('templates/settings.hooks.json','utf8'))"` → sem erro
- Acceptance criteria covered: nenhum CA fecha aqui — esta task é o que impede a feature de existir só na máquina do autor. É pré-requisito do CA-1 valer para outra pessoa.

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] `install.ps1` usa sintaxe PowerShell e a chave `status`
- [ ] `docs/workspace-e-obsidian.md` **não** foi tocado
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from inside `claude-brain/` with a clear message ending with the trailer `Card: #11`.
4. Flip the first line of this file to `✅ Status: Complete`.
