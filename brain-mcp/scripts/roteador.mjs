// Suite do roteador de source (#45), sem rede e sem servidor: Jev falso, buscador falso e o
// cliente da worktree em modo falso. Saida 0 = tudo ok, 1 = algum caso falhou.
//
// Os casos de integracao montam o McpServer em processo (InMemoryTransport), com o buscador sempre falso.
//
// A ordem de abertura e fixa e importa:
//   0. poe o Jev ligado e o falso `sim` no ambiente, para o `semJev-limpa` provar que a limpeza
//      os tira (a chave nunca e posta);
//   1. `semJev(root)`: limpa o ambiente do proprio processo;
//   2. troca o `fetch` por um contador que lanca: uma chamada de rede acidental viraria `rede` ->
//      `null` no adaptador, indistinguivel de `sem_chave`, e por isso e contada a parte;
//   3. so entao importa os modulos de `dist/`.
import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

process.env.BRAIN_JEV = "roteador";
process.env.BRAIN_JEV_FALSO = "sim";

const { semJev } = await import("./sem-jev.mjs");
const limpeza = semJev(root);
if (limpeza.erro) {
  console.error("FALHOU: " + limpeza.erro);
  process.exit(1);
}
const cliente = limpeza.cliente;

let chamadasFetch = 0;
globalThis.fetch = () => {
  chamadasFetch++;
  throw new Error("rede proibida no teste do roteador");
};

const rot = await import(join(root, "dist", "roteador.js"));
const { USO_ROTEADOR, LIMIAR_ROTEADOR, TETO_ROTEADOR_MS, QUALQUER, INSTRUCAO_ROTEADOR } = rot;

// A ordem de `SOURCES` em `src/tools.ts` (P20); a suite nao a importa porque a lista nao e exportada.
const SOURCES = ["planning", "docs", "diario", "memoria", "mapa", "notas", "code", "github", "decisao", "git"];

let falhas = 0;
const rejeicoesSoltas = [];
process.on("unhandledRejection", (e) => rejeicoesSoltas.push(e));

async function caso(nome, fn) {
  try {
    await fn();
    console.log(`ok ${nome}`);
  } catch (e) {
    falhas++;
    console.log(`FALHOU ${nome}: ${e && e.message ? e.message : e}`);
  }
}

