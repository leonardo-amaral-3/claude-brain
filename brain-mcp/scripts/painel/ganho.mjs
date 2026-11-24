// Secao `Ganho` do painel (F2, card #68 do epico #66): o que a injecao de contexto rendeu.
//
// Exporta `secao(ctx)` (interface de secao do painel) e `medirAproveitamento(eventos, ctx)`, que a
// F3 consome. So le: o diario (`ctx.eventos`), os transcripts (`ctx.projetos`) e o `uso` (`ctx.db`).
// A saida nunca traz caminho nem texto de prompt (R1).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Desfechos que entram: os dois primeiros tem trecho a aproveitar, os tres ultimos sao linha de base. */
export const DESFECHOS = new Set(["injetado", "entidade", "sem_candidatos", "sem_enviaveis", "jev_reprovou_tudo"]);

const norm = (s) => String(s).toLowerCase().replace(/\\/g, "/");
const basename = (s) => norm(s).split("/").pop() ?? "";

/** Tokens da rebusca: NFD sem acento, minusculas, `split(/[^a-z0-9]+/)`, comprimento >= 3. */
export function tokens(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/** Texto de uma entrada `user`/`assistant`: o `content` string, ou a concatenacao dos blocos `text`. */
function textoDe(entrada) {
  const c = entrada?.message?.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  return c.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
}

const blocos = (entrada) => (Array.isArray(entrada?.message?.content) ? entrada.message.content : []);

/** Entrada de prompt (P16): usuario de verdade, nao tool_result, nao meta, nao comando local nem resumo. */
function ehPrompt(e) {
  if (e?.type !== "user" || e.isSidechain === true || e.isMeta === true || e.isCompactSummary === true) return false;
  if (blocos(e).some((b) => b?.type === "tool_result")) return false;
  return !textoDe(e).trimStart().startsWith("<local-command");
}

/** O texto do prompt do turno: com `<command-name>`, e `nome + ' ' + args`. */
function textoDoPrompt(e) {
  const t = textoDe(e);
  const nome = /<command-name>([\s\S]*?)<\/command-name>/.exec(t);
  if (!nome) return t;
  const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(t);
  return `${nome[1]} ${args ? args[1] : ""}`;
}

/** Folhas string do `input` de um tool_use, recursivamente. */
function* folhas(v) {
  if (typeof v === "string") yield v;
  else if (Array.isArray(v)) for (const x of v) yield* folhas(x);
  else if (v && typeof v === "object") for (const x of Object.values(v)) yield* folhas(x);
}

// Le um transcript (projetos/<dir>/<sessao>.jsonl); `null` se nao existe.
function lerTranscript(projetos, dirs, sessao) {
  if (typeof sessao !== "string" || sessao === "") return null;
  for (const d of dirs) {
    const arq = join(projetos, d, `${sessao}.jsonl`);
    if (!existsSync(arq)) continue;
    const entradas = [];
    for (const linha of readFileSync(arq, "utf8").split("\n")) {
      if (!linha.trim()) continue;
      try {
        entradas.push(JSON.parse(linha));
      } catch {
        /* linha invalida no transcript: ignora */
      }
    }
    return entradas;
  }
  return null;
}

const distintos = (lista) => [...new Set(lista)];

/**
 * @param {object[]} eventos eventos `contexto` (os de outro tipo ou desfecho sao ignorados)
 * @param {{ projetos: string }} ctx
 * @returns {Map<string, { par: 'promptId'|'horario'|'sem_par'|'sem_transcript', mostrados: string[], abertos: string[], citados: string[], rebusca: boolean }>}
 */
export function medirAproveitamento(eventos, ctx) {
  const saida = new Map();
  let dirs = [];
  try {
    dirs = readdirSync(ctx.projetos);
  } catch {
    /* sem pasta de projetos: tudo vira sem_transcript */
  }
  const cache = new Map();
  const transcript = (sessao) => {
    if (!cache.has(sessao)) cache.set(sessao, lerTranscript(ctx.projetos, dirs, sessao));
    return cache.get(sessao);
  };

  for (const ev of eventos) {
    if (ev?.evento !== "contexto" || !DESFECHOS.has(ev.desfecho)) continue;
    const chave = `${ev.sessao}|${ev.prompt ?? "ts:" + ev.ts}`;
    const mostrados = distintos((ev.itens ?? []).filter((i) => i?.mostrado && typeof i.caminho === "string").map((i) => i.caminho));
    const vazia = (par) => ({ par, mostrados, abertos: [], citados: [], rebusca: false });

    const entradas = transcript(ev.sessao);
    if (!entradas) {
      saida.set(chave, vazia("sem_transcript"));
      continue;
    }
    const prompts = entradas.map((e, i) => [e, i]).filter(([e]) => ehPrompt(e));
    let par = "promptId";
    let turno = ev.prompt != null ? prompts.find(([e]) => e.promptId === ev.prompt) : undefined;
    if (!turno) {
      par = "horario";
      turno = prompts.find(([e]) => {
        const t = Date.parse(e.timestamp);
        return Number.isFinite(t) && t >= ev.ts - 2000 && t <= ev.ts + 15000;
      });
    }
    if (!turno) {
      saida.set(chave, vazia("sem_par"));
      continue;
    }

    const [entradaTurno, ini] = turno;
    const textoPrompt = norm(textoDoPrompt(entradaTurno));
    const janela = [];
    for (let i = ini + 1; i < entradas.length; i++) {
      const e = entradas[i];
      // Sem promptId no turno, `undefined !== undefined` nunca fecharia a janela: qualquer prompt seguinte fecha.
      if (ehPrompt(e) && (entradaTurno.promptId == null || e.promptId !== entradaTurno.promptId)) break;
      if (e?.isSidechain === true) continue;
      if (e?.type === "assistant") janela.push(e);
    }

    const usos = janela.flatMap((e) => blocos(e).filter((b) => b?.type === "tool_use"));
    const folhasTools = usos.flatMap((b) => [...folhas(b.input)].map(norm));
    const textos = janela.flatMap((e) => blocos(e).filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => norm(b.text)));

    const abertos = [];
    const citados = [];
    for (const caminho of mostrados) {
      const c = norm(caminho);
      if (folhasTools.some((f) => f.includes(c))) abertos.push(caminho);
      const base = basename(caminho);
      const porBase = base.length >= 12 && !textoPrompt.includes(base);
      if (textos.some((t) => t.includes(c) || (porBase && t.includes(base)))) citados.push(caminho);
    }

    const toksPrompt = new Set(tokens(textoPrompt));
    const rebusca = usos.some((b) => {
      if (b.name !== "mcp__brain__search_context") return false;
      const q = distintos(tokens(b.input?.query ?? ""));
      return q.length > 0 && q.filter((t) => toksPrompt.has(t)).length * 2 >= q.length;
    });

    saida.set(chave, { par, mostrados, abertos, citados, rebusca });
  }
  return saida;
}

