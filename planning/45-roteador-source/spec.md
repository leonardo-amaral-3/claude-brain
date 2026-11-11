# Roteador de source no search_context — Spec

> Profundidade **Lite** (G2 decidido no modo despachado, 2026-11-10). A Rota do card continua
> **Curta**: não há parâmetro novo na tool, campo novo no `_meta` nem coluna nova em `uso`.
>
> **Emenda 2026-11-10: alinhamento ao contrato do #42.** O G2 original (cofre #1409) supunha um
> cliente do Jev em `brain-mcp/src/`. O `/gm-plan-tasks` parou porque o #42 fixou outro (cofre #1415),
> e o braço direito decidiu que o #45 se alinha a ele (cofre #1416). O que esta emenda muda:
> - os itens C1–C6 viram **citações** de `planning/42-filtro-jev/spec.md` § *Contrato do cliente do
>   Jev (estável)*, sem copiar o texto;
> - o adaptador passa a chamar `decidir(...)` com o uso `roteador` e carrega o `hooks/jev.js` por
>   `createRequire`, procurando primeiro no repo ou na worktree e só depois na instalação;
> - o roteador liga com `roteador` em `BRAIN_JEV`. **`BRAIN_ROTEADOR` sai** (TD-2);
> - `eval`, `smoke` e `concorrencia` passam `envSemJev` aos filhos (novo A8). O A1 deixa de
>   precisar de `env -u` e ganha a rodada com o cliente falso;
> - o A7 e o `sem-http-proprio` provam o cliente único pela resolução de verdade;
> - o B1 com o Jev real deixa de ter comando nesta PR (G2-E);
> - o `## Execution` ganha o rebase sobre a ponta do #42, o cache do modelo e o Node do portão. A
>   fixture das guardas do `concorrencia.mjs` passa a achar o cliente. Os dois vieram do revisor
>   independente.
>
> O texto aprovado no G2 de 10/11 fica no histórico do comentário `gm:spec` do card.
>
> **Emenda 2026-11-11: tratamento do G4 da PR #64** (decisões do braço direito, cofre #1701).
> - **Achado 2 (emenda autorizada).** O roteador só age quando a chamada não traz **nenhum** filtro
>   que restrinja a busca: nem `source`, nem `repo`, nem `feature`, nem `doc_type`. Com qualquer um
>   deles, a busca segue como veio e o Jev não é consultado. O Jev não sabe desses filtros, e as
>   raízes de `diario`, `mapa`, `notas`, `memoria` e `decisao` têm `repo` nulo: uma rota para elas
>   numa chamada com `repo` saía vazia por construção e pagava o teto e duas buscas. O
>   `incluir_arquivadas` não restringe e não conta. Mudam o A4, o passo 1 do `rotear` e a definição
>   de "chamada sem `source`", que vira "chamada sem filtro".
> - **Achado 7.** O `roteadorLigado` deixa de ter parser próprio do `BRAIN_JEV`: ele carrega o
>   cliente pela mesma resolução do C1, dentro de `try`, e devolve `jev.ligado('roteador', env) === true`.
>   A regra fica num lugar só, no cliente, e passa a exigir também chave ou `BRAIN_JEV_FALSO`
>   definida: com `roteador` na lista e sem chave, o roteador fica desligado e o adaptador nem é
>   chamado. Sem cliente, cliente quebrado ou sem `ligado`, é desligado. O "sem I/O" e o "conferir
>   o uso antes de carregar" saem: carregar o `jev.js` não escreve nada (Emenda 1 do #42) e o
>   `require` guarda o módulo. A linha de boot passa a dizer "ligado" e "buscas sem filtro".

