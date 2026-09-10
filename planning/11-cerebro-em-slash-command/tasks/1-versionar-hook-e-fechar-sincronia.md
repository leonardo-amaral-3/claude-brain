❌ Status: Not Started

# Task 1: Versionar o `brain-contexto.js` e fechar o buraco da sincronia

## Context

You are implementing part of a larger feature. Read this first:
- **Spec**: [`planning/11-cerebro-em-slash-command/spec.md`](../spec.md) — ALL requirements, technical decisions, patterns and standards. Follow it strictly; do not deviate. If reality contradicts the spec, STOP and follow the deviation protocol (do not improvise silently).

Seções que governam esta task: `## Requisitos & critérios de aceite` (CA-3), `## Implementation Details` → `sync.sh` e `sync.ps1`, e `## File Change Summary`.

The code lives in the `claude-brain/` directory of the workspace — **its own git repository**; run every git command from inside it. Work happens on the feature branch named in the spec's `## Execution` (already checked out by `/gm-implement`).

This is task 1 of 6.

## Scope

Duas coisas, e **nada além delas**:

1. `hooks/brain-contexto.js` entra no repositório como **cópia fiel do que está instalado hoje** em `~/.claude/hooks/brain-contexto.js`. **Nenhuma mudança de comportamento nesta task** — nem o guard de slash command, nem parse de argumento, nem resolução de entidade. Isso é das tasks 4, 5 e 6. Esta task existe para dar ao `--base` da task 6 um "antes" real no git e para fechar o CA-3 isolado do resto.
2. `sync.sh` e `sync.ps1` passam a cobrir o arquivo e a denunciar hook órfão, conforme a subseção `sync.sh e sync.ps1` da spec — incluindo a regra de restringir o relato a `*.js` fora da lista fixa, que é o que evita o falso positivo permanente.

**Fora do escopo**: qualquer alteração de comportamento do hook · o card #3 (falso positivo CRLF do `sync.sh status`), que é card próprio e não se conserta aqui · os instaladores e o README, que são da task 2.

**Atenção à base**: as referências de linha da spec são contra `dev`. A branch `feat/5` mexeu nos mesmos dois arquivos; se ela já tiver mergeado, case pela **âncora de conteúdo** da tabela da spec, não pelo número da linha.

## Verification

- `diff --strip-trailing-cr <(git show HEAD:hooks/brain-contexto.js) ~/.claude/hooks/brain-contexto.js` → **sai vazio** (portão real do CA-3, imune ao card #3)
- `./sync.sh status` → não lista `brain-contexto.js`
- Com `obsidian-diario.js.bak` e `obsidian-diario.js.pre-detach` presentes na instalação (estão hoje) → **não** aparecem na seção de órfãos
- `touch ~/.claude/hooks/zz-teste.js && ./sync.sh status` → `zz-teste.js` **aparece** nos órfãos; apagar depois
- `pwsh ./sync.ps1 status` reporta o mesmo conjunto que o `sync.sh`
- Acceptance criteria covered: **CA-3** (inteiro)

## Completion Checklist

- [ ] Everything in scope implemented per the spec
- [ ] Verification command(s) green
- [ ] `hooks/brain-contexto.js` no repo é byte-a-byte o da instalação (ignorando fim de linha) — nenhuma edição de comportamento entrou junto
- [ ] Code compiles; no unused imports/variables

## Workflow

1. Implement; run the checklist.
2. Present the summary and wait for the user's review; iterate until approved.
3. After approval: commit from inside `claude-brain/` with a clear message ending with the trailer `Card: #11`.
4. Flip the first line of this file to `✅ Status: Complete`.
