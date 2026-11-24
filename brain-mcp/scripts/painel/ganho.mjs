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
      if (ehPrompt(e) && e.promptId !== entradaTurno.promptId) break;
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

/** Placeholder: a task 3 escreve o texto da secao. */
export async function secao() {
  return "Ganho: (em construcao)";
}
