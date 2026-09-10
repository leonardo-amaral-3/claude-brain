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

const LIMITE_BRUTO = 24; // sobre-busca porque o filtro de workspace corta boa parte
const LIMITE_FINAL = 5;
const SNIP = 220;

// import() dinamico nao registra handle no libuv: sem isto o processo sai com codigo 0 antes de
// a promise resolver, e o hook "funciona" sem nunca imprimir nada. Foi exatamente o que aconteceu.
const manter = setInterval(() => {}, 1000);
const fim = (saida) => {
  if (saida) process.stdout.write(saida);
  clearInterval(manter);
};

(async () => {
  try {
    let bruto = '';
    try {
      bruto = fs.readFileSync(0, 'utf8');
    } catch {
      return fim();
    }
    const h = JSON.parse(bruto || '{}');
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
    if (h.source && h.source !== 'user') return fim();

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

    // Sem argumento nao ha o que resolver, e injetar ali e desperdicio puro: medido, 82 dos 373
    // slash commands (22%) nao tem argumento e 62 deles sao `/clear` — o contexto injetado seria
    // descartado no turno seguinte.
    if (ehSlash && !arg) return fim();
    if (!ehSlash && prompt.length < 12) return fim(); // "ok", "continua" nao tem o que buscar

    // O alvo da busca e o ARGUMENTO quando o prompt e slash command. O nome do comando so
    // adiciona ruido, e ruido que reprova: `gm` e `explore` de `/gm-explore como funciona o
    // indexador` nao aparecem em resultado nenhum, e o filtro de relevancia la embaixo exige
    // metade dos tokens presentes — com a linha inteira, o passo 5 nunca injetaria.
    const alvo = ehSlash ? arg : prompt;

    const ws = cfg.doCwd(String(h.cwd || ''));
    if (!ws || !ws.db || !fs.existsSync(ws.db)) return fim();

    // dist/ e ESM; este hook e CJS. import() dinamico atravessa.
    const dist = path.join(path.dirname(ws.db), '..', 'dist');
    const url = (f) => 'file:///' + path.join(dist, f).split(BS).join('/');
    const { openDb } = await import(url('db.js'));
    const { Buscador, tokensDe, normalizar } = await import(url('search.js'));

    const db = openDb(ws.db);

    // Passo 5 da precedencia — TEXTO. Argumento curto demais nao da busca: `#5` acha o mundo.
    // (Os passos 1-4, que resolvem o argumento contra o grafo, entram antes desta linha.)
    if (ehSlash && arg.length < 12) return fim();

    // vec=null: a metade semantica exige carregar o transformer, caro demais por prompt.
    // O Buscador degrada sozinho para lexico puro (~90ms).
    const { resultados } = await new Buscador(db, null).buscar(alvo, {}, LIMITE_BRUTO);

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

    const achados = resultados.filter(daqui).filter(relevante).slice(0, LIMITE_FINAL);
    if (!achados.length) return fim();

    const linhas = achados.map((r, i) => {
      const meta = [r.source, r.repo, r.feature, r.doc_type !== 'doc' ? r.doc_type : null, r.status, r.data]
        .filter(Boolean)
        .join(' · ');
      const snip = String(r.snip || '').replace(/\s+/g, ' ').trim().slice(0, SNIP);
      return `${i + 1}. ${r.breadcrumb}\n   [${meta}]\n   ${r.path}\n   ${snip}`;
    });

    const texto =
      'Cerebro (busca lexica automatica sobre este prompt — voce nao gastou tool call nenhuma):\n\n' +
      linhas.join('\n\n') +
      '\n\nIsto e so a metade lexica e os 5 primeiros. Para a metade semantica, filtros por ' +
      'source/repo/feature, ou o documento inteiro, chame mcp__brain__search_context / ' +
      'mcp__brain__read_doc — carregue-as com ToolSearch. Nao vale abrir arquivo na mao antes disso.';

    fim(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: texto },
        suppressOutput: true,
      })
    );
  } catch (e) {
    if (DEBUG) process.stderr.write('[brain-contexto] ' + (e && e.stack ? e.stack : e) + '\n');
    fim();
  }
})();
