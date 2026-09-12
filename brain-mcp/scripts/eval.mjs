// Avaliação de retrieval: roda o golden set contra o servidor e mede nDCG@5.
// Sem isto, toda mudança em ranking é fé — é o que separa "mexi no BM25" de "melhorou".
//
// Existe como PORTÃO, e não só como relatório, desde o card #18: em 2026-09-10 o `hit@5` marcava
// 10/10 — saturado, sem margem nenhuma para acusar regressão. O nDCG@5 desconta a posição, então
// um alvo que cai do 1º para o 3º lugar aparece no número. `hit@1`, `hit@5` e `MRR` continuam
// impressos como secundários: são legíveis e o histórico existe.
//
//   node scripts/eval.mjs            # roda tudo
//   node scripts/eval.mjs natural    # só as queries em linguagem natural
//   BRAIN_DB=<banco> BRAIN_CONFIG=<config> BRAIN_GOLDEN=<golden> node scripts/eval.mjs
//
// Roda na INSTALAÇÃO: o índice vivo e o cache do modelo de embeddings só existem lá.
//
// Nunca contra o índice vivo, e sim contra um SNAPSHOT dele (`VACUUM INTO`): o servidor da rodada
// escreve `uso` e disputaria o lease do índice de produção — e medir base e head em momentos
// diferentes contra um índice que muda sozinho mediria deriva de índice e a chamaria de regressão.
//
// Códigos de saída — é o que torna o portão legível por máquina:
//   0  não caiu (sem --base, apenas relatório)
//   1  regrediu: nDCG@5 do head abaixo do base          (nasce com o --base)
//   2  NÃO CONSEGUI MEDIR: semântica caiu, caso apodrecido, servidor não respondeu…
// Código 2 nunca é licença para seguir: é medição que não aconteceu, e barra a PR igual ao 1.
//
// BRAIN_EVAL_TETO_AQUECIMENTO_MS existe só para os testes de scripts/concorrencia.mjs: o teto
// real é 60 s, e um caso que prova "estourou o teto" não pode custar um minuto à suíte.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const CODIGO = { NAO_CAIU: 0, REGREDIU: 1, NAO_MEDI: 2 };

/**
 * Fixo em todos os casos, inclusive nos cujo uso original pediu outro limite: a métrica é @5, e o
 * `colapsar` de `src/search.ts` se comporta em função do limite pedido — com outro limite, o top-5
 * medido não seria o top-5 que a busca devolve quando alguém pede 5.
 */
export const LIMITE = 5;

export const TETO_AQUECIMENTO_MS = Number(process.env.BRAIN_EVAL_TETO_AQUECIMENTO_MS) || 60000;
const INTERVALO_AQUECIMENTO_MS = 500;
const TIMEOUT_PEDIDO_MS = 30000;

// ---------------------------------------------------------------- a métrica

/**
 * nDCG@5 com relevância binária. O ganho é 1 no primeiro resultado que casa e 0 nos demais, então
 * IDCG@5 = 1/log2(2) = 1 e o nDCG é só o desconto da posição: `1 / log2(rank + 1)` no top-5, `0`
 * fora dele. Com um único alvo relevante isto é um MRR com desconto logarítmico — dito aqui para
 * ninguém se surpreender depois.
 *
 * `rank` é 1-based; 0 (ou qualquer valor fora de 1..5) quer dizer "não veio no top-5".
 */
export const ndcg5 = (rank) => (rank >= 1 && rank <= LIMITE ? 1 / Math.log2(rank + 1) : 0);

const BS = String.fromCharCode(92);
const norm = (s) => s.split(BS).join("/").toLowerCase();

/**
 * Os caminhos, na ordem, a partir do texto do `search_context`. Cada resultado é um bloco
 * `N. breadcrumb` / `[meta]` / `caminho` / `trecho` (`src/tools.ts`): o caminho é a 2ª linha depois
 * do cabeçalho numerado. Pela posição, e não por "linha que parece caminho absoluto": um trecho de
 * código que começa com `//` passaria por caminho num teste de formato.
 */