// ---------------------------------------------------------------------------------------------
// A secao

const fmtPct = (n, d) => (d > 0 ? ((100 * n) / d).toFixed(1).replace(".", ",") + "%" : "n/d");
const soma = (xs) => xs.reduce((a, b) => a + b, 0);
const JANELA_USO_MS = 30 * 60 * 1000;
const COM_INJECAO = new Set(["injetado", "entidade"]);
const SEM_BLOCO = new Set(["sem_candidatos", "sem_enviaveis", "jev_reprovou_tudo"]);

/** Taxas de um conjunto de medidas com par: trechos, aproveitamento, prompts com algum aproveitado, rebusca. */
function taxas(medidas) {
  const mostrados = soma(medidas.map((m) => m.mostrados.length));
  const abertos = soma(medidas.map((m) => m.abertos.length));
  const citados = soma(medidas.map((m) => m.citados.length));
  const aprov = (m) => distintos([...m.abertos, ...m.citados]).length;
  const aproveitados = soma(medidas.map(aprov));
  return {
    prompts: medidas.length,
    mostrados,
    abertos,
    citados,
    aproveitados,
    comAlgum: medidas.filter((m) => aprov(m) > 0).length,
    rebusca: medidas.filter((m) => m.rebusca).length,
  };
}

function linhasTaxas(t) {
  return [
    `  trechos mostrados ${t.mostrados}, aproveitados ${t.aproveitados} (abertos ${t.abertos}, citados ${t.citados}); taxa de aproveitamento ${fmtPct(t.aproveitados, t.mostrados)}`,
    `  prompts com ao menos um trecho aproveitado: ${t.comAlgum} de ${t.prompts} (${fmtPct(t.comAlgum, t.prompts)})`,
    `  rebusca: ${t.rebusca} de ${t.prompts} (${fmtPct(t.rebusca, t.prompts)})`,
  ];
}

/** Caminho de um `read_doc` em `uso.args` (cortado em 500): JSON inteiro, ou o regex no JSON truncado. */
function caminhoDoArgs(args) {
  if (typeof args !== "string") return null;
  try {
    const p = JSON.parse(args)?.path;
    if (typeof p === "string") return p;
  } catch {
    /* args truncado: cai no regex */
  }
  const m = /"path":"((?:[^"\\]|\\.)*)"/.exec(args);
  if (!m) return null;
  try {
    return JSON.parse(`"${m[1]}"`);
  } catch {
    return m[1];
  }
}

