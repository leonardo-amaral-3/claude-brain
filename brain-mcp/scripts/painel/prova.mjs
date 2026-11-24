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
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

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
  const shaDoCaminho = new Map(); // caminho → Map(sha → texto): a rodada lê e faz o SHA de cada documento uma vez
  return function trecho(item) {
    const direto = porId.get(item.chunk);
    if (direto && sha12(direto.text) === item.trecho_sha) return cortar(direto.text, MAX_TRECHO);
    if (!shaDoCaminho.has(item.caminho)) {
      const m = new Map();
      for (const r of porCaminho.all(item.caminho)) {
        const h = sha12(r.text);
        if (!m.has(h)) m.set(h, r.text);
      }
      shaDoCaminho.set(item.caminho, m);
    }
    const achado = shaDoCaminho.get(item.caminho).get(item.trecho_sha);
    return achado === undefined ? null : cortar(achado, MAX_TRECHO);
  };
}

/** Texto de transcript e de chunk vai ao terminal: escape e controle (ANSI, OSC, `\r`) não podem reescrever a tela. */
function limpar(t) {
  return String(t ?? "").replace(/\x1b(?:\[[0-?]*[ -\/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)?|.)?/g, "").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
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
      // Sem limiar numérico o evento não diz de que lado do corte o item caiu: estrato indefinido, fora.
      if (typeof ev.limiar !== "number") continue;
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
// julgar

/** A resposta digitada → 'sim' | 'nao' | 'pular' | 'sair' | null (não entendi, pergunta de novo). */
function interpretar(texto) {
  const t = texto.trim().toLowerCase();
  if (t === "s" || t === "sim") return "sim";
  if (t === "n" || t === "nao" || t === "não") return "nao";
  if (t === "p" || t === "pular") return "pular";
  if (t === "q" || t === "sair") return "sair";
  return null;
}

/** Reescreve o arquivo inteiro por um temporário + rename: morrer no meio nunca deixa meio gabarito. */
function reescrever(arquivo, linhas) {
  const tmp = `${arquivo}.tmp-${process.pid}`;
  writeFileSync(tmp, linhas.join("\n") + "\n");
  renameSync(tmp, arquivo);
}

/** Só o nome (o que `--amostrar` imprime) procura em `gabarito/`; com diretório, é o caminho dado. */
function resolverArquivo(ctx, arquivo) {
  return /[\\/]/.test(arquivo) ? arquivo : join(ctx.dir, "gabarito", arquivo);
}

/**
 * Julga no terminal os itens da amostra com `julgamento: null`: mostra pergunta, trecho e `prob` e
 * pergunta `[s]im relevante, [n]ão, [p]ular, [q] sair`. Grava a cada resposta, então sair no meio
 * (ou fechar o terminal) não perde nada.
 *
 * Esta é a ÚNICA saída do painel que mostra texto de prompt e de trecho: vai direto ao terminal de
 * quem julga (`ctx.stdout`, padrão `process.stdout`) e nunca ao `linhas` que o agregador devolve, que
 * só leva contagens. `ctx.stdin` (padrão `process.stdin`) existe para o teste dar um terminal falso.
 *
 * Arquivo ausente ou ilegível é argumento inválido → código 2, a mesma regra do agregador.
 *
 * @returns {Promise<{ codigo: number, linhas: string[] }>}
 */
export async function julgar(ctx, arquivo) {
  const entrada = ctx.stdin ?? process.stdin;
  const saida = ctx.stdout ?? process.stdout;
  if (!entrada.isTTY) return { codigo: 2, linhas: ["julgar: precisa de um terminal interativo (stdin não é TTY); rode `npm run painel -- --julgar <arquivo>` num terminal"] };
  if (typeof arquivo !== "string" || !arquivo) return { codigo: 2, linhas: ["julgar: faltou o arquivo da amostra (`--julgar <arquivo>`)"] };

  const caminho = resolverArquivo(ctx, arquivo);
  let brutas;
  try {
    brutas = readFileSync(caminho, "utf8").split("\n").filter(Boolean);
  } catch {
    return { codigo: 2, linhas: [`julgar: não consegui ler ${arquivo}`] };
  }
  // Linha que não é JSON fica como está: o arquivo é do Leonardo, e reescrevê-lo não pode comer nada.
  const itens = brutas.map((l) => {
    try {
      const o = JSON.parse(l);
      return o && typeof o === "object" ? o : null;
    } catch {
      return null;
    }
  });
  const pendentes = itens.map((o, i) => (o && o.julgamento === null ? i : -1)).filter((i) => i >= 0);
  if (!pendentes.length) return { codigo: 0, linhas: ["nada a julgar: todos os itens já têm julgamento"] };

  const rl = createInterface({ input: entrada, terminal: false });
  const fila = [];
  let fim = false;
  let acorda = null;
  rl.on("line", (l) => {
    fila.push(l);
    acorda?.();
  });
  rl.on("close", () => {
    fim = true;
    acorda?.();
  });
  /** A próxima linha digitada, ou `null` quando a entrada acabou. */
  const proxima = async () => {
    while (!fila.length && !fim) await new Promise((r) => (acorda = r));
    acorda = null;
    return fila.length ? fila.shift() : null;
  };

  let sim = 0;
  let nao = 0;
  let puladas = 0;
  let saiu = false;
  for (const [k, i] of pendentes.entries()) {
    const it = itens[i];
    saida.write(`\n[${k + 1}/${pendentes.length}] prob ${it.prob}\nPergunta: ${limpar(it.pergunta)}\nTrecho:\n${limpar(it.trecho)}\n`);
    let resp = null;
    while (resp === null) {
      saida.write("o trecho é relevante para a pergunta? [s]im, [n]ão, [p]ular, [q] sair: ");
      const lida = await proxima();
      resp = lida === null ? "sair" : interpretar(lida);
    }
    if (resp === "sair") {
      saiu = true;
      break;
    }
    if (resp === "pular") {
      puladas++;
      continue;
    }
    it.julgamento = resp;
    brutas[i] = JSON.stringify(it);
    reescrever(caminho, brutas);
    if (resp === "sim") sim++;
    else nao++;
  }
  rl.close();

  const restantes = pendentes.length - sim - nao;
  return {
    codigo: 0,
    linhas: [`julgados agora: ${sim + nao} (${sim} sim, ${nao} não); pulados: ${puladas}; ainda sem julgamento: ${restantes}${saiu ? " (saiu antes do fim)" : ""}`],
  };
}

// ---------------------------------------------------------------------------------------------
// secao

const LIMIARES = [0.3, 0.4, 0.5, 0.6, 0.7];
const fmt = (x) => String(x).replace(".", ",");
const taxa = (a, b) => (b ? `${fmt(((100 * a) / b).toFixed(1))}% (${a}/${b})` : "n/d (0/0)");

/** Todos os itens julgados de `<dir>/gabarito/amostra-*.jsonl`, sem filtro de período: o gabarito acumula. */
function lerJulgados(dir) {
  const pasta = join(dir, "gabarito");
  let nomes = [];
  try {
    nomes = readdirSync(pasta).filter((n) => /^amostra-.*\.jsonl$/.test(n)).sort();
  } catch {
    return { itens: [], arquivos: 0 };
  }
  const itens = [];
  const vistos = new Set(); // o mesmo item sorteado em duas amostras conta uma vez (vale o primeiro julgado)
  const comJulgado = new Set();
  for (const nome of nomes) {
    for (const l of readFileSync(join(pasta, nome), "utf8").split("\n")) {
      if (!l) continue;
      try {
        const o = JSON.parse(l);
        if (o && (o.julgamento === "sim" || o.julgamento === "nao") && typeof o.prob === "number") {
          const chave = `${o.sessao}|${o.prompt ?? "ts:" + o.ts_evento}|${o.pos}`;
          if (vistos.has(chave)) continue;
          vistos.add(chave);
          itens.push(o);
          comJulgado.add(nome);
        }
      } catch {
        // linha estranha: o `julgar` também a preserva e segue
      }
    }
  }
  return { itens, arquivos: comJulgado.size };
}

/** Matriz de confusão do Jev contra o julgamento humano, com `aprovado(i)` dizendo o que o Jev fez. */
function confusao(itens, aprovado) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const i of itens) {
    const a = aprovado(i);
    const sim = i.julgamento === "sim";
    if (a && sim) tp++;
    else if (a) fp++;
    else if (sim) fn++;
    else tn++;
  }
  return { tp, fp, fn, tn, n: itens.length };
}