export function caminhosDaResposta(texto) {
  const linhas = String(texto ?? "").split("\n");
  const caminhos = [];
  for (let i = 0; i < linhas.length; i++) {
    if (/^\d+\. /.test(linhas[i]) && i + 2 < linhas.length) caminhos.push(linhas[i + 2].trim());
  }
  return caminhos;
}

/**
 * Os filtros gravados no caso, do jeito que a tool aceita. `null` não é filtro: a tool valida
 * `source` contra um enum, e mandar `null` seria erro de protocolo em vez de "sem filtro".
 */
export function argumentosDaBusca(caso) {
  const args = { query: caso.q, limit: LIMITE };
  for (const chave of ["source", "repo", "feature", "doc_type"]) {
    const v = caso.filtros?.[chave];
    if (v !== null && v !== undefined && v !== "") args[chave] = v;
  }
  return args;
}

/**
 * Avalia UM caso a partir da mensagem JSON-RPC crua. Devolve o nDCG e, quando a medição daquele caso
 * não vale, o motivo — que é o que decide o código 2.
 *
 * As três invalidações são distintas de propósito, e a ordem importa:
 *  - `sem-diagnostico`: não veio `_meta.brain`. NUNCA é tratado como `semantica === false` — ausente
 *    quer dizer "não sei se a semântica respondeu", e adivinhar aqui é o que faria o portão mentir.
 *  - `so-lexico`: veio o diagnóstico e a semântica não respondeu nesta consulta.
 *  - `apodreceu`: negativo `volatil` que passou a ter resultado. Não é regressão de ranking — é o
 *    índice que ganhou o assunto; o caso tem de ser recolhido.
 */
export function avaliar(caso, msg) {
  const base = { caso, rank: 0, ndcg: 0, caminhos: [], vazio: false, invalido: null };

  if (msg?.error || msg?.result?.isError === true) {
    const detalhe = msg.error ? JSON.stringify(msg.error) : String(msg.result?.content?.[0]?.text ?? "");
    return { ...base, invalido: { tipo: "erro", msg: `a tool respondeu erro: ${detalhe.slice(0, 200)}` } };
  }

  const brain = msg?.result?._meta?.brain;
  if (!brain || typeof brain.semantica !== "boolean") {
    return {
      ...base,
      invalido: {
        tipo: "sem-diagnostico",
        msg: "a resposta veio sem `_meta.brain` — não dá para saber se a semântica respondeu",
      },
    };
  }
  if (brain.semantica === false) {
    return { ...base, invalido: { tipo: "so-lexico", msg: "a busca semântica não respondeu nesta consulta" } };
  }

  const texto = String(msg.result?.content?.[0]?.text ?? "");
  const vazio = /^Nenhum resultado/.test(texto);
  const caminhos = vazio ? [] : caminhosDaResposta(texto);

  if (caso.tipo === "negativo") {
    if (!vazio && caso.volatil === true) {
      return {
        ...base,
        caminhos,
        invalido: {
          tipo: "apodreceu",
          msg: `negativo volátil passou a ter resultado (${caminhos.length}) — o caso apodreceu, recolha de novo`,
        },
      };
    }
    return { ...base, caminhos, vazio, ndcg: vazio ? 1 : 0 };
  }

  const alvos = [].concat(caso.esperado ?? []).map((a) => norm(String(a)));
  const i = caminhos.findIndex((p) => alvos.some((a) => norm(p).includes(a)));
  const rank = i >= 0 ? i + 1 : 0;
  return { ...base, caminhos, vazio, rank, ndcg: ndcg5(rank) };
}

/**
 * A rodada inteira. Um único caso inválido invalida tudo: a métrica é uma média, e média com buraco
 * é outro número. Sem `--base` não há comparação, então o melhor que uma rodada válida diz é 0.
 */
export function veredito(avaliacoes) {
  const invalidos = avaliacoes.filter((a) => a.invalido);
  const n = avaliacoes.length;
  const positivos = avaliacoes.filter((a) => a.caso.tipo !== "negativo");
  const negativos = avaliacoes.filter((a) => a.caso.tipo === "negativo");
  const soma = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
  return {
    codigo: invalidos.length || n === 0 ? CODIGO.NAO_MEDI : CODIGO.NAO_CAIU,
    invalidos,
    n,
    ndcg: n ? soma(avaliacoes, (a) => a.ndcg) / n : 0,
    positivos: positivos.length,
    hit1: positivos.filter((a) => a.rank === 1).length,
    hit5: positivos.filter((a) => a.rank >= 1 && a.rank <= LIMITE).length,
    mrr: positivos.length ? soma(positivos, (a) => (a.rank ? 1 / a.rank : 0)) / positivos.length : 0,
    negativos: negativos.length,
    negativosVazios: negativos.filter((a) => a.vazio).length,
  };
}

