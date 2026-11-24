// Seção `Gabarito` do painel (F3 do épico #66): o julgamento humano contra o qual se mede o Jev.
//
// O Jev diz "este trecho responde ao prompt com probabilidade P"; o aproveitamento (F2) diz se o
// trecho foi usado. Nenhum dos dois sabe se o trecho *era* relevante — só uma pessoa lendo sabe. Este
// arquivo sorteia itens do diário (`amostrar`), deixa Leonardo julgá-los no terminal (`julgar`) e
// confronta o julgamento com o Jev (`secao`).
//
// Contrato com o agregador (F1, `painel.mjs`): exporta `secao(ctx)`, `amostrar(ctx, n, semente)` e
// `julgar(ctx, arquivo)`; as duas últimas devolvem `{ codigo, linhas }`. Nada aqui importa de `ganho.mjs`
// (F2): a regra da "entrada de prompt" é reimplementada, e a concordância usa `ctx.carregarSecao`.
//
// Privacidade (spec, `### Privacidade`): o arquivo de amostra é a ÚNICA cópia deliberada de texto —
// até 500 caracteres da pergunta e 600 do trecho, porque julgar exige ler os dois. Mora em
// `<ctx.dir>/gabarito/`, fora do repo. A saída que este módulo devolve nunca traz caminho nem texto.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MAX_PERGUNTA = 500;
const MAX_TRECHO = 600;
const N_PADRAO = 30;
// Janela do casamento por horário quando o transcript não conhece o `prompt_id` (spec, F2 passo 3).
const JANELA_ANTES_MS = 2000;
const JANELA_DEPOIS_MS = 15000;

// ---------------------------------------------------------------------------------------------
// Aleatoriedade determinística: a mesma semente sorteia os mesmos itens (CA5).

/** Hash de texto para uint32 (xmur3): a semente vira o estado inicial do mulberry32. */
function hashSemente(texto) {
  let h = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function mulberry32(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates sobre uma cópia. */
function embaralhar(lista, rnd) {
  const v = lista.slice();
  for (let i = v.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [v[i], v[j]] = [v[j], v[i]];
  }
  return v;
}

// ---------------------------------------------------------------------------------------------
// Transcript: a pergunta do turno (regra dos passos 1-2 da F2, reimplementada).

/** Corta em `max` unidades sem deixar meio par substituto no fim. */
function cortar(texto, max) {
  let s = texto.slice(0, max);
  const ult = s.charCodeAt(s.length - 1);
  if (texto.length > max && ult >= 0xd800 && ult <= 0xdbff) s = s.slice(0, -1);
  return s;
}

/** O texto da entrada `user`, ou `null` se ela não é prompt de gente (P16). */
function textoDePrompt(e) {
  if (e?.type !== "user" || e.isSidechain === true || e.isMeta === true || e.isCompactSummary === true) return null;
  const c = e.message?.content;
  let texto;
  if (typeof c === "string") texto = c;
  else if (Array.isArray(c)) {
    if (c.some((b) => b?.type === "tool_result")) return null;
    texto = c.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text).join("");
  } else return null;
  if (texto.startsWith("<local-command")) return null;
  if (texto.includes("<command-name>")) {
    const nome = /<command-name>([\s\S]*?)<\/command-name>/.exec(texto)?.[1] ?? "";
    const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(texto)?.[1] ?? "";
    return `${nome} ${args}`;
  }
  return texto;
}

/**
 * As entradas de prompt de um transcript: `{ promptId, ts, texto }` em ordem de leitura.
 * Linha que não é JSON é pulada: o Claude Code escreve o arquivo enquanto a sessão corre.
 */
function lerPrompts(arquivo) {
  const saida = [];
  for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
    if (!linha) continue;
    let e;
    try {
      e = JSON.parse(linha);
    } catch {
      continue;
    }
    const texto = textoDePrompt(e);
    if (texto === null) continue;
    saida.push({ promptId: typeof e.promptId === "string" ? e.promptId : null, ts: Date.parse(e.timestamp), texto });
  }
  return saida;
}

/** `<projetos>/<projeto>/<sessao>.jsonl`; `null` se a sessão é nula, estranha ou o arquivo não existe. */
function acharTranscript(projetos, sessao) {
  if (typeof sessao !== "string" || !/^[\w.-]+$/.test(sessao)) return null;
  let dirs;
  try {
    dirs = readdirSync(projetos);
  } catch {
    return null;
  }
  for (const d of dirs) {
    const arq = join(projetos, d, `${sessao}.jsonl`);
    if (existsSync(arq)) return arq;
  }
  return null;
}

