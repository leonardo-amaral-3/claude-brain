# Mapas de arquitetura

Um doc por repo (ou por módulo grande) descrevendo a estrutura para orientação rápida do Claude: propósito, stack, entrypoints, estrutura de pastas, fluxos principais, integrações e arquivos-chave.

Convenção de nome: `<repo>.md` (ex.: `modulo-processos.md`, `shd-rpa.md`) ou `<repo>-<modulo>.md` para módulos grandes (ex.: `modulo-processos-api.md`).

Estes docs são indexados pelo brain-mcp (source `mapa`). Para regenerar/atualizar um mapa depois de mudanças estruturais, rode a skill `/mapear <repo>` numa sessão do Claude Code.

Template de seções:

```markdown
# <repo>

## Propósito
## Stack e como roda
## Entrypoints
## Estrutura de pastas
## Fluxos principais
## Integrações (filas, APIs, banco, outros repos)
## Arquivos-chave
## Pegadinhas
Atualizado em: AAAA-MM-DD
```
