---
name: mapear
description: Gera ou atualiza o mapa de arquitetura de um repo/módulo do workspace atual em `<workspace>/claude/mapas/`, indexado pelo brain MCP. Use quando o usuário pedir "/mapear <repo>", "mapeia o <repo>", ou após mudanças estruturais grandes num repo (novo módulo, pasta reorganizada, integração nova).
---

# Mapear repo → mapa de arquitetura

O **workspace** e a pasta que contem `claude/` e engloba o diretorio de trabalho atual (os workspaces da maquina estao listados em `~/.claude/brain-workspaces.json`). Cada um tem seu proprio cofre; nunca escreva no cofre do outro.

Objetivo: manter em `<workspace>/claude/mapas/<repo>.md` (ou `<repo>-<modulo>.md` para módulos grandes) um doc de orientação que o brain MCP indexa (source `mapa`) — é o que permite ao Claude se orientar num repo sem rodar exploração pesada toda sessão.

## Passos

1. Identifique o alvo pelo argumento (`/mapear <repo>`) ou pergunte se ambíguo. Os repos do workspace atual estao no `CLAUDE.md` dele (secao `## Board`, campo **repos**) e nas raizes `kind: "code"` do `brain.config.json`; se nao achar o repo em nenhum dos dois, pergunte em vez de adivinhar o caminho.
2. Se já existe mapa em `<workspace>/claude/mapas/`, leia-o primeiro — a tarefa é ATUALIZAR (preservando pegadinhas ainda válidas), não reescrever do zero.
3. Explore o repo (um agente Explore resolve; para o modulo-processos, um por módulo grande: api, web, infra). Levante: propósito, stack/como rodar, entrypoints, estrutura de pastas (só as que importam), fluxos principais (fim a fim, com nomes de arquivos), integrações (filas SQS, APIs externas, banco, outros repos), arquivos-chave, pegadinhas conhecidas.
4. Escreva o mapa seguindo o template abaixo. Alvo: 60–150 linhas — denso, sem prosa vazia; caminhos de arquivo sempre relativos à raiz do repo. Termine com `Atualizado em: AAAA-MM-DD`.
5. Rode a tool `reindex` do MCP brain (ou avise que o índice pega sozinho em até 5 min).

## Template

```markdown
# <repo>

## Propósito
(2–4 linhas: o que o repo faz no produto e para quem)

## Stack e como roda
(linguagem, framework, como sobe local, onde roda em prod)

## Entrypoints
(binários/handlers/rotas de entrada com caminho de arquivo)

## Estrutura de pastas
(árvore comentada só do que importa)

## Fluxos principais
(2–5 fluxos fim a fim, cada um citando os arquivos por onde passa)

## Integrações
(filas, APIs, banco/schema, dependências de outros repos)

## Arquivos-chave
(lista arquivo → por que importa)

## Pegadinhas
(o que engana quem chega agora)

Atualizado em: AAAA-MM-DD
```