// ---------------------------------------------------------------- aquecimento

/**
 * Medido em 2026-09-11 (decisão #468): o modelo fica pronto entre +0,4 s e +5,7 s do boot, e a
 * primeira consulta antes disso sai só com léxico e devolve um 1º lugar DIFERENTE. Sem esperar,
 * boa parte da rodada terminaria antes de o modelo existir.
 *
 * Diagnóstico ausente sai na hora em vez de esperar o teto: `_meta.brain` não é questão de tempo,
 * é de versão do servidor — esperar 60 s por ele só atrasaria o mesmo código 2.
 */
export async function aquecer(pedir, { teto = TETO_AQUECIMENTO_MS, intervalo = INTERVALO_AQUECIMENTO_MS } = {}) {
  const t0 = Date.now();
  for (;;) {
    const msg = await pedir("tools/call", {
      name: "search_context",
      arguments: { query: "aquecimento do eval", limit: 1 },
    });
    if (msg?.error || msg?.result?.isError === true) {
      return { ok: false, ms: Date.now() - t0, motivo: `a busca de aquecimento respondeu erro: ${JSON.stringify(msg.error ?? msg.result).slice(0, 200)}` };
    }
    const brain = msg?.result?._meta?.brain;
    if (!brain || typeof brain.semantica !== "boolean") {
      return { ok: false, ms: Date.now() - t0, motivo: "o servidor responde sem `_meta.brain` — não dá para saber se a semântica respondeu" };
    }
    if (brain.semantica === true) return { ok: true, ms: Date.now() - t0 };
    if (Date.now() - t0 >= teto) {
      return { ok: false, ms: Date.now() - t0, motivo: `a busca semântica não respondeu em ${Math.round(teto / 1000)} s de aquecimento` };
    }
    await new Promise((r) => setTimeout(r, intervalo));
  }
}

// ---------------------------------------------------------------- snapshot

/**
 * `VACUUM INTO` dá cópia consistente INCLUINDO o conteúdo do WAL num arquivo único; copiar
 * `brain.db` + `-wal` + `-shm` à mão não garante isso. Duas ressalvas do SQLite, respeitadas aqui:
 * o destino não pode existir (daí `mkdtemp`, e não caminho fixo), e a cópia é do tamanho do índice
 * (~155 MB), uma vez por rodada. A conexão de origem é só-leitura: o snapshot nunca escreve no vivo.
 */
export function tirarSnapshot(origem) {
  const dir = mkdtempSync(join(tmpdir(), "brain-eval-"));
  const arquivo = join(dir, "snapshot.db");
  try {
    const db = new DatabaseSync(origem, { readOnly: true });
    try {
      db.exec("PRAGMA busy_timeout = 30000");
      db.prepare("VACUUM INTO ?").run(arquivo);
    } finally {
      db.close();
    }
    return { dir, arquivo };
  } catch (err) {
    limpar(dir);
    throw err;
  }
}

/** Em Windows o arquivo pode ficar preso por alguns instantes depois de o servidor morrer. */
export function limpar(dir) {
  if (!dir) return;
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (err) {
    console.error(`  aviso: não consegui apagar ${dir}: ${err.message}`);
  }
}

// ---------------------------------------------------------------- servidor

