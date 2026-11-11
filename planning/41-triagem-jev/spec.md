# Pré-preencher a classificação da gm-triage com o Jev — Spec

> Profundidade **Lite** (decisão #1389 do cofre): mesmo esqueleto, seções curtas. A rota do card
> continua **Curta**.

> **Revisão do G2 — 2026-11-10.** O primeiro G2 (cofre #1429) foi aprovado contra o *rascunho* do
> contrato do #42. O G2 do #42 (comentário `gm:spec` de 19:46:31Z, commit `4101a72`) mudou três itens
> que esta spec usa: `ligado(env?)` virou `ligado(uso, env?)`; `BRAIN_JEV` virou uma lista de usos, em
> que `1` não liga nada e a triagem liga com `triagem`; `decidir` exige `opcoes.uso`. O `/gm-plan-tasks`
> parou por isso (cofre #1438 e #1441), antes de qualquer task. Depois veio a emenda 1 do #42
> (`fb82444`, só aditiva), que fixou como um script `.mjs` de skill acha o `jev.js`.
>
> Esta revisão muda só o que o contrato tocou, mais o que a crítica e o revisor de IA acharam nas
> mesmas seções: `## References`, `## Execution`, R1, R5, as linhas **(rev)** de `## Premissas
> medidas`, `## Technical Overview`, `### O que esta spec usa do contrato`, `USO`, `sugerir` (passos 1
> e 4, e o `<prazo>` da mensagem de tempo), `principal` (`--estado`), `carregarCliente` (a ordem de
> dois lugares do contrato), `### Teste`, os casos do `## Plano de testes` que usavam `BRAIN_JEV=1` ou
> `CLAUDE_CONFIG_DIR`, mais os casos novos de `jev.js` quebrado e de ordem de resolução,
> `## Migrations & compatibilidade`, `## Rollback`, `## Verificação pós-deploy` e duas decisões
> técnicas. O resto do desenho (#1428) fica como estava.

> **Emenda do G4 — 2026-11-11.** O parecer do `/code-review high` na PR #50 (cofre #1566) achou
> falso negativo na guarda `sensivel` e um `unlink` sem trava. A guarda é o que impede dado de cliente
> ou de paciente de sair para a TypeSafe AI, e o braço direito autorizou a emenda no despacho do
> `/gm-correcao 50` (Leonardo entregou o card: cofre #1371; a emenda: cofre #1591). Muda só isto; o resto do desenho fica
> como estava:
> - **`sensivel`** (achados 2 e 4). O `"número longo"` une dígitos também pela `/` depois de um grupo
>   de 3+ dígitos (CNPJ) e pelo espaço entre grupos de até 5 (CNS, telefone, CPF espaçado). Padrão novo
>   `"telefone"`, para o fixo de 10 dígitos. O `"caminho absoluto"` vale em qualquer raiz com três
>   segmentos ou mais, ou terminando em arquivo com extensão. Padrão novo `"caminho relativo"`: `./`,
>   `../`, ou três segmentos com uma sequência de três letras. Os textos que esta spec já provava
>   passarem continuam passando; na dúvida, a guarda recusa, porque o custo é só a sugestão que não
>   aparece.
> - **`principal`** (achado 1). Só apaga a `--entrada` chamada `gm-triage-jev-<8 hex>.json` e posta
>   direto em `os.tmpdir()`; qualquer outra fica onde está, com aviso no stderr. O Step 4b diz o hex
>   minúsculo e a pasta.
> - **`lerBoard`** (achado 5): o pedaço não precisa terminar no id; um comentário depois dele não tira
>   a opção.
> - **`renderizar`** (achados 6 e 7): o cabeçalho sai de `LIMIAR_PCT` e diz o caso sem proposta; toda
>   célula troca `|` por `\|` e quebra de linha por espaço.
> - **R3** (achado 9): `## Board` presente sem linha de campo legível tem mensagem própria.
> - **`## Verificação pós-deploy`**, item 4: confere que a entrada some da pasta temporária.
>
> As seções abaixo já estão no texto emendado; os commits e a resposta a cada achado estão no
> comentário `gm:correcao` da PR #50.

## References
- Card: [#41](https://github.com/leonardo-amaral-3/claude-brain/issues/41) — repo `leonardo-amaral-3/claude-brain`
- Dependência: [#42](https://github.com/leonardo-amaral-3/claude-brain/issues/42), dono do cliente do Jev e da lista de usos `BRAIN_JEV`.
  Esta spec consome a seção **`### Contrato do cliente do Jev (estável)`** de
  `planning/42-filtro-jev/spec.md` (worktree `~/pessoal/claude-brain-42-filtro-jev`), aprovada no G2 do #42 (comentário `gm:spec` de
  2026-11-10 19:46:31Z, commit `4101a72`) e com a **emenda 1** (commit `fb82444` da
  `feat/42-filtro-jev`, 16:55 -03, só aditiva). Daqui em diante, "o contrato" é essa seção, nesse
  commit.
- A emenda 1 trouxe o que o #41 pedia ao G2 do #42 (cofre #1426: o pedido não tinha entrado):
  - a linha **Skills com script** (`spec.md:131-135` do #42), com a ordem de resolução que
    `carregarCliente` segue e que nomeia o `jev-triagem.mjs` como o caso do passo 1;
  - o silêncio ao carregar o módulo (`:215`);
  - o `timeoutMs` sem teto (`:214`), de que depende o `PRAZO_MS = 10000`.

  O comentário `gm:spec` do #42 ainda não tinha a emenda quando foi lido nesta revisão. Se uma emenda
  seguinte mudar qualquer desses itens, é emenda **desta** spec (`## Execution`).
- Decisões do cofre: #1371 (assuma), #1377 (G1), #1382 (worktree), #1389 (profundidade), #1384 (G1 do #42),
  #1426 (G2 do #42), #1428 (desenho, substituído pelo #1459), #1429 (primeiro G2, substituído pelo
  #1460), #1438 e #1441 (a parada do G3), #1459 (desenho revisto), #1460 (G2 revisto)
- PRD: não há

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir: a worktree `~/pessoal/claude-brain-41-triagem-jev`)
- Feature branch: `feat/41-triagem-jev` (já existe, saída de `origin/dev` `3c3b92c`)
- **Base: a branch do #42 (`feat/42-filtro-jev`).** O braço direito faz o rebase de
  `feat/41-triagem-jev` sobre ela. Antes disso, nenhuma task deste card é implementada (cofre #1371):
  os testes de integração precisam do `hooks/jev.js`, que nasce lá. Em 2026-11-10 ele já existe na
  `feat/42-filtro-jev`: commit `14fee0c` (task 1 do #42), que é também a ponta do remoto. A ponta local
  é `ffcc917` (task 2). Quem implementa é o `/gm-implement`, depois do rebase.
- PR: contra `dev` se a PR do #42 já tiver entrado nela; senão, contra `feat/42-filtro-jev`. Quem
  escolhe é o braço direito.
- **O #41 não cria cliente do Jev nem altera `hooks/jev.js`.** Ele o carrega pelo caminho do contrato
  e usa só `ligado` e `decidir` no script, mais `envSemJev` no teste. **Se uma emenda do #42 mudar
  qualquer item do contrato que esta spec usa (lista em `### O que esta spec usa do contrato`), a
  implementação do #41 para: é emenda desta spec, não ajuste do implementador.** O mesmo vale se o
  `hooks/jev.js` do #42 divergir do contrato num desses itens.
- Portão do `/gm-ship` (precondição 4): `node scripts/skills-comum.mjs --check` (item 3 de
  `## A esteira` do `CLAUDE.md` do repo) **e** `node scripts/gm-triage-jev-teste.mjs`. Código `1`
  em qualquer um é vermelho. Nada vai para `brain-mcp/src/`, então `npm run smoke` e
  `npm run eval` não entram. Se uma task puser código lá, é desvio da spec.

## Requisitos & critérios de aceite

R1–R4 são os critérios do card. R5 depende do aval de Leonardo.

**R1 — Jev desligado é a triagem de hoje.**
Dado qualquer um destes, quando a `/gm-triage` roda:
- o uso `triagem` fora da lista `BRAIN_JEV`: ausente, `1` (que pelo contrato não liga nada) ou só
  outros usos, como `contexto`;
- `triagem` na lista, mas sem `TYPESAFE_API_KEY` e sem `BRAIN_JEV_FALSO`;
- sem o `hooks/jev.js` no lugar em que a skill o procura, ou com ele quebrado;
- a chamada do script negada pelo modo de permissão.

Então:
- a proposta do Step 5 é a de hoje, com os mesmos quatro campos gravados e o mesmo ponto de decisão;
- não entra nenhuma linha nova na mensagem;
- nenhuma chamada de rede sai da máquina, e nenhum resumo é escrito.

A única diferença é uma chamada local, `jev-triagem.mjs --estado`. Ela não escreve nada no stdout, escreve
uma linha de diagnóstico no stderr (`jev-triagem: …`, que a ferramenta Bash mostra à sessão e que a
skill manda ignorar) e sai com código 0.
Em sessão interativa sem regra `allow` para ela, essa chamada pode pedir permissão, conforme o modo
de permissão da sessão. Isso é aceito,
porque não é ponto de decisão da triagem (ver `## Verificação pós-deploy`, item 5).

**R2 — Jev ligado: os cinco campos com probabilidade, e a marca no fraco.**
Dado o Jev ligado (no teste, o cliente falso), quando a triagem chega ao Step 5, então a mensagem traz,
logo depois dos valores da sessão, uma tabela com os cinco campos (Tipo, Severidade, Classe, Rota,
Módulo). Cada campo mostra:
- o valor proposto pela sessão;
- a probabilidade que o Jev dá a esse valor, em porcentagem inteira;
- a escolha do Jev, quando ela é outra.

A Rota, que a sessão só propõe no S1, mostra a escolha do Jev e a probabilidade dela. Campo com
probabilidade abaixo de 70% vem marcado `⚠ revisar`.

Dado que o Jev volta `indisponivel`, responde fora do formato ou passa do prazo de 10 s, então não sai
tabela. A mensagem traz uma linha dizendo que a triagem ficou sem a sugestão e por quê, e o resto segue
como hoje.

Em nenhum caso o board é gravado antes do ponto de decisão. Nenhuma sugestão do Jev é gravada: o
board e o corpo do card recebem o que a sessão propôs e o ponto de decisão aprovou.

**R3 — As opções vêm do `## Board`.**
As opções enviadas ao Jev, campo a campo, são as lidas da seção `## Board` do `CLAUDE.md` em que a
triagem grava o card, e não de lista escrita na skill. No `claude-brain`, o Módulo enviado é
exatamente `brain-mcp`, `hooks`, `skills`, `docs`.

**R4 — Blocos comuns intactos.** `node scripts/skills-comum.mjs --check` sai com código 0.

**R5 — Medição com a API real. Depende do aval de Leonardo e não é verificado pela PR.**

O aval precisa citar o uso **`triagem`**, isto é, o envio dos resumos de triagem. Pelo contrato,
cada uso liga sozinho: com o aval, liga-se a triagem acrescentando `triagem` a `BRAIN_JEV`, com a
chave no ambiente do processo `claude`. Isso não liga o hook do #42 nem os irmãos, e um aval do
`contexto` não liga a triagem. Por isso o aval pode cobrir só a triagem.

Com o aval, as próximas 10 triagens no board do `claude-brain` guardam a tabela do Step 5 em
`planning/41-triagem-jev/medicao.md`: uma seção por card, colada na hora. Depois do G1 de cada card,
compara-se a tabela com os valores finais do board:
- acerto do Jev por campo;
- quantos campos corrigidos (na triagem ou no G1) vieram marcados;
- a latência, pela linha `jev-triagem: <n> ms` do stderr, que aparece na saída da ferramenta Bash e
  que quem cola a tabela no `medicao.md` copia junto.

A Rota é contada à parte, porque a pergunta usa a regra genérica do `gm-card`, e o `claude-brain`
inverte o padrão (`CLAUDE.md`, `## A esteira`, item 1).

O resultado vai na PR do trem. Sem o aval, a release segue o delta 1 do workspace e sai registrada na
PR do trem com o motivo.

## Premissas medidas

Todas rodadas em 2026-11-10, worktree em `3c3b92c` (= `origin/dev`), worktree do #42 lida sem
escrever. As linhas marcadas **(rev)** foram medidas na revisão do G2. As outras vêm do primeiro G2;
na revisão, `git status` mostrou a worktree ainda em `3c3b92c`, só com `planning/41-triagem-jev/` novo.
Os arquivos que elas citam não mudaram.

| Premissa | Como foi medida | Resultado |
|---|---|---|
| **(rev)** O contrato do #42 passou pelo G2 e ganhou a emenda 1, e é essa versão que esta spec consome | `gh api …/issues/42/comments` (comentário `gm:spec`); `diff` dele contra o arquivo; `git log` da worktree do #42; `git diff 4101a72 fb82444 -- planning/42-filtro-jev/spec.md`; `git ls-remote --heads origin feat/42-filtro-jev` | `gm:spec` 6777528040 de 19:46:31Z, igual ao arquivo do `4101a72`. Depois: `cc510cc` (tasks), `fb82444` (emenda 1: aviso em `:119`, **Skills com script** em `:131-135`, `timeoutMs` sem teto em `:214`, silêncio ao carregar em `:215`, A7 em `:100`), `14fee0c` (`hooks/jev.js`, = remoto), `ffcc917` (task 2, só local). Decisão do G2 do #42: cofre #1426 |
| **(rev)** O contrato oferece escolha de lista com probabilidade por opção, numa requisição, sem rejeitar | leitura de `### Contrato do cliente do Jev (estável)`, *Tipos* e *Funções exportadas* | `decidir(estado, perguntas, opcoes)`; `Pergunta` `{tipo:'escolha', instrucao, opcoes: Record<nome, descrição>}` de 1 a 255; `RespostaEscolha` `{estado:'ok', tipo:'escolha', escolha, confianca, probabilidades}`, com `probabilidades` nas chaves de `opcoes`; `Indisponivel` `{estado:'indisponivel', motivo, detalhe?}`, com `detalhe` sem chave nem corpo; uma requisição; nunca rejeita; resolve em até `timeoutMs` + 50 ms; não escreve em stdout/stderr |
| **(rev)** Como o contrato liga um uso, e o que `decidir` exige | mesma seção, *Usos*, *Ambiente*, *Ordem de decisão*, `Opcoes` | `ligado(uso, env?)`: `true` sse o uso está na tabela **e** em `BRAIN_JEV` **e** (`BRAIN_JEV_FALSO !== undefined` ou `TYPESAFE_API_KEY` não vazia), sem I/O. `BRAIN_JEV` é lista separada por vírgula, com `trim()` e minúsculas; `1`, `*` e `todos` não ligam nada. O uso `triagem` é do #41. `Opcoes.uso` é obrigatório: uso fora da tabela → `entrada_invalida` em todas as chaves; uso fora de `BRAIN_JEV` → `desligado` |
| **(rev)** Onde o contrato manda um script `.mjs` de skill achar o `jev.js` | `planning/42-filtro-jev/spec.md:131-135` no `fb82444` | 1. `join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'hooks', 'jev.js')`, se existir; 2. senão, `<CLAUDE_HOME>/hooks/jev.js`, com `CLAUDE_HOME = $CLAUDE_CONFIG_DIR \|\| ~/.claude`; `createRequire` em `try`; falha ao carregar vale desligado. Resolver só o passo 2 também cumpre; o passo 1 é "o que permite medir na worktree sem instalar (ex.: `skills/gm-triage/jev-triagem.mjs` do #41)" |
| **(rev)** De `skills/gm-triage/`, `../../hooks/jev.js` é o `hooks/jev.js` do repo, da worktree e da instalação | `sync.sh:32` (`CLAUDE_HOME=…`), `:81-83` (skills → `$CLAUDE_HOME/skills/<nome>`), `:87-88` (hooks → `$CLAUDE_HOME/hooks`); `node -e` com `path.join` | as duas pastas saem do mesmo `CLAUDE_HOME`. `join("/home/leo/.claude/skills/gm-triage","..","..","hooks","jev.js")` = `/home/leo/.claude/hooks/jev.js` |
| **(rev)** O falso por roteiro cobre os casos de ponta a ponta sem rede, e o cliente do `14fee0c` faz o que o contrato diz | contrato, *Cliente falso*; `hooks/jev.js` do `14fee0c`: `:128-133` (`ligado`), `:112-116` (lista com `trim` e minúsculas), `:140-147` (`envSemJev`), `:150-155` (barreira do uso), `:167-172` (resto dividido igual), `:214-229` (roteiro), `:233-237` (`lento`), `:389-404` (falso antes da chave), `:60` (o único `require` é `fs`) | confiança omitida vale 0,95; o resto é `(1 − confiança)/(n − 1)`; sem regra vale o `padrao`; sem `padrao`, `{motivo:'resposta_invalida', detalhe:'roteiro'}`; `{indisponivel:<Motivo>}` volta com `detalhe:'falso'`; `lento` espera o `timeoutMs` e dá `timeout`/`falso`; com `BRAIN_JEV_FALSO` definida, `decidir` responde sem olhar a chave |
| **(rev)** As porcentagens do caso de ponta a ponta | `node -e` com `Math.floor(p * 100 + 1e-9)` | 0,95 → 95; (1 − 0,75)/2 = 0,125 → 12; 0,75 → 75; 0,9 → 90; 0,71 → 71; 0,64 → 64 |
| **(rev)** Os rótulos do `## Board` do repo não levam U+FE0F, então o roteiro e as linhas esperadas do caso de ponta a ponta podem ser escritos com o emoji simples | `grep -o '⚪[^ ]* Padrão' CLAUDE.md \| od -c`; o mesmo para `✨ Melhoria` com `od -tx1` | `⚪` = `342 232 252` (U+26AA) e `✨` = `e2 9c a8` (U+2728), cada um seguido direto do espaço |
| **(rev)** Não há chave nem flag nesta máquina | `env \| grep -E '^(BRAIN_\|TYPESAFE)'` | vazio |
| O `## Board` declara os cinco campos numa linha cada, no formato `- **<Campo>** field \`<id>\`: <rótulo>=\`<id>\` · …` | `awk '/^## Board/…'` no `CLAUDE.md` do repo e no `~/notoria/CLAUDE.md`; leitura do `~/pessoal/CLAUDE.md` | Formato igual nos três, com LF. Status ocupa duas linhas e não é lido. Módulo: `brain-mcp · hooks · skills · docs` no repo, seis opções na Notoria, só `Comum` no `pessoal` |
| A skill hoje classifica na sessão, grava quatro campos e só toca a Rota no S1 | leitura de `skills/gm-triage/SKILL.md` | Step 3 em `:135-152` (Módulo da Notoria em `:152`); Step 5 em `:202-227`, com os quatro campos em `:217-224` e Rota=Hotfix só no S1 em `:227`; épico com a maior Severidade em `:120`. As referências do card conferem |
| A pasta inteira da skill é instalada | `sync.sh:78-83` | Par `skills/<nome>` sem lista: "Sem a lista, a subarvore inteira entra" |
| O carimbo dos blocos comuns só lê `SKILL.md` | `scripts/skills-comum.mjs:103`; `node scripts/skills-comum.mjs --check` (rodado de novo na revisão) | Só `skills/<nome>/SKILL.md`; `--check` sai 0, com "11 skills × 3 blocos iguais à fonte" |
| Uma sessão despachada (`claude -p`) recebe a pasta instalada da skill | esta sessão roda por `d.sh` (`claude -p … --permission-mode auto --permission-prompts none`), e o texto da skill carregada começa com "Base directory for this skill: /home/leo/.claude/skills/gm-spec" | confirmado |
| **(rev)** Não há regra `allow` para `node` no `settings.json` do usuário | `jq '.permissions' ~/.claude/settings.json`; `jq 'keys'`; `ls ~/.claude/settings.local.json` | `null`; chaves `autoMode, hooks, modelSettings, skipDangerousModePermissionPrompt, theme`; sem `settings.local.json`. Sem regra `allow`, quem decide a chamada é o modo de permissão da sessão (R1) |
| `node` existe; teste do repo é script avulso | `node --version`; `ls` da raiz (sem `package.json`); `scripts/skills-comum-teste.mjs:1-4` | v26.12.0; teste roda com `node scripts/<nome>-teste.mjs` e sai 0 ou 1 |
| Ponto flutuante: `Math.floor(p * 100)` erra para baixo | `node -e` com 0,29 e 0,57 | 28 e 56. Com `+ 1e-9`, 29 e 57 |

## Technical Overview

A skill continua classificando como hoje (Step 3). Um passo novo, o **Step 4b**, roda em duas fases:
1. `jev-triagem.mjs --estado` pergunta ao contrato, sem rede, se o uso `triagem` está ligado.
   Desligado, ou chamada negada, encerra o passo em silêncio.
2. Ligado, a sessão escreve um arquivo de entrada (o resumo sem dado sensível e os valores que ela
   propõe). O script lê as opções do `## Board`, faz **uma** chamada `decidir` com uma pergunta
   `escolha` por campo e imprime a tabela. A sessão cola a tabela no Step 5.

O ponto de decisão, os campos gravados e os comandos de gravação não mudam. O script só usa `ligado`
e `decidir` do contrato, sempre com o uso `triagem`. O teste injeta um cliente falso com a mesma forma e, nos casos de ponta a
ponta, usa o `hooks/jev.js` do #42 com o falso dele por roteiro, sem rede.

## Implementation Details

### O que esta spec usa do contrato
Só isto. Se uma emenda do #42 mudar qualquer item, é emenda desta spec (`## Execution`):
- o arquivo `hooks/jev.js` (CJS), instalado em `<CLAUDE_HOME>/hooks/jev.js`;
- **a linha *Skills com script* (emenda 1): `createRequire(import.meta.url)` dentro de `try`, pela
  ordem `join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'hooks', 'jev.js')`, se existir, e
  senão `<CLAUDE_HOME>/hooks/jev.js`; falha ao carregar vale desligado.** De `skills/<skill>/`, o
  primeiro caminho é o `hooks/jev.js` do repo, da worktree e da instalação (`## Premissas medidas`).
  Usar a função, e não a CLI, evita `child_process` e um segundo processo;
- carregar o módulo não escreve nada em stdout nem em stderr (emenda 1), de que depende o stderr exato
  dos casos do R1;
- o `timeoutMs` sem teto (emenda 1), de que depende o `PRAZO_MS = 10000`;
- a tabela de usos, com `triagem` para o #41, e `BRAIN_JEV` como lista de usos sem curinga;
- `ligado(uso, env?) → boolean`, sem I/O;
- `decidir(estado, perguntas, { uso, timeoutMs }) → Promise<Record<id, RespostaEscolha | Indisponivel>>`,
  com `uso` obrigatório. Nunca rejeita, resolve em até `timeoutMs` + 50 ms e devolve exatamente as
  chaves de `perguntas`;
- `Pergunta` `{ tipo: 'escolha', instrucao, opcoes: Record<nome, descrição> }`, e
  `RespostaEscolha.escolha` / `.probabilidades`;
- `Indisponivel.motivo` / `.detalhe`, com `detalhe` sem chave nem corpo;
- `envSemJev(env)`, só no teste: a env de todo processo filho;
- o falso: `BRAIN_JEV_FALSO` definida nunca vai à rede; os valores `sim` e `lento`; o roteiro, com
  regra `{ quando: { id }, responde: { escolha, confianca? } }` ou `{ indisponivel: <Motivo> }`, o
  `padrao` e as regras de *Cliente falso* (confiança omitida vale 0,95, o resto se divide igual; sem
  regra vale o `padrao`; sem `padrao`, `resposta_invalida`).

### Script: `skills/gm-triage/jev-triagem.mjs`

ESM, só módulos `node:` embutidos. Não importa `node:child_process`, `node:http`, `node:https`,
`node:net` nem `node:tls`, e não chama `fetch`: a rede, quando existe, é do `hooks/jev.js`. Exporta:

```js
export const USO = "triagem";       // o uso do #41 na tabela de usos do contrato
export const CAMPOS = ["Tipo", "Severidade", "Classe", "Rota", "Módulo"];
export const LIMIAR_PCT = 70;      // porcentagem inteira < 70 → revisar
export const PRAZO_MS = 10000;     // timeoutMs passado ao decidir
export const FOLGA_MS = 1000;      // guarda do próprio script sobre o decidir
export const MAX_RESUMO = 800;     // pontos de código ([...s].length), depois do trim

// Condensam o Step 3 da SKILL.md e a regra de rota do gm-card (skills/gm-card/SKILL.md:128).
// Mudou um critério lá? Mude aqui.
export const INSTRUCOES = {
  Tipo: "Qual o tipo desta demanda?",
  Severidade: "Qual a severidade desta demanda?",
  Classe: "Qual a classe de serviço desta demanda?",
  Rota: "Qual rota de desenvolvimento cabe nesta demanda?",
  "Módulo": "A que módulo do sistema esta demanda pertence?",
};
export const DESCRICOES = {   // chave = rótulo do ## Board sem o prefixo não alfanumérico
  Tipo: {
    "Bug": "o sistema faz o errado, quebra ou corrompe dado",
    "Dúvida": "a pergunta é como algo funciona hoje; a entrega é a resposta com evidência",
    "Melhoria": "o sistema faz o certo, mas deveria fazer mais ou melhor",
    "Débito técnico": "sem efeito visível para o usuário, mas o custo de mudar a área subiu",
  },
  Severidade: {
    "S1": "parado ou dado corrompido em produção, sem workaround, ou o workaround é reparar dado à mão",
    "S2": "resultado errado ou fluxo travado, com workaround praticável",
    "S3": "incômodo, cosmético, ou dor sem prazo",
  },
  Classe: {
    "Expedite": "S1 real",
    "Data fixa": "há prazo externo",
    "Padrão": "o caso comum, sem prazo externo",
    "Intangível": "débito técnico sem dor externa hoje",
  },
  Rota: {
    "Hotfix": "S1 em produção",
    "Curta": "não muda contrato de API, schema nem regra de negócio; diff pequeno; reverte trivialmente",
    "Completa": "todo o resto",
  },
};
```

A descrição de um rótulo é `DESCRICOES[campo]?.[semPrefixo(rótulo)] ?? rótulo`, com
`semPrefixo = r => r.replace(/^[^\p{L}\p{N}]+/u, "")`. O Módulo usa sempre o próprio rótulo.

**`normalizar(texto)`** — tira o BOM inicial, troca `\r\n` e `\r` por `\n`, aplica `normalize("NFC")`.

**`lerBoard(texto): Map<string, string[]>`** — sobre `normalizar(texto)`, recorta do texto o trecho
entre a linha exatamente `## Board` e a próxima linha que começa com `## `. Para cada nome de
`CAMPOS`, procura a linha que casa `^- \*\*<nome>\*\* field \`[^\`]+\`:\s*(.+)$`, quebra o resto em
` · ` e, de cada pedaço que casa `^(.+?)=\`[^\`]+\`` (o que vier depois do id é ignorado: emenda do G4),
guarda o rótulo (`trim`). Fica fora do mapa o
campo sem linha, ou com linha sem nenhum rótulo. O rótulo é guardado como está no `## Board`, com o
emoji (`🐞 Bug`), e é ele que vai ao Jev como nome da opção.

**`sensivel(resumo): string | null`** — devolve o nome do primeiro padrão que casar, ou `null`. A
guarda é grosseira de propósito: ela não substitui a regra do Step 4b, só segura o deslize óbvio.
- `"e-mail"`: `/[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/`. Não casa `better-sqlite3@11.5.0`.
- `"URL"`: `/\bhttps?:\/\/|\bwww\./i`
- `"caminho absoluto"` (emenda do G4): `~/`, as raízes `home|Users|tmp|var|etc|opt|mnt|srv|root`,
  o drive do Windows (`\b[A-Za-z]:[\\\/]`) e, em qualquer raiz, três segmentos ou mais
  (`/<a>/<b>/…`) ou um arquivo com extensão (`/dados/aih.csv`). Rota de API (`/api/aih`) e nome de
  skill (`/gm-triage/jev`) **não** contam como caminho: são vocabulário do sistema, não da máquina de
  alguém.
- `"caminho relativo"` (emenda do G4): `./` e `../`, e três segmentos ou mais com uma sequência de três
  letras em algum deles (`logs/<pasta>/erro.txt`). Um arquivo do repo com uma barra só
  (`hooks/brain-contexto.js`) e o período `10/2026-11/2026` passam.
- `"telefone"` (emenda do G4): `(?:\(\d{2}\)|\b\d{2})\s?\d{4,5}-\d{4}\b`, DDD e número com hífen,
  para o fixo de 10 dígitos que o número longo não alcança.
- `"número longo"`: onze dígitos ou mais, como CPF, CNPJ, CNS e AIH. Entre eles valem `.`, `-`, `(`,
  `)` (até dois) e, desde a emenda do G4, a `/` depois de um grupo de 3+ dígitos
  (`12.345.678/0001-90`, e não `MM/AAAA`) e o espaço, com `)` antes ou `(` depois, entre grupos de até
  5 dígitos (`123 4567 8901 2345`, `(11) 98765-4321`). Competências (`202610 202611`, grupos de 6) e
  períodos (`10/2026-11/2026`) continuam passando.
- `"stack trace"`: `/\bat \S+ ?\(?[^()\s]+:\d+(?::\d+)?\)?|Traceback \(most recent call last\)/`

**`sugerir({ opcoes, entrada, cliente, prazoMs = PRAZO_MS, folgaMs = FOLGA_MS })`**. `entrada` é
`{ resumo: string, proposta: { [campo]: string | null } }`. Devolve um de:

```js
{ estado: "desligado" }
{ estado: "falhou", motivo: string }
{ estado: "ligado", ms: number, campos: Array<{
    campo: string,
    proposta: string | null,        // valor da sessão (null = sessão não propôs)
    pProposta: number | null,       // % inteira que o Jev dá à proposta
    escolha: string | null,         // escolha do Jev
    pEscolha: number | null,        // % inteira da escolha
    revisar: boolean,
    nota: null | "única opção" | "não declarado no ## Board" | "proposta fora do ## Board",
}> }                                // sempre os cinco, na ordem de CAMPOS
```

Passos, em ordem:
1. Se `cliente` é nulo, ou `cliente.ligado(USO, process.env)` não é `true`, ou lança → `desligado`.
   Nenhuma outra chamada é feita.
2. `resumo = String(entrada?.resumo ?? "").trim()`. Vazio → `falhou` com motivo
   `"o resumo para o Jev veio vazio"`. Mais de `MAX_RESUMO` pontos de código → `falhou` com motivo
   `"o resumo para o Jev passou de 800 caracteres"`. `sensivel(resumo)` não nulo → `falhou` com motivo
   `"o resumo parece ter <padrão>; nada foi enviado"`. Nesses três casos, `decidir` não é chamado.
3. Para cada campo de `CAMPOS`, `proposta = entrada.proposta?.[campo] ?? null`. Se a proposta não é
   igual a nenhum rótulo do campo, compara `chave(x) = semPrefixo(String(x).normalize("NFC")
   .replace(/\uFE0F/g, "").trim()).toLowerCase()` dos dois lados. Achou um só rótulo → a proposta passa
   a ser esse rótulo. Assim `"Melhoria"` e `"⚪️ Padrão"` (com U+FE0F) casam com `✨ Melhoria` e
   `⚪ Padrão`. Daí em diante, "proposta entre as opções" é igualdade exata:
   - campo fora do mapa → `nota: "não declarado no ## Board"`, tudo mais `null`, `revisar: false`;
   - uma opção só → sem pergunta, com `escolha` = essa opção, `pEscolha: 100` e
     `nota: "única opção"`. Proposta igual a ela, ou `null`: `pProposta` 100 (ou `null`) e
     `revisar: false`. Proposta diferente: `nota: "proposta fora do ## Board"`, `pProposta: null` e
     `revisar: true`;
   - duas ou mais → entra em `perguntas[campo] = { tipo: "escolha", instrucao: INSTRUCOES[campo],
     opcoes: { [rótulo]: descrição } }`.
4. Se `perguntas` tem chaves, faz uma chamada só: `cliente.decidir(resumo, perguntas, { uso: USO,
   timeoutMs: prazoMs })`, em `Promise.race` com um temporizador de `prazoMs + folgaMs`. Ao fim, `clearTimeout`.
   `ms = Math.round(performance.now() - início)` em volta dessa chamada; sem chamada, `ms = 0`. O
   `ms` vai no resultado `ligado` e também no `falhou` que acontece daqui em diante. Saídas para
   `falhou`:
   - o temporizador venceu → motivo `"o Jev não respondeu em <prazo> s"`. O `<prazo>` é `prazoMs`
     (o `timeoutMs` dado ao Jev), e não `prazoMs + folgaMs`, em segundos: inteiro quando for inteiro,
     senão com `toLocaleString("pt-BR")`;
   - `decidir` lançou → motivo `"o cliente do Jev falhou: <msg>"`, com
     `msg = String(e?.message ?? e).split("\n")[0].slice(0, 120)`;
   - resultado `null`, que não é objeto, ou sem nenhuma das chaves perguntadas (o `{}` que o contrato
     devolve em entrada inválida) →
     `"resposta inválida do Jev no campo <primeiro campo perguntado, na ordem de CAMPOS>"`;
   - senão, varre os campos perguntados na ordem de `CAMPOS`, e **o primeiro problema decide**:
     - chave com `estado: "indisponivel"` → motivo `"o Jev ficou indisponível (<motivo>[: <detalhe>])"`,
       com o `detalhe` cortado em 60 caracteres;
     - chave ausente, `estado` que não é `"ok"`, `escolha` fora das opções enviadas, `probabilidades`
       que não é objeto, ou `probabilidades[escolha]` (ou `probabilidades[proposta]`, com proposta
       entre as opções) que não é número finito com 0 ≤ p ≤ 1 → motivo
       `"resposta inválida do Jev no campo <campo>"`.

   É tudo ou nada: qualquer uma dessas falhas derruba a tabela inteira.
5. Para cada campo perguntado: `pct = p => Math.floor(p * 100 + 1e-9)`; `escolha` e
   `pEscolha = pct(probabilidades[escolha])`.
   - Com proposta entre as opções: `pProposta = pct(probabilidades[proposta])` e
     `revisar = pProposta < LIMIAR_PCT`.
   - Proposta fora das opções: `nota: "proposta fora do ## Board"`, `pProposta: null`, `revisar: true`.
   - Proposta `null` (a Rota fora do S1): `revisar = pEscolha < LIMIAR_PCT`.

   A marca é calculada sobre a porcentagem já arredondada, para não aparecer "70% ⚠ revisar".

**`renderizar(resultado): string`**:
- `desligado` → `""`.
- `falhou` → `Sem a sugestão do Jev: <motivo>. A classificação acima é só a da sessão.`
- `ligado` → exatamente este formato. A coluna "Escolha do Jev" mostra `=` quando a escolha é a
  proposta, e `<escolha> (<pEscolha>%)` quando é outra:

```markdown
**Sugestão do Jev** — só leitura, nada disto é gravado. `⚠ revisar` = o Jev dá menos de 70% ao valor proposto, ou à escolha dele quando não há proposta.

| Campo | Proposta da sessão | Jev nela | Escolha do Jev | |
|---|---|---|---|---|
| Tipo | ✨ Melhoria | 82% | = | |
| Severidade | S3 | 20% | S2 (75%) | ⚠ revisar |
| Classe | ⚪ Padrão | 90% | = | |
| Rota | — | — | Curta (71%) | |
| Módulo | skills | 64% | = | ⚠ revisar |
```

- Linhas especiais:
  - única opção: `| Módulo | Comum | 100% (única opção) | = | |`; sem proposta:
    `| <campo> | — | — | <opção> (100%) | |`;
  - não declarado: `| <campo> | — | — | — | não declarado no \`## Board\` |`;
  - proposta fora: `| <campo> | <proposta> | — | <escolha> (<p>%) | ⚠ revisar (proposta fora do \`## Board\`) |`.
- Proposta `null` aparece como `—`.
- O `70` do cabeçalho é o `LIMIAR_PCT`, e toda célula troca `|` por `\|` e quebra de linha por
  espaço: a proposta é texto livre (emenda do G4).

**`principal(argv, { carregar = carregarCliente, stdout = process.stdout, stderr = process.stderr })`
→ `Promise<number>`** (código de saída). **O `argv` é validado antes de qualquer outra coisa:** são
válidos só `["--estado"]` e `--claude-md <a> --entrada <b>`, em qualquer ordem e sem nada a mais.
Qualquer outro `argv` → uso no stderr, código 2, em qualquer estado do Jev, sem chamar `carregar`.
Usos:
- `--estado`:
  - `{ cliente, motivo } = carregar()`;
  - ligado (`cliente?.ligado(USO, process.env) === true`, em `try`) → stdout `ligado\n`;
  - desligado → nada no stdout, e no stderr `jev-triagem: cliente carregado, desligado` ou
    `jev-triagem: cliente indisponível: <motivo>`;
  - código 0.
- `--claude-md <arquivo> --entrada <arquivo>`:
  0. **Só a entrada do Step 4b é apagada** (emenda do G4): o nome casa
     `^gm-triage-jev-[0-9a-f]{8}\.json$` e a pasta, pelo `realpath`, é a de `os.tmpdir()`. Qualquer
     outra `--entrada` (argumentos trocados, caminho errado) fica onde está, e o stderr recebe
     `jev-triagem: não apaguei <nome>: só apago gm-triage-jev-<8 hex>.json da pasta temporária`.
     "Apagar", nos passos abaixo, é sempre sob esta regra.
  1. Sem cliente ligado → nada no stdout, o mesmo diagnóstico no stderr, código 0. A `--entrada` é
     apagada se existir (`unlinkSync` em `try`, erro ignorado), **sem ser lida**. O `--claude-md` não
     é tocado.
  2. Ligado: lê a `--entrada` **primeiro** e a apaga num `finally`, leia ou não. Só então lê o
     `--claude-md`. Arquivo ilegível ou JSON inválido → `falhou` com motivo
     `"não consegui ler <nome do arquivo>"`.
  3. `lerBoard` vazio → `falhou` com motivo `"não achei o ## Board em <nome do arquivo>"`, ou, com a
     linha `## Board` presente, `"achei o ## Board em <nome do arquivo>, mas nenhuma linha de campo"`
     (emenda do G4).
  4. Em seguida, `sugerir` e `renderizar`. O texto vai no stdout com `\n` final, quando não vazio.
  5. Quando o resultado traz `ms`, o stderr recebe `jev-triagem: <ms> ms`. Falha anterior a `sugerir`
     não imprime essa linha. Código 0.

**`carregarCliente()` → `{ cliente: object | null, motivo: string | null }`.** Segue a ordem de
resolução do contrato para script `.mjs` de skill (emenda 1, `spec.md:131-135` do #42):
1. `LOCAL = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks", "jev.js")`. É o
   `hooks/jev.js` do repo e da worktree; na instalação, é o mesmo `<CLAUDE_HOME>/hooks/jev.js`.
2. Se `existsSync(LOCAL)` é falso: `INSTALADO = join(CLAUDE_HOME, "hooks", "jev.js")`, com
   `CLAUDE_HOME = process.env.CLAUDE_CONFIG_DIR || join(os.homedir(), ".claude")`, lido na chamada.

O caminho escolhido é o primeiro que existe. Nenhum existe → `{ cliente: null, motivo: "jev.js não
instalado" }`, sem chamar o `require`. Existe → `createRequire(import.meta.url)(<caminho>)` em `try`,
e devolve `{ cliente: <módulo>, motivo: null }`. Um `require` com erro no caminho escolhido **não**
tenta o outro: devolve `{ cliente: null, motivo: <primeira linha da mensagem, 120 caracteres> }`. O
`carregar` de `principal` tem a mesma forma. O motivo vai ao diagnóstico do stderr, nunca ao stdout.
É o que mantém o R1 mesmo com instalação quebrada.

**Bloco de execução** — só quando o arquivo é o `process.argv[1]`: `process.argv[1]` existe e
`realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])`, dentro de um
`try` que dá `false` se algum `realpathSync` lançar. Assim o módulo pode ser importado pelo teste ou
por `node -e`. Faz `principal(process.argv.slice(2)).then(sair, e => { stderr.write("jev-triagem:
erro interno: " + <primeira linha de e> + "\n"); sair(1); })`. A saída passa toda por um ponto só:
`sair(codigo)` = `process.stdout.write("", () => process.exit(codigo))`, depois de tudo escrito. O
`exit` no callback não corta o stdout que vai por pipe, e não deixa um handle aberto do cliente
segurar o processo.

### Skill: `skills/gm-triage/SKILL.md`

Uma seção nova entre o Step 4 e o Step 5, e duas frases no Step 5. Nenhuma outra linha muda: o
Step 3 (com a lista de Módulo de `:152`), os comandos de gravação e os blocos comuns ficam como estão.
Texto da seção nova, em inglês como o resto das instruções:

```markdown
## Step 4b — Sugestão do Jev (só quando o Jev do brain está ligado)

The Jev is a decision model that only picks among closed options. Here it **suggests**: it never
decides and never writes. Your Step 3 classification stays the proposal. Do not change it because of
the suggestion; a divergence stays visible in the table for whoever confirms.

`<dir>` below is this skill's base directory; if it was not given, `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/gm-triage`.

1. Run `node "<dir>/jev-triagem.mjs" --estado` (Bash `timeout` 30000). Empty stdout, a non-zero
   exit, or the call denied → the Jev is off: **say nothing about it**, skip to Step 5, which stays
   exactly as before. Stdout `ligado` → go on.
2. With `Write`, create `gm-triage-jev-<8 random lowercase hex>.json` directly in the system temp dir
   (`$TMPDIR`, else `/tmp`):
   `{"resumo": "...", "proposta": {"Tipo": "...", "Severidade": "...", "Classe": "...", "Rota": null, "Módulo": "..."}}`.
   - `proposta`: your Step 3 values, written exactly as the option labels of the `## Board`
     (`"✨ Melhoria"`). `Rota` is `null` unless S1, then `"Hotfix"`.
   - `Write` denied → skip to Step 5 with the line `Sem a sugestão do Jev: o script auxiliar falhou.`
   - `resumo`: up to 800 characters in pt-BR — the draft title, what arrived and its effect, in
     terms of the system. Never in it: names of people, institutions or clients; patient data;
     document numbers of any kind; e-mail, phone, URL or path; any excerpt of log or stack trace
     (only the kind of error, e.g. "timeout na exportação"). In doubt about a piece, leave it out.
     An épico's resumo cites its most severe point, and its proposed Severidade is that point's
     (Step 1b).
3. Run `node "<dir>/jev-triagem.mjs" --claude-md "<the CLAUDE.md whose ## Board you will write the
   card on>" --entrada "<that file>"` (Bash `timeout` 30000). The script deletes the file after
   reading it — only a file named like that, directly in its temp dir; any other `--entrada` stays
   where it is, and stderr says so. Exit 0 → its stdout goes into Step 5 verbatim (it may be one
   line saying the suggestion is missing, and why). Any other exit, or the call denied → Step 5
   carries one line: `Sem a sugestão do Jev: o script auxiliar falhou.`

Several cards from one report (Step 1b) → run this step once per card. An *Ajustar* in Step 5 that
changes a field value or the title runs it again; one that only rewrites the body does not.
```

No Step 5, depois de "the four field values in the message", acrescentar ", and right after them,
whatever Step 4b produced, verbatim". Depois do parágrafo do *Ajustar*/*Rejeitar*, acrescentar: "The
Jev's suggestions are never written: the commands below take the values the decision point approved."

### Teste: `scripts/gm-triage-jev-teste.mjs`

Script avulso no molde de `scripts/skills-comum-teste.mjs` (`afirmar(ok, msg)`, sai 0 ou 1). Importa
`../skills/gm-triage/jev-triagem.mjs`. Antes de qualquer caso, e no molde do `brain-mcp/scripts/jev.mjs`
do contrato:
- carrega `envSemJev` de `<repo>/hooks/jev.js` com `createRequire`. Ausente ou quebrado → `FALHOU:
  hooks/jev.js do #42 ausente (rode depois do rebase sobre a feat/42-filtro-jev)` e código 1;
- `process.env = envSemJev(process.env)`;
- `globalThis.fetch` passa a ser uma função que lança `rede proibida no teste`.

O cliente falso em processo fica no próprio teste, no molde de `brain-mcp/scripts/embeddings-falso.mjs`.
É determinístico, tem a forma do contrato (`ligado(uso, env)`, `decidir(estado, perguntas, opcoes)`),
é configurável por caso e registra cada chamada: o `uso` de `ligado`, e o estado, as perguntas e as
`opcoes` inteiras de `decidir`.

Os casos de ponta a ponta rodam a CLI com `spawnSync` sobre uma **árvore temporária no layout da
instalação**, porque o script acha o `jev.js` primeiro pelo caminho relativo (`carregarCliente`):
- `<tmp>/skills/gm-triage/jev-triagem.mjs` é uma cópia do arquivo do repo, feita no começo do caso;
- `<tmp>/hooks/` só existe quando o caso pede cliente no passo 1. Para o cliente real, é a cópia da
  pasta `hooks/` inteira do repo. É precaução: no `14fee0c` o único `require` do `jev.js` é `fs`
  (`hooks/jev.js:60`), mas uma task do #42 pode lhe dar um vizinho. Para o cliente de mentira de um
  caso, é só o `jev.js` escrito pelo caso;
- `<tmp>/casa/` é o `CLAUDE_CONFIG_DIR` de todo filho, para o passo 2 nunca cair no `~/.claude` de
  quem roda o teste. Fica vazio, salvo nos casos do passo 2, que escrevem `<tmp>/casa/hooks/jev.js`;
- o env de todo filho é `{ ...envSemJev(process.env), CLAUDE_CONFIG_DIR: "<tmp>/casa", ...<só o que o
  caso pede> }`. O teste nunca põe
  `TYPESAFE_API_KEY` no env de um filho: o estado "ligado" sai sempre de `BRAIN_JEV_FALSO`, que pelo
  contrato nunca vai à rede.

Todo `spawnSync` leva `{ timeout: 15000, killSignal: "SIGKILL" }`, e o caso afirma `r.error === undefined`
e `r.signal === null` antes de olhar o código, para que um processo pendurado reprove em vez de
travar o portão.

Fixtures inline, com ids inventados. Nenhum dado real.

## File Change Summary
- **criado** `skills/gm-triage/jev-triagem.mjs` — `lerBoard`, `sensivel`, `sugerir`, `renderizar`,
  `principal`, `carregarCliente` e o bloco de execução.
- **alterado** `skills/gm-triage/SKILL.md` — Step 4b novo e duas frases no Step 5.
- **criado** `scripts/gm-triage-jev-teste.mjs` — o teste.
- **alterado** `CLAUDE.md` — em `## A esteira`, item 3, uma frase: "Mudou `skills/gm-triage/`? A suíte
  soma `node scripts/gm-triage-jev-teste.mjs`." Assim o teste não apodrece na próxima mudança da skill.
- **criado** `planning/41-triagem-jev/spec.md` — esta spec. (O `medicao.md` do R5 só nasce com o aval.)

## Migrations & compatibilidade
N/A. Nenhum formato em disco muda. O card não ganha campo nem seção, e o board recebe os mesmos campos
de hoje.

Compatibilidade nos dois sentidos:
- Skill nova com `hooks/jev.js` ausente, inclusive se o `sync.sh` não o copiar: `carregarCliente` dá
  `null` e vale o R1.
- `hooks/jev.js` do #42 instalado e a triagem fora de `BRAIN_JEV`: vale o R1, mesmo com outros usos
  ligados. O script carrega o `jev.js` em toda triagem, antes de saber se o uso está ligado (o
  contrato permite: carregar não escreve nada nem abre rede, `:215` do #42), mas nada sai sem
  `triagem` na lista.
- Instalação antiga sem o `.mjs`: o `SKILL.md` que manda rodá-lo chega junto, no mesmo
  `sync.sh push`, porque a pasta da skill é copiada inteira.

## Rollback
- Sem deploy: tirar `triagem` de `BRAIN_JEV` devolve a triagem de hoje (R1) a partir da próxima sessão
  do `claude` aberta sem ela, porque a env é a do processo `claude`, que a ferramenta Bash herda. O hook
  do #42 e os irmãos ficam como estão, porque cada uso liga sozinho. O inverso também vale: tirar
  `contexto` (o rollback do #42) não mexe na triagem.
- Reverter o #42 e manter o #41: o `jev.js` que sobra na instalação (o `sync.sh` não o apaga) continua
  sendo carregado pela triagem, mas fica inerte sem `triagem` em `BRAIN_JEV`. Para a triagem largar
  dele, apagar à mão `<CLAUDE_HOME>/hooks/jev.js`; aí vale o R1 com `jev.js não instalado`.
- Para tirar só a triagem: reverter a PR na `dev` e rodar `./sync.sh push`. Depois, **apagar à mão**
  `~/.claude/skills/gm-triage/jev-triagem.mjs`, porque o `sync.sh` não apaga arquivo que só existe na
  instalação (`sync.sh:217`, "nao existe na origem, pulado"), e o próximo `pull` o traria de volta.
- Quem faz tudo isso é Leonardo, porque escreve na instalação viva.

## Verificação pós-deploy
Na 🧪 Validação em Dev, depois do `./sync.sh push` feito por Leonardo. Abaixo,
`S="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/gm-triage/jev-triagem.mjs"`.
1. **`hooks/jev.js` instalado e a triagem desligada.** Rodar
   `env -u BRAIN_JEV -u BRAIN_JEV_FALSO node "$S" --estado`.
   Esperado: stdout vazio, código 0, stderr `jev-triagem: cliente carregado, desligado`. Um
   `cliente indisponível: jev.js não instalado` reprova: quer dizer que o `hooks/jev.js` não chegou à
   instalação, ou que não está em `../../hooks/` da pasta instalada da skill.
2. **O uso `triagem` liga o script instalado, sem rede nem chave.** O mesmo comando com
   `BRAIN_JEV=triagem BRAIN_JEV_FALSO=sim` no lugar dos `-u` imprime exatamente `ligado`. Com
   `BRAIN_JEV=contexto BRAIN_JEV_FALSO=sim`, stdout vazio. O falso nunca vai à rede.
3. **Triagem de teste.** Uma `/gm-triage` de um relato inventado, numa sessão com `triagem` fora de
   `BRAIN_JEV` (outros usos podem estar ligados), mostra a proposta de hoje, sem linha do Jev. No
   Step 5, escolher **Rejeitar**, para não gravar card no board público.
4. **O caminho ligado numa sessão de verdade, sem rede nem chave.** Abrir o `claude` com
   `BRAIN_JEV=triagem BRAIN_JEV_FALSO=sim` exportados antes, e rodar a `/gm-triage` de um relato
   inventado. Esperado: logo depois dos quatro valores da sessão, a tabela do Jev, com a escolha do
   falso em cada campo (a primeira opção do `## Board`, a 95%), e nenhum campo gravado antes do ponto de
   decisão. Escolher **Rejeitar**. Isso prova que a ferramenta Bash herda a env do `claude` e que o
   Step 4b roda como escrito. Depois, `ls "${TMPDIR:-/tmp}"/gm-triage-jev-*.json` não acha nada: a
   entrada foi apagada (emenda do G4). Se achar, o stderr do script disse `não apaguei`, e a sessão
   escreveu o arquivo fora da pasta que o `os.tmpdir()` do script vê: reprova.
5. **Permissão (opcional, de Leonardo, fora do repo).** Sem uma regra `allow` para
   `Bash(node ~/.claude/skills/gm-triage/jev-triagem.mjs:*)`, a sessão interativa pode pedir permissão
   para o `--estado`, conforme o modo de permissão. Se isso incomodar, Leonardo acrescenta a regra.
6. **Com o aval (R5), que precisa citar o uso `triagem`.** O `--estado` com `triagem` em `BRAIN_JEV`,
   a chave no ambiente e `BRAIN_JEV_FALSO` indefinida imprime `ligado`, e a medição do R5 começa. Sem o aval, este item não roda, e a release registra o motivo (delta 1 do workspace).

## Plano de testes

`node scripts/gm-triage-jev-teste.mjs`, um bloco por critério:

| Critério | Caso |
|---|---|
| R1 | `sugerir` com `cliente: null`, com `ligado` falso e com `ligado` que lança → `desligado`, sem nenhum `decidir` registrado; `renderizar` → `""` |
| R1 | `principal(["--estado"])` com `carregar` devolvendo `{ cliente: null, motivo: "jev.js não instalado" }` → stdout vazio, código 0, stderr `jev-triagem: cliente indisponível: jev.js não instalado` |
| R1 | `principal(["--claude-md", a, "--entrada", b])` desligado (falso com `decidir` que registra leitura) → stdout vazio, código 0, `b` apagado, nenhum `decidir` |
| R1 | CLI por `spawnSync` na árvore temporária **sem** `<tmp>/hooks/` e com `<tmp>/casa/` vazio, com `BRAIN_JEV=triagem BRAIN_JEV_FALSO=sim` (o env que ligaria), `--estado` e o modo completo → stdout vazio, código 0, stderr `jev-triagem: cliente indisponível: jev.js não instalado` |
| R1 | ordem de resolução, passo 2: sem `<tmp>/hooks/` e com `<tmp>/casa/hooks/jev.js` de mentira (`ligado(uso)` dá `uso === "triagem"`; escreve `PASSO2` no stderr ao carregar), `BRAIN_JEV=triagem`, `--estado` → stdout `ligado\n`, stderr com `PASSO2` |
| R1 | ordem de resolução, passo 1 vence: o mesmo `<tmp>/casa/hooks/jev.js` e mais o `hooks/` real em `<tmp>/hooks/`, sem `BRAIN_JEV`, `--estado` → stdout vazio, stderr `jev-triagem: cliente carregado, desligado` e sem `PASSO2` |
| R1 | `jev.js` quebrado: `<tmp>/hooks/jev.js` com `throw new Error("quebrado")` no topo, e um `<tmp>/casa/hooks/jev.js` que escreve `PASSO2`; `BRAIN_JEV=triagem BRAIN_JEV_FALSO=sim`, `--estado` e o modo completo → stdout vazio, código 0, stderr `jev-triagem: cliente indisponível: quebrado` e sem `PASSO2` (o erro no passo 1 não cai no passo 2); no modo completo, a `--entrada` apagada |
| R1 | `jev.js` sem a função: `<tmp>/hooks/jev.js` com `module.exports = {}`, o mesmo env, `--estado` → stdout vazio, código 0, stderr `jev-triagem: cliente carregado, desligado` |
| R1 | CLI por `spawnSync` na árvore temporária com o `hooks/` real, `--estado` e o modo completo, com `--import "data:text/javascript,…"`. O módulo do `--import` troca `globalThis.fetch`, `net.connect`, `net.createConnection`, `tls.connect`, `http.request` e `https.request` por funções que escrevem `REDE!` no stderr e lançam, e chama `syncBuiltinESMExports()`. Quatro envs: sem `BRAIN_JEV`; `BRAIN_JEV=1 BRAIN_JEV_FALSO=sim` (o `1` não liga nada); `BRAIN_JEV=contexto BRAIN_JEV_FALSO=sim` (outro uso não liga a triagem); `BRAIN_JEV=triagem` sem chave e sem falso. Esperado nos oito: stdout vazio, código 0, stderr `jev-triagem: cliente carregado, desligado` e sem `REDE!`; no modo completo, a `--entrada` apagada |
| R1 | CLI na árvore temporária com um `<tmp>/hooks/jev.js` que escreve `CARREGOU` no stderr ao carregar, sem `--entrada`, com argumento desconhecido e com argumento a mais, **sem** `BRAIN_JEV` e com `BRAIN_JEV=triagem BRAIN_JEV_FALSO=sim` → código 2 nos seis, e `CARREGOU` em nenhum (o `argv` é validado antes de `carregar`) |
| R1 | `import()` do módulo por `node -e` → não roda `principal` nem lança |
| R2 | falso em processo, `## Board` do `CLAUDE.md` do repo, proposta `{Tipo:"✨ Melhoria", Severidade:"S3", Classe:"⚪ Padrão", Rota:null, "Módulo":"skills"}`. Probabilidades: Melhoria 0,82; S3 0,20 com S2 0,75 escolhida; Padrão 0,90; Rota com Curta 0,71 escolhida; skills 0,64. Esperado: `ligado` chamado com `"triagem"`; um só `decidir`, com `opcoes` igual a `{ uso: "triagem", timeoutMs: 10000 }`, cinco perguntas `escolha` (Tipo, Severidade, Classe, Rota, Módulo) e o resumo como `estado`; o markdown igual, **byte a byte**, ao exemplo de `renderizar` |
| R2 | arredondamento e limiar: proposta com 0,70 → `70%` sem marca; 0,6999 → `69%` com marca; 0,29 → `29%`; 0,57 → `57%` |
| R2 | campo de uma opção só (fixture no formato do `~/pessoal/CLAUDE.md`, Módulo `Comum`) → Módulo fora das `perguntas` e linha `\| Módulo \| Comum \| 100% (única opção) \| = \| \|`; com proposta `null`, `\| Módulo \| — \| — \| Comum (100%) \| \|` |
| R2 | campo ausente do `## Board` (fixture sem a linha de Rota) → fora das `perguntas`, linha ``\| Rota \| — \| — \| — \| não declarado no `## Board` \|`` |
| R2 | proposta fora do `## Board` (`"Módulo": "Processos"` no `## Board` do repo, Jev escolhendo `skills` a 0,64) → linha ``\| Módulo \| Processos \| — \| skills (64%) \| ⚠ revisar (proposta fora do `## Board`) \|`` |
| R2 | proposta `"Melhoria"` (sem emoji) e `"⚪️ Padrão"` (com U+FE0F) → casam com `✨ Melhoria` e `⚪ Padrão`, com `pProposta` preenchido |
| R2 | `decidir` com todas as chaves `{estado:'indisponivel', motivo:'http', detalhe:'429'}` → `falhou`; `renderizar` = `Sem a sugestão do Jev: o Jev ficou indisponível (http: 429). A classificação acima é só a da sessão.` |
| R2 | `decidir` que nunca resolve, com `prazoMs: 50, folgaMs: 30` → `falhou` com `o Jev não respondeu em 0,05 s` (e não `0,08 s`), e `sugerir` volta em menos de 500 ms |
| R2 | falhas misturadas: Tipo com escolha inválida e Severidade `indisponivel` → `resposta inválida do Jev no campo Tipo`; Tipo `indisponivel` e Severidade inválida → `o Jev ficou indisponível (…)` |
| R2 | `decidir` que lança `"x\ny"` e que lança uma string → `falhou` com `o cliente do Jev falhou: x` e com a string |
| R2 | respostas inválidas: escolha fora das opções; chave faltando; `probabilidades` ausente; `probabilidades[proposta]` igual a 1,5; resultado `null` e resultado `{}` → `falhou` com `resposta inválida do Jev no campo <campo>`, e para `null` e `{}` o campo é `Tipo` |
| R2 | resumo vazio, resumo de 801 pontos de código, e um resumo de cada padrão de `sensivel` → `falhou`, sem `decidir`. Casam (um caso cada): `ver fulano@exemplo.com.br`, `em https://x.y`, `arquivo /home/u/a.txt`, `C:/Users/x`, `CPF 123.456.789-09`, `CNS 898001234567890`, `AIH 3524100012345`, `erro at f (a.js:1:2) no meio`, `at com.foo.Bar.run(Bar.java:42)`. Não casam e passam: um resumo de 800 pontos de código com emoji, `atualizar better-sqlite3@11.5.0 quebra o build`, `a rota /api/aih retorna 500`, `o slash /gm-triage/jev`, `competências 202610 202611 e 202612`, `período 10/2026-11/2026`, `cita hooks/brain-contexto.js`, `às 10:30:15 caiu`, `timeout na exportação de 2026-11-10` (conjunto medido com `node -e` em 2026-11-10) |
| R2 | CLI por `spawnSync` na árvore temporária com o `hooks/` real, `--claude-md` = o `CLAUDE.md` do repo, a proposta do caso principal, `BRAIN_JEV=triagem` e `BRAIN_JEV_FALSO=<roteiro>`. O roteiro tem uma regra `quando:{id}` por campo e nenhum `padrao`, com os rótulos tirados do `lerBoard` do mesmo arquivo: Tipo `{escolha:"✨ Melhoria"}` (sem `confianca`, vale 0,95), Severidade `{escolha:"S2", confianca:0.75}` (S1 e S3 ficam com 0,125 cada), Classe `{escolha:"⚪ Padrão", confianca:0.9}`, Rota `{escolha:"Curta", confianca:0.71}`, Módulo `{escolha:"skills", confianca:0.64}`. Esperado: stdout igual, byte a byte, ao cabeçalho de `renderizar` seguido das linhas `\| Tipo \| ✨ Melhoria \| 95% \| = \| \|`, `\| Severidade \| S3 \| 12% \| S2 (75%) \| ⚠ revisar \|`, `\| Classe \| ⚪ Padrão \| 90% \| = \| \|`, `\| Rota \| — \| — \| Curta (71%) \| \|`, `\| Módulo \| skills \| 64% \| = \| ⚠ revisar \|` e de `\n`; stderr com `jev-triagem: <n> ms`; código 0; o arquivo de entrada apagado |
| R2 | o mesmo ambiente, `--estado`, e também com `BRAIN_JEV=" Contexto , TRIAGEM " BRAIN_JEV_FALSO=sim` (lista, com espaço e maiúsculas) → stdout exatamente `ligado\n`, código 0 |
| R2 | roteiro sem a regra do Módulo e com `padrao: {indisponivel:"http"}` → stdout igual a `Sem a sugestão do Jev: o Jev ficou indisponível (http: falso). A classificação acima é só a da sessão.\n` (sem regra que case vale o `padrao`, e a falha de um campo derruba a tabela) |
| R2 | roteiro sem a regra do Módulo e **sem** `padrao` → stdout igual a `Sem a sugestão do Jev: o Jev ficou indisponível (resposta_invalida: roteiro). A classificação acima é só a da sessão.\n` |
| R2 | `BRAIN_JEV=triagem BRAIN_JEV_FALSO=lento` → stdout `Sem a sugestão do Jev: o Jev ficou indisponível (timeout…`, medido em menos de 12 s |
| R2 | CLI por `spawnSync` na árvore temporária com um `<tmp>/hooks/jev.js` de mentira escrito pelo caso: `ligado(uso)` dá `true`, `decidir` responde `ok` e deixa um `setInterval` vivo. O processo sai com código 0 em menos de 3 s |
| R2 | arquivo de entrada com JSON inválido → `Sem a sugestão do Jev: não consegui ler <nome>` |
| R2 | estático: `jev-triagem.mjs` não contém `child_process`, `node:http`, `node:https`, `node:net`, `node:tls` nem `fetch(` |
| R3 | `lerBoard` do `CLAUDE.md` do repo → Módulo `["brain-mcp","hooks","skills","docs"]`, Rota `["Completa","Curta","Hotfix"]`, Tipo com os quatro rótulos com emoji, Status fora do mapa |
| R3 | `lerBoard` da mesma fixture com CRLF, com BOM e com "Módulo" em NFD → mesmo mapa |
| R3 | `--claude-md` apontando para um arquivo sem `## Board` → `Sem a sugestão do Jev: não achei o ## Board em <nome>` |
| R3 | (emenda do G4) `## Board` presente sem linha de campo → `Sem a sugestão do Jev: achei o ## Board em <nome>, mas nenhuma linha de campo`; texto depois do último id (`docs=\`f9cf9726\` (novo)`, ou um ponto final) não tira a opção |
| R1 | (emenda do G4) as entradas do teste são `gm-triage-jev-<8 hex>.json` em `os.tmpdir()`; argumentos trocados (o `CLAUDE.md` na `--entrada`), o nome certo fora da pasta temporária, e nome fora do padrão (`.txt`, hex maiúsculo) dentro dela → o arquivo fica, ligado ou desligado, e o stderr traz `não apaguei <nome>` |
| R2 | (emenda do G4) casam também: `CNPJ 12.345.678/0001-90`, `CNPJ 12345678/0001-90`, `CNS 123 4567 8901 2345`, `CPF 123 456 789 09`, `tel 11 98765 4321` (número longo); `tel (11) 98765-4321`, `+55 11 98765-4321`, `tel (11) 3456-7890` (telefone); `/data/clientes/hospital-x/aih.csv`, `/dados/aih.csv`, `/srv2/x/y` (caminho absoluto); `./logs/x.txt`, `../dados/x`, `logs/hospital-x/erro.txt` (caminho relativo). Seguem passando todos os "não casam" de cima, mais `de 10/11/2026 a 12/11/2026`, `2026-11-10 10:30:15`, `versões 1.2.3 e 4.5.6`, `S1 S2 S3, 70% e 10 s`, `a rota /api/aih.` e `e/ou, entrada/saída, S1/S2/S3` |
| R2 | (emenda do G4) proposta `Bug \| urgente` com quebra de linha → a célula sai com `\|` e espaço, a tabela com o mesmo número de linhas; o cabeçalho não tem limiar escrito à mão, sai de `LIMIAR_PCT`; a fonte do script não tem U+FEFF nem U+FE0F crus |
| R3 | no caso principal do R2, as chaves de `perguntas[campo].opcoes` são as do `lerBoard`, campo a campo |
| R2/R3 | `SKILL.md` contém `## Step 4b — Sugestão do Jev`, `jev-triagem.mjs" --estado` e `--entrada` |
| R4 | `node scripts/skills-comum.mjs --check` → código 0 |
| R5 | fora da PR: `## Verificação pós-deploy`, item 6 |

## Technical Decisions
- **A proposta continua sendo a da sessão. O Jev dá a probabilidade dela e mostra a escolha dele ao
  lado.** É isso que "a proposta traz os cinco campos, cada um com a probabilidade" quer dizer quando o
  valor confirmado é o da sessão: a marca cai no campo em que vale parar. Se o Jev pré-preenchesse os
  valores, no `## Modo despachado` a sessão aprovaria a escolha dele, e o G1 descartou deixar o Jev
  decidir sozinho (#1377). Pelo mesmo motivo, a sessão não troca a própria classificação por causa da
  sugestão.
- **Uma chamada `decidir` com uma pergunta `escolha` por campo**, e não cinco chamadas nem sim/não por
  opção. O contrato do #42 dá `probabilidades` por opção numa requisição, e é daí que sai a
  probabilidade da proposta.
- **Script na pasta da skill, chamado em duas fases.** O `--estado` vem antes de qualquer resumo
  escrito, porque com o Jev desligado nada deve ser escrito. A leitura do `## Board`, a guarda, o limiar
  e o formato ficam testáveis sem abrir sessão do Claude.
- **Vai ao Jev um resumo sem dado sensível, nunca o relato bruto, com uma guarda por padrões.** O card
  deixou o recorte para a spec, sob o aval de Leonardo. O resumo é o recorte que não precisa do aval
  para começar a ser seguro. A guarda segura o deslize óbvio, sem prometer mais que isso. Mandar o
  relato inteiro fica para quando o aval disser que pode.
- **A triagem liga pelo uso `triagem` da lista `BRAIN_JEV` do contrato, e não por flag própria.**
  (Revisão do G2.) O G1 amarrou o #41 à flag do #42, e o G2 do #42 fez dela uma lista de usos, com
  `triagem` reservado para o #41. Assim o custo da versão anterior some: ligar o hook do #42 já não
  liga a triagem, o aval do R5 pode cobrir só a triagem, e o rollback dela não desliga o #42.
  Descartados: uma env só da triagem (duplicaria o que o contrato já dá, e seria uma segunda chave de
  liga); e continuar exigindo um aval que cubra o #42 junto, que deixou de ter motivo.
- **O `jev.js` é achado pela ordem de dois lugares do contrato: `../../hooks/jev.js` a partir do
  script e, se não existir, `<CLAUDE_HOME>/hooks/jev.js`.** (Revisão do G2.) É a linha **Skills com
  script** da emenda 1 do #42, que cita este script como o caso do passo 1. O passo 1 deixa o teste
  rodar contra o `jev.js` do branch sem instalar nada. O passo 2 é o que o contrato manda, e o teste o
  isola com um `CLAUDE_CONFIG_DIR` temporário. Um erro de `require` no passo 1 não cai no passo 2: o
  contrato só manda o passo 2 quando o passo 1 não existe, e cair num cliente instalado e diferente do
  branch esconderia a quebra. Descartados: só o passo 1, que foi a forma combinada antes da emenda e
  que o contrato publicado não aceita por escrito (aceita só "só o passo 2"); e só o passo 2, que na
  worktree carregaria o cliente instalado e não o do branch.
- **Limiar de 70%, prazo de 10 s, constantes.** Não há medição; quem recalibra é o R5. O limiar do #42
  (0,5) é do filtro do hook e não se aplica aqui.
- **Tudo ou nada.** Uma falha em um campo derruba a tabela, porque uma tabela parcial misturaria
  sugestão com falta. O #42 faz o mesmo no hook.
- **Desligado é tudo o que não prova `ligado("triagem") === true`**, inclusive cliente ausente ou quebrado. O
  diagnóstico vai para o stderr. É o que mantém o R1 mesmo numa instalação parcial.
- **A Rota usa a regra genérica do `gm-card`.** No `claude-brain`, onde Curta é o padrão, a sugestão de
  Rota tende a errar para Completa. O R5 a conta à parte, em vez de ler critério de rota de cada
  workspace, que o card não pediu.
- **O rótulo vai ao Jev com o emoji, como está no `## Board`.** Tirar o emoji pediria mapear de volta, e
  não há medição que diga que ajuda.

## Coding Standards
- Só módulos `node:` embutidos; nada de dependência, nada de build. Nomes e mensagens em pt-BR, como em
  `scripts/skills-comum.mjs`.
- Nada além do especificado: sem flag própria, sem log do resumo, sem tocar `hooks/jev.js`.
- O `SKILL.md` só muda nos pontos do `### Skill`; os três blocos comuns não são tocados (R4).
- Repo público: nenhum nome de cliente, de hospital ou dado real em fixture ou teste.