const resumo = (c) =>
  `precisão ${taxa(c.tp, c.tp + c.fp)} · cobertura ${taxa(c.tp, c.tp + c.fn)} · acurácia ${taxa(c.tp + c.tn, c.n)}`;

/** A concordância com o aproveitamento da F2, ou a linha que diz o que falta. */
async function concordancia(ctx, itens) {
  const mod = await ctx.carregarSecao?.("ganho");
  if (typeof mod?.medirAproveitamento !== "function") return ["concordância com o aproveitamento: precisa de painel/ganho.mjs (F2)"];
  // O gabarito é acumulado e pode ser anterior ao período do painel: lê os eventos dos itens, não os do ctx.
  const tss = itens.map((i) => i.ts_evento).filter(Number.isFinite);
  if (!tss.length) return ["concordância com o aproveitamento: nenhum item julgado traz ts_evento"];
  const lido = await ctx.lerEventos({ desde: Math.min(...tss) - 60000, ate: Math.max(...tss) + 60000 });
  const medidas = await mod.medirAproveitamento(Array.isArray(lido) ? lido : lido.eventos, ctx);
  const por = { sim: { n: 0, aprov: 0 }, nao: { n: 0, aprov: 0 } };
  let semMedida = 0;
  for (const i of itens.filter((x) => x.mostrado === true)) {
    const m = medidas.get(`${i.sessao}|${i.prompt ?? "ts:" + i.ts_evento}`);
    if (!m || m.par === "sem_par" || m.par === "sem_transcript") {
      semMedida++;
      continue;
    }
    por[i.julgamento].n++;
    if (m.abertos.includes(i.caminho) || m.citados.includes(i.caminho)) por[i.julgamento].aprov++;
  }
  return [
    "concordância com o aproveitamento (itens mostrados, com transcript):",
    `  julgados sim: aproveitados ${taxa(por.sim.aprov, por.sim.n)}`,
    `  julgados não: aproveitados ${taxa(por.nao.aprov, por.nao.n)}`,
    `  sem medida no transcript: ${semMedida}`,
  ];
}