/** Cache por rodada: um transcript é lido uma vez, por maior que seja. */
function criarPerguntas(ctx) {
  const cache = new Map();
  return function pergunta(ev) {
    const chave = String(ev.sessao);
    if (!cache.has(chave)) {
      const arq = acharTranscript(ctx.projetos, ev.sessao);
      let prompts = null;
      if (arq) {
        try {
          prompts = lerPrompts(arq);
        } catch {
          prompts = null;
        }
      }
      cache.set(chave, prompts);
    }
    const prompts = cache.get(chave);
    if (!prompts) return null;
    let turno = typeof ev.prompt === "string" ? prompts.find((p) => p.promptId === ev.prompt) : undefined;
    turno ??= prompts.find((p) => p.ts >= ev.ts - JANELA_ANTES_MS && p.ts <= ev.ts + JANELA_DEPOIS_MS);
    const texto = turno?.texto.trim();
    return texto ? cortar(texto, MAX_PERGUNTA) : null;
  };
}

// ---------------------------------------------------------------------------------------------
// Trecho: o texto exato que o Jev julgou, achado pelo SHA gravado no evento.

const sha12 = (texto) => createHash("sha256").update(texto).digest("hex").slice(0, 12);

/**
 * O `chunks.text` com `id = item.chunk` se o SHA bate; senão, entre os chunks do mesmo caminho, um
 * com o mesmo SHA (o documento foi reindexado e o id mudou). Nenhum bate → `null`: julgar outro texto
 * mediria outra coisa.
 */
function criarTrechos(db) {
  const porId = db.prepare("SELECT text FROM chunks WHERE id = ?");
  const porCaminho = db.prepare("SELECT c.text FROM chunks c JOIN docs d ON d.id = c.doc_id WHERE d.path = ?");
  return function trecho(item) {
    const direto = porId.get(item.chunk);
    if (direto && sha12(direto.text) === item.trecho_sha) return cortar(direto.text, MAX_TRECHO);
    for (const r of porCaminho.all(item.caminho)) {
      if (sha12(r.text) === item.trecho_sha) return cortar(r.text, MAX_TRECHO);
    }
    return null;
  };
}

// ---------------------------------------------------------------------------------------------
// amostrar

/** `--ws <nome>` de `ctx.args`, que pode ser objeto (`{ ws }`) ou a lista crua de argv. Ausente → null. */
function wsDe(args) {
  if (Array.isArray(args)) {
    const i = args.indexOf("--ws");
    return i >= 0 && typeof args[i + 1] === "string" ? args[i + 1] : null;
  }
  return typeof args?.ws === "string" && args.ws ? args.ws : null;
}

const doisDig = (n) => String(n).padStart(2, "0");

