# brain-mcp

Servidor MCP local (stdio) que indexa o contexto de um produto e o expõe ao Claude Code — o
"cérebro" de finalidade e evolução. Faz três coisas: **busca** (híbrida, léxica + semântica),
**relaciona** (grafo card ↔ PR ↔ spec ↔ arquivo ↔ commit) e **lembra** (decisões gravadas na
hora, não só no fim da sessão).

Este documento é o mergulho técnico. Para instalar, veja o [README da raiz](../README.md).

## O que indexa

Cada entrada de `roots` no `brain.config.json` tem um `source`, e é por ele que se filtra a busca:

| `source` | Conteúdo típico |
|---|---|
| `planning` | specs de feature: PRD, tech-spec, tasks (`_arquivo/` entra como `status=arquivado`) |
| `docs` | documentação dos repos, CHANGELOGs, READMEs |
| `diario` | notas de sessão no cofre Obsidian, alimentadas pelo hook `SessionEnd` |
| `decisao` | decisões gravadas pela tool `lembrar` |
| `memoria` | notas de memória do Claude (`~/.claude/projects/<slug>/memory`) |
| `mapa` | mapas de arquitetura por repo, gerados pela skill `/mapear` |
| `notas` | notas soltas do produto que não pertencem a um repo |
| `code` | código-fonte dos repos (extensões em `codeExtensions`) |
| `github` | cards/issues e PRs com comentários — coletados via `gh` |
| `git` | histórico de commits: um markdown por repo/mês, um chunk por commit |

Config em `brain.config.json` (roots, extensões, excludes, repos de git/GitHub) — editável sem
recompilar. Caminhos aceitam `${HOME}`, `${CLAUDE_HOME}`, `${BRAIN_ROOT}` e as variáveis que você
declarar no bloco `vars`.

Dois campos moldam o servidor ao seu domínio sem tocar em código:

- **`produto`** — o nome que aparece na descrição das tools, para o modelo saber de que índice se
  trata. Sem ele, a descrição fala em "produto deste workspace".
- **`sinonimos`** — vocabulário do seu domínio, somado ao dicionário embutido em `src/search.ts`.

## Como a busca funciona

**Híbrida.** BM25 acerta quando você já sabe a palavra (`blocklist fragmento`) e erra quando você
descreve o problema (`por que aparece duas vezes?`). Embedding faz o inverso. As duas passadas são
fundidas por **RRF** (Reciprocal Rank Fusion), que combina rankings sem precisar calibrar escalas
incompatíveis — só usa a posição.

- **Léxico**: SQLite FTS5, tokenizer `unicode61 remove_diacritics 2`. Stopwords pt-BR são removidas
  da query (sem isso o AND obriga a preposição a existir no trecho e a busca premia texto longo e
  genérico). Passada AND para precisão; passada OR, com sinônimos do domínio, para cobertura. Os
  sinônimos entram **só na passada OR** — no AND destruiriam a precisão. Acrescente os seus pelo
  bloco `sinonimos` do config.
- **Semântico**: `Xenova/multilingual-e5-small` (384 dims) via transformers.js, rodando local na CPU.
  Vetores ficam em `chunks.embedding` e são varridos em força bruta em memória — nesta escala
  (~10k chunks × 384 dims = 15 MB) custa poucos milissegundos e dispensa extensão nativa. Acima de
  ~100k chunks vale trocar por ANN; o formato de armazenamento não muda.
- **Reordenação** por autoridade (uma decisão registrada pesa mais que uma nota solta; spec pesa
  mais que card; arquivado pesa menos) e por recência. Os pesos são **deliberadamente pequenos**
  (1,06 no topo): o score RRF do 1º lugar é 1/61 e o do 2º é 1/62 — 1,6% de diferença —, então um
  multiplicador aparentemente modesto de 1,3 empurra um documento ~18 posições e a autoridade
  deixa de desempatar para passar a mandar. A primeira versão errava exatamente nisso, e o eval
  pegou: hit@1 subiu de 60% para 90% só ao encolher a escala.
- **Colapso por conteúdo**: a spec de planning e a mesma spec embutida no corpo do card do GitHub
  eram dois resultados idênticos disputando o top-N. Agora fica a canônica, anotada com
  `(mesmo conteúdo em: card #1072)`. E **diversidade antes de profundidade**: um documento só ganha
  um segundo trecho depois que todos os outros já tiveram o primeiro.