/** Poe variaveis de ambiente, roda `fn` e restaura o que havia (o ambiente nunca vaza entre casos). */
async function comEnv(vars, fn) {
  const antes = {};
  for (const k of Object.keys(vars)) antes[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(antes)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function resultado(source) {
  return {
    chunk_id: 1,
    full_text: "texto",
    path: `/x/${source}.md`,
    title: "t",
    source,
    repo: null,
    feature: null,
    doc_type: "doc",
    status: null,
    data: null,
    breadcrumb: `bc ${source}`,
    snip: "trecho",
    score: 1,
    tambemEm: [],
  };
}

/** O `diag` depende so do `source` pedido, nunca de quantas chamadas ja houve. */
function buscadorFalso(vazias = []) {
  const chamadas = [];
  const buscar = async (q, f, l) => {
    chamadas.push({ q, f, l });
    const src = f.source;
    const resultados = src && vazias.includes(src) ? [] : [resultado(src ?? "docs")];
    return { resultados, diag: { lexicais: resultados.length, vetoriais: 0, semantica: true, colapsados: src ? 1 : 0 } };
  };
  return { buscar, chamadas };
}

function jevFalso(comportamento) {
  const chamadas = [];
  const escolher = (estado, opcoes, orcamentoMs) => {
    chamadas.push({ estado, opcoes, orcamentoMs });
    return comportamento(estado, opcoes, orcamentoMs);
  };
  return { escolher, chamadas };
}

// Sem filtro que restrinja: com `repo`, `feature` ou `doc_type` o roteador nem age (emenda
// 2026-11-11, casos `filtro-explicito-nao-consulta`). `incluirArquivadas` nao restringe.
const FILTROS = { incluirArquivadas: false };

function deps(escolher, buscar, extra = {}) {
  return { ligado: true, fontes: SOURCES, escolher, buscar, ...extra };
}

// ---------------------------------------------------------------- A1

await caso("desligado-nao-consulta", async () => {
  const jev = jevFalso(async () => ({ opcao: "mapa", probabilidade: 0.99 }));
  const b = buscadorFalso();
  const r = await rot.rotear("x", { ...FILTROS }, 8, deps(jev.escolher, b.buscar, { ligado: false }));
  assert.equal(jev.chamadas.length, 0, "o escolhedor foi chamado");
  assert.equal(b.chamadas.length, 1);
  assert.equal(b.chamadas[0].f.source, undefined);
  assert.equal(r.roteado, null);
});

await caso("ligado-pela-lista", () => {
  for (const v of [undefined, "1", "*", "todos", "contexto", ""]) {
    assert.equal(rot.roteadorLigado(v === undefined ? {} : { BRAIN_JEV: v }), false, `BRAIN_JEV=${v}`);
  }
  for (const v of ["roteador", " Roteador ,contexto", "contexto,roteador"]) {
    assert.equal(rot.roteadorLigado({ BRAIN_JEV: v }), true, `BRAIN_JEV=${v}`);
  }
});

// ---------------------------------------------------------------- A2

const QUEDAS = [
  ["abaixo-do-limiar", async () => ({ opcao: "mapa", probabilidade: 0.79 })],
  ["probabilidade-invalida-nan", async () => ({ opcao: "mapa", probabilidade: NaN })],
  ["probabilidade-invalida-maior-que-1", async () => ({ opcao: "mapa", probabilidade: 1.5 })],
  ["probabilidade-invalida-string", async () => ({ opcao: "mapa", probabilidade: "0.9" })],
  ["indisponivel", async () => null],
  ["indefinido", async () => undefined],
  ["sem-opcao", async () => ({ probabilidade: 0.9 })],
  ["lanca-sincrono", () => {
    throw new Error("boom");
  }],
  ["rejeita", async () => {
    throw new Error("boom");
  }],
  ["fora-da-lista", async () => ({ opcao: "wiki", probabilidade: 0.99 })],
  ["caixa-diferente", async () => ({ opcao: "Mapa", probabilidade: 0.99 })],
  ["qualquer", async () => ({ opcao: "qualquer", probabilidade: 0.99 })],
];
for (const [nome, comportamento] of QUEDAS) {
  await caso(nome, async () => {
    const jev = jevFalso(comportamento);
    const b = buscadorFalso();
    const filtros = { ...FILTROS };
    const r = await rot.rotear("x", filtros, 8, deps(jev.escolher, b.buscar));
    assert.equal(jev.chamadas.length, 1);
    assert.equal(b.chamadas.length, 1);
    assert.deepStrictEqual(b.chamadas[0].f, FILTROS);
    assert.equal(r.roteado, null);
  });
}

await caso("timeout", async () => {
  const jev = jevFalso(() => new Promise(() => {}));
  const b = buscadorFalso();
  const t0 = Date.now();
  const r = await rot.rotear("x", { ...FILTROS }, 8, deps(jev.escolher, b.buscar, { tetoMs: 100 }));
  const ms = Date.now() - t0;
  assert.ok(ms <= 400, `levou ${ms} ms`);
  assert.equal(b.chamadas.length, 1);
  assert.equal(b.chamadas[0].f.source, undefined);
  assert.equal(r.roteado, null);
  assert.equal(TETO_ROTEADOR_MS, 1000);
  assert.equal(LIMIAR_ROTEADOR, 0.8);
  assert.equal(USO_ROTEADOR, "roteador");
  assert.equal(QUALQUER, "qualquer");
});

await caso("filtro-vazio-cai-para-sem-filtro", async () => {
  const jev = jevFalso(async () => ({ opcao: "mapa", probabilidade: 0.95 }));
  const b = buscadorFalso(["mapa"]);
  const r = await rot.rotear("x", { ...FILTROS }, 8, deps(jev.escolher, b.buscar));
  assert.equal(b.chamadas.length, 2);
  assert.equal(b.chamadas[0].f.source, "mapa");
  assert.deepStrictEqual(b.chamadas[1].f, FILTROS);
  assert.deepStrictEqual(r.diag, { lexicais: 1, vetoriais: 0, semantica: true, colapsados: 0 });
  assert.equal(r.roteado, null);
});

// ---------------------------------------------------------------- A3

await caso("no-limiar-aplica", async () => {
  const jev = jevFalso(async () => ({ opcao: "mapa", probabilidade: 0.8 }));
  const b = buscadorFalso();
  const r = await rot.rotear("x", { ...FILTROS }, 3, deps(jev.escolher, b.buscar));
  assert.equal(b.chamadas.length, 1);
  assert.equal(b.chamadas[0].f.source, "mapa");
  assert.equal(b.chamadas[0].l, 3);
  assert.equal(r.roteado, "mapa");
  assert.deepStrictEqual(r.diag, { lexicais: 1, vetoriais: 0, semantica: true, colapsados: 1 });
  assert.equal(jev.chamadas[0].orcamentoMs, TETO_ROTEADOR_MS);
});

await caso("estado-e-opcoes", async () => {
  assert.equal(rot.estadoDoRoteador("  x  "), "x");
  assert.equal(Array.from(rot.estadoDoRoteador("a".repeat(600))).length, 500);
  const emojis = rot.estadoDoRoteador("😀".repeat(600));
  assert.equal(Array.from(emojis).length, 500);
  assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(emojis), "surrogate solto");
  const opcoes = rot.opcoesDoRoteador(SOURCES);
  assert.deepStrictEqual(Object.keys(opcoes), [...SOURCES, "qualquer"]);
  assert.equal(Object.keys(opcoes).length, 11);
  for (const [k, v] of Object.entries(opcoes)) assert.ok(typeof v === "string" && v.length > 0, `descricao de ${k}`);

  const jev = jevFalso(async () => null);
  const query = "  " + "q".repeat(600);
  await rot.rotear(query, { ...FILTROS }, 8, deps(jev.escolher, buscadorFalso().buscar));
  assert.equal(jev.chamadas[0].estado, "q".repeat(500));
  assert.deepStrictEqual(jev.chamadas[0].opcoes, opcoes);
});

await caso("estado-pequeno", () => {
  const estado = rot.estadoDoRoteador(String.fromCharCode(1).repeat(600));
  const tam = JSON.stringify(estado).length;
  assert.ok(tam <= 3002, `serializou em ${tam}`);
  assert.ok(tam < cliente.MAX_ESTADO);
});

// ---------------------------------------------------------------- A4

await caso("source-explicito-nao-consulta", async () => {
  const jev = jevFalso(async () => ({ opcao: "mapa", probabilidade: 0.99 }));
  const b = buscadorFalso();
  const r = await rot.rotear("x", { ...FILTROS, source: "code" }, 8, deps(jev.escolher, b.buscar));
  assert.equal(jev.chamadas.length, 0);
  assert.equal(b.chamadas.length, 1);
  assert.equal(b.chamadas[0].f.source, "code");
  assert.equal(r.roteado, null);
});

// Emenda 2026-11-11 (achado 2 do G4): qualquer filtro que restrinja a busca desliga o roteador.
for (const extra of [{ repo: "r" }, { feature: "f" }, { doc_type: "spec" }, { repo: "r", feature: "f", doc_type: "spec" }]) {
  await caso(`filtro-explicito-nao-consulta ${Object.keys(extra).join("+")}`, async () => {
    const jev = jevFalso(async () => ({ opcao: "mapa", probabilidade: 0.99 }));
    const b = buscadorFalso();
    const filtros = { ...FILTROS, ...extra };
    const r = await rot.rotear("x", filtros, 8, deps(jev.escolher, b.buscar));
    assert.equal(jev.chamadas.length, 0, "o escolhedor foi chamado");
    assert.equal(b.chamadas.length, 1);
    assert.deepStrictEqual(b.chamadas[0].f, filtros);
    assert.equal(r.roteado, null);
  });
}

await caso("incluir-arquivadas-ainda-roteia", async () => {
  const jev = jevFalso(async () => ({ opcao: "mapa", probabilidade: 0.99 }));
  const b = buscadorFalso();
  const r = await rot.rotear("x", { incluirArquivadas: true }, 8, deps(jev.escolher, b.buscar));
  assert.equal(jev.chamadas.length, 1);
  assert.deepStrictEqual(b.chamadas[0].f, { incluirArquivadas: true, source: "mapa" });
  assert.equal(r.roteado, "mapa");
});

// ---------------------------------------------------------------- A6

await caso("filtros-intactos", async () => {
  const filtros = Object.freeze({ ...FILTROS });
  const b = buscadorFalso();
  const r = await rot.rotear("x", filtros, 8, deps(jevFalso(async () => ({ opcao: "mapa", probabilidade: 0.95 })).escolher, b.buscar));
  assert.equal(r.roteado, "mapa");
  assert.equal(filtros.source, undefined);
  assert.deepStrictEqual({ ...filtros }, FILTROS);
});

// ---------------------------------------------------------------- A7

// A outra ponte ao MESMO `hooks/jev.js`: a do #46 (lembrar), que chegou com o merge da dev. Ela
// tambem nao pode abrir HTTP proprio; o "um cliente so" e o arquivo, nao o numero de pontes.
const PONTES = ["roteador.ts", "juizJev.ts"];

await caso("sem-http-proprio", () => {
  const regex = /fetch\(|node:https?|undici|XMLHttpRequest/;
  for (const f of ["roteador.ts", "tools.ts", "juizJev.ts"]) {
    const t = readFileSync(join(root, "src", f), "utf8");
    assert.ok(!regex.test(t), `${f} casa ${regex}`);
  }
  const r = readFileSync(join(root, "src", "roteador.ts"), "utf8");
  for (const trecho of ["createRequire", '"jev.js"', 'USO_ROTEADOR = "roteador"']) {
    assert.ok(r.includes(trecho), `roteador.ts sem ${trecho}`);
  }
  for (const f of readdirSync(join(root, "src")).filter((n) => n.endsWith(".ts") && !PONTES.includes(n))) {
    assert.ok(!readFileSync(join(root, "src", f), "utf8").includes("jev.js"), `${f} cita jev.js`);
  }
});

const daWorktree = resolve(root, "..", "hooks", "jev.js");

await caso("resolve-a-worktree", async () => {
  assert.equal(rot.caminhoDoJev(), daWorktree);
  // O cliente ja foi carregado pelo `semJev` da abertura; a chave do cache e o caminho real.
  const cache = createRequire(import.meta.url).cache;
  assert.ok(cache[realpathSync(daWorktree)], "o cliente da worktree nao esta no cache do require");
  const instalado = join(process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME ?? "", ".claude"), "hooks", "jev.js");
  if (resolve(instalado) !== daWorktree) {
    assert.ok(!cache[instalado], "o cliente instalado foi carregado");
  }
  assert.equal(rot.caminhoDoJev("/r/pacote", "/h", () => true), join("/r/pacote", "..", "hooks", "jev.js"));
  assert.equal(
    rot.caminhoDoJev("/r/pacote", "/h", (p) => p === join("/h", "hooks", "jev.js")),
    join("/h", "hooks", "jev.js")
  );
  assert.equal(rot.caminhoDoJev("/r/pacote", "/h", () => false), null);
});

await caso("adaptador", async () => {
  const ok = { fonte: { estado: "ok", tipo: "escolha", escolha: "mapa", confianca: 0.9, probabilidades: {} } };
  assert.deepStrictEqual(rot.paraEscolha(ok), { opcao: "mapa", probabilidade: 0.9 });
  for (const ruim of [
    { fonte: { estado: "indisponivel", motivo: "sem_chave" } },
    { fonte: { estado: "ok", tipo: "noul", sim: true, probabilidade: 0.9 } },
    {},
    undefined,
    { fonte: null },
  ]) {
    assert.equal(rot.paraEscolha(ruim), null, JSON.stringify(ruim));
  }

  const opcoes = rot.opcoesDoRoteador(SOURCES);
  for (const [nome, carregar] of [
    ["carregar-lanca", () => {
      throw new Error("x");
    }],
    ["carregar-null", () => null],
    ["carregar-vazio", () => ({})],
    ["decidir-lanca", () => ({
      decidir: () => {
        throw new Error("x");
      },
    })],
    ["decidir-rejeita", () => ({ decidir: async () => Promise.reject(new Error("x")) })],
  ]) {
    assert.equal(await rot.criarEscolherFonteJev(carregar)("x", opcoes, 1000), null, nome);
  }

  const espiao = [];
  const escolher = rot.criarEscolherFonteJev(() => ({
    decidir: async (...a) => {
      espiao.push(a);
      return ok;
    },
  }));
  assert.deepStrictEqual(await escolher("consulta", opcoes, 777), { opcao: "mapa", probabilidade: 0.9 });
  assert.deepStrictEqual(espiao[0], [
    "consulta",
    { fonte: { tipo: "escolha", instrucao: INSTRUCAO_ROTEADOR, opcoes } },
    { uso: "roteador", timeoutMs: 777 },
  ]);
});

await caso("cliente-da-worktree", async () => {
  const opcoes = rot.opcoesDoRoteador(SOURCES);
  const medir = async (env, orcamento = 1000) => {
    const t0 = Date.now();
    const r = await comEnv(env, () => rot.escolherFonteJev("x", opcoes, orcamento));
    return { r, ms: Date.now() - t0 };
  };
  let m = await medir({ BRAIN_JEV: undefined, BRAIN_JEV_FALSO: undefined, TYPESAFE_API_KEY: undefined });
  assert.equal(m.r, null, "sem BRAIN_JEV");
  assert.ok(m.ms < 50, `sem BRAIN_JEV levou ${m.ms} ms`);

  m = await medir({ BRAIN_JEV: "roteador", BRAIN_JEV_FALSO: undefined, TYPESAFE_API_KEY: undefined });
  assert.equal(m.r, null, "sem chave");
  assert.ok(m.ms < 50, `sem chave levou ${m.ms} ms`);

  const ligado = { BRAIN_JEV: "roteador", TYPESAFE_API_KEY: undefined };
  m = await medir({ ...ligado, BRAIN_JEV_FALSO: "sim" });
  assert.deepStrictEqual(m.r, { opcao: "planning", probabilidade: 0.95 });

  m = await medir({ ...ligado, BRAIN_JEV_FALSO: "nao" });
  assert.equal(m.r?.opcao, "planning");
  assert.ok(Math.abs(m.r.probabilidade - 1 / 11) < 1e-9, `probabilidade ${m.r.probabilidade}`);

  m = await medir({ ...ligado, BRAIN_JEV_FALSO: "indisponivel" });
  assert.equal(m.r, null, "indisponivel");

  m = await medir({ ...ligado, BRAIN_JEV_FALSO: "lento" }, 100);
  assert.equal(m.r, null, "lento");
  assert.ok(m.ms < 300, `lento levou ${m.ms} ms`);
});

// ---------------------------------------------------------------- A8

await caso("filhos-sem-jev", () => {
  const ler = (f) => readFileSync(join(root, "scripts", f), "utf8");

  const ev = ler("eval.mjs");
  const main = ev.indexOf("async function main");
  assert.ok(main >= 0, "eval.mjs sem `async function main`");
  const usoSemJev = ev.indexOf("semJev(", main);
  const lerArgs = ev.indexOf("lerArgumentos(", main);
  assert.ok(usoSemJev >= 0 && lerArgs >= 0 && usoSemJev < lerArgs, "eval.mjs: semJev( nao vem antes do lerArgumentos( dentro de main");
  assert.ok(!ev.slice(0, main).includes("semJev("), "eval.mjs chama semJev( antes de main (topo do modulo)");

  const sm = ler("smoke.mjs");
  assert.ok(sm.includes("semJev(") && sm.indexOf("semJev(") < sm.indexOf("spawn("), "smoke.mjs: semJev( nao vem antes de spawn(");

  const co = ler("concorrencia.mjs");
  const lease = co.indexOf("process.env.BRAIN_LEASE_TTL_MS");
  assert.ok(lease >= 0 && co.includes("semJev(") && co.indexOf("semJev(") < lease, "concorrencia.mjs: semJev( nao vem antes de BRAIN_LEASE_TTL_MS");
});

await caso("semJev-limpa", () => {
  const sobrou = Object.keys(process.env).filter((k) => k.startsWith("BRAIN_JEV"));
  assert.deepStrictEqual(sobrou, []);
  assert.equal(process.env.TYPESAFE_API_KEY, undefined);
});

await caso("semJev-sem-cliente", async () => {
  const temp = mkdtempSync(join(tmpdir(), "roteador-sem-cliente-"));
  const outro = mkdtempSync(join(tmpdir(), "roteador-home-vazio-"));
  try {
    const antes = Object.keys(process.env).sort();
    const r = await comEnv({ CLAUDE_CONFIG_DIR: outro }, () => semJev(join(temp, "pacote")));
    assert.ok(typeof r.erro === "string" && r.erro.length > 0, "devia devolver erro");
    assert.equal(r.cliente, undefined);
    assert.deepStrictEqual(Object.keys(process.env).sort(), antes);
  } finally {
    rmSync(temp, { recursive: true, force: true });
    rmSync(outro, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- integracao (handler)

const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
const { openDb } = await import(join(root, "dist", "db.js"));
const { registerTools } = await import(join(root, "dist", "tools.js"));

const RODAPE_FIM = "\n\nUse read_doc(path) para ler o documento inteiro ou uma seção.";
const rodapeRoteador = (s) => `\n(roteador: busca restrita a source="${s}" nesta consulta — para outra fonte, passe source)`;

/**
 * Um servidor e um cliente NOVOS por configuracao (registrar a mesma tool duas vezes lanca). O
 * buscador e sempre o falso: um real num banco vazio nunca traria resultado e quebraria o A3.
 * `roteador` omitido = o padrao de producao de `registerTools`.
 */
async function montar({ roteador, vazias = [] } = {}) {
  const temp = mkdtempSync(join(tmpdir(), "roteador-integ-"));
  const db = openDb(join(temp, "brain.db"));
  const b = buscadorFalso(vazias);
  const server = new McpServer({ name: "brain-teste", version: "0" });
  const args = [server, db, {}, {}, { buscar: b.buscar }, {}, {}, {}, () => {}, "teste"];
  if (roteador) args.push(roteador);
  registerTools(...args);
  const client = new Client({ name: "teste", version: "0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  return {
    client,
    db,
    buscas: b.chamadas,
    chamar: (a) => client.callTool({ name: "search_context", arguments: a }),
    async fechar() {
      await client.close();
      await server.close();
      db.close();
      rmSync(temp, { recursive: true, force: true });
    },
  };
}

async function comServidor(cfg, fn) {
  const s = await montar(cfg);
  try {
    return await fn(s);
  } finally {
    await s.fechar();
  }
}

const sempre = (opcao, probabilidade) => jevFalso(async () => ({ opcao, probabilidade }));
const textoDe = (r) => r.content[0].text;

await caso("desligado-nao-carrega", async () => {
  let carregou = 0;
  const escolher = rot.criarEscolherFonteJev(() => {
    carregou++;
    return null;
  });
  await comServidor({ roteador: { ligado: () => false, escolher } }, async (s) => {
    await s.chamar({ query: "x" });
    assert.equal(carregou, 0, "o carregador do cliente foi chamado");
    assert.equal(s.buscas.length, 1);
  });
});

await caso("desligado-byte-a-byte", async () => {
  const jev = sempre("mapa", 0.99);
  await comServidor({ roteador: { ligado: () => false, escolher: jev.escolher } }, async (s) => {
    const r = await s.chamar({ query: "x" });
    const esperado = "1. bc docs\n   [docs]\n   /x/docs.md\n   trecho" + RODAPE_FIM;
    assert.equal(textoDe(r), esperado);
    assert.deepStrictEqual(r._meta, { brain: { lexicais: 1, vetoriais: 0, semantica: true, colapsados: 0 } });
    assert.equal(jev.chamadas.length, 0);
  });
});

await caso("desligado-igual-a-sem-chave", async () => {
  const chamadas = [{ query: "x" }, { query: "x", repo: "r", limit: 3 }];
  // padrao de producao com BRAIN_JEV ausente
  const desligado = await comEnv({ BRAIN_JEV: undefined, BRAIN_JEV_FALSO: undefined, TYPESAFE_API_KEY: undefined }, () =>
    comServidor({}, async (s) => {
      const out = [];
      for (const a of chamadas) out.push(await s.chamar(a));
      return out;
    })
  );
  // padrao de producao, ligado e sem chave: o cliente de verdade da worktree responde sem_chave
  const semChave = await comEnv({ BRAIN_JEV: "roteador", BRAIN_JEV_FALSO: undefined, TYPESAFE_API_KEY: undefined }, () =>
    comServidor({}, async (s) => {
      const out = [];
      for (const a of chamadas) out.push(await s.chamar(a));
      return out;
    })
  );
  for (let i = 0; i < chamadas.length; i++) {
    assert.deepStrictEqual(semChave[i].content, desligado[i].content);
    assert.deepStrictEqual(semChave[i]._meta, desligado[i]._meta);
  }
  // o mesmo par com o Jev falso devolvendo null
  const nulo = jevFalso(async () => null);
  const comNulo = await comServidor({ roteador: { ligado: () => true, escolher: nulo.escolher } }, async (s) => {
    const out = [];
    for (const a of chamadas) out.push(await s.chamar(a));
    return out;
  });
  // So a chamada sem filtro consulta: a com `repo` segue como veio (emenda 2026-11-11).
  assert.equal(nulo.chamadas.length, 1);
  for (let i = 0; i < chamadas.length; i++) {
    assert.deepStrictEqual(comNulo[i].content, desligado[i].content);
    assert.deepStrictEqual(comNulo[i]._meta, desligado[i]._meta);
  }
});

await caso("rodape-quando-roteado", async () => {
  const jev = sempre("mapa", 0.95);
  await comServidor({ roteador: { ligado: () => true, escolher: jev.escolher } }, async (s) => {
    const r = await s.chamar({ query: "x" });
    const t = textoDe(r);
    assert.ok(t.endsWith(rodapeRoteador("mapa") + RODAPE_FIM), `texto: ${t}`);
    assert.deepStrictEqual(r._meta, { brain: { lexicais: 1, vetoriais: 0, semantica: true, colapsados: 1 } });
    assert.equal(s.buscas.length, 1);
    assert.equal(s.buscas[0].f.source, "mapa");
  });
});

await caso("filtro-na-chamada-nao-consulta", async () => {
  const jev = sempre("mapa", 0.99);
  await comServidor({ roteador: { ligado: () => true, escolher: jev.escolher } }, async (s) => {
    for (const a of [{ repo: "r" }, { feature: "f" }, { doc_type: "spec" }]) {
      const r = await s.chamar({ query: "x", ...a });
      assert.ok(!textoDe(r).includes("(roteador:"), `${JSON.stringify(a)}: a resposta foi roteada`);
    }
    assert.equal(jev.chamadas.length, 0, "o escolhedor foi chamado");
    assert.deepStrictEqual(s.buscas.map((b) => b.f.source), [undefined, undefined, undefined]);
  });
});

await caso("ponta-a-ponta-falso", async () => {
  await comEnv({ BRAIN_JEV: "roteador", BRAIN_JEV_FALSO: "sim", TYPESAFE_API_KEY: undefined }, () =>
    comServidor({}, async (s) => {
      const r = await s.chamar({ query: "x" });
      assert.ok(textoDe(r).endsWith(rodapeRoteador("planning") + RODAPE_FIM), `texto: ${textoDe(r)}`);
      assert.equal(s.buscas.length, 1);
      assert.equal(s.buscas[0].f.source, "planning");
    })
  );
});

await caso("query-vazia-nao-consulta", async () => {
  const jev = sempre("mapa", 0.95);
  await comServidor({ roteador: { ligado: () => true, escolher: jev.escolher } }, async (s) => {
    const r = await s.chamar({ query: "   " });
    assert.equal(textoDe(r), "Query vazia — informe ao menos um termo.");
    assert.equal(jev.chamadas.length, 0);
    assert.equal(s.buscas.length, 0);
  });
});

await caso("superficie-intacta", async () => {
  const jev = sempre("mapa", 0.95);
  await comServidor({ roteador: { ligado: () => true, escolher: jev.escolher } }, async (s) => {
    const { tools } = await s.client.listTools();
    const t = tools.find((x) => x.name === "search_context");
    assert.deepStrictEqual(Object.keys(t.inputSchema.properties).sort(), [
      "doc_type", "feature", "incluir_arquivadas", "limit", "query", "repo", "source",
    ]);
    const r = await s.chamar({ query: "x" });
    assert.ok(textoDe(r).includes("(roteador:"), "a resposta devia ser roteada");
    assert.deepStrictEqual(Object.keys(r._meta.brain).sort(), ["colapsados", "lexicais", "semantica", "vetoriais"]);
  });
});

await caso("uso-grava-args-como-vieram", async () => {
  const jev = sempre("mapa", 0.95);
  await comServidor({ roteador: { ligado: () => true, escolher: jev.escolher } }, async (s) => {
    const r = await s.chamar({ query: "x", limit: 3 });
    assert.ok(textoDe(r).includes(rodapeRoteador("mapa")));
    assert.equal(s.buscas.length, 1);
    assert.equal(s.buscas[0].f.source, "mapa");
    assert.equal(s.buscas[0].l, 3);
    const linha = s.db.prepare("SELECT tool, args FROM uso ORDER BY id DESC LIMIT 1").get();
    assert.equal(linha.tool, "search_context");
    assert.deepStrictEqual(JSON.parse(linha.args), { query: "x", limit: 3 });
  });
});

// ---------------------------------------------------------------- fim

await caso("nenhum-fetch", async () => {
  await new Promise((r) => setImmediate(r));
  assert.equal(rejeicoesSoltas.length, 0, `unhandledRejection: ${rejeicoesSoltas.map(String).join("; ")}`);
  assert.equal(chamadasFetch, 0, `${chamadasFetch} chamada(s) de rede`);
});

process.exit(falhas > 0 ? 1 : 0);
