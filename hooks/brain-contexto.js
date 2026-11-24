#!/usr/bin/env node
// UserPromptSubmit hook: injeta o que o cerebro ja sabe sobre o prompt, antes do primeiro turno.
//
// Por que existe: as tools do MCP sao "deferred" — nao entram no schema, precisam de um
// ToolSearch antes de qualquer chamada. Isso da ao `grep` uma vantagem de dois round-trips
// sobre o `search_context`, e a medicao dos transcripts mostrou o resultado: 1003 buscas de
// arquivo na mao contra 56 consultas ao cerebro no workspace pessoal.
//
// A deferral e decidida por feature flag do servidor (tengu_deferred_stub_tool) — nao ha chave
// de settings nem env var que a desligue. Entao em vez de baratear o PULL, este hook faz o PUSH:
// roda a mesma busca do search_context e entrega o resultado de graca, sem tool call nenhuma.
// O search_context continua disponivel para aprofundar (e para a metade semantica, que so o
// servidor MCP aquece).
//
// Falha em silencio — hook de contexto nunca pode atrapalhar o prompt. Mas silencio esconde bug:
// rode com BRAIN_HOOK_DEBUG=1 para ver o erro no stderr.
//
// Telemetria (claude-brain#66): com BRAIN_TELEMETRIA=1 cada execucao grava UM evento `contexto` no
// diario (hooks/telemetria.js), em todo desfecho. Contrato: planning/66-telemetria/spec.md. Gravar
// vem DEPOIS da stdout e dentro de try: nunca muda o que foi injetado nem segura o prompt.

// Primeira linha executavel, antes dos require: o `ms_total` do evento nao inclui a partida do node.
const T0 = Date.now();
const fs = require('fs');
const path = require('path');
const cfg = require('./brain-config.js');

const BS = String.fromCharCode(92);
const barras = (p) => String(p == null ? '' : p).split(BS).join('/').toLowerCase();
const DEBUG = !!process.env.BRAIN_HOOK_DEBUG;

// Mesma divisao do brain-briefing: fontes com path real filtram por prefixo do workspace;
// github/git moram todas sob <brain>/data/, entao so o repo diz de quem elas sao.
const POR_PATH = new Set(['planning', 'docs', 'diario', 'decisao', 'memoria', 'mapa', 'notas', 'code']);

// Pontuacao que gruda no fim do argumento e nao faz parte de chave nenhuma. Medido no corpus:
// existe `/gm-plan-tasks 11-fila-de-pedidos-pendentes.`, com o ponto final colado no slug.
const FIM_SUJO = new Set(['/', BS, '.', ',', ';', ':']);