Se o modelo de embeddings não carregar, a busca **degrada para léxico puro** em vez de falhar.

## O grafo

O card #1072, o PR #1078, a spec em `planning/1072-…`, os commits e o arquivo que implementa aquilo
são a mesma história — e a ligação já existia explícita nos dados, só nunca tinha sido lida:

| Ligação | De onde sai |
|---|---|
| PR → card | `**Card:** #n` no corpo, `closes/fixes #n`, número no nome do branch |
| feature → card | prefixo numérico da pasta em `planning/` |
| doc → feature | estrutura de pastas |
| commit → PR/card | número carimbado pelo squash-merge, `#n` na mensagem |
| qualquer → arquivo | caminhos citados em crase (`meuArquivo.ts:152-161`) |
| sessão/decisão → card | menções `#n` no diário e no escopo da decisão |

Duas regras de precisão que valem citar: **número é resolvido repo-primeiro** (o `#1078` de um repo
não é o `#1078` de outro; o atalho só-por-número vale apenas quando o número é único no workspace
inteiro), e **arquivo citado por nome ambíguo não é ligado** — uma citação a `index.ts` casaria com
centenas, e ligação ambígua é pior que ligação ausente porque mente com aparência de precisão.

Reconstrução é sempre total (~0,5 s para 4,7k documentos), o que elimina a classe inteira de bug de
grafo incremental dessincronizado.

## Tools MCP

- `search_context(query, source?, repo?, feature?, doc_type?, incluir_arquivadas?, limit?)` — busca híbrida.
- `read_doc(path, heading?)` — lê doc/seção direto do disco.
- `list_features(repo?, apenas_ativas?)` — catálogo de features documentadas.
- `feature_timeline(feature)` — PRD → tech-spec → tasks + menções no diário/memória/GitHub.
- `vizinhanca(alvo, limite?)` — o que está ligado a um card, PR, feature ou arquivo.
- `lembrar(fato, tipo?, escopo?, porque?, alternativas?, refs?, supersede?)` — grava decisão no cofre e no grafo.
- `recent_activity(dias?, incluir_codigo?)` — briefing do que mudou.
- `reindex(full?, github?, forcar?)` — re-varredura manual + reconstrução do grafo; exige a liderança do índice (ver *Escritor único*).

## Memória ativa

Antes, o que era decidido numa sessão só entrava no índice se o usuário lembrasse de rodar `/diario`
no fim — sessão que morresse antes levava junto o *porquê*, que é justamente a parte que ninguém
reconstrói lendo o diff depois. `lembrar` grava na hora: um markdown em `<workspace>/claude/decisoes/`
(visível no Obsidian, indexado como qualquer doc) **e** uma linha na tabela `decisoes`.

Ao gravar, a tool devolve decisões anteriores do mesmo escopo cujo texto é semanticamente próximo
(cosseno ≥ 0,82). Ela **não afirma que há contradição** — julgar isso automaticamente seria chute
com cara de certeza. Ela traz os candidatos com a semelhança medida; quem escreve decide se
substitui (`supersede: <id>`) ou se convivem.

## Frescor do índice

Watcher (`fs.watch` recursivo, debounce de 1,5 s) nas raízes de documento — pequenas e de alta
rotatividade — e varredura periódica de 5 minutos para o resto. Código não é vigiado de propósito:
`fs.watch` recursivo num repo com `node_modules` é caro e o ganho é nulo, já que código muda em
rajada. **Nenhuma varredura acontece no caminho da consulta** (antes, uma busca podia pagar a
varredura inteira de todos os repos).

## Escritor único do índice

Várias sessões do Claude Code abertas ao mesmo tempo são vários servidores `brain` contra o **mesmo**
`brain.db`. Antes, todos varriam os mesmos arquivos, reconstruíam o mesmo grafo e calculavam os
mesmos vetores simultaneamente: trabalho multiplicado por N e tempestade de lock, com
`database is locked` chegando ao usuário no meio de um `lembrar`.

Agora um **lease** gravado no próprio banco (tabela `lider`, TTL de 60 s, renovado a cada ⅓ dele)
elege um escritor. Só o líder varre, reconstrói o grafo, gera embeddings e sincroniza GitHub/git. Os
seguidores **respondem consulta exatamente como o líder** e seguem gravando `uso` e `lembrar` — o
lease governa o trabalho pesado, não o atendimento.