/**
 * Seção `Gabarito`: sobre os itens julgados, a precisão e a cobertura do Jev no limiar gravado em cada
 * item e numa tabela de limiares hipotéticos (só mostra o efeito; não muda limiar nenhum). Só
 * contagens e taxas (R1): nem caminho nem texto.
 *
 * @returns {Promise<string>}
 */
export async function secao(ctx) {
  const { itens, arquivos } = lerJulgados(ctx.dir);
  if (!itens.length) return "Gabarito\n  gabarito vazio: rode --amostrar e --julgar";

  const limiares = [...new Set(itens.map((i) => i.limiar).filter((l) => typeof l === "number"))].sort((a, b) => a - b);
  const sim = itens.filter((i) => i.julgamento === "sim").length;
  const linhas = ["Gabarito", `  itens julgados: ${itens.length} em ${arquivos} arquivo(s) (${sim} sim, ${itens.length - sim} não)`];

  const gravados = itens.filter((i) => typeof i.limiar === "number");
  const c = confusao(gravados, (i) => i.prob >= i.limiar);
  linhas.push(
    `  no limiar gravado (${limiares.map(fmt).join(", ") || "n/d"}): VP ${c.tp} · FP ${c.fp} · FN ${c.fn} · VN ${c.tn}`,
    `    ${resumo(c)}`,
    "  (taxas da amostra, que sorteia metade acima e metade abaixo do limiar: não são as do universo)",
    "  limiares hipotéticos (mesmo gabarito, outro corte):"
  );
  for (const t of LIMIARES) linhas.push(`    ${fmt(t)}: ${resumo(confusao(itens, (i) => i.prob >= t))}`);

  try {
    linhas.push(...(await concordancia(ctx, itens)).map((l) => (l.startsWith(" ") ? l : "  " + l)));
  } catch (e) {
    linhas.push(`  concordância com o aproveitamento: indisponível (${e?.name ?? "erro"})`);
  }
  return linhas.join("\n");
}