function subirServidor(entrada, env) {
  const child = spawn(process.execPath, [entrada], { cwd: root, stdio: ["pipe", "pipe", "pipe"], env });
  const pendentes = new Map();
  let buf = "";
  let err = "";
  let saida = null;

  // stderr é lido (e não ignorado) por dois motivos: um pipe cheio e não drenado trava o filho, e
  // quando o servidor morre é o rastro dele que diz por quê.
  child.stderr.on("data", (d) => (err = (err + d.toString()).slice(-4000)));
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) !== -1) {
      const linha = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!linha) continue;
      try {
        const m = JSON.parse(linha);
        if (m.id !== undefined && pendentes.has(m.id)) {
          pendentes.get(m.id).res(m);
          pendentes.delete(m.id);
        }
      } catch {
        /* linha não-JSON */
      }
    }
  });
  const morto = new Promise((res) =>
    child.on("exit", (code, sinal) => {
      saida = { code, sinal };
      // Servidor morto não responde mais nada: sem isto cada caso restante esperaria o timeout.
      for (const p of pendentes.values()) p.rej(new Error(`o servidor morreu (${JSON.stringify(saida)})`));
      pendentes.clear();
      res();
    })
  );

  let proxId = 1;
  const pedir = (method, params) =>
    new Promise((res, rej) => {
      if (saida) return rej(new Error(`o servidor morreu (${JSON.stringify(saida)})`));
      const id = proxId++;
      const t = setTimeout(() => {
        pendentes.delete(id);
        rej(new Error(`timeout (${TIMEOUT_PEDIDO_MS / 1000} s) em ${method}`));
      }, TIMEOUT_PEDIDO_MS);
      pendentes.set(id, {
        res: (m) => (clearTimeout(t), res(m)),
        rej: (e) => (clearTimeout(t), rej(e)),
      });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });

  return {
    pedir,
    rastro: () => err.trim().split("\n").slice(-6).join("\n    "),
    async handshake() {
      await pedir("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "eval", version: "0" } });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
    },
    /** Mata e ESPERA morrer: enquanto o processo vive, o Windows não deixa apagar o snapshot. */
    async encerrar() {
      if (!saida) {
        try {
          child.kill();
        } catch {
          /* já morreu */
        }
      }
      await Promise.race([morto, new Promise((r) => setTimeout(r, 5000))]);
    },
    matarJa() {
      try {
        child.kill();
      } catch {
        /* já morreu */
      }
    },
  };
}

// ---------------------------------------------------------------- relatório

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const ultimosDois = (p) => norm(p).split("/").slice(-2).join("/");

function marca(a) {
  if (a.invalido) return "!!  ";
  if (a.caso.tipo === "negativo") return a.vazio ? "∅ok " : "✗∅  ";
  return a.rank === 1 ? "✓@1 " : a.rank > 1 ? `~@${a.rank} ` : "✗   ";
}

function naoMedi(motivos) {
  console.error("\nEVAL: NÃO CONSEGUI MEDIR (código 2)");
  for (const m of motivos) console.error(`  x ${m}`);
  console.error("  Isto não diz que o ranking piorou: diz que a medição não aconteceu. Não é licença para seguir.");
  return CODIGO.NAO_MEDI;
}

// ---------------------------------------------------------------- CLI