/** `AAAAMMDD-HHmm` em UTC. */
function carimbo(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${doisDig(d.getUTCMonth() + 1)}${doisDig(d.getUTCDate())}-${doisDig(d.getUTCHours())}${doisDig(d.getUTCMinutes())}`;
}

/**
 * Sorteia `n` itens (padrão 30) do universo — itens com `prob` de eventos `contexto` em que o Jev
 * respondeu `ok` — e grava `<ctx.dir>/gabarito/amostra-AAAAMMDD-HHmm.jsonl`.
 *
 * Estratificado: metade (para cima) entre os que o Jev aprovou, o resto entre os que reprovou. Sem os
 * dois lados o gabarito mediria só a precisão ou só a cobertura. Estrato curto completa com o outro.
 *
 * @returns {{ codigo: number, linhas: string[] }}
 */
export function amostrar(ctx, n = N_PADRAO, semente) {
  const alvo = n ?? N_PADRAO;
  if (!Number.isInteger(alvo) || alvo < 1) return { codigo: 2, linhas: [`amostrar: N inválido (${alvo}); use um inteiro ≥ 1`] };
  if (!ctx.db) return { codigo: 2, linhas: ["amostrar: sem índice (ctx.db nulo): o trecho julgado sai de chunks.text, e sem o banco não há como achá-lo"] };

  const agora = ctx.agora ?? Date.now();
  const rnd = mulberry32(hashSemente(typeof semente === "string" && semente ? semente : new Date(agora).toISOString().slice(0, 10)));
  const ws = wsDe(ctx.args);

  // Ordem total por ts (e identidade): o sorteio não pode depender da ordem em que o leitor entregou.
  const eventos = (ctx.eventos ?? [])
    .filter((e) => e?.evento === "contexto" && e.jev === "ok" && Array.isArray(e.itens) && (!ws || e.ws === ws))
    .sort((a, b) => a.ts - b.ts || String(a.sessao).localeCompare(String(b.sessao)) || String(a.prompt).localeCompare(String(b.prompt)));

  const vistos = new Set();
  const acima = [];
  const abaixo = [];
  for (const ev of eventos) {
    for (const item of ev.itens) {
      // Sem chunk ou sem SHA não há como recuperar o texto julgado: fora do universo.
      if (typeof item?.prob !== "number" || !Number.isInteger(item.chunk) || typeof item.trecho_sha !== "string") continue;
      const chave = `${ev.sessao}|${ev.prompt ?? "ts:" + ev.ts}|${item.pos}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      (item.prob >= ev.limiar ? acima : abaixo).push({ ev, item });
    }
  }

  const pergunta = criarPerguntas(ctx);
  const trecho = criarTrechos(ctx.db);
  const criado = new Date(agora).toISOString();

  /** Tira de `pool` (já embaralhado) até `k` itens que têm pergunta e trecho; o que não tem é descartado. */
  const tirar = (pool, k) => {
    const saida = [];
    while (saida.length < k && pool.length) {
      const { ev, item } = pool.shift();
      const p = pergunta(ev);
      if (!p) continue;
      const t = trecho(item);
      if (t === null) continue;
      saida.push({
        v: 1, criado, sessao: ev.sessao, prompt: ev.prompt, ts_evento: ev.ts, caminho: item.caminho, fonte: item.fonte ?? null,
        pos: item.pos, chunk: item.chunk, prob: item.prob, limiar: ev.limiar, mostrado: item.mostrado === true,
        grupo: ev.grupo ?? null, pergunta: p, trecho: t, julgamento: null, nota: "",
      });
    }
    return saida;
  };

  const pa = embaralhar(acima, rnd);
  const pb = embaralhar(abaixo, rnd);
  const metade = Math.ceil(alvo / 2);
  const dosAcima = tirar(pa, metade);
  const dosAbaixo = tirar(pb, alvo - metade);
  // O estrato que ficou curto é completado pelo outro, até onde o outro der.
  const faltaAcima = metade - dosAcima.length;
  const faltaAbaixo = alvo - metade - dosAbaixo.length;
  if (faltaAcima > 0) dosAbaixo.push(...tirar(pb, faltaAcima));
  if (faltaAbaixo > 0) dosAcima.push(...tirar(pa, faltaAbaixo));
  const itens = [...dosAcima, ...dosAbaixo];

  if (!itens.length) {
    return { codigo: 2, linhas: [`amostrar: universo vazio${ws ? ` para o workspace ${ws}` : ""}: nenhum item com probabilidade do Jev, com pergunta no transcript e com o trecho ainda no índice`] };
  }

  const dir = join(ctx.dir, "gabarito");
  const nome = `amostra-${carimbo(agora)}.jsonl`;
  mkdirSync(dir, { recursive: true });
  try {
    // `wx`: um segundo --amostrar no mesmo minuto não pode apagar um arquivo que já está sendo julgado.
    writeFileSync(join(dir, nome), itens.map((i) => JSON.stringify(i)).join("\n") + "\n", { flag: "wx" });
  } catch (e) {
    if (e.code === "EEXIST") return { codigo: 2, linhas: [`amostrar: ${nome} já existe (mesmo minuto); espere um minuto ou use outra rodada`] };
    throw e;
  }

  const linhas = [
    `amostra criada: ${nome}`,
    `itens: ${itens.length} de ${alvo} pedidos (${dosAcima.length} aprovados pelo Jev, ${dosAbaixo.length} reprovados)`,
  ];
  if (itens.length < alvo) linhas.push(`faltaram ${alvo - itens.length}: o universo válido acabou (itens sem pergunta no transcript ou sem o trecho no índice foram descartados)`);
  linhas.push("o arquivo guarda texto de prompt e de trecho: fica em gabarito/ no diário, fora do repo; apagar é manual");
  return { codigo: 0, linhas };
}

// ---------------------------------------------------------------------------------------------
// julgar e secao: entram nas tasks 2 e 3 do card #69.

/** @returns {Promise<{ codigo: number, linhas: string[] }>} */
export async function julgar() {
  return { codigo: 2, linhas: ["julgar: ainda não implementado"] };
}

/** @returns {Promise<string>} */
export async function secao() {
  return "Gabarito: seção ainda não implementada";
}