function temColunaSessao(db) {
  try {
    return db.prepare("PRAGMA table_info(uso)").all().some((c) => c.name === "sessao");
  } catch {
    return false;
  }
}

/** O sinal do `uso`, sem transcript: buscas e leituras entre este evento e o proximo da sessao (teto 30 min). */
function linhasUso(ctx, comInjecao, todosContexto) {
  if (!ctx.db || !temColunaSessao(ctx.db)) return ["  uso sem sessão (servidor anterior à F2)"];
  const q = ctx.db.prepare("SELECT ts, tool, args FROM uso WHERE sessao = ? AND ts >= ? AND ts < ? AND tool IN ('search_context', 'read_doc')");
  let buscas = 0;
  let leituras = 0;
  let acertos = 0;
  for (const ev of comInjecao) {
    if (typeof ev.sessao !== "string") continue;
    const proximo = todosContexto.find((x) => x.sessao === ev.sessao && x.ts > ev.ts)?.ts ?? Infinity;
    const fim = Math.min(proximo, ev.ts + JANELA_USO_MS);
    const mostrados = new Set((ev.itens ?? []).filter((i) => i?.mostrado).map((i) => norm(i.caminho)));
    for (const r of q.all(ev.sessao, ev.ts, fim)) {
      if (r.tool === "search_context") buscas++;
      else {
        leituras++;
        const c = caminhoDoArgs(r.args);
        if (c !== null && mostrados.has(norm(c))) acertos++;
      }
    }
  }
  return [
    `  eventos com injeção: ${comInjecao.length}; chamadas a search_context na janela: ${buscas}; a read_doc: ${leituras}`,
    `  read_doc de caminho que a injeção mostrou: ${acertos}`,
  ];
}

/** Intervalo de Wilson de 95% (z = 1,96) para x sucessos em n; `null` sem amostra. */
export function wilson(x, n, z = 1.96) {
  if (n <= 0) return null;
  const p = x / n;
  const d = 1 + (z * z) / n;
  const centro = (p + (z * z) / (2 * n)) / d;
  const meia = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { lo: Math.max(0, centro - meia), hi: Math.min(1, centro + meia) };
}

const MIN_POR_GRUPO = 30;
const fmtNum = (n, d) => (d > 0 ? (n / d).toFixed(2).replace(".", ",") : "n/d");
const fmtIc = (x, n) => {
  const w = wilson(x, n);
  return `${fmtPct(x, n)}${w ? ` [${(100 * w.lo).toFixed(1).replace(".", ",")}%–${(100 * w.hi).toFixed(1).replace(".", ",")}%]` : ""}`;
};

/** Uma linha por grupo: prompts, medias por prompt e as duas proporcoes com Wilson, sempre sobre prompts. */
function linhaGrupo(nome, medidas) {
  const n = medidas.length;
  const aprov = (m) => distintos([...m.abertos, ...m.citados]).length;
  const comAlgum = medidas.filter((m) => aprov(m) > 0).length;
  const rebusca = medidas.filter((m) => m.rebusca).length;
  return [
    `  ${nome}: ${n} prompts; trechos mostrados por prompt ${fmtNum(soma(medidas.map((m) => m.mostrados.length)), n)}, aproveitados por prompt ${fmtNum(soma(medidas.map(aprov)), n)}`,
    `    com ao menos um aproveitado: ${comAlgum} de ${n}, ${fmtIc(comAlgum, n)}; com rebusca: ${rebusca} de ${n}, ${fmtIc(rebusca, n)}`,
  ];
}

/**
 * Comparacao A/B com e sem o filtro do Jev. A unidade e o prompt sorteado, nao o trecho: a taxa por
 * trecho favorece o filtro por construcao (ele mostra menos, e so os aprovados).
 */