Não há nada a administrar: se o líder morre, o lease vence e outro assume sozinho no tique seguinte;
se ele se despede direito (a sessão fecha o stdin), solta o lease na hora e a troca é imediata.

**A CLI e a tool `reindex` são a exceção, e de propósito.** As duas são ação humana explícita de
reindexação, então em vez de esperar caladas elas **recusam com aviso**:

```
$ npm run index
O índice está sob o servidor pid 24180 (LEO-DESK), lease até 15:42:07.
Feche as sessões do Claude Code, ou rode de novo com --force para tomar a liderança.
```

Antes de recusar, a CLI tenta a cada segundo por 10 s — isso cobre o caso comum, que é um servidor
justamente de saída. `--force` na CLI (ou `forcar: true` na tool `reindex`) toma a liderança de quem
estiver com ela; o servidor que a perde se rebaixa a seguidor no tique seguinte, sem morrer e sem
parar de atender.

Para desligar o mecanismo a quente, sem deploy: `BRAIN_LEASE_TTL_MS=0` faz todo lease nascer vencido,
todo processo se eleger líder e o comportamento anterior voltar.

## Qualidade da busca

`scripts/golden.json` guarda queries com o documento que **deveria** vir em 1º. `npm run eval` roda
todas contra o servidor e reporta hit@1, hit@5 e MRR. Sem isso, mexer em ranking é fé — rode antes
e depois de qualquer mudança em tokenização, fusão ou pesos. Adicione um caso novo toda vez que uma
busca real decepcionar.

Repare que o número **cai sozinho conforme o corpus cresce**, sem ninguém mexer em ranking: um
`lembrar` novo sobre o mesmo assunto passa na frente da spec que o golden set esperava. Isso é
sinal para revisar o caso (o documento esperado ainda é a melhor resposta?), não necessariamente
para mexer nos pesos.

> O `golden.json` versionado aqui aponta para documentos do workspace de origem, então ele **vai
> falhar na sua máquina até você trocá-lo pelos seus casos**. É esperado: golden set é local por
> natureza.

A tabela `uso` registra toda chamada de tool (qual, argumentos, ms, tamanho da resposta, se veio
vazia). `npm run uso` transforma "acho que o Claude não usa o cérebro" em número, e a lista de
buscas vazias vira candidata a caso de golden set ou a sinônimo faltando.

## Comandos

```sh
npm run build              # tsc -> dist/
npm run index              # varredura incremental + estatísticas
npm run index:full         # reindexação do zero (APAGA os embeddings — precisa rodar embed depois)
npm run embed              # gera embeddings dos chunks que ainda não têm (retomável)
npm run grafo              # reconstrói o grafo de entidades
npm run eval               # golden set: hit@1 / hit@5 / MRR
npm run uso                # quantas vezes o Claude chamou cada tool
npm run smoke              # sobe o servidor por stdio e testa as tools
node dist/cli.js --git     # relê o histórico de git dos repos
node dist/cli.js --github  # força sync de cards/PRs
node dist/cli.js --force   # toma a liderança de um servidor vivo em vez de recusar
```

Variáveis de ambiente: `BRAIN_CONFIG` aponta para outro `brain.config.json` e `BRAIN_DB` para outro
banco (úteis para testar sem mexer no seu índice); `BRAIN_LEASE_TTL_MS` ajusta o TTL do lease.
`BRAIN_CLI_ESPERA_MS` muda os 10 s que a CLI espera antes de recusar (0 = recusa na hora).

## Registro no Claude Code

```sh
claude mcp add --scope user brain -- node <caminho>/brain-mcp/dist/index.js
```

Depois de mudar o código: `npm run build` (o servidor novo sobe na próxima sessão). Depois de mudar
só a config: nada a fazer — o watcher e a varredura periódica cobrem.

## Próximos passos possíveis

- Busca vetorial por ANN (sqlite-vec) quando o índice passar de ~100k chunks.
- Ligar `commit → arquivo` ao *blame* para responder "quem decidiu esta linha".
- Golden set maior, alimentado automaticamente pelas buscas que voltaram vazias em `uso`.
