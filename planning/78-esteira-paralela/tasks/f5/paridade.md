# F5 (#83): paridade `sync.sh` x `sync.ps1` e o que o `CLAUDE.privado.md` terá

**`sync.ps1` NÃO foi executado.** Não há `pwsh` nem `powershell` nesta máquina; a paridade abaixo é
conferência por leitura contra o `sync.sh`, que a `prova-sync.sh` executa de verdade (verde).

## Paridade, caso a caso da prova

| Caso da prova | `sync.sh` | `sync.ps1` | Paridade |
|---|---|---|---|
| Par só quando a pasta acima do repo se chama `pessoal` | `WS_ATIVO` (l. ~134) | `$wsAtivo`, `-ceq 'pessoal'` (l. 163) | igual |
| `push` monta (marcadora → inicio + privado + fim) | `ws_monta` (l. 158) | `WsMonta` (l. 227) | igual |
| Sem privado: instala o genérico, marcadora intacta, avisa, código 0 | bloco `WS_TEM_PRIV` (l. ~172) | `$wsTemPriv` (l. ~256) | igual |
| Genérico sem marcadora ou com mais de uma: avisa, instala sem o privado | `aviso "…linhas marcadoras…"` (l. 179) | `Aviso "…linhas marcadoras…"` (l. 259) | igual |
| `push` copia se o genérico **ou** o bloco privado difere | compara `soma(esperado)` com `soma(vivo)` (l. 216) | `HashTexto $wsEsperado` x `Hash $wsVivo` (l. ~321) | igual |
| `pull` desmonta (bloco → marcadora) e grava só isso | `ws_desmonta` (l. 139) + laço de cópia (l. 319) | `WsDesmonta` (l. 182) + laço de cópia (l. 448) | igual |
| `pull` nunca escreve o `CLAUDE.privado.md` | nenhum `>` ao `WS_PRIV` | nenhum `WriteAllText` ao `$wsPriv` | igual |
| `pull` avisa que a edição do bloco instalado não volta | l. 195 | l. 275 | igual (mesma mensagem) |
| Delimitador órfão, repetido ou fora de ordem no `pull`: código 2, nada escrito | l. 187 (`exit 2`, antes do laço) | l. 267 (`exit 2`, antes do laço) | igual |
| `status` compara só o genérico (repo x instalado desmontado) | l. ~218 | l. ~327 | igual |
| Bloco privado defasado no `status`: aviso, não diferença | l. 197 | l. 277 | igual (mesma mensagem) |
| Delimitador torto no `status`: avisa e lista o par | l. 220 | l. 325 | igual |

Divergências conhecidas, nenhuma de comportamento: o `sync.sh` lê/escreve bytes (`cat`, `awk`, `cp`) e
o `sync.ps1` lê e grava texto UTF-8 sem BOM, com LF (o `ReadAllText` descarta um BOM, se houver); os
avisos vão para `stderr` no `.sh` e para o host no `.ps1`, como já fazem as demais mensagens de cada um.

## O que o `CLAUDE.privado.md` terá (seções e tipos de dado, nunca o dado)

Arquivo local, nunca versionado, em `<pasta acima do repo>/CLAUDE.privado.md`, ao lado do
`CLAUDE.md` instalado. Quem cria e mantém é o mantenedor; o `sync` só lê. Ordem:

1. **Continuação de `## Convenções da esteira`**: os itens que são do repo do produto — typecheck e
   comandos do CI, portão de teste, requisitos de ambiente e de worktree nova, ambiente de ensaio.
2. **`## Board`**: coordenadas do Project do repo do produto (número, owner, ids do projeto e dos
   campos Status, Tipo, Severidade, Classe, Rota, Módulo e dos campos de texto, com os ids de cada
   opção), a lista de *repos* (nome, visibilidade, owner) e a regra do *auto-add* de sub-issues.
3. **`## O repo do produto`**: nome, owner, visibilidade e descrição do repo, onde ficam as specs
   dele e o destino das decisões do `lembrar`, com o caminho do cofre.