function blocoAB(ctx, todos) {
  const sorteados = todos.filter((e) => e.grupo === "com_filtro" || e.grupo === "sem_filtro");
  if (sorteados.length === 0) return ["A/B com e sem o filtro do Jev: A/B desligado no período"];
  const medidas = medirAproveitamento(sorteados, ctx);
  const comPar = (grupo) =>
    sorteados
      .filter((e) => e.grupo === grupo)
      .map((e) => [e, medidas.get(`${e.sessao}|${e.prompt ?? "ts:" + e.ts}`)])
      .filter(([, m]) => m && (m.par === "promptId" || m.par === "horario"));
  const com = comPar("com_filtro");
  const sem = comPar("sem_filtro");
  const itt = (lista) => lista.map(([, m]) => m);
  const pp = com.filter(([e]) => e.jev === "ok");

  const out = [
    "A/B com e sem o filtro do Jev (a unidade é o prompt sorteado, com par no transcript):",
    "Primária, por intenção de tratar (todo prompt conta no grupo sorteado, inclusive com o Jev indisponível):",
    ...linhaGrupo("com_filtro", itt(com)),
    ...linhaGrupo("sem_filtro", itt(sem)),
    `Secundária, por protocolo (sai do com_filtro quem não teve jev = ok: ${com.length - pp.length} prompts):`,
    ...linhaGrupo("com_filtro", itt(pp)),
    ...linhaGrupo("sem_filtro", itt(sem)),
  ];

  const aprov = (m) => distintos([...m.abertos, ...m.citados]).length > 0;
  const xc = itt(com).filter(aprov).length;
  const xs = itt(sem).filter(aprov).length;
  const wc = wilson(xc, com.length);
  const ws = wilson(xs, sem.length);
  let veredito;
  if (com.length < MIN_POR_GRUPO || sem.length < MIN_POR_GRUPO) {
    veredito = `inconclusivo (algum grupo tem menos de ${MIN_POR_GRUPO} prompts: com_filtro ${com.length}, sem_filtro ${sem.length})`;
  } else if (wc.lo <= ws.hi && ws.lo <= wc.hi) {
    veredito = "inconclusivo (os intervalos de 95% da métrica principal se sobrepõem)";
  } else {
    veredito = `${xc / com.length > xs / sem.length ? "com_filtro" : "sem_filtro"} tem a maior porcentagem de prompts com ao menos um trecho aproveitado`;
  }
  out.push(`Veredito (primária): ${veredito}`);
  return out;
}

export async function secao(ctx) {
  const todos = (ctx.eventos ?? []).filter((e) => e?.evento === "contexto").sort((a, b) => a.ts - b.ts);
  // O sem_filtro e o desvio deliberado do A/B: a taxa normal e a do comportamento de producao.
  const normais = todos.filter((e) => e.grupo !== "sem_filtro");
  const medidas = medirAproveitamento(normais, ctx);
  const medidaDe = (e) => medidas.get(`${e.sessao}|${e.prompt ?? "ts:" + e.ts}`);

  const comInjecao = normais.filter((e) => COM_INJECAO.has(e.desfecho));
  const pareada = (e) => {
    const m = medidaDe(e);
    return m && (m.par === "promptId" || m.par === "horario") ? m : null;
  };
  const conta = (par) => comInjecao.filter((e) => medidaDe(e)?.par === par).length;

  const out = ["## Ganho"];
  out.push(
    `Prompts com injeção (fora do grupo sem_filtro): ${comInjecao.length}`,
    `  casados por promptId ${conta("promptId")}, por horário ${conta("horario")}; sem par no transcript ${conta("sem_par")}; sem transcript ${conta("sem_transcript")}`
  );

  const comPar = comInjecao.map(pareada).filter(Boolean);
  if (comPar.length === 0) {
    out.push("  nenhum prompt com injeção casou com transcript no período: sem taxa de aproveitamento");
  } else {
    out.push("Aproveitamento (só os prompts com par):", ...linhasTaxas(taxas(comPar)));
  }

  const base = normais.filter((e) => SEM_BLOCO.has(e.desfecho)).map(pareada).filter(Boolean);
  out.push(
    `Linha de base da rebusca (prompts sem bloco: sem_candidatos, sem_enviaveis, jev_reprovou_tudo): ${base.filter((m) => m.rebusca).length} de ${base.length} (${fmtPct(base.filter((m) => m.rebusca).length, base.length)})`,
    "  A rebusca tem base alta por construção (o rodapé do bloco manda chamar search_context): só vale comparada com a linha de base, nunca sozinha."
  );

  for (const desfecho of ["entidade", "injetado"]) {
    const ms = comInjecao.filter((e) => e.desfecho === desfecho).map(pareada).filter(Boolean);
    out.push(`Por desfecho, ${desfecho} (${ms.length} prompts com par):`);
    out.push(...(ms.length ? linhasTaxas(taxas(ms)) : ["  sem prompts"]));
  }

  out.push("Pelo uso (sem transcript):", ...linhasUso(ctx, comInjecao, todos));
  out.push(...blocoAB(ctx, todos));
  return out.join("\n");
}
