# Telemetria do brain e do Jev

Mede o que o hook de contexto e o Jev fazem, quanto custam e, nas fases seguintes, se o que o hook
injeta é aproveitado. É de uma pessoa, local, **opt-in**: sem `BRAIN_TELEMETRIA=1` nada é gravado e
nada muda. A spec é `planning/66-telemetria/spec.md` (épico #66; esta página cobre a F1, #67).

## O que é gravado, e onde

Um **diário de eventos**, JSONL, um arquivo por dia (UTC):

```
<CLAUDE_HOME>/brain-telemetria/eventos-AAAA-MM-DD.jsonl      CLAUDE_HOME = $CLAUDE_CONFIG_DIR ou ~/.claude
```

Fica **fora do repo** (que é público) e **fora do `brain.db`**. `BRAIN_TELEMETRIA_DIR` troca o
diretório (os testes usam um temporário). O próprio gravador apaga os arquivos com mais de 90 dias,
quando cria o do dia; só mexe em `eventos-AAAA-MM-DD.jsonl`.

Dois tipos de linha, ambos com `v: 1`, `ts` (ms), `evento`, `sessao` e `prompt`:

- **`contexto`**: uma linha por execução do hook `UserPromptSubmit`, em **todo** desfecho
  (`injetado`, `entidade`, `curto`, `sem_candidatos`, `jev_reprovou_tudo`, `erro`…), com o que o
  Jev decidiu (`jev`, `enviados`, `aprovados`, `limiar`), os trechos considerados (`itens`: caminho,
  posição, nota, se foi mostrado) e as durações (`ms_busca`, `ms_jev`, `ms_total`).
- **`jev`**: uma linha por chamada ao cliente do Jev (`julgar`/`decidir`, de qualquer uso: contexto,
  triagem, spec, parada, roteador, lembrar), com contagens, motivos de indisponibilidade, `ms` e os
  `tokens` quando a API os devolver.

O contrato campo a campo está na spec (`### Contrato do evento`). Quem grava é só `hooks/telemetria.js`;
o painel e os scripts só leem.

## Como ligar

```bash
export BRAIN_TELEMETRIA=1     # no ~/.bashrc; reinicie as sessões do Claude Code
```

Para desligar, tire a linha e reinicie as sessões: nada mais acontece, sem reverter código. Se
`BRAIN_JEV_FALSO` estiver definida (os testes do Jev), a gravação só acontece com
`BRAIN_TELEMETRIA_DIR` também definida: é o que impede um teste de gravar no diário vivo.

### O A/B com e sem o filtro do Jev

```bash
export BRAIN_TELEMETRIA_AB=0.2     # valor sugerido: 20% dos prompts elegíveis saem sem o filtro
```

Só vale com a telemetria ligada, `contexto` em `BRAIN_JEV` e a chave do Jev presente. Um prompt que
chega ao passo 5 com candidatos é sorteado, de forma determinística pelo `prompt_id`, para
`sem_filtro` (o bloco sai como se o Jev estivesse desligado) ou `com_filtro` (o Jev filtra como
sempre); o evento grava o `grupo`. Sem a variável, ou com valor fora de `0 < p ≤ 1`, ninguém é sorteado e
`grupo` é `null`. **Para desligar o A/B, remova a variável.** A leitura do resultado (taxas, intervalo
de confiança, veredito) é da seção Ganho, F2.

## Privacidade

O diário **nunca** guarda o texto do prompt, o argumento do slash command, a mensagem de erro nem texto
de trecho. Guarda tamanhos (`alvo_chars`, `alvo_tokens`), o nome do comando (`/gm-spec`; qualquer outra
coisa que comece com barra vira `(outro)`), a chave da entidade resolvida, os **caminhos locais** dos
candidatos e as probabilidades do Jev. O caminho entra porque é a única chave que liga um trecho
injetado ao arquivo que a sessão abriu depois; fica na máquina e some em 90 dias.

A saída do painel só traz contagens, percentuais, nomes de `uso`, desfechos e motivos: nunca caminho
nem texto de prompt, e por isso pode ir para PR e card.

## O painel

```bash
cd brain-mcp
npm run painel                                              # últimos 7 dias
npm run painel -- --dias 1
npm run painel -- --desde 2026-11-20 --ate 2026-11-24       # datas UTC; --ate inclui o dia inteiro
BRAIN_DB=<brain.db> npm run painel                          # se o índice não está em brain-mcp/data
```

Imprime o cabeçalho (período, eventos por tipo, linhas inválidas e de outra versão) e as seções que
existirem em `brain-mcp/scripts/painel/`. Seção ausente vira `(<nome>: seção não instalada)`; seção que
falha vira `(<nome>: falhou — <erro>)`. Códigos de saída: `0` ok, `1` alguma seção falhou, `2` nada
para ler (diário ausente ou período sem evento) ou argumento inválido.

| Seção | Fase | O que mostra |
|---|---|---|
| `saude` | F1 | execuções do hook por desfecho; p50/p90 de `ms_total`, `ms_busca`, `ms_jev` e de `ms` do Jev por uso; falhas por motivo; quantas vezes o Jev reprovou todos os trechos; tokens |
| `ganho` | F2 | taxa de aproveitamento dos trechos injetados, rebusca e a comparação A/B. Documenta-se no cabeçalho de `painel/ganho.mjs` |
| `prova` | F3 | gabarito julgado à mão: precisão e cobertura do Jev. Documenta-se no cabeçalho de `painel/prova.mjs` |

O `ms_total` do hook **não inclui a partida do `node`**: o relógio começa na primeira linha do arquivo.

## Testes e medições

```bash
node brain-mcp/scripts/telemetria.mjs              # gravador, eventos, ab, stdout, conferir, poluicao
node brain-mcp/scripts/telemetria.mjs --custo      # o portão do CA4: o hook ligado não custa mais de 20 ms
node brain-mcp/scripts/telemetria.mjs --conferir --dias 1    # cobertura do diário sobre os transcripts
node brain-mcp/scripts/painel-teste.mjs            # o agregador e a seção saúde, sobre fixtures
```

Nenhum deles grava no diário vivo. `--conferir` compara os prompts dos transcripts do período com os
eventos `contexto` da mesma sessão e diz quantos casam por `prompt` = `promptId` (a premissa de que o
`prompt_id` do payload é o `promptId` do transcript ainda não foi medida numa sessão real).

## Instalar

`hooks/telemetria.js` está na lista de hooks versionados do `sync.sh` e do `sync.ps1`: o
`./sync.sh push` o leva para `~/.claude/hooks/`. Hook novo instalado com `jev.js` velho (ou o
contrário) é seguro: cada um carrega o gravador dentro de `try`.