async function main(estado) {
  const argv = process.argv.slice(2);
  // Flag desconhecida é código 2, e não silêncio: `--base` ignorado aqui imprimiria "não caiu"
  // sem ter comparado nada — a pior resposta que um portão pode dar.
  const flags = argv.filter((a) => a.startsWith("-"));
  if (flags.length) return naoMedi([`opção não reconhecida: ${flags.join(" ")}`]);
  const estilo = argv[0];

  const caminhoGolden = process.env.BRAIN_GOLDEN || join(root, "scripts", "golden.json");
  const dbOrigem = process.env.BRAIN_DB || join(root, "data", "brain.db");
  const config = process.env.BRAIN_CONFIG || join(root, "brain.config.json");
  const entrada = join(root, "dist", "index.js");

  let golden;
  try {
    golden = JSON.parse(readFileSync(caminhoGolden, "utf8"));
  } catch (err) {
    return naoMedi([`golden set ilegível em ${caminhoGolden}: ${err.message}`]);
  }
  const casos = estilo ? golden.filter((g) => g.estilo === estilo) : golden;
  if (!casos.length) return naoMedi([`nenhum caso${estilo ? ` com estilo "${estilo}"` : ""} em ${caminhoGolden}`]);
  if (!existsSync(dbOrigem)) return naoMedi([`banco não encontrado em ${dbOrigem} — rode na instalação, ou aponte o BRAIN_DB`]);
  if (!existsSync(config)) return naoMedi([`config não encontrado em ${config} — rode na instalação, ou aponte o BRAIN_CONFIG`]);
  if (!existsSync(entrada)) return naoMedi([`${entrada} não existe — rode \`npm run build\``]);

  try {
    const t0 = Date.now();
    estado.snapshot = tirarSnapshot(dbOrigem);
    console.log(`snapshot: ${estado.snapshot.arquivo} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

    estado.servidor = subirServidor(entrada, {
      ...process.env,
      BRAIN_DB: estado.snapshot.arquivo,
      BRAIN_CONFIG: config,
      BRAIN_SOMENTE_CONSULTA: "1",
    });
    const srv = estado.servidor;
    await srv.handshake();

    const aq = await aquecer(srv.pedir);
    if (!aq.ok) return naoMedi([aq.motivo]);
    console.log(`semântica pronta em ${(aq.ms / 1000).toFixed(1)} s · ${casos.length} casos\n`);

    const avaliacoes = [];
    for (const caso of casos) {
      const a = avaliar(caso, await srv.pedir("tools/call", { name: "search_context", arguments: argumentosDaBusca(caso) }));
      avaliacoes.push(a);
      console.log(`${marca(a)} ${a.ndcg.toFixed(2)} [${caso.estilo}] ${caso.q}${a.invalido ? `  <- ${a.invalido.msg}` : ""}`);
    }

    const v = veredito(avaliacoes);
    if (v.codigo === CODIGO.NAO_MEDI) {
      // Sem o número de propósito: uma média com casos inválidos é outro número, e impresso ele seria
      // lido como medição.
      return naoMedi(v.invalidos.map((a) => `[${a.invalido.tipo}] "${a.caso.q}": ${a.invalido.msg}`));
    }

    console.log(
      `\nnDCG@5 ${v.ndcg.toFixed(3)} (${v.n} casos)  ·  hit@1 ${v.hit1}/${v.positivos} (${pct(v.hit1, v.positivos)}%)` +
        `  ·  hit@5 ${v.hit5}/${v.positivos} (${pct(v.hit5, v.positivos)}%)  ·  MRR ${v.mrr.toFixed(2)}` +
        `  ·  negativos vazios ${v.negativosVazios}/${v.negativos}`
    );
    const abaixo = avaliacoes.filter((a) => a.ndcg < 1);
    if (abaixo.length) {
      console.log("\nAbaixo de 1:");
      for (const a of abaixo) {
        const esperado = a.caso.tipo === "negativo" ? "(vazio)" : [].concat(a.caso.esperado).join(" ou ");
        console.log(`  "${a.caso.q}"\n    esperado: ${esperado}\n    veio:     ${a.caminhos.slice(0, 3).map(ultimosDois).join(" | ") || "(vazio)"}`);
      }
    }
    console.log("\nEVAL OK (código 0) — medição válida; sem --base não há comparação, é relatório.");
    return v.codigo;
  } catch (err) {
    const rastro = estado.servidor?.rastro();
    return naoMedi([err.message + (rastro ? `\n    stderr do servidor:\n    ${rastro}` : "")]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const estado = { snapshot: null, servidor: null };
  // Ctrl+C no meio da rodada: sem isto ficariam ~155 MB de snapshot órfão no temporário a cada
  // interrupção. Síncrono e sem esperar o filho — é o melhor que um handler de sinal pode fazer.
  process.on("SIGINT", () => {
    estado.servidor?.matarJa();
    limpar(estado.snapshot?.dir);
    process.exit(CODIGO.NAO_MEDI);
  });
  let codigo = CODIGO.NAO_MEDI;
  try {
    codigo = await main(estado);
  } catch (err) {
    // Exceção que escapasse daqui viraria rejeição não tratada, e o Node sairia com código 1 — que
    // neste script quer dizer "regrediu". Qualquer coisa inesperada é, por definição, não ter medido.
    codigo = naoMedi([`erro inesperado: ${err?.stack ?? err}`]);
  } finally {
    await estado.servidor?.encerrar();
    limpar(estado.snapshot?.dir);
  }
  process.exit(codigo);
}