// A resolucao de entidade roda sobre uma LISTA de candidatos, nao sobre o token inteiro, porque
// CAMINHO e a forma mais comum de argumento: 136 dos 291 slash commands com argumento (47%).
// Tratando so o token inteiro, os 136 caem todos na busca lexica; com os segmentos como
// candidatos, os acertos de feature saltam de 42 para 179 e a busca lexica encolhe de 154 para 18.
// Ordem: o token inteiro, depois cada segmento do mais FUNDO para o mais raso, deduplicado.
// Separador `/` E `\` — o corpus tem os dois, porque o Windows cola caminho com barra invertida.
//   processos/planning/reagrupamento-aih-por-dominio
//   -> [o caminho inteiro, "reagrupamento-aih-por-dominio", "planning", "processos"]
const candidatosDe = (arg) => {
  let t = String(arg || '').trim().split(/\s+/)[0] || '';
  t = t.replace(/^["']+/, '').replace(/["']+$/, '');
  while (t.length && FIM_SUJO.has(t[t.length - 1])) t = t.slice(0, -1);
  if (!t) return [];
  const vistos = new Set();
  const saida = [];
  for (const c of [t, ...t.split(BS).join('/').split('/').filter(Boolean).reverse()]) {
    if (!vistos.has(c)) {
      vistos.add(c);
      saida.push(c);
    }
  }
  return saida;
};

// Os passos 1 a 4 da precedencia: o argumento do slash command vira CHAVE do grafo. A query util
// de um slash command nao e o nome do comando, e o ARGUMENTO — buscar "/gm-spec #11" por texto
// devolve lixo (os tokens viram `gm`, `spec`, `11`), mas `#11` e a chave `card:claude-brain#11`.
// Medido: 200 lookups por chave exata em 2 ms — o caminho de entidade sai mais barato que a busca
// de hoje, porque nem chega a rodar o FTS.
//
// Por que NAO reaproveitar Grafo.resolver() (brain-mcp/src/grafo.ts): o regex dele e /(\d{3,5})/
// e nao casa numero de 1-2 digitos. Para `#11` ele cai no ramo LIKE '%11%' e devolve 10 paths de
// migration — verificado. Como todos os cards deste repo sao de 1-2 digitos, usa-lo quebraria
// justamente o caso do card #11. Consertar mexeria em brain-mcp/src/ e viraria Rota Completa.
// `id` entra porque as `arestas` ligam por id, nao por chave — e o passo dos vizinhos precisa dele.
const COLS_ENT = ['id', 'tipo', 'chave', 'titulo', 'repo', 'status', 'data', 'doc_path'];
const CAMPOS_ENT = COLS_ENT.join(', ');
const CAMPOS_VIZ = COLS_ENT.map((c) => 'e.' + c).join(', '); // as mesmas colunas, qualificadas

// O repo sai do CAMINHO, nunca de ws.repos: o workspace `notoria` nao tem essa chave, tem
// `exceto`. Segmentos do cwd abaixo do prefixo do workspace, do mais FUNDO para o mais raso; o
// primeiro que existir como repo de card no indice ganha.
//   ~/pessoal/claude-brain                                 -> claude-brain
//   ~/notoria/processos/modulo-processos                   -> modulo-processos
//   ~/pessoal/operations-center/.claude-worktrees/feat-31-x -> operations-center
//   ~/notoria/processos                                    -> null (`processos` nao e repo com card)
//   ~/pessoal (raiz do workspace)                          -> null (nao sobra segmento)
// Os dois `null` sao o comportamento certo, nao falha: sem repo, quem decide e a unicidade do
// numero no workspace (passo 3), e se ele for ambiguo nao se adivinha. Medido: resolve o repo em
// 84 de 94 casos (89%), e os 10 restantes cairam todos no passo 3.
//
// Custo: este laco faz WHERE tipo='card' AND repo=?, e NAO existe indice em `repo` — e varredura
// sobre ~4k linhas, uma vez por prompt no pior caso. Barato em absoluto, mas nao o "gratis" dos
// passos 1 e 2, e e por isso que a precedencia poe os caminhos indexados na frente.
const repoDoCwd = (db, ws, cwd) => {
  const segs = barras(cwd).slice(barras(ws.prefixo).length).split('/').filter(Boolean);
  const ehRepo = db.prepare("SELECT 1 FROM entidades WHERE tipo='card' AND repo=? LIMIT 1");
  for (let i = segs.length - 1; i >= 0; i--) if (ehRepo.get(segs[i])) return segs[i];
  return null;
};

// Filtro de workspace dos passos 3 e 4. Defensivo de proposito: `repos` e `exceto` sao opcionais e
// mutuamente exclusivas no brain-workspaces.json, e sem o terceiro ramo um arquivo sem NENHUMA das
// duas faz `ws.repos.includes` estourar — e hook que estoura falha em silencio e nunca mais injeta.
const daquiRepoDe = (ws) => {
  const baixa = (a) => a.map((s) => String(s).toLowerCase());
  const so = Array.isArray(ws.repos) ? baixa(ws.repos) : null;
  const fora = Array.isArray(ws.exceto) ? baixa(ws.exceto) : null;
  return (repo) => {
    const r = String(repo || '').toLowerCase();
    if (so) return so.includes(r);
    if (fora) return !fora.includes(r);
    return true; // workspace sem nenhuma das duas: nao filtra, nao explode
  };
};

// A precedencia, parando no PRIMEIRO que casar. Devolve a entidade, ou null = cai para o passo 5.
//
// AMBIGUIDADE E TERMINAL: passo 3 com 2+ candidatos cai para o passo 5, NAO para o passo 4. O alvo
// real no indice que torna isso concreto: `feature:11-fila-de-pedidos-pendentes` existe (e do
// operations-center). Se o passo 3 ambiguo caisse no passo 4, `/gm-spec #11` dentro do claude-brain
// injetaria uma feature sobre fila de pedidos — resposta confiante e errada, que e pior do que nao
// injetar. O numero 11 e o caso patologico e esta no indice: e card em TRES repos
// (processos-criticas, operations-center, claude-brain); filtrado para o workspace `pessoal` sobram
// 2 -> ambiguo -> passo 5 -> `#11` tem 3 chars -> nao injeta. Quem carrega o caso do card #11 e o
// passo 2 (repo do cwd), nao o passo 3.
const resolverEntidade = (db, ws, arg, cwd) => {
  const cands = candidatosDe(arg);
  if (!cands.length) return null;
  const porChave = db.prepare('SELECT ' + CAMPOS_ENT + ' FROM entidades WHERE chave = ?');

  // 1. Slug exato de feature, na ordem dos candidatos. FEATURE ANTES DE CARD, e e medido:
  //    `/gm-ship 982-setor-dashboard-inconsistencias` casa os dois (o numero prefixa o slug). Pela
  //    feature os vizinhos sao a spec + as 5 tasks + o card + 2 decisoes (9, todos do assunto);
  //    pelo card sao 30, incluindo 9 sessoes de diario e 3 cards citados de passagem.
  for (const c of cands) {
    const e = porChave.get('feature:' + c);
    if (e) return e;
  }

  // `#*` e nao `#?`: o corpus tem `/gm-spec ##1086`.
  let n = null;
  for (const c of cands) {
    const m = c.match(/^#*(\d{1,5})\b/);
    if (m) {
      n = m[1];
      break;
    }
  }
  if (!n) return null;

  // 2. Numero -> card, desambiguado pelo repo do cwd. E este passo que carrega a feature.
  const repo = repoDoCwd(db, ws, cwd);
  if (repo) {
    const e = porChave.get('card:' + repo + '#' + n);
    if (e) return e;
  }

  const daquiRepo = daquiRepoDe(ws);
  // 3. Numero -> card unico no workspace. So vale se sobrar EXATAMENTE 1; 2+ e terminal.
  const cards = db
    .prepare('SELECT ' + CAMPOS_ENT + " FROM entidades WHERE tipo='card' AND chave LIKE 'card:%#'||?")
    .all(n)
    .filter((e) => daquiRepo(e.repo));
  if (cards.length) return cards.length === 1 ? cards[0] : null;

  // 4. Numero -> feature `<n>-*` unica, com o MESMO filtro de workspace (entidades.repo esta
  //    preenchido em 59/59 features). Sem ele, o `#11` do claude-brain pescaria a feature da
  //    Notoria.
  const feats = db
    .prepare('SELECT ' + CAMPOS_ENT + " FROM entidades WHERE tipo='feature' AND chave LIKE 'feature:'||?||'-%'")
    .all(n)
    .filter((e) => daquiRepo(e.repo));
  return feats.length === 1 ? feats[0] : null;
};

// Primeiro chunk do documento da entidade: e ele que vira o trecho do slot.
const primeiroTrecho = (db, docPath) => {
  const r = db
    .prepare('SELECT c.text FROM chunks c JOIN docs d ON d.id = c.doc_id WHERE d.path = ? ORDER BY c.ord LIMIT 1')
    .get(docPath);
  return r ? r.text : '';
};

// Os vizinhos da entidade resolvida: uniao das `arestas` nos DOIS sentidos, descartando quem nao
// tem `doc_path` — sem documento nao ha trecho a injetar.
//
// Diversidade antes de profundidade: agrupa por `tipo`, ordena os grupos pela lista abaixo e pega
// 1 de cada grupo por rodada ate encher. Sem isto, uma feature com 5 tasks enche os slots de task
// e derruba o card — que e justamente o que /gm-implement precisa ver.
//
// `feature` e `commit` ficam FORA da lista de proposito: tem doc_path NULL em 65/65 e 585/585,
// entao o descarte acima ja os elimina. Deixa-los aqui seria codigo morto sugerindo um
// comportamento que nao existe.
//
// Dentro de cada grupo, ORDER BY data DESC, chave ASC — deterministico. Sem ORDER BY explicito
// qual das 5 tasks de uma feature aparece e sorteio, e duas rodadas iguais dao saidas diferentes.
//
// EMENDA 2026-09-10 — a chave que vem ANTES de data DESC dentro do grupo `doc`. `entidades.tipo`
// vale `doc` tanto para a spec quanto para as tasks de uma feature: elas disputam o MESMO grupo, e
// a spec e sempre o documento mais ANTIGO dele. Com data DESC sozinho, a spec da feature 982 fica
// em 5o de 6 e nunca pega slot — medido, o bloco saia com duas tasks e nenhuma spec, contra o CA-1,
// que exige "a spec, o card e pelo menos uma task". O rank de doc_type poe spec/tech-spec/prd na
// frente; para todo o resto ele vale 0 e o desempate continua sendo data DESC, chave ASC.
const ORDEM_TIPO = ['doc', 'decisao', 'pr', 'card', 'arquivo', 'sessao'];

const vizinhosDe = (db, ent, limite) => {
  if (limite <= 0) return [];
  // O LEFT JOIN existe so pelo doc_type: `entidades` nao o tem, e `docs.path` e UNIQUE (indexado).
  const lado = (a, b) =>
    'SELECT ' + CAMPOS_VIZ + ', d.doc_type FROM arestas a JOIN entidades e ON e.id = a.' + b +
    ' LEFT JOIN docs d ON d.path = e.doc_path' +
    ' WHERE a.' + a + ' = ? AND e.doc_path IS NOT NULL';
  // O UNION vai DENTRO de uma subconsulta porque o ORDER BY de um compound SELECT so aceita nome
  // de coluna do resultado, nunca expressao: com o rank solto, o SQLite responde "1st ORDER BY term
  // does not match any column in the result set" — e como o hook falha em silencio, o sintoma seria
  // simplesmente parar de injetar. Foi assim que apareceu, sob BRAIN_HOOK_DEBUG=1.
  const brutos = db
    .prepare(
      'SELECT * FROM (' + lado('de', 'para') + ' UNION ' + lado('para', 'de') + ')' +
        " ORDER BY (doc_type IN ('spec','tech-spec','prd')) DESC, data DESC, chave ASC"
    )
    .all(ent.id, ent.id)
    .filter((v) => v.id !== ent.id); // aresta reflexiva nao se injeta a si mesma duas vezes

  const grupos = ORDEM_TIPO.map((t) => brutos.filter((v) => v.tipo === t)).filter((g) => g.length);
  const saida = [];
  for (let rodada = 0; saida.length < limite; rodada++) {
    let rendeu = false;
    for (const g of grupos) {
      if (rodada >= g.length) continue;
      saida.push(g[rodada]);
      rendeu = true;
      if (saida.length >= limite) break;
    }
    if (!rendeu) break; // todos os grupos esgotados antes de o teto encher
  }
  return saida;
};

const LIMITE_BRUTO = 24; // sobre-busca porque o filtro de workspace corta boa parte
const LIMITE_FINAL = 5;
const SNIP = 220;

const LIMITE_JEV = 10; // quantos candidatos do passo 5 vao ao Jev
const LIMIAR_JEV = 0.5; // provisorio: ver ### Limiar da spec do #42
const INSTRUCAO_JEV = 'O trecho é relevante para o que o usuário pediu na pergunta?';
// O hook passa o prazo do cliente explicito e corre contra ele + 200: as duas constantes ficam
// amarradas aqui, e um TIMEOUT_MS diferente no jev.js nao separa uma da outra sem aviso. O prazo
// proprio nao e derivado do jev.js de proposito: ele existe para o caso do jev.js quebrado.
const TIMEOUT_JEV = 2000;
const PRAZO_HOOK_JEV = TIMEOUT_JEV + 200;

// O uso so liga com `contexto` na lista; conferido aqui para nem carregar o jev.js sem ele.
const usaJev = () =>
  String(process.env.BRAIN_JEV || '')
    .split(',')
    .some((u) => u.trim().toLowerCase() === 'contexto');

// Vazio ou fora de [0,1] vale o padrao: permite medir outros limiares sem PR, sem arriscar um valor absurdo.
const limiarJev = () => {
  const s = String(process.env.BRAIN_JEV_LIMIAR_CONTEXTO || '').trim();
  const n = s ? Number(s) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : LIMIAR_JEV;
};

// Devolve { estado: 'ok', passaram, enviados, lista, limiar, notas } ou { estado, motivo?, enviados?,
// limiar? } com estado 'sem_chave' | 'sem_enviaveis' | 'indisponivel' | 'prazo_hook' | 'erro'. So o
// `ok` filtra; o resto vale "filtro indisponivel, injete como hoje" (o chamador trata `sem_enviaveis`
// a parte: o bloco continua vazio, como sempre foi). O estado existe para a telemetria saber POR QUE
// nao filtrou. `enviados` e a contagem (o cabecalho do bloco a usa); `lista` sao os candidatos que
// foram ao Jev, e `notas[i]` e a probabilidade de `lista[i]` (a nota volta ao item pelo objeto).
const filtrarComJev = async (alvo, cands) => {
  let timer;
  try {
    const jev = require('./jev.js');
    if (!jev.ligado('contexto')) return { estado: 'sem_chave' };
    const limiar = limiarJev();
    // Candidato sem texto nao vai ao Jev (emenda 3 da spec do #42): o cliente o recusaria com
    // `entrada_invalida`, e isso abandonaria o filtro do prompt inteiro. Ele so fica fora do bloco
    // filtrado. Acontece porque o piso de tokens tambem le o breadcrumb.
    const enviados = cands.filter((r) => String(r.full_text || '') !== '');
    if (!enviados.length) return { estado: 'sem_enviaveis' };
    const prazo = new Promise((r) => {
      timer = setTimeout(() => r(null), PRAZO_HOOK_JEV);
    });
    const vs = await Promise.race([
      jev.julgar(
        alvo,
        enviados.map((r) => ({
          id: String(r.path),
          texto: String(r.full_text || ''),
          titulo: r.breadcrumb || '',
          fonte: r.source || '',
        })),
        {
          uso: 'contexto',
          instrucao: INSTRUCAO_JEV,
          timeoutMs: TIMEOUT_JEV,
          telemetria: { sessao: reg.sessao, prompt: reg.prompt },
        }
      ),
      prazo,
    ]);
    if (vs === null) return { estado: 'prazo_hook', enviados: enviados.length, limiar };
    if (!Array.isArray(vs) || vs.length !== enviados.length || vs.some((v) => !v)) {
      return { estado: 'erro', enviados: enviados.length, limiar };
    }
    const fora = vs.find((v) => v.estado !== 'ok');
    if (fora) {
      return { estado: 'indisponivel', motivo: fora.motivo, enviados: enviados.length, limiar };
    }
    if (DEBUG) {
      vs.forEach((v, i) =>
        process.stderr.write('[brain-contexto] jev ' + (i + 1) + ' ' + v.probabilidade + ' ' + enviados[i].path + '\n')
      );
    }
    return {
      estado: 'ok',
      passaram: enviados.filter((_, i) => vs[i].probabilidade >= limiar),
      enviados: enviados.length,
      lista: enviados,
      limiar,
      notas: vs.map((v) => v.probabilidade),
    };
  } catch (e) {
    if (DEBUG) process.stderr.write('[brain-contexto] jev ' + (e && e.stack ? e.stack : e) + '\n');
    return { estado: 'erro' };
  } finally {
    clearTimeout(timer);
  }
};

// A frase final e a MESMA nos dois caminhos (entidade e lexico) — constante, para nao derivarem.
const RODAPE =
  'Para a metade semantica, filtros por source/repo/feature, ou o documento inteiro, chame ' +
  'mcp__brain__search_context / mcp__brain__read_doc — carregue-as com ToolSearch. Nao vale abrir ' +
  'arquivo na mao antes disso.';

// Um slot do bloco. Os dois caminhos passam por aqui pelo mesmo motivo do RODAPE.
const linha = (i, titulo, meta, caminho, trecho) =>
  `${i}. ${titulo}\n   [${meta.filter(Boolean).join(' · ')}]\n   ${caminho}\n   ` +
  String(trecho || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SNIP);

// import() dinamico nao registra handle no libuv: sem isto o processo sai com codigo 0 antes de
// a promise resolver, e o hook "funciona" sem nunca imprimir nada. Foi exatamente o que aconteceu.
const manter = setInterval(() => {}, 1000);

// O evento `contexto` desta execucao, com todo campo no valor "nao chegou la" (spec do #66, §
// Contrato do evento). Cada ponto de saida preenche `desfecho` antes de chamar `fim`.
const reg = {
  ts: T0,
  evento: 'contexto',
  sessao: null,
  prompt: null,
  ws: null,
  tipo: null,
  comando: null,
  alvo_chars: null,
  alvo_tokens: null,
  desfecho: null,
  entidade: null,
  candidatos: null,
  jev: null,
  jev_motivo: null,
  grupo: null,
  enviados: null,
  aprovados: null,
  limiar: null,
  mostrados: 0,
  itens: [],
  ms_busca: null,
  ms_jev: null,
  ms_total: 0,
  erro: null,
};
let gravado = false;

// Ordem que importa: `ms_total` e medido ANTES da stdout, a stdout sai como sempre, e so depois
// vem a gravacao, com o `require` dentro do try. Um telemetria.js ausente, quebrado ou lento de
// disco nunca muda o que foi injetado. `gravado` evita a linha dupla quando a propria escrita da
// stdout lanca e o catch final chama `fim` de novo.
const fim = (saida) => {
  reg.ms_total = Date.now() - T0;
  if (saida) process.stdout.write(saida);
  clearInterval(manter);
  if (gravado) return;
  gravado = true;
  try {
    require('./telemetria.js').gravar(reg);
  } catch {}
};

// Corta o nome da funcao/arquivo do erro: so `e.name[:code]`, nunca `e.message` (mensagem de
// SQLite/FTS pode conter token do prompt, e o diario nao guarda texto do prompt).
const nomeDoErro = (e) => String((e && e.name) || 'Error') + (e && e.code ? ':' + e.code : '');

// A/B (claude-brain#66, CA3): com BRAIN_TELEMETRIA_AB=<p>, 0 < p <= 1, sorteia o prompt para
// `sem_filtro` (probabilidade p: o bloco sai como com o Jev desligado) ou `com_filtro` (o Jev filtra
// como hoje). Devolve `null` = sem sorteio. Tres condicoes, todas dentro de try (falha = sem A/B):
// - a telemetria ligada: tirar o filtro de um prompt sem medir o efeito e custo sem retorno;
// - o Jev de fato responderia (`ligado('contexto')`): sem chave todo `com_filtro` sairia sem filtro
//   e o dado seria jogado fora;
// - a variavel valida. O chamador so chega aqui com `usaJev()` e candidatos.
// Determinístico por `prompt_id` (SHA-256), sem estado: o mesmo prompt cai sempre no mesmo grupo e os
// dois grupos saem da mesma populacao. Sem `prompt_id`, sorteio comum.
const sortearGrupo = (promptId) => {
  try {
    if (!require('./telemetria.js').ligada()) return null;
    if (!require('./jev.js').ligado('contexto')) return null;
    const p = Number(process.env.BRAIN_TELEMETRIA_AB);
    if (!(Number.isFinite(p) && p > 0 && p <= 1)) return null;
    const u = promptId
      ? parseInt(require('crypto').createHash('sha256').update(promptId).digest('hex').slice(0, 8), 16) / 2 ** 32
      : Math.random();
    return u < p ? 'sem_filtro' : 'com_filtro';
  } catch {
    return null;
  }
};

// Itens do passo 5: os primeiros LIMITE_JEV candidatos, na ordem do ranking. `mostrado` e `prob`
// ligam ao item por IDENTIDADE DE OBJETO (o mesmo caminho pode vir em dois trechos), nunca por
// caminho. `trecho_sha` e o SHA-256 (12 hex) do texto que o Jev julgou. Dentro de try: a telemetria
// nao pode derrubar a injecao.
const itensDoPasso5 = (primeiros, achados, jev) => {
  try {
    const crypto = require('crypto');
    const mostrados = new Set(achados);
    const nota = new Map();
    if (jev && jev.estado === 'ok') jev.lista.forEach((r, i) => nota.set(r, jev.notas[i]));
    return primeiros.map((r, i) => {
      const texto = String(r.full_text || '');
      return {
        caminho: String(r.path),
        fonte: r.source == null ? null : String(r.source),
        pos: i + 1,
        chunk: Number.isInteger(r.chunk_id) ? r.chunk_id : null,
        trecho_sha: texto ? crypto.createHash('sha256').update(texto).digest('hex').slice(0, 12) : null,
        prob: nota.has(r) ? nota.get(r) : null,
        mostrado: mostrados.has(r),
      };
    });
  } catch {
    return [];
  }
};

(async () => {
  try {
    // stdin ilegivel OU JSON malformado: `sem_payload`. A stdout nao muda (o malformado antes caia
    // no catch final e tambem nao imprimia nada).
    let h;
    try {
      h = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
    } catch {
      reg.desfecho = 'sem_payload';
      return fim();
    }
    if (h === null || typeof h !== 'object') {
      reg.desfecho = 'sem_payload';
      return fim();
    }
    if (typeof h.session_id === 'string' && h.session_id) reg.sessao = h.session_id;
    if (typeof h.prompt_id === 'string' && h.prompt_id) reg.prompt = h.prompt_id;
    // Payload inteiro sob BRAIN_HOOK_DEBUG=1: e assim que se confere um campo novo do harness
    // sem precisar de sonda temporaria no arquivo instalado. Foi o que respondeu o `source` abaixo.
    if (DEBUG) process.stderr.write('[brain-contexto] payload ' + JSON.stringify(h) + String.fromCharCode(10));

    // So prompt digitado por gente. Wakeups de loop/schedule e injecoes de sistema nao pedem contexto.
    //
    // Medido 2026-09-10 numa sessao INTERATIVA de verdade (nao no headless, que era a duvida):
    // o payload do UserPromptSubmit NAO traz a chave `source`. As chaves sao session_id,
    // transcript_path, cwd, prompt_id, permission_mode, hook_event_name, prompt — tanto no turno
    // de slash command (`/gm-implement 11-cerebro-em-slash-command`) quanto em prompt normal.
    // Logo o guard passa nos dois e nao ha nada a relaxar; se um dia aparecer valor novo, o dump
    // acima o mostra.
    if (h.source && h.source !== 'user') {
      reg.desfecho = 'ignorado';
      return fim();
    }

    const prompt = String(h.prompt || '').trim();

    // Slash command entra ANTES do guard de tamanho, e a ordem e o conserto.
    // Antes ele era descartado inteiro — 45% dos prompts medidos — e o guard de tamanho, que vinha
    // na frente, ainda matava `/gm-card #5` (11 chars) sem ninguem ver: 6 prompts reais do recorte
    // de 3 dias, todos da esteira deste repo.
    // O guard de <12 continua existindo para prompt normal e NAO muda: dos 168 prompts curtos
    // medidos, ZERO resolvem card ou feature — sao "ok", "sim", "continua". Mexer nele compra nada.
    const ehSlash = prompt.startsWith('/');
    const mSlash = ehSlash ? prompt.match(/^\/\S+\s*([\s\S]*)$/) : null;
    const arg = mSlash ? mSlash[1].trim() : '';
    // Telemetria: so o NOME do comando, e so se for um nome de verdade ('/home/x' tambem comeca com
    // barra e o hook o trata como slash, mas nao pode gravar caminho). Nunca o argumento.
    reg.tipo = ehSlash ? 'slash' : 'texto';
    if (ehSlash) {
      const nome = prompt.match(/^\/\S+/)[0];
      reg.comando = /^\/[a-z0-9:_-]+$/i.test(nome) ? nome : '(outro)';
    }
    reg.alvo_chars = ehSlash ? arg.length : prompt.length;

    // Sem argumento nao ha o que resolver, e injetar ali e desperdicio puro: medido, 82 dos 373
    // slash commands (22%) nao tem argumento e 62 deles sao `/clear` — o contexto injetado seria
    // descartado no turno seguinte.
    if ((ehSlash && !arg) || (!ehSlash && prompt.length < 12)) {
      // "ok", "continua" nao tem o que buscar
      reg.desfecho = 'curto';
      return fim();
    }

    // O alvo da busca e o ARGUMENTO quando o prompt e slash command. O nome do comando so
    // adiciona ruido, e ruido que reprova: `gm` e `explore` de `/gm-explore como funciona o
    // indexador` nao aparecem em resultado nenhum, e o filtro de relevancia la embaixo exige
    // metade dos tokens presentes — com a linha inteira, o passo 5 nunca injetaria.
    const alvo = ehSlash ? arg : prompt;

    const ws = cfg.doCwd(String(h.cwd || ''));
    if (ws && ws.nome != null) reg.ws = String(ws.nome);
    if (!ws || !ws.db || !fs.existsSync(ws.db)) {
      reg.desfecho = 'sem_indice';
      return fim();
    }

    // dist/ e ESM; este hook e CJS. import() dinamico atravessa.
    const dist = path.join(path.dirname(ws.db), '..', 'dist');
    const url = (f) => 'file:///' + path.join(dist, f).split(BS).join('/');
    const { openDb } = await import(url('db.js'));
    const { Buscador, tokensDe, normalizar } = await import(url('search.js'));
    reg.alvo_tokens = tokensDe(alvo).length;

    const db = openDb(ws.db);

    // Passos 1 a 4 — ENTIDADE. So para slash command: e o argumento de um comando que e chave de
    // grafo; prompt normal e texto corrido e vai direto para o passo 5.
    const ent = ehSlash ? resolverEntidade(db, ws, arg, String(h.cwd || '')) : null;
    if (DEBUG) {
      process.stderr.write(
        '[brain-contexto] arg=' + JSON.stringify(arg) + ' candidatos=' + JSON.stringify(candidatosDe(arg)) +
          ' entidade=' + (ent ? ent.chave : '(nenhuma)') + String.fromCharCode(10)
      );
    }

    // O que a entidade resolvida injeta: ela mesma no slot 1 e os vizinhos das `arestas` nos
    // demais. O teto de 5 e do BLOCO INTEIRO, entidade incluida.
    //
    // Entidade SEM doc_path — o caso de TODA `feature` (65/65), e tambem de `commit` (585/585) —
    // nao tem trecho a injetar e NAO ocupa slot: emitir o slot assim poe `null` no lugar do
    // caminho e trecho vazio, que foi o que o prototipo mostrou. Ela vira so o cabecalho, e os 5
    // slots vao todos para os vizinhos.
    //
    // Se, depois de tudo, o bloco ficaria VAZIO — entidade sem doc_path e nenhum vizinho com
    // documento, que e o caso de um indice sem grafo construido — cai para o passo 5 em vez de
    // emitir cabecalho sem conteudo nenhum.
    //
    // Este caminho NAO passa pelo daqui() nem pelo relevante() la embaixo, e e o ponto que decide
    // se a feature entrega alguma coisa: `entidades` nao tem coluna `source`, entao daqui() cairia
    // no ramo do repo, onde `decisao` tem repo NULL em 438/438 e `sessao` em 389/389 — o filtro
    // apagaria toda decisao e toda sessao, que sao justamente o que a esteira quer ler. Medido no
    // alvo do proprio CA-1: com daqui(), o bloco do card #11 perde as duas decisoes e sobra o
    // vizinho falso. E relevante() mataria ate a entidade, pelo motivo de sempre: tokensDe("11")
    // e ["11"]. A procedencia aqui vem da ARESTA explicita a partir de uma chave que o usuario
    // nomeou no argumento — nao e resultado de busca aberta, e nao precisa do filtro que existe
    // para busca aberta.
    if (ent) {
      const itens = ent.doc_path ? [ent] : [];
      for (const v of vizinhosDe(db, ent, LIMITE_FINAL - itens.length)) itens.push(v);

      if (itens.length) {
        const slots = itens.map((e, i) =>
          linha(i + 1, e.titulo || e.chave, [e.tipo, e.repo, e.status, e.data], e.doc_path, primeiroTrecho(db, e.doc_path))
        );
        // O cabecalho diz de onde veio E o que exatamente esta abaixo. Prometer "os vizinhos"
        // quando o grafo nao deu nenhum e mentira barata, e o caso existe: indice sem grafo
        // construido devolve a entidade sozinha.
        const nViz = itens.length - (ent.doc_path ? 1 : 0);
        const quantos = nViz === 1 ? '1 vizinho direto' : nViz + ' vizinhos diretos';
        const oQue = !nViz
          ? 'abaixo, so ela — o grafo nao tem vizinho com documento'
          : ent.doc_path
            ? 'abaixo, ela e ' + quantos
            : 'ela nao tem documento proprio; abaixo, ' + quantos;
        const texto =
          'Cerebro (o argumento do comando resolveu `' + ent.chave + '` no grafo do indice; ' +
          oQue + ' — voce nao gastou tool call nenhuma):\n\n' +
          slots.join('\n\n') +
          '\n\nIsto e a vizinhanca de UMA entidade, nao uma busca. ' +
          RODAPE;
        reg.desfecho = 'entidade';
        reg.entidade = ent.chave;
        reg.mostrados = itens.length;
        reg.itens = itens.map((e, i) => ({
          caminho: String(e.doc_path),
          fonte: e.tipo == null ? null : String(e.tipo),
          pos: i + 1,
          chunk: null,
          trecho_sha: null,
          prob: null,
          mostrado: true,
        }));
        return fim(
          JSON.stringify({
            hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: texto },
            suppressOutput: true,
          })
        );
      }
    }

    // Passo 5 da precedencia — TEXTO. Argumento curto demais nao da busca: `#5` acha o mundo.
    if (ehSlash && arg.length < 12) {
      reg.desfecho = 'curto';
      return fim();
    }

    // vec=null: a metade semantica exige carregar o transformer, caro demais por prompt.
    // O Buscador degrada sozinho para lexico puro (~90ms).
    const tBusca = Date.now();
    const { resultados } = await new Buscador(db, null).buscar(alvo, {}, LIMITE_BRUTO);
    reg.ms_busca = Date.now() - tBusca;

    const pref = barras(ws.prefixo);
    const lista = (ws.repos || ws.exceto || []).map((s) => String(s).toLowerCase());
    const daqui = (r) => {
      if (POR_PATH.has(r.source)) return barras(r.path).startsWith(pref);
      const repo = String(r.repo || '').toLowerCase();
      if (!repo) return false;
      return ws.repos ? lista.includes(repo) : !lista.includes(repo);
    };

    // Piso de relevancia. O score do Buscador e RRF puro (rank), entao vale ~0.0166 tanto para
    // o acerto em cheio quanto para o lixo — nao serve de corte. O que separa e quantos tokens da
    // pergunta aparecem mesmo no resultado: medido, on-topic fica em 3+ e off-topic em 1-2. Sem
    // isto, um "qual a receita de bolo de cenoura" injetaria 5 resultados de ruido.
    const toks = tokensDe(alvo);
    const minimo = Math.min(2, toks.length);
    const relevante = (r) => {
      const hay = normalizar((r.breadcrumb || '') + ' ' + (r.full_text || ''));
      const n = toks.filter((t) => hay.includes(t)).length;
      return n >= minimo && n / toks.length >= 0.5;
    };

    // Filtro do Jev (#42), so com `contexto` em BRAIN_JEV. Tres escolhas:
    // - o piso de tokens vem ANTES do Jev: o filtro so tira candidato, entao o que sai da maquina
    //   diminui, e sem candidato o cliente nem e chamado;
    // - um `indisponivel` em QUALQUER trecho abandona o filtro inteiro (jev = null): um bloco
    //   julgado pela metade nao seria nem o de hoje nem o filtrado;
    // - o hook tem prazo proprio (PRAZO_HOOK_JEV) porque nao pode ficar preso num jev.js quebrado.
    // A ordem do ranking e mantida; o Jev so decide quem fica.
    const candidatos = resultados.filter(daqui).filter(relevante);
    let achados = candidatos.slice(0, LIMITE_FINAL);
    reg.candidatos = candidatos.length;

    // `r` e o retorno inteiro de filtrarComJev (com o `estado`); `jev` e o que o resto do caminho
    // usa e e `null` fora do `ok`, como sempre foi: so o estado e novo, a stdout nao muda.
    // O sorteio do A/B vem imediatamente antes da chamada. `sem_filtro`: nao chama o Jev, `r` fica
    // null e o bloco sai EXATAMENTE como com o Jev desligado.
    if (candidatos.length && usaJev()) reg.grupo = sortearGrupo(reg.prompt);
    let r = null;
    if (candidatos.length && !usaJev()) {
      reg.jev = 'desligado';
    } else if (reg.grupo === 'sem_filtro') {
      reg.jev = 'sem_filtro_ab';
    } else if (candidatos.length) {
      const tJev = Date.now();
      r = await filtrarComJev(alvo, candidatos.slice(0, LIMITE_JEV));
      reg.ms_jev = Date.now() - tJev;
      reg.jev = r.estado;
      if (r.estado === 'indisponivel') reg.jev_motivo = r.motivo == null ? null : String(r.motivo);
      if (r.enviados != null) reg.enviados = r.enviados;
      if (r.limiar != null) reg.limiar = r.limiar;
    }
    const jev = r && r.estado === 'ok' ? r : null;
    if (jev) {
      achados = jev.passaram.slice(0, LIMITE_FINAL);
      reg.aprovados = jev.passaram.length;
    } else if (r && r.estado === 'sem_enviaveis') {
      // Todos sem texto: o bloco filtrado sai vazio, como antes (nao e "filtro indisponivel").
      achados = [];
    }
    reg.itens = itensDoPasso5(candidatos.slice(0, LIMITE_JEV), achados, jev);
    if (!achados.length) {
      reg.desfecho = jev ? 'jev_reprovou_tudo' : r && r.estado === 'sem_enviaveis' ? 'sem_enviaveis' : 'sem_candidatos';
      return fim();
    }
    reg.desfecho = 'injetado';
    reg.mostrados = achados.length;

    const linhas = achados.map((r, i) =>
      linha(
        i + 1,
        r.breadcrumb,
        [r.source, r.repo, r.feature, r.doc_type !== 'doc' ? r.doc_type : null, r.status, r.data],
        r.path,
        r.snip
      )
    );

    // "busca lexica automatica" fica no cabecalho filtrado de proposito: e o que o motivo() do
    // injecao.mjs usa para contar `texto`.
    const cabecalho = jev
      ? 'Cerebro (busca lexica automatica sobre este prompt, filtrada pelo Jev: ' +
        jev.passaram.length + ' de ' + jev.enviados + ' candidatos passaram; abaixo, os ' + achados.length +
        ' primeiros — voce nao gastou tool call nenhuma):\n\n'
      : 'Cerebro (busca lexica automatica sobre este prompt — voce nao gastou tool call nenhuma):\n\n';
    const fecho = jev
      ? '\n\nIsto e so a metade lexica, filtrada pelo Jev (limiar ' + jev.limiar + '). '
      : '\n\nIsto e so a metade lexica e os 5 primeiros. ';
    const texto = cabecalho + linhas.join('\n\n') + fecho + RODAPE;

    fim(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: texto },
        suppressOutput: true,
      })
    );
  } catch (e) {
    if (DEBUG) process.stderr.write('[brain-contexto] ' + (e && e.stack ? e.stack : e) + '\n');
    reg.desfecho = 'erro';
    reg.erro = nomeDoErro(e);
    fim();
  }
})();