## References
- Card: [#45](https://github.com/leonardo-amaral-3/claude-brain/issues/45) — repo `leonardo-amaral-3/claude-brain`
- G1: comentário `gm:decisao` no card (cofre #1378). Medições da spec original: cofre #1395. G2: cofre
  #1409. G3 parado: cofre #1415. Alinhamento ao #42: cofre #1416.
- Contrato do cliente: `planning/42-filtro-jev/spec.md` § *Contrato do cliente do Jev (estável)*
  (G2 do #42 aprovado em `4101a72`, mais a **Emenda 1**, só aditiva, em `fb82444`; cofre #1426 e
  #1427). **É a fonte da verdade.** Onde esta spec cita um item dele, vale o texto de lá, com a
  emenda.
- Dependência: [#42](https://github.com/leonardo-amaral-3/claude-brain/issues/42), que cria o cliente do Jev.
- PRD: não há.

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir `claude-brain/` no workspace `pessoal`)
- Worktree: `~/pessoal/claude-brain-45-roteador-source`
- Feature branch: `feat/45-roteador-source`, empilhada sobre `feat/42-filtro-jev`; hoje aponta para
  `4101a72`, um ancestral da ponta do #42.
- Base branch: **`feat/42-filtro-jev`** (PR empilhada), porque o cliente do Jev nasce lá. Quando a
  PR do #42 entrar na `dev`, a base desta passa a ser `dev`. Em 2026-11-10 a branch do #42 já traz o
  `hooks/jev.js` (P16), mas esta worktree continua em `4101a72`.
- **Antes da primeira task:** `git rebase` de `feat/45-roteador-source` sobre a ponta de
  `feat/42-filtro-jev`. É a ref local, compartilhada pelas worktrees, que hoje está à frente da
  origin. A spec do #45, ainda não commitada, entra no primeiro commit.
- **Portão de entrada da implementação.** O `/gm-implement` só começa quando a base trouxer um
  `hooks/jev.js` que cumpra **todos** os itens de `## Implementation Details` › *O que o #45 usa do
  contrato do #42* (C1–C6). A sessão confere cada item lendo o arquivo e rodando o `npm run jev` do
  #42.
  - Código `0` → segue.
  - Código `2` → `PARADA: ambiente`.
  - Código `1`, ou um item divergente → `PARADA` com emenda pedida, aqui ou no #42. A sessão não
    escreve um segundo cliente, não muda o `jev.js` e não contorna.
  - Basta a task do cliente do #42. O `sync.sh` do #42 (a lista de hooks) só pesa no deploy, que vem
    depois da PR do #42 pelo empilhamento.
- **Ambiente.** Isso é feito fora do `/gm-ship`, e o `node_modules` é o da worktree, e não o da
  instalação. A worktree não tem `brain-mcp/node_modules`. Dentro de `brain-mcp/`:
  1. `PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm ci`
     (cofre #1424);
  2. copiar o cache do modelo, só lendo a instalação:
     `cp -R ~/notoria/claude/brain-mcp/node_modules/@huggingface/transformers/.cache node_modules/@huggingface/transformers/`.
     Sem ele, `src/embeddings.ts:26` (`allowRemoteModels = true`) baixa o modelo da rede no
     aquecimento do eval e do smoke;
  3. `npm run build`.

  **Todo comando do portão** (build, `roteador`, `smoke`, `concorrencia`, `eval`) roda com o mesmo
  `PATH=/home/leo/.local/share/mise/installs/node/22.23.4/bin:$PATH`, para não misturar o Node que
  instalou o `node_modules` com o Node 26 do sistema.

## Requisitos & critérios de aceite

Definições usadas abaixo:
- **chamada sem `source`**: `search_context` com `query` não vazia e sem a chave `source` (`repo`,
  `feature`, `doc_type`, `incluir_arquivadas` e `limit` podem vir ou não);
  - *emenda 2026-11-11:* o roteador só age na **chamada sem filtro**, a que vem sem `source`,
    `repo`, `feature` e `doc_type` (`incluir_arquivadas` e `limit` podem vir ou não). Onde os
    critérios abaixo dizem "sem `source`" para o roteador agir, leia "sem filtro";
- **roteador ligado**: no momento da chamada, `process.env.BRAIN_JEV` contém o item `roteador`,
  pela regra do contrato do #42 (lista separada por vírgula, cada item com `trim()` e em minúsculas,
  sem curinga). `BRAIN_JEV=1`, `*`, `todos` ou só outros usos (`contexto`) **não** ligam;
- **sem chave**: `TYPESAFE_API_KEY` ausente ou vazia e `BRAIN_JEV_FALSO` indefinida;
- **busca como veio**: `buscador.buscar` chamado com os filtros da chamada sem nenhum acréscimo, e
  o resultado devolvido com o texto e o `_meta` que a `origin/dev` produz.

### Grupo A: provado sem a API do Jev (bloqueia a PR)

- **A1. Desligado não muda nada.**
  - Dado o roteador desligado, quando chega uma chamada sem `source`, então o escolhedor não é
    chamado (e por isso o adaptador nem procura o `hooks/jev.js`) e a resposta é a busca como veio,
    sem rodapé novo.
  - Dado o roteador ligado e sem chave, a resposta é idêntica (texto e `_meta`) à do roteador
    desligado para a mesma chamada. A prova usa o cliente **de verdade** da worktree, que responde
    `sem_chave`.
  - `npm run eval -- --base origin/dev` sai com código `0` e imprime `Nenhum caso mudou de posição.`.
    O mesmo vale para `BRAIN_JEV=roteador BRAIN_JEV_FALSO=sim npm run eval -- --base origin/dev`.
    Essa segunda forma é **prova adicional** do A8, e não a principal. Sem a limpeza, o falso `sim`
    mandaria toda busca sem `source` do head para `planning`. Mas o eval só conta mudança de `rank`
    no top-5 e de `vazio` (`eval.mjs:195-201`), e poucos casos têm alvo indexado (P9), então não foi
    medido que algum caso mudaria. A prova principal do A8 está na suíte (`semJev-limpa` e
    `filhos-sem-jev`).
  - "Sem chave" é garantido pelo próprio script (A8), e não pelo comando: nenhuma rodada desta PR
    (teste, smoke, concorrência ou eval) leva a chave a um processo que possa carregar o cliente.
  - O portão do A1 é `--base origin/dev`, como no card. Como a PR é empilhada, o head traz também
    os commits do #42. Se algum caso mudar de posição, a sessão não tenta atribuir a mudança: sai
    com `PARADA`, nomeando os casos.
- **A2. Toda falha cai para a busca como veio, com teto de latência.** Com o roteador ligado e uma
  chamada sem `source`, cada um destes casos devolve a busca como veio e `roteado = null`:
  - probabilidade abaixo de `LIMIAR_ROTEADOR` (0,8);
  - probabilidade que não é número finito em [0, 1];
  - escolha indisponível (`null`), `undefined` ou fora de forma (sem `opcao` string);
  - escolhedor que lança ou rejeita;
  - opção com caixa diferente da lista (a comparação é exata);
  - escolhedor que não responde dentro de `TETO_ROTEADOR_MS` (1000 ms);
  - opção fora da lista;
  - opção `qualquer`;
  - fonte escolhida cuja busca filtrada volta vazia.

  No caso do timeout, a decisão do roteador custa no máximo o teto mais 300 ms. Isso foi medido com o
  buscador falso, que responde na hora; a busca real soma a latência dela (P3).
- **A3. Fonte aceita restringe a busca e avisa.** Com o roteador ligado, quando o escolhedor devolve
  uma fonte da lista com probabilidade `>= 0,8` e a busca filtrada traz resultado, então a resposta
  é essa busca filtrada, e o texto ganha uma linha de rodapé que nomeia a fonte e diz como escolher
  outra. O `_meta.brain` é o diagnóstico da busca que foi devolvida, com as mesmas quatro chaves de
  hoje.
- **A4. `source` explícito nunca passa pelo roteador.** Com o roteador ligado, uma chamada com
  `source` não consulta o cliente, e a resposta é a busca como veio.
  - *Emenda 2026-11-11:* o mesmo vale para `repo`, `feature` e `doc_type`, sozinhos ou juntos.
    `incluir_arquivadas` sozinho ainda passa pelo roteador.
- **A4b. Query vazia não consulta.** `query` vazia ou só com espaços devolve `Query vazia — …` como
  hoje (`tools.ts:110`, que fica **antes** de `rotear`), sem consultar o cliente.
- **A5. Superfície intacta.** O `inputSchema` do `search_context` continua com exatamente
  `query, source, repo, feature, doc_type, incluir_arquivadas, limit`. O `_meta.brain` continua com
  exatamente `lexicais, vetoriais, semantica, colapsados`. A tabela `uso` não ganha coluna.
- **A6. `uso` grava os argumentos como vieram.** Com o roteador ligado e uma fonte aplicada, a
  linha de `uso` daquela chamada tem em `args` o JSON dos argumentos recebidos, sem `source`.
- **A7. Um cliente só.**
  - O roteador usa o `hooks/jev.js` do #42 pelo `decidir` com `uso: 'roteador'`, carregado por
    `createRequire`. A procura começa em `<raiz do pacote>/../hooks/jev.js` e só depois vai a
    `<CLAUDE_HOME>/hooks/jev.js` (C1).
  - Na worktree, o arquivo carregado é o `hooks/jev.js` **da worktree**, e não o instalado.
  - O roteador não abre nenhuma conexão HTTP própria: `src/roteador.ts` e `src/tools.ts` não contêm
    `fetch(`, `node:http`, `node:https`, `undici` nem `XMLHttpRequest`.
  - Nenhum outro arquivo de `src/` cita `jev.js`.
  - *Nota 2026-11-11 (merge da `dev` com o #46, PR #61).* O `src/juizJev.ts` do #46 é a segunda
    ponte ao **mesmo** `hooks/jev.js`, pela mesma ordem do C1, com o uso `lembrar`. O "um cliente só"
    é o arquivo, e não o número de pontes: o item acima passa a ler "nenhum outro arquivo de `src/`
    além de `roteador.ts` e `juizJev.ts` cita `jev.js`", e a regex do HTTP próprio vale também para
    o `juizJev.ts`. Sem isso o `sem-http-proprio` ficava vermelho só pelo merge.
- **A8. Medição nunca leva o Jev aos filhos.** `scripts/eval.mjs`, `scripts/smoke.mjs` e
  `scripts/concorrencia.mjs` trocam `process.env` por `envSemJev(process.env)` (C6) antes de subir
  qualquer processo filho que suba o servidor. Sem o cliente achável, eles não medem: o eval sai
  com código `2` e os outros dois com `1`. As fixtures do `concorrencia.mjs` que rodam uma cópia do
  eval ganham o cliente no lugar da instalação (ver a seção dos scripts), e os casos de guarda dele
  continuam passando sem mudar de expectativa.

### Grupo B: só com a API de verdade (depende do aval do Leonardo; não bloqueia a PR deste card)

- **B1.** Com chave, aval e o roteador ligado, um eval mostra o nDCG@5 do head contra o do base, com
  código `0`. Código `1` reprova. Código `2` é medição que não aconteceu e também não serve.
  **Nesta PR, o B1 não tem comando.** O eval limpa a chave dos filhos por contrato (A8), e um modo
  que a deixe passar é o "modo `--jev-real`" que o #42 descartou e mandou para um card de
  calibração (ver **G2-E**). Ver também **G2-D**, sobre o que esse número consegue medir com o golden
  de hoje.

## Premissas medidas

P1–P13 foram medidas em 2026-11-10, na sessão do G2, contra o repo em `origin/dev` = `3c3b92c` e o
índice vivo da instalação (`~/notoria/claude/brain-mcp/data/brain.db`, aberto só para leitura ou
copiado por `VACUUM INTO`). Continuam valendo para a base nova porque `brain-mcp/` não mudou entre
`3c3b92c` e `4101a72` (P15). P14 foi substituída pela P16. P15–P24 foram medidas em 2026-11-10, nesta
sessão da emenda (a P16 depois do revisor independente, que achou a branch do #42 adiante).

| # | Premissa | Como foi provada | Resultado |
|---|---|---|---|
| P1 | Sem `source`, o handler chama `buscar` com `source: undefined`, e a busca não filtra por fonte | leitura de `brain-mcp/src/tools.ts:109-121` e `src/search.ts:181-190` | confirmado: `condicoes` só acrescenta `d.source = ?` quando `f.source` vem |
| P2 | Quase toda chamada chega sem `source` | `SELECT … FROM uso WHERE tool='search_context'` (node:sqlite, `readOnly`) | 699 de 975 (71,7%), de 2026-10-26 a 2026-11-10. As 276 com `source`: `decisao` 179, `code` 33, `github` 26, `mapa` 15, `diario` 14, `planning` 7, `memoria` 1, `docs` 1 |
| P3 | Latência atual da busca (para dimensionar o teto) | `ms` de `uso`, últimos 30 dias | p50 288 ms · p90 525 ms · p99 1660 ms (n = 975) |
| P4 | `uso.args` é o JSON dos argumentos recebidos, serializado **depois** do handler, e o `colher` transforma o `source` dele no filtro do caso | `src/tools.ts:54-79` (o `finally` serializa `args`) e `scripts/colher-golden.mjs:144` (`source: args.source ?? null`) | confirmado: se o handler mutasse `args`, o filtro do roteador vazaria para `uso` e para o golden. O roteador trabalha num objeto de filtros novo |
| P5 | O `_meta.brain` é o `Diagnostico` da busca, e o eval invalida a rodada sem ele | `src/tools.ts:29-32`, `src/search.ts:151-156`, `scripts/eval.mjs:126-137` | confirmado: quatro chaves; sem `_meta.brain` o caso vira `sem-diagnostico` (código 2) |
| P6 | O eval passa o ambiente inteiro aos dois servidores | `scripts/eval.mjs:631-636` (`...process.env`) | confirmado. É o que o A8 corta: sem `envSemJev`, `BRAIN_JEV` e a chave chegariam ao head |
| P7 | **O eval já sai com código 2 na `origin/dev`, sem mudança nenhuma** | `node scripts/eval.mjs --base origin/dev` da worktree, com `BRAIN_DB`/`BRAIN_CONFIG` da instalação | código **2**: `[apodreceu] "GetIndicadoresController getFalhasPorSetor limitMetricItems": negativo volátil passou a ter resultado (5)`. O `modulo-erp` passou a ser indexado (652 docs de código naquela hora) |
| P8 | Trocar esse negativo por um de repo não indexado devolve o código 0 | o mesmo comando com `BRAIN_GOLDEN` apontando para uma cópia com o caso do item T0 | código **0**: nDCG@5 0,101 no base e no head, delta +0,000, `Nenhum caso mudou de posição.` O repo `extractor` tem 0 docs no índice |
| P9 | O que o golden consegue medir neste índice | alvos do `golden.json` contra `docs.path` | só 11 dos 80 positivos têm o alvo indexado. Só 7 desses vêm sem `source` (5 com o alvo em `github`, 1 em `planning` e 1 em `git`) |
| P10 | O ganho máximo possível no eval de hoje | eval em modo relatório com uma cópia do golden em que os 7 casos do P9 recebem a fonte do alvo (roteador "oráculo") | nDCG@5 de **0,101 → 0,121** e hit@5 de 7/80 → 9/80. É o teto do B1 com este golden |
| P11 | O mapa de arquitetura, citado no card, quase não existe neste índice | `SELECT source, COUNT(*) FROM docs GROUP BY source` | `mapa`: 2 docs (os dois `README.md` de `claude/mapas/`). As fontes grandes são `code` 6093, `github` 4428, `decisao` 1380 e `planning` 560 |
| P12 | Um consumidor fora do servidor alcança código do pacote em tempo de execução | `hooks/brain-contexto.js:309-313` (`import()` dinâmico de `dist/db.js` e `dist/search.js`) | confirmado. Depois da emenda, o sentido que importa é o inverso, servidor → hook (P18) |
| P13 | Dá para testar o handler em processo, sem subir servidor e sem rede | `node_modules/@modelcontextprotocol/sdk` 1.30.0 tem `dist/esm/inMemory.js`, `client/index.js` e `server/mcp.js`, e `scripts/concorrencia.mjs:66-69` já importa `dist/` em processo | confirmado |
| P14 | *(substituída pela P16)* | — | — |
| P15 | A base nova não mexe no que o #45 lê ou muda | `git diff --stat 3c3b92c 4101a72`; `git diff --stat 3c3b92c 83bbe6c -- brain-mcp/src brain-mcp/scripts/{eval,smoke,concorrencia}.mjs brain-mcp/scripts/golden.json brain-mcp/package.json` | `4101a72` traz só a spec do #42. Até `83bbe6c`, desses arquivos só o `package.json` muda (+ `"jev"`, que o script `roteador` ladeia). P1–P13 valem para a base empilhada |
| P16 | Como a branch do #42 está hoje, e se o `jev.js` dela cumpre C2–C6 | `git log --oneline feat/42-filtro-jev`; `git ls-remote --heads origin feat/42-filtro-jev`; leitura de `hooks/jev.js` da worktree do #42 (`:112-116` `usosLigados`, `:128-133` `ligado`, `:140-148` `envSemJev`, `:178-185` falso `sim`/`nao`, `:350-356` 1 a 255 opções, `:381-425` `decidir`, `:517` CLI atrás de `require.main`) | local em `83bbe6c` (tasks 1 a 3 do #42); na origin em `14fee0c` (task 1). `fb82444` é a Emenda 1. Esta worktree está em `4101a72` e não tem `hooks/jev.js`. O arquivo lido confere com C2–C6: o falso `sim` dá a 1ª opção com 0,95, e o `nao` dá `1 / nomes.length`. O `globalThis.fetch` é lido na hora da chamada. A conferência formal é o portão de entrada |
| P17 | Quem sobe o servidor e chama `search_context` com o ambiente herdado | `grep` de `dist/index.js` em `brain-mcp/scripts/*.mjs`; leitura dos spawns | três scripts: `smoke.mjs:7` (spawn sem `env`, ou seja, herda tudo), `eval.mjs:631-636` (`...process.env`) e `concorrencia.mjs`. No último, o servidor sobe em `:134-142` e uma **cópia** do eval em `:2066-2095`, a partir de `criarInstalacao` (`:2223-2232`), com `CLAUDE_CONFIG_DIR` num `claude-home` vazio da fixture (`montarGuardas`, `:2252-2272`). Os outros spawns (`:338`, `:510`, `:1115`, `:1300`, `:1489`, `:1694`) rodam `openDb`, `cli.js`, `uso.mjs` e `colher-golden.mjs`, que não carregam o cliente, mas herdam o ambiente limpo do mesmo jeito. Nenhum script chama `registerTools` em processo |
| P18 | A raiz do pacote, de onde parte a ordem de resolução do C1 | `src/config.ts:44-46` (`export const packageRoot = join(here, "..")`, com `here` = `dist/`); `eval.mjs:676` (o head é `<root>/dist/index.js`, com `cwd: root`, em `:469`) e `:430-432` (o base compila em `<raiz>/dist-base`, dentro do pacote) | na worktree, `packageRoot/../hooks/jev.js` é o `hooks/jev.js` da worktree, e o head do eval o acha. O base acharia o mesmo arquivo, mas `origin/dev` não tem roteador, e os dois servidores recebem o ambiente limpo. Na instalação, `<brain-mcp>/../hooks` não existe (P10 do #42), e a busca cai em `<CLAUDE_HOME>/hooks/jev.js` |
| P19 | `eval.mjs` é importado por outro script, e por isso não pode mexer em `process.env` no carregamento | a spec do #46 (`planning/46-freio-contradicao/spec.md:344`, worktree do #46) importa `tirarSnapshot` de `./eval.mjs`; o `main` só roda por guarda (`eval.mjs`, `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)`, nas últimas 25 linhas) | confirmado: no eval, a limpeza fica dentro de `main` |
| P20 | A ordem das fontes que vira a ordem das opções | `src/tools.ts:15` (`SOURCES`) | `planning, docs, diario, memoria, mapa, notas, code, github, decisao, git`. Com `qualquer` no fim são 11 opções, dentro de 1 a 255 (C3). O falso `sim` do #42 escolhe a primeira, `planning` |
| P21 | O estado enviado nunca chega perto de `MAX_ESTADO` (200 000) | aritmética: o estado é uma string de até 500 code points. `JSON.stringify` só escapa controle e surrogate solto, com 6 caracteres cada | máximo de 500 × 6 + 2 = 3002 caracteres. O caso `estado-pequeno` do plano prova isso |
| P22 | Não há chave nem uso ligado nesta máquina | `env \| grep -E "^(BRAIN_\|TYPESAFE)"` nesta sessão | vazio |
| P23 | A T0 continua necessária e o repo substituto continua vazio | `node:sqlite` `readOnly` no índice vivo; `grep -n GetIndicadoresController scripts/golden.json` | `extractor`: 0 docs. `modulo-erp`: 1607 docs. O caso continua em `golden.json:206`. Não foi rodado de novo, porque `src/` e o golden não mudaram desde a P7 |
| P24 | Onde entra o parâmetro de teste de `registerTools` | `src/tools.ts:34-51` (assinatura até `aoAssumirLideranca`, em `:49`, e `produto`, em `:50`), `src/index.ts:97` (a chamada) | o parâmetro novo vai **depois** de `produto`, com padrão de produção. O `index.ts` não muda a chamada |

**O que não deu para medir e virou ponto aberto (ver `## Technical Decisions`):** o `hooks/jev.js`
rodando contra o #45, que só existe depois do rebase (P16; o portão de entrada cobre); se o aval cobre a query (G2-B); a
latência e a calibração do Jev (G2-C); o ganho real do B1 (G2-D); e como um script de medição
deixaria a chave passar com aval (G2-E). O smoke vermelho na base (G2-F) é medição de outra sessão
(cofre #1456) e não foi refeito aqui.

## Technical Overview

Um módulo novo, `src/roteador.ts`, decide o filtro antes da busca. O handler do `search_context`
passa a chamar `rotear(...)` em vez de `buscador.buscar(...)`.
- **Desligado, ou com `source` na chamada:** `rotear` só repassa a chamada a `buscar`, e o caminho é
  o de hoje. Desligado quer dizer sem `roteador` em `BRAIN_JEV`, lido a cada chamada.
- **Ligado e sem `source`:** ele faz ao cliente do #42 uma pergunta `escolha`. O estado é a query,
  cortada em 500 code points. As opções são as 10 fontes do enum mais `qualquer`, cada uma com uma
  descrição. O teto é de 1000 ms.
  - Uma fonte com probabilidade `>= 0,8` vira o `source` de **uma cópia** dos filtros.
  - Se essa busca voltar vazia, ou se qualquer coisa falhar antes, roda a busca como veio.

Os `args` nunca são tocados, e por isso a `uso` grava o que chegou. Ao Jev vão só a query, a
instrução fixa e a lista estática de fontes, nunca trecho do corpus.

O escolhedor entra por injeção (`EscolherFonte`), e os testes usam um Jev falso. O único código que
toca o #42 é o adaptador `escolherFonteJev`. Ele acha o `hooks/jev.js` pela ordem do contrato e o
carrega com `createRequire`. Os scripts que sobem o servidor limpam o Jev do ambiente dos filhos.

## Implementation Details

### O que o #45 usa do contrato do #42

O #45 não define o cliente. Cada item abaixo **cita** uma parte de `planning/42-filtro-jev/spec.md`
§ *Contrato do cliente do Jev (estável)*, e o texto que vale é o de lá. O portão de entrada do
`## Execution` confere cada um no `hooks/jev.js` da base.

- **C1. Onde mora e como se alcança**, item **brain-mcp**: resolução na ordem 1
  (`<raiz do pacote>/../hooks/jev.js`) → 2 (`<CLAUDE_HOME>/hooks/jev.js`), carga por
  `createRequire(import.meta.url)(caminho)` dentro de `try`. Falha ao carregar vale
  `{estado:'indisponivel', motivo:'desligado'}`, e os tipos ficam numa interface local. Para os
  scripts, vale a mesma ordem, com a raiz = `join(dirname(script), '..')`.
- **C2. Usos e Ambiente**: o uso `roteador` da tabela, `BRAIN_JEV` sem curinga, `TYPESAFE_API_KEY`,
  `BRAIN_JEV_FALSO` e a *ordem de decisão por chamada*. Fora de `BRAIN_JEV` dá `desligado`, e sem
  chave dá `sem_chave`, sem I/O de rede.
- **C3. `decidir`** com uma `Pergunta` `{tipo:'escolha', instrucao, opcoes}`, em que `opcoes` é
  nome → descrição, com 1 a 255 entradas; `Opcoes` com `uso` obrigatório e `timeoutMs`; e o estado
  limitado por `MAX_ESTADO` (acima disso, `entrada_invalida`, sem corte).
- **C4. Tipos de saída**: `RespostaEscolha` (`{estado:'ok', tipo:'escolha', escolha, confianca, probabilidades}`,
  com `escolha ∈ opcoes`) e `Indisponivel` (`{estado:'indisponivel', motivo, detalhe?}`), no
  resultado com as chaves de `perguntas`.
- **C5. Garantias**:
  - de `decidir`: nunca rejeita e nunca lança; não faz retry; resolve em até `timeoutMs` + 50 ms;
    não escreve em stdout nem em stderr;
  - da Emenda 1: **carregar o módulo não escreve em stdout nem em stderr**. Isso é crítico aqui,
    porque o roteador carrega o `jev.js` dentro do servidor, onde a stdout é o protocolo MCP.

  O roteador impõe o próprio teto mesmo assim: o C5 é defesa em profundidade, e não premissa.
- **C6. `envSemJev`** (a função exportada e a regra de que todo script de teste ou medição a passa aos
  filhos, "inclusive `eval`/`smoke` quando #45/#46 os tocarem") e o **Cliente falso** nos valores
  `sim`, `nao`, `indisponivel` e `lento`.

**Conferência feita nesta emenda.** Para o roteador, o contrato atende sem emenda:
- escolha em lista com confiança;
- sem chave, sem rede;
- orçamento por chamada;
- uso próprio;
- resolução que acha a worktree;
- limites folgados (P20, P21).

O único ponto que ele não cobre é a medição com o Jev real (G2-E). Esse ponto não bloqueia a PR
deste card e vira objeção a levar à PR do #42.

### `brain-mcp/src/roteador.ts` (novo)

```ts
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { packageRoot } from "./config.js";
import type { Filtros, Resultado, Diagnostico } from "./search.js";

/** O pedaço do contrato que o roteador usa (C1: "os tipos ficam numa interface local"). */
interface ClienteJev {
  decidir(
    estado: string,
    perguntas: Record<string, { tipo: "escolha"; instrucao: string; opcoes: Record<string, string> }>,
    opcoes: { uso: typeof USO_ROTEADOR; timeoutMs: number }
  ): Promise<Record<string, unknown>>;
}

/** Escolha já validada contra o C4. `null` = indisponível. */
export type EscolhaDeFonte = { opcao: string; probabilidade: number } | null;
/** estado = a query já cortada; opcoes = nome → descrição (C3); orcamentoMs = o teto do roteador. */
export type EscolherFonte = (
  estado: string,
  opcoes: Readonly<Record<string, string>>,
  orcamentoMs: number
) => Promise<EscolhaDeFonte>;

export const USO_ROTEADOR = "roteador";
export const LIMIAR_ROTEADOR = 0.8;
export const TETO_ROTEADOR_MS = 1000;
export const QUALQUER = "qualquer";
const MAX_QUERY = 500;

export const INSTRUCAO_ROTEADOR =
  "O estado é a consulta que uma sessão do Claude Code fez ao índice de contexto de um workspace de software. Em qual fonte do índice está, mais provavelmente, o documento que responde a ela?";

const DESCRICAO: Record<string, string> = {
  planning: "specs, PRDs e tasks de cards",
  docs: "documentação dos repositórios",
  diario: "diário das sessões do Claude Code",
  memoria: "notas de memória do Claude Code",
  mapa: "mapas de arquitetura dos repositórios",
  notas: "notas soltas",
  code: "código-fonte dos repositórios",
  github: "cards (issues) e PRs do GitHub, com comentários",
  decisao: "decisões registradas durante as sessões",
  git: "mensagens de commit",
  [QUALQUER]: "a resposta pode estar em mais de uma fonte, ou em nenhuma em particular",
};

export function roteadorLigado(env: NodeJS.ProcessEnv = process.env): boolean;
export function estadoDoRoteador(query: string): string;
export function opcoesDoRoteador(fontes: readonly string[]): Record<string, string>;
export function caminhoDoJev(
  raiz: string = packageRoot,
  claudeHome: string = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"),
  existe: (p: string) => boolean = existsSync
): string | null;
export function paraEscolha(saida: unknown): EscolhaDeFonte;
export function criarEscolherFonteJev(carregar?: () => unknown): EscolherFonte;
export const escolherFonteJev: EscolherFonte; // = criarEscolherFonteJev()
export async function rotear(
  query: string,
  filtros: Filtros,
  limit: number,
  deps: {
    ligado: boolean;
    fontes: readonly string[];
    escolher: EscolherFonte;
    buscar: (q: string, f: Filtros, l: number) => Promise<{ resultados: Resultado[]; diag: Diagnostico }>;
    tetoMs?: number;   // padrão TETO_ROTEADOR_MS; só os testes passam outro
    limiar?: number;   // padrão LIMIAR_ROTEADOR; só os testes passam outro
  }
): Promise<{ resultados: Resultado[]; diag: Diagnostico; roteado: string | null }>;
```

**`roteadorLigado`** (*substituído pela emenda 2026-11-11, achado 7: ver o topo; o texto abaixo é o
de 10/11*) devolve
`String(env.BRAIN_JEV ?? "").split(",").some((u) => u.trim().toLowerCase() === USO_ROTEADOR)`.
É a mesma leitura do C2, e o mesmo padrão do `usaJev()` do hook do #42: conferir o uso **antes** de
carregar o `jev.js`. Sem I/O. Um comentário diz que ligar manda a query ao Jev quando houver chave,
o que exige o aval do Leonardo (G2-B).

**`estadoDoRoteador`** devolve `Array.from(query.trim()).slice(0, MAX_QUERY).join("")`. O corte é
por code point, para não partir um par surrogate. O estado vai como string porque o adaptador do #42
o serializa, e assim a query nunca fecha uma citação dentro do texto.

**`opcoesDoRoteador`** devolve um objeto novo com uma entrada por fonte, na ordem recebida:
`DESCRICAO[fonte] ?? fonte`. Depois vem `[QUALQUER]: DESCRICAO[QUALQUER]`, sempre por último. A
lista de fontes **não** entra no estado nem na instrução: ela vai só em `opcoes`, que o Jev recebe
como os critérios do `choice` (TD-9).

**`caminhoDoJev`** devolve o primeiro caminho, nesta ordem, para o qual `existe` é verdadeiro:
1. `join(raiz, "..", "hooks", "jev.js")`;
2. `join(claudeHome, "hooks", "jev.js")`.

Se nenhum existir, devolve `null`. É o C1 ao pé da letra. O padrão de `claudeHome` repete a regra de
`src/config.ts:61` e de `hooks/brain-config.js:24`. Os parâmetros padrão são avaliados a cada
chamada, então a env é lida na hora.

**`paraEscolha(saida)`**, função pura e exportada, lê `r = saida?.fonte` (a chave da pergunta) e
devolve `{ opcao: r.escolha, probabilidade: r.confianca }` só quando todas estas condições valem:
- `r` é objeto;
- `r.estado === "ok"`;
- `r.tipo === "escolha"`;
- `typeof r.escolha === "string"`;
- `typeof r.confianca === "number"`.

Fora disso devolve `null`, e isso inclui todo `Indisponivel`, `undefined`, `{}` e `tipo` `noul`.
Ela não valida limiar nem pertencimento à lista: isso é do `rotear`, para que o Jev falso dos testes
passe pelas mesmas regras.

**`criarEscolherFonteJev(carregar = carregarJev)`** devolve um `EscolherFonte` que:
1. dentro de `try`, chama `carregar()`. Um resultado que não é objeto com `decidir` função vira `null`.
   Senão, é tratado como `ClienteJev`;
2. chama
   `jev.decidir(estado, { fonte: { tipo: "escolha", instrucao: INSTRUCAO_ROTEADOR, opcoes: { ...opcoes } } }, { uso: USO_ROTEADOR, timeoutMs: orcamentoMs })`;
3. devolve `paraEscolha(await ...)`.

Qualquer exceção, ou rejeição, vira `null`. O `carregarJev` interno (não exportado) é
`const c = caminhoDoJev(); return c ? createRequire(import.meta.url)(c) : null;`. Não há cache
próprio: o `require` já guarda o módulo, e o `existsSync` custa microssegundos. Por isso um
`jev.js` instalado pela **primeira vez** depois do boot é achado sem reiniciar. Um `jev.js`
**atualizado** só vale depois de reabrir a sessão, porque o cache do `require` prende a versão
já carregada.

**`rotear`**, nesta ordem:
1. `if (!deps.ligado || filtros.source) return { ...(await deps.buscar(query, filtros, limit)), roteado: null };`
   - *Emenda 2026-11-11:* a condição vira `!deps.ligado || temFiltro(filtros)`, com `temFiltro(f)` =
     `Boolean(f.source || f.repo || f.feature || f.doc_type)` (não exportada).
2. `const opcoes = opcoesDoRoteador(deps.fontes)`. Chama
   `deps.escolher(estadoDoRoteador(query), opcoes, teto)`.
   - A chamada fica dentro de `Promise.resolve().then(...)`, para que um `throw` síncrono vire
     rejeição. Rejeição também vira `null` (`.catch(() => null)`).
   - Ela corre contra um timer de `teto` ms, que resolve `null`. O timer é limpo com `clearTimeout` em
     qualquer desfecho.
   - A promessa perdedora fica com o `.catch` pendurado, e assim nunca vira `unhandledRejection`.
3. Aceita a escolha só se todas estas condições valem; senão, volta à busca como veio, como no passo 1:
   - `e != null` e `typeof e === "object"`;
   - `typeof e.opcao === "string"` e `typeof e.probabilidade === "number"`;
   - `Number.isFinite(e.probabilidade)`, `e.probabilidade >= limiar` e `e.probabilidade <= 1`;
   - `e.opcao !== QUALQUER` e `deps.fontes.includes(e.opcao)`.
4. `const r = await deps.buscar(query, { ...filtros, source: e.opcao }, limit);`.
   - Com `r.resultados.length > 0`, devolve `{ ...r, roteado: e.opcao }`.
   - Senão, devolve a busca como veio (uma segunda chamada a `buscar` com os `filtros` originais) e
     `roteado: null`.
5. Nunca escreve em `filtros` e nunca recebe `args`.

### `brain-mcp/src/tools.ts`

- `registerTools` ganha um último parâmetro opcional, depois de `produto` (P24):
  `roteador: { ligado: () => boolean; escolher: EscolherFonte } = { ligado: () => roteadorLigado(), escolher: escolherFonteJev }`.
  O `index.ts` não muda a chamada: o padrão é o de produção, e só o teste passa outro.
- No handler do `search_context` (hoje `tools.ts:109-144`), o objeto de filtros passa a ser montado
  numa
  `const filtros: Filtros = { source: args.source, repo: args.repo, feature: args.feature, doc_type: args.doc_type, incluirArquivadas: args.incluir_arquivadas }`.
  A chamada vira:
  `const { resultados: rows, diag, roteado } = await rotear(args.query, filtros, args.limit ?? 8, { ligado: roteador.ligado(), fontes: SOURCES, escolher: roteador.escolher, buscar: (q, f, l) => buscador.buscar(q, f, l) });`.
  `ligado()` é lido a cada chamada, como o C2 lê a env.
- O ramo `rows.length === 0` não muda: ali `roteado` é sempre `null`, por causa do passo 4.
- No ramo com resultado, depois de `rodape`, entra
  `const aviso = roteado ? \`\n(roteador: busca restrita a source="${roteado}" nesta consulta — para outra fonte, passe source)\` : "";`.
  O retorno vira `text(out + rodape + aviso + "\n\nUse read_doc(path) para ler o documento inteiro ou uma seção.", diag)`.
  Com `roteado === null`, o texto é byte a byte o de hoje.
- `inputSchema`, `text()`, o wrapper de `uso` e as outras tools não mudam.

### `brain-mcp/src/index.ts`

*Emenda 2026-11-11 (achado 7):* nas duas linhas abaixo, "pedido (roteador em BRAIN_JEV): com
TYPESAFE_API_KEY" vira "ligado (roteador em BRAIN_JEV, com TYPESAFE_API_KEY):", e "buscas sem
source" vira "buscas sem filtro". A primeira só aparece com chave, porque o `roteadorLigado` agora é o
`ligado` do cliente.

Importar `roteadorLigado`. Logo depois do bloco de boot (`index.ts:49-67`), quando ele for
verdadeiro, emitir:
- com `process.env.BRAIN_JEV_FALSO === undefined`:
  `console.error("[brain] roteador de source pedido (roteador em BRAIN_JEV): com TYPESAFE_API_KEY, a query das buscas sem source vai ao Jev");`;
- com `BRAIN_JEV_FALSO` definida:
  `console.error("[brain] roteador de source com o Jev FALSO (BRAIN_JEV_FALSO): as buscas sem source seguem o roteiro do falso, sem rede");`.
  Numa sessão real, o falso `sim` manda toda busca sem `source` para `planning` (P20), e a linha diz
  isso a quem lê o stderr.

A linha é só informativa: a decisão é de cada chamada. Nada mais muda.

`src/config.ts` **não muda**: o `ROTEADOR_LIGADO` da spec original sai junto com o `BRAIN_ROTEADOR`
(TD-2).

### `brain-mcp/scripts/sem-jev.mjs` (novo) e os três scripts que sobem o servidor (A8)

`sem-jev.mjs` exporta `semJev(raiz)`:
- procura o cliente em `join(raiz, "..", "hooks", "jev.js")` e depois em
  `join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "hooks", "jev.js")` (C1, scripts);
- carrega com `createRequire(import.meta.url)`;
- faz `process.env = cliente.envSemJev(process.env)` (C6), o mesmo gesto do `jev.mjs` do #42;
- devolve `{ caminho, cliente }`.

Se não achar o cliente, se a carga lançar, ou se `envSemJev` não for função, devolve
`{ erro: "cliente do Jev não encontrado em <1> nem em <2> (ou ilegível): rode de dentro do repo ou com os hooks instalados" }`,
**sem** mexer em `process.env`. Um comentário no arquivo diz por quê: o servidor que estes scripts
sobem pode carregar o cliente (o roteador), e é isso que mantém "medição não usa rede" verdadeiro
numa máquina que um dia tiver a chave.

| Script | Onde chama | Sem cliente |
|---|---|---|
| `scripts/eval.mjs` | no início de `main`, antes de `lerArgumentos`. Nunca no topo do módulo, porque o #46 importa `eval.mjs` (P19) | `return naoMedi([r.erro])`, código `2` |
| `scripts/smoke.mjs` | no topo, depois de `root` e antes do `spawn` de `:7` | `console.error("FALHOU: " + r.erro); process.exit(1)` |
| `scripts/concorrencia.mjs` | no topo, logo depois de `const root` (`:21`) e antes da primeira escrita em `process.env` (`:31`) | idem, código `1` |

Os `...process.env` de hoje passam a espalhar o ambiente já limpo. Fora isso, só a fixture das
guardas do `concorrencia.mjs` muda, porque ela roda uma **cópia** do `eval.mjs` numa instalação de
mentira (P17), e a cópia agora importa `./sem-jev.mjs` e precisa achar um cliente:
- `criarInstalacao` (`:2223-2232`) copia também `scripts/sem-jev.mjs` para `<dir>/scripts/`;
- `montarGuardas` (`:2252-2272`), logo depois de criar o `claude-home`, copia `join(root, "..", "hooks", "jev.js")`
  para `join(claudeHome, "hooks", "jev.js")`. É o layout da instalação real (P18): o passo 1 da
  resolução não existe na fixture, e a cópia do eval cai no passo 2 pelo `CLAUDE_CONFIG_DIR` que
  `g.env()` já passa.

Os casos de guarda (`eval-base-sem-checkout-nomeia-as-tres-saidas`,
`eval-base-guarda-de-branch-nao-compila`, `eval-base-guarda-de-frescor` e
`eval-base-dentro-do-git-le-a-branch-do-git`) **não** mudam de expectativa: o `semJev` acha o
cliente e o eval segue até a guarda de sempre. Se a base já trouxer essa limpeza (de outro card do
lote), a task confere que ela cumpre esta seção e não a repete.

### `brain-mcp/scripts/roteador.mjs` (novo) e `package.json`

Uma suíte sem rede, no estilo de `scripts/concorrencia.mjs`. A ordem de abertura é fixa:
0. `process.env.BRAIN_JEV = "roteador"` e `process.env.BRAIN_JEV_FALSO = "sim"`, para o `semJev-limpa`
   provar que a limpeza os tira. A chave nunca é posta;
1. `semJev(root)`; com `erro`, `FALHOU` e saída `1`;
2. `let chamadasFetch = 0; globalThis.fetch = () => { chamadasFetch++; throw new Error("rede proibida no teste do roteador"); };`;
3. só então `await import()` dos módulos de `dist/`.

No fim, antes de sair, a suíte afirma `chamadasFetch === 0` (caso `nenhum-fetch`). Uma chamada de
rede acidental viraria `rede` → `null` no adaptador, indistinguível de `sem_chave`, e por isso é
contada à parte.

Cada caso imprime `ok`/`FALHOU <nome>: <motivo>`, e a suíte sai com `1` se algum falhar e `0` se
todos passarem. No `package.json`, `"roteador": "node scripts/roteador.mjs"`. Os casos estão em
`## Plano de testes`. Os casos que precisam do roteador ligado põem `process.env.BRAIN_JEV`
(e, quando o caso pede, `BRAIN_JEV_FALSO`) e os apagam num `finally`. A chave nunca é posta.

O **Jev falso** é uma função `EscolherFonte` que registra quantas vezes foi chamada e com quais
argumentos `(estado, opcoes, orcamentoMs)`. Ela devolve o que o caso mandar: uma escolha, `null`, um
`throw`, uma rejeição, ou uma promessa que nunca resolve.

O **buscador falso** registra cada chamada `(q, filtros, limit)`. Ele devolve um `Resultado` fixo por
`source`, com `breadcrumb`, `path`, `snip`, `source`, `doc_type: "doc"`, `tambemEm: []` e o resto
`null`, ou lista vazia para as fontes que o caso disser. O `diag` depende **só** do `source` pedido,
e nunca de quantas chamadas já houve:
`{ lexicais: <n. de resultados>, vetoriais: 0, semantica: true, colapsados: source ? 1 : 0 }`.
É isso que deixa comparar respostas com `deepStrictEqual` e saber de qual busca veio o `diag`.

Os casos de integração montam o servidor em processo, com `McpServer` +
`InMemoryTransport.createLinkedPair()` + o `Client` do SDK.
- Cada configuração de roteador ganha um `McpServer` e um `Client` **novos**, porque registrar o
  mesmo nome de tool duas vezes lança.
- O banco é `openDb(<temp>/brain.db)` de `dist/db.js`, que cria a tabela `uso`, e é apagado no fim.
- O `buscador` é **sempre o falso**: um `Buscador` real num banco vazio nunca traria resultado e
  quebraria o A3.
- `indexer`, `syncer`, `grafo`, `vigia` e `lease` são stubs `{}`, porque só o `search_context` é
  chamado. `aoAssumirLideranca` é `() => {}` e `produto` é `"teste"`.
- O `Resultado` falso tem `source` igual ao filtro pedido, ou `"docs"` quando não há filtro.

### `brain-mcp/scripts/golden.json` (task T0, condicional)

**Só se** o `brain-mcp/scripts/golden.json` **desta worktree**, já com a base da PR (a branch do
#42) incorporada, ainda tiver o caso `"GetIndicadoresController getFalhasPorSetor limitMetricItems"`
(hoje em `:206`, P23), e se `npm run eval -- --base origin/dev` sair com `[apodreceu]` nele. O eval lê
o golden do head (`scripts/eval.mjs:673`) nas duas rodadas. Nesse caso, ele é substituído, no mesmo
lugar da lista, por:

```json
{
 "q": "tradutor ghidra arvores de ouro sub-regras SIHD2",
 "filtros": { "source": null, "repo": "extractor", "feature": null, "doc_type": null },
 "esperado": [],
 "tipo": "negativo",
 "estilo": "keywords",
 "volatil": true,
 "origem": "manual",
 "nota": "negativo de ASSUNTO AUSENTE: o repo extractor (~/notoria/extractor) não está no brain.config.json — 0 docs em 2026-11-10. Substitui o do modulo-erp, que apodreceu quando o modulo-erp passou a ser indexado (652 docs, cofre #1395). Basta indexar o extractor para este também apodrecer: volatil true, e o eval sai com código 2, nunca com 1."
}
```

Antes do commit, `SELECT COUNT(*) FROM docs WHERE repo = 'extractor'` no índice vivo tem de dar `0`.
Se der mais que `0`, a task para com `PARADA`, porque escolher outro repo é decisão nova. O commit é
só dele: `test(eval): troca o negativo volátil que apodreceu`. Se a base já tiver consertado o caso,
a T0 não existe. O #42 não mexe em `src/` nem roda o eval (Execution do #42), então a T0 fica aqui.
A T0 é a **primeira** task: o eval que a decide roda logo depois do rebase, antes de qualquer código
do #45, com o head igual à base. Assim o `[apodreceu]` não se mistura com o efeito do roteador.
O hash do commit da T0 vai para a sessão do #46, que empilha sobre ele (cofre #1457).

### `brain-mcp/README.md`

Uma subseção `### Roteador de source` dentro de `## Qualidade da busca`, depois do parágrafo da
tabela `uso`, com:
- o que o roteador faz;
- como ligar: `roteador` em `BRAIN_JEV` no ambiente do processo `claude` (ou no `env` do servidor
  `brain` em `~/.claude.json`), mais `TYPESAFE_API_KEY`, com o apontador para o parágrafo do Jev do #42;
- o que vai ao Jev: a query cortada, a instrução fixa e a lista de fontes com as descrições, nunca
  trecho do corpus;
- o limiar e o teto;
- os casos que caem para a busca como veio;
- que a `uso` grava os argumentos como vieram;
- que `eval`, `smoke` e `concorrencia` limpam o Jev do ambiente dos filhos;
- que um `jev.js` atualizado só vale depois de reabrir a sessão (cache do `require`);
- que `BRAIN_JEV_FALSO` numa sessão real, com `roteador` na lista, desvia **toda** busca sem `source`
  pelo roteiro do falso;
- o B1: não há comando nesta versão, porque fica para o card de calibração do Jev (G2-E). O aviso do
  P9/P10 vai junto.

E mais duas entradas: `npm run roteador` em `## Comandos` (`brain-mcp/README.md:209`), e `roteador`
na linha dos scripts do `README.md` raiz, a mesma que o #42 edita para `jev`.

## File Change Summary

| Arquivo | Mudança |
|---|---|
| `brain-mcp/src/roteador.ts` | **novo**: tipos, constantes, `roteadorLigado`, `estadoDoRoteador`, `opcoesDoRoteador`, `caminhoDoJev`, `paraEscolha`, `criarEscolherFonteJev`/`escolherFonteJev`, `rotear` |
| `brain-mcp/src/tools.ts` | parâmetro opcional `roteador` em `registerTools`; o handler do `search_context` chama `rotear` e acrescenta o rodapé quando `roteado` |
| `brain-mcp/src/index.ts` | linha de boot no stderr quando `roteador` está em `BRAIN_JEV` |
| `brain-mcp/scripts/sem-jev.mjs` | **novo**: `semJev(raiz)`, com a resolução do C1 e o `envSemJev` |
| `brain-mcp/scripts/eval.mjs` | `semJev` no início de `main`; sem cliente, `naoMedi` |
| `brain-mcp/scripts/smoke.mjs` | `semJev` antes do spawn; sem cliente, `FALHOU` |
| `brain-mcp/scripts/concorrencia.mjs` | `semJev` no topo; sem cliente, `FALHOU`; a fixture das guardas copia `sem-jev.mjs` e põe o `jev.js` no `claude-home` dela |
| `brain-mcp/scripts/roteador.mjs` | **novo**: suíte do roteador com Jev e buscador falsos, mais o cliente da worktree em modo falso |
| `brain-mcp/package.json` | script `roteador` |
| `brain-mcp/scripts/golden.json` | **só na T0 condicional**: troca um negativo apodrecido |
| `brain-mcp/README.md` | subseção `### Roteador de source` e `npm run roteador` em `## Comandos` |
| `README.md` (raiz) | `roteador` na linha dos scripts |

`src/config.ts` e `hooks/` não mudam.

## Migrations & compatibilidade

N/A. O formato em disco não muda: nem o índice, nem a `uso`, nem o `conversations.json`, nem as
decisões. A troca de um caso no `golden.json` (T0) muda o instrumento de medida, não um dado. Base e
head leem o mesmo arquivo, então a comparação continua válida (P8). Sem `roteador` em `BRAIN_JEV`, o
servidor novo é indistinguível do antigo para quem chama (A1).

Compatibilidade de instalação:
- servidor novo sem `jev.js` instalado: o `caminhoDoJev` devolve `null`, e o roteador cai para a
  busca como veio, mesmo ligado;
- `eval`, `smoke` e `concorrencia` novos sem `jev.js` achável: **não medem** (A8). Na instalação, o
  `sync.sh push` do #42 instala o `jev.js` em `~/.claude/hooks/` (P10 do #42). Por isso a ordem de
  deploy é a do empilhamento: o #42 antes ou junto.

## Rollback

Em produção (a instalação): tirar `roteador` de `BRAIN_JEV`, no ambiente do `claude` ou no `env` do
`brain` em `~/.claude.json`, e reabrir a sessão. O caminho volta a ser o de hoje sem rebuild, porque o
uso é lido a cada chamada. (Um `jev.js` atualizado, ao contrário, pede reabrir a sessão.) Se o
problema for o código com o roteador desligado, reverter a PR na
`dev`, rodar `sync.sh push` e `npm run build` na instalação. Não há dado a desfazer: a `uso` nunca
recebeu nada diferente.

## Verificação pós-deploy

Não é a verificação obrigatória do delta 1 do workspace, porque não muda dado nem formato em disco.
Mesmo assim, na 🧪 Validação em Dev, depois de `sync.sh push` e `npm run build` na instalação (com o
`jev.js` do #42 já instalado), e com `roteador` **fora** de `BRAIN_JEV`:
1. `npm run eval -- --base origin/dev` na instalação, que tem de sair com código `0` e
   `Nenhum caso mudou de posição.`;
2. `BRAIN_JEV=roteador BRAIN_JEV_FALSO=sim npm run eval -- --base <P>` na instalação, com
   `<P> = git rev-parse <merge do #45 na dev>^1` (a `dev` antes do #45), e o mesmo resultado. Com
   `--base origin/dev` já com o #45, base e head teriam o mesmo roteador, e o passo não provaria
   nada. Ele mostra que o eval instalado acha o `~/.claude/hooks/jev.js` (sem cliente, sairia `2`).
   A limpeza dos filhos ele só mostra com a mesma ressalva do A1;
3. um `search_context` sem `source` numa sessão real, que não pode ter a linha `(roteador: …)`;
4. o stderr do boot, que não pode ter `[brain] roteador de source` (emenda 2026-11-11: a linha com
   chave diz `ligado`, e não mais `pedido`).

O grupo B (ligar o roteador com chave e aval, medir o B1) é uma verificação à parte. Ela só existe
depois do aval (G2-B) e do modo de medição com chave (G2-E), e fica registrada no card quando
acontecer.

## Plano de testes

Portão (pela `## A esteira` do repo, com o `dist/` recompilado e `BRAIN_DB`/`BRAIN_CONFIG` apontando
para o índice vivo):
- `npm run build` (tsc);
- `npm run roteador`;
- `npm run smoke` (vermelho na base hoje, por fora do #45: G2-F);
- `npm run concorrencia` (o script foi tocado);
- o eval do A1 nas duas formas.

| Critério | Prova | Caso |
|---|---|---|
| A1 | `scripts/roteador.mjs` | `desligado-nao-consulta`: `ligado: false`, sem `source`. O Jev falso é chamado 0 vezes, `buscar` 1 vez com `source` ausente, `roteado === null`. Mais `desligado-nao-carrega` (integração): `registerTools` com `{ ligado: () => false, escolher: criarEscolherFonteJev(carregarEspiao) }`, e `{query:"x"}` → o espião `carregar` foi chamado 0 vezes. Mais `ligado-pela-lista`: `roteadorLigado` com `BRAIN_JEV` ausente, `"1"`, `"*"`, `"todos"`, `"contexto"` → `false`; com `"roteador"`, `" Roteador ,contexto"`, `"contexto,roteador"` → `true` |
| A1 | `scripts/roteador.mjs` (integração) | `desligado-byte-a-byte`: com `ligado: () => false`, `{query:"x"}` responde um `content[0].text` igual a uma **string literal** montada no teste no formato de `tools.ts:133-143` (`1. <breadcrumb>\n   [docs]\n   <path>\n   <snip>` + `\n\nUse read_doc(path) para ler o documento inteiro ou uma seção.`), a partir do `Resultado` falso, e um `_meta` `deepStrictEqual` a `{ brain: <diag do falso sem source> }` |
| A1 | `scripts/roteador.mjs` (integração) | `desligado-igual-a-sem-chave`: `{query:"x"}` e `{query:"x", repo:"r", limit:3}` respondem `content` e `_meta` `deepStrictEqual` entre o servidor com o padrão de produção de `registerTools` (só o buscador falso) e `BRAIN_JEV` ausente, e o mesmo servidor com `BRAIN_JEV=roteador` e sem chave. Isso exercita o `escolherFonteJev` de verdade contra o `hooks/jev.js` da worktree, que devolve `sem_chave`. Mais o mesmo par com o Jev falso devolvendo `null` |
| A1 | eval | `npm run eval -- --base origin/dev` sai `0` com `Nenhum caso mudou de posição.`, e de novo com `BRAIN_JEV=roteador BRAIN_JEV_FALSO=sim` na frente. Mudança de posição → `PARADA` (A1). `[apodreceu]` no caso do `modulo-erp` → T0 antes |
| A2 | `scripts/roteador.mjs` | `abaixo-do-limiar` (0,79); `probabilidade-invalida` (`NaN`, `1.5`, `"0.9"`); `indisponivel` (`null`); `indefinido` (o falso resolve `undefined`); `sem-opcao` (`{ probabilidade: 0.9 }`); `lanca-sincrono`; `rejeita`; `fora-da-lista` (`"wiki"`, 0,99); `caixa-diferente` (`"Mapa"`, 0,99); `qualquer` (0,99). Em todos, `rotear` não lança, `buscar` é chamado 1 vez com os filtros originais e `roteado === null` |
| A2 | `scripts/roteador.mjs` | `timeout`: o Jev falso nunca resolve, com `tetoMs: 100` e o buscador falso. `rotear` resolve em ≤ 400 ms, com a busca como veio. Mais `TETO_ROTEADOR_MS === 1000` e `LIMIAR_ROTEADOR === 0.8` |
| A2 | `scripts/roteador.mjs` | `filtro-vazio-cai-para-sem-filtro`: escolha `mapa` 0,95, e o buscador falso devolve `[]` para `mapa`. `buscar` é chamado 2 vezes (com `mapa`, depois sem `source`), o retorno tem o `diag` da 2ª e `roteado === null` |
| A3 | `scripts/roteador.mjs` | `no-limiar-aplica`: escolha `mapa` 0,8 com resultado. `buscar` 1 vez com `source: "mapa"` e `roteado === "mapa"`. O Jev falso recebeu `orcamentoMs === TETO_ROTEADOR_MS` quando `tetoMs` não é passado |
| A3 | `scripts/roteador.mjs` | `estado-e-opcoes`: `estadoDoRoteador("  x  ") === "x"`; uma query de 600 caracteres sai com 500 code points; 600 emojis saem com 500 code points sem surrogate solto; `estado-pequeno`: `JSON.stringify(estadoDoRoteador(String.fromCharCode(1).repeat(600))).length <= 3002` e `< cliente.MAX_ESTADO`. `Object.keys(opcoesDoRoteador(SOURCES))` é a ordem do P20 mais `qualquer`, com 11 entradas e toda descrição string não vazia. O Jev falso recebeu exatamente o estado cortado e essas opções |
| A3 | `scripts/roteador.mjs` (integração) | `rodape-quando-roteado`: o texto termina em `(roteador: busca restrita a source="mapa" nesta consulta — para outra fonte, passe source)\n\nUse read_doc(path) para ler o documento inteiro ou uma seção.`, e `_meta` é `deepStrictEqual` a `{ brain: { lexicais: 1, vetoriais: 0, semantica: true, colapsados: 1 } }`, o diag do falso **com** `source` (a busca filtrada) |
| A3, A7 | `scripts/roteador.mjs` (integração) | `ponta-a-ponta-falso`: o padrão de produção de `registerTools`, com `BRAIN_JEV=roteador BRAIN_JEV_FALSO=sim` e o buscador falso, responde `{query:"x"}` com o rodapé de `source="planning"` (o falso `sim` escolhe a primeira opção com 0,95, C6). O buscador registrou `source: "planning"` |
| A4, A4b | `scripts/roteador.mjs` | `source-explicito-nao-consulta`: `ligado: true`, `source: "code"`. O Jev falso é chamado 0 vezes, `buscar` 1 vez com `code`. Mais `query-vazia-nao-consulta` (integração): `{query:"   "}` com o roteador ligado responde `Query vazia — informe ao menos um termo.` e o Jev falso é chamado 0 vezes |
| A4 (emenda 2026-11-11) | `scripts/roteador.mjs` | `filtro-explicito-nao-consulta repo`, `… feature`, `… doc_type` e `… repo+feature+doc_type`: `ligado: true`, o Jev falso em `mapa` 0,99 é chamado 0 vezes, `buscar` 1 vez com os filtros como vieram, `roteado === null`. `incluir-arquivadas-ainda-roteia`: só `incluirArquivadas: true` → o Jev é chamado e a busca vai com `source: "mapa"`. Na integração, `filtro-na-chamada-nao-consulta`: `{query, repo}`, `{query, feature}` e `{query, doc_type}` com o roteador ligado não consultam o Jev nem ganham o rodapé. A suíte passa a usar `FILTROS = { incluirArquivadas: false }`, e o `desligado-igual-a-sem-chave` conta 1 consulta (a chamada com `repo` não consulta) |
| A5 | `scripts/roteador.mjs` (integração) + diff (com `<base>` = `origin/dev`) | `superficie-intacta`: `tools/list` mostra as chaves de `inputSchema.properties` do `search_context`, com `sort()`, iguais a `[doc_type, feature, incluir_arquivadas, limit, query, repo, source]`. As chaves de `_meta.brain` de uma resposta roteada, com `sort()`, são iguais a `[colapsados, lexicais, semantica, vetoriais]`. No diff, `git diff --stat <base>...HEAD -- brain-mcp/src/db.ts` vem vazio (a `uso` não ganha coluna) |
| A6 | `scripts/roteador.mjs` (integração) | `uso-grava-args-como-vieram`: com o roteador ligado e o Jev falso em `mapa` 0,95, `{query:"x", limit:3}` responde com o rodapé do roteador, e o buscador falso registrou uma chamada com `source: "mapa"`. A última linha de `uso` (`ORDER BY id DESC LIMIT 1`) tem `tool = 'search_context'` e `JSON.parse(args)` `deepStrictEqual` a `{query:"x", limit:3}`, sem `source`. Mais `filtros-intactos` na unidade: `rotear` com `Object.freeze(filtros)` não lança |
| A7 | `scripts/roteador.mjs` | `sem-http-proprio`: lê `src/roteador.ts` e `src/tools.ts` e falha se algum casar a regex do bloco abaixo. Falha se `src/roteador.ts` não contiver `createRequire`, `"jev.js"` e `USO_ROTEADOR = "roteador"`, ou se algum outro `src/*.ts` contiver `jev.js` |
| A7 | `scripts/roteador.mjs` | `resolve-a-worktree`: `caminhoDoJev()` é igual a `resolve(root, "..", "hooks", "jev.js")`, o arquivo da worktree, e não o instalado. Depois do `cliente-da-worktree`, `createRequire(import.meta.url).cache` tem a chave desse caminho e **não** tem a de `join(<CLAUDE_HOME>, "hooks", "jev.js")`. `caminhoDoJev(r, h, existe)` com `existe` falso: os dois existem → o 1º; só o 2º → o 2º; nenhum → `null` |
| A7 | `scripts/roteador.mjs` | `adaptador`: `paraEscolha` com `{fonte:{estado:"ok", tipo:"escolha", escolha:"mapa", confianca:0.9, probabilidades:{}}}` → `{opcao:"mapa", probabilidade:0.9}`; com `{fonte:{estado:"indisponivel", motivo:"sem_chave"}}`, `{fonte:{estado:"ok", tipo:"noul", sim:true, probabilidade:0.9}}`, `{}`, `undefined` e `{fonte: null}` → `null`. `criarEscolherFonteJev` com `carregar` que lança, que devolve `null` ou `{}`, ou com `decidir` que lança ou rejeita → `null`, sem lançar. O espião de `decidir` recebeu `(estado, {fonte:{tipo:"escolha", instrucao: INSTRUCAO_ROTEADOR, opcoes}}, {uso:"roteador", timeoutMs: <orçamento>})` |
| A7 | `scripts/roteador.mjs` | `cliente-da-worktree`: `escolherFonteJev("x", opcoesDoRoteador(SOURCES), 1000)` contra o `jev.js` real dá: sem `BRAIN_JEV` → `null` em < 50 ms; `BRAIN_JEV=roteador` sem chave → `null` em < 50 ms. Com `BRAIN_JEV=roteador` posto em todos estes: `BRAIN_JEV_FALSO=sim` → `{opcao:"planning", probabilidade:0.95}`; `nao` → `opcao: "planning"` com `Math.abs(probabilidade - 1/11) < 1e-9`; `indisponivel` → `null`; `lento` com orçamento 100 → `null` em < 300 ms. O `nenhum-fetch` do fim da suíte conta zero chamadas |
| A8 | `scripts/roteador.mjs` | `filhos-sem-jev`, sobre o texto dos arquivos: no `eval.mjs`, `semJev(` aparece entre `async function main` e o primeiro `lerArgumentos(` **depois** dele, e não no topo do módulo; no `smoke.mjs`, `indexOf("semJev(") < indexOf("spawn(")`; no `concorrencia.mjs`, `indexOf("semJev(") < indexOf("process.env.BRAIN_LEASE_TTL_MS")`. Mais `semJev-limpa`: depois do `semJev(root)` da abertura (passo 0 da ordem), nenhuma chave de `process.env` começa com `BRAIN_JEV`, e `TYPESAFE_API_KEY` é `undefined`. Mais `semJev-sem-cliente`: `semJev(join(<temp>, "pacote"))`, com `CLAUDE_CONFIG_DIR` apontando para outro temp vazio (restaurado num `finally`), devolve `erro` e deixa `process.env` com as mesmas chaves |
| A8 | eval + `concorrencia` | a 2ª forma do A1 (`BRAIN_JEV=roteador BRAIN_JEV_FALSO=sim`) com código `0` é prova adicional, com a ressalva do A1. `npm run concorrencia` verde, com os quatro casos de guarda do eval copiado inalterados, prova que a cópia acha o cliente pelo passo 2 |
| B1 | eval com o Jev real | sem comando nesta PR (G2-E). Fora do portão |

A regex do `sem-http-proprio`, fora da tabela para não ganhar barras de escape:

```js
/fetch\(|node:https?|undici|XMLHttpRequest/
```

## Technical Decisions

- **TD-1. O roteador fica num módulo à parte e recebe o escolhedor por injeção.** Assim o Jev falso
  testa o comportamento todo sem rede, e o único código que conhece o #42 é o adaptador.
  *Descartado:* chamar o cliente direto no handler, o que deixaria impossível testar o fallback sem
  um servidor HTTP falso.
- **TD-2 (emendada). O roteador liga só com `roteador` em `BRAIN_JEV`. `BRAIN_ROTEADOR` sai.**
  - Com o contrato do #42, o uso nomeado **é** o interruptor por consumidor: ele vem desligado por
    padrão, não tem curinga e existe para que o aval venha por uso (TD *Um uso nomeado por
    consumidor* do #42). O hook do #42 liga o `contexto` só pela lista, sem flag própria.
  - Uma segunda flag pediria `BRAIN_ROTEADOR=1` **e** `roteador` em `BRAIN_JEV`. São dois nomes para
    o mesmo opt-in, e a pegadinha seria "ligado em um, desligado no outro".
  - O motivo original da flag era chegar ao head do eval pelo `...process.env` (P6). Ele caiu: por
    contrato, o eval limpa o Jev dos filhos (A8), e com a chave fora a flag só ligaria um roteador
    que responde `sem_chave`, caso que a suíte já cobre em processo.
  - *Descartado:* manter `BRAIN_ROTEADOR=1` como segunda trava. Ela não protege nada que o par
    `BRAIN_JEV` + `TYPESAFE_API_KEY` não proteja, e cria um estado ligado-pela-metade.
  - *Descartado também:* a flag em `brain.config.json`, pelo motivo original (não chega ao processo
    sem um parâmetro novo, e cada máquina tem o seu).
- **TD-3. Limiar 0,8 e teto 1000 ms, como constantes.** O teto fica perto do dobro do p90 da busca
  (525 ms, P3): o pior caso dobra a latência e nunca a torna desconhecida. O teto vai ao `decidir`
  como `timeoutMs`, e o roteador corre o próprio timer mesmo assim (C5). Os dois números não estão
  calibrados (G2-C). Mudar um deles é emenda com a medida do B1, e não ajuste na hora.
  *Descartado:* variável de ambiente para o limiar, superfície a mais antes de existir um dado que a
  justifique.
- **TD-4. `qualquer` entra na lista.** Ele dá ao Jev um jeito de dizer "não há uma fonte só" sem
  espalhar a probabilidade pelas dez e cair abaixo do limiar por acaso. Escolher `qualquer` dá a
  busca como veio. *Descartado:* a lista só com as dez fontes.
- **TD-5. Filtro sem resultado cai para a busca como veio, com uma segunda chamada a `buscar`.**
  Está no card. Um filtro é subconjunto da busca, então um negativo (resposta vazia) nunca fica
  cheio por causa do roteador.
  - *Limite medido:* a metade vetorial não tem corte de score (`vectors.ts:89-109` devolve sempre os
    K mais próximos). Com a semântica respondendo, a busca filtrada só volta vazia quando nenhum
    documento passa pelos filtros. Uma consulta roteada para `mapa`, que tem 2 documentos neste
    índice (P11), devolve esses dois.
  - Por isso o fallback não protege de uma escolha errada com confiança alta: quem protege é o
    limiar. Todas as fontes ficam na lista, e quem diz se isso custa caro é o B1.
  - *Descartado:* tirar da lista as fontes com poucos documentos, porque isso depende da máquina e
    seria uma regra sem medida que a sustente.
- **TD-6. Rodapé de uma linha quando o roteador aplicou o filtro.** Sem ele, quem chamou acharia que
  "só há isto" no índice, sem saber que a busca foi restrita. Com ele, a sessão pode repetir a
  consulta com outro `source`. É texto, não `_meta` nem parâmetro, e por isso não leva à Rota
  Completa. Com o roteador desligado, ou quando ele não aplica filtro, o texto é o de hoje.
  - *Descartado:* um campo `roteado` no `_meta`, que é exatamente o que o G1 manda de volta à Rota
    Completa.
  - *Limitação aceita:* com o roteador ligado, quem quer a busca sem filtro não tem como pedir.
    Pedir exigiria um valor novo no enum, e isso é superfície nova. O caminho é tirar `roteador` de
    `BRAIN_JEV`.
- **TD-7. Ao Jev vai a query (cortada em 500 code points), a instrução fixa e a lista estática de
  fontes com uma descrição de cada, e nada do corpus.** É o mínimo que o card permite. O uso
  desligado por padrão e a falta de chave são o freio do G2-B.
- **TD-8. A troca do negativo apodrecido entra aqui como T0 condicional.** Sem ela, o A1 é
  inalcançável (P7), e o portão do CLAUDE.md barra qualquer PR em `brain-mcp/src/`. É a menor
  correção que o procedimento do README prevê ("recolha de novo"), e foi medida (P8). O G2 do #42
  (cofre #1426) confirma que ela fica com o #45.
  - *Descartado:* recolher o golden inteiro com o `colher`, que é o #22 e mudaria o instrumento junto
    com a feature.
  - *Descartado também:* apagar o caso, porque o README conta com um negativo de assunto ausente.
- **TD-9 (emenda). Estado = a query; a lista vai só em `opcoes`.** O `choice` do Jev recebe as
  opções como critérios (adaptador do #42: `criteria: opcoes`). Repetir a lista no estado ou na
  instrução gastaria envio e criaria duas fontes da verdade para a mesma lista. O estado é string
  para que o roteiro do falso do #42 (`quando.pergunta`) possa casar por query, se um oráculo vier a
  ser feito.
  - *Descartado:* estado `{consulta, fontes}`.
  - *Descartado também:* o texto único de `perguntaDoRoteador` da spec original, que existia porque
    o contrato suposto (C2 antigo) só recebia pergunta e lista de strings.
- **TD-10 (emenda). O adaptador acha o cliente pela ordem do C1 a cada chamada e o carrega com
  `createRequire`.**
  - A ordem "repo antes da instalação" é o que faz a suíte da worktree testar o `jev.js` da
    worktree. Era o problema do teste hermético apontado no G3 (cofre #1415).
  - Sem cache próprio, porque o `require` já guarda o módulo.
  - *Descartado:* `import` estático, porque o #42 descartou `src/jev.ts`; e uma env `BRAIN_DIST`,
    descartada pelo #42.
- **TD-11 (emenda). A limpeza do ambiente fica num helper só, `scripts/sem-jev.mjs`, chamado pelos três
  scripts que sobem o servidor.**
  - O C6 manda passar `envSemJev` a todo filho que possa carregar o cliente. Com o roteador, o
    servidor passa a ser um desses filhos.
  - Trocar `process.env` uma vez, antes do primeiro spawn, cobre todos os `...process.env` de hoje
    sem mexer em cada um. É o mesmo gesto do `jev.mjs` do #42.
  - O `concorrencia.mjs` entra porque também sobe o servidor e chama `search_context` (P17), embora
    o despacho só citasse `eval` e `smoke`.
  - Sem cliente achável, o script não mede, em vez de seguir sem limpar. A falha fechada custa pouco:
    na instalação, o `sync` do #42 põe o `jev.js` no lugar.
  - *Descartado:* trocar o `env` em cada spawn, mais diff e fácil de esquecer num spawn novo;
    copiar a lógica de `envSemJev` para o script, que seria o segundo dono de uma regra do
    contrato; e limpar no topo do `eval.mjs`, que mexeria no ambiente de quem só o importa (P19).

### Pontos abertos do G2

- **G2-A (fechado pela emenda).** O contrato do cliente é o do #42 (C1–C6). O `hooks/jev.js` já
  existe na branch do #42 e, lido, confere (P16). Resta que esta worktree ainda não o tem. Quem cobre é o portão de entrada do `## Execution`: o
  `/gm-implement` confere C1–C6 no arquivo da base e sai com `PARADA` se algum divergir.
- **G2-B. Se o aval do Leonardo cobre mandar a query.** O card diz que ainda não foi verificado. Sem
  aval, ninguém põe `roteador` em `BRAIN_JEV` com a chave, e o B1 não roda. Não bloqueia a PR.
- **G2-C. Latência e precisão do Jev.** São números do fornecedor, não verificados. O limiar e o
  teto do TD-3 se calibram no B1. O Jev com instrução e estado em pt-BR é a premissa A6 do #42,
  compartilhada.
- **G2-D. O B1 mede pouco com o golden de hoje.** Só 7 positivos sem `source` têm o alvo neste
  índice (P9), e o teto do ganho é +0,020 de nDCG@5 (P10). Um B1 com código `0` diz "não piorou
  nesses 7 casos", e não "o roteador ajuda". Para medir de verdade, falta recolher o golden (#22).
  Fica registrado, sem bloquear o #45.
- **G2-E (emenda). Objeção a levar à PR do #42: o contrato não diz como um script de medição deixa
  passar a chave quando houver aval.**
  - O C6 manda limpar a chave de todo filho, e o #42 descartou um "modo `--jev-real`", mandando a
    rodada com o Jev real para um card de calibração.
  - O B1 deste card precisa exatamente disso: o eval com o head ligado ao Jev de verdade. A
    calibração do limiar do #42 também.
  - O #45 não contorna: não cria modo com chave no eval. O B1 fica sem comando até o contrato
    definir a regra (sugestão: no card de calibração, para os dois).
  - Não bloqueia a PR, porque o grupo B não bloqueia, pelo card.
- **G2-F. O smoke já sai vermelho na base, por um motivo alheio ao #45** (cofre #1456 e #1457).
  `smoke.mjs:78` pede `feature_timeline('motor-lancamentos-automaticos')`, e o índice vivo não tem
  mais essa feature. O #45 não corrige isso: é fixture do setup, sem card, e a escolha do slug
  substituto vale para o lote todo (decisão do Leonardo). Planejar e implementar seguem; a PR **não
  abre** enquanto o `npm run smoke` não sair `0` com outro card, pela regra 2 da esteira. O
  `/gm-ship` para com `PARADA` nomeando este ponto, e não contorna.

## Coding Standards

- TypeScript `strict`, ESM `NodeNext`, comentários e nomes em pt-BR, como no resto de `src/`.
  Comentário explica o **porquê** (o padrão de `search.ts` e `tools.ts`).
- Nenhuma dependência nova. Nenhum `fetch` fora do cliente do #42. Nenhuma cópia de regra do
  contrato além da leitura de `BRAIN_JEV` em `roteadorLigado`, a mesma que o hook do #42 faz para não
  carregar o `jev.js` à toa.
- `rotear` nunca lança por causa do Jev. Erro de `buscar` continua subindo como hoje.
- `stdout` é o protocolo MCP: log só em `stderr`, e só a linha de boot.
- Scripts: ESM, Node puro, códigos de saída no padrão de `smoke.mjs`/`eval.mjs`.
- Nenhum comentário de `src/roteador.ts` ou de `src/tools.ts` pode conter `fetch(`, `node:http`,
  `undici` ou `XMLHttpRequest`: a regex do `sem-http-proprio` lê o arquivo inteiro.
- Nada além do especificado: sem cache de escolhas, sem várias fontes, sem `repo`/`feature`/`doc_type`
  escolhidos, sem decidir "não precisa do brain" (isso é do #42), sem modo de medição com chave.
