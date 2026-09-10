// Testes de concorrência do índice, no estilo de smoke.mjs: sem framework, porque o repo não tem
// um e esta feature não vai introduzir um.
//
// A diferença para o smoke: este roda ISOLADO. smoke.mjs e eval.mjs exercitam o índice real da
// instalação (137 MB, 5.757 docs) — legítimo, porque só leem. Aqui se escreve, se toma liderança
// e se mata processo, então rodar contra o índice vivo seria destrutivo. Daí a fixture
// descartável: BRAIN_CONFIG + BRAIN_DB + BRAIN_LEASE_TTL_MS próprios, num diretório temporário
// que morre no fim.
//
// Duas metades: casos de UNIDADE, que importam dist/ neste mesmo processo, e casos de SERVIDOR,
// que sobem `dist/index.js` de verdade e falam JSON-RPC por stdio. Os de servidor recebem o stub
// determinístico de embeddings (ver embeddings-falso.mjs e a emenda 2026-09-09 da spec).

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modulo = (nome) => pathToFileURL(join(root, "dist", nome)).href;
// file:// URL, e não o caminho cru: em Windows o `--import` recusa caminho absoluto
// ("absolute paths must be valid file:// URLs") e o servidor morre antes de logar qualquer coisa.
const hookStub = pathToFileURL(join(root, "scripts", "embeddings-falso-hook.mjs")).href;

// TTL curto: o padrão de 60 s tornaria o caso do lease vencido inviável de rodar. Precisa ser
// definido ANTES do import de dist/lease.js — TTL_MS é lido do ambiente no topo do módulo, uma
// vez só. Os servidores filhos recebem o seu próprio (maior) pelo env do spawn.
const TTL_TESTE_MS = 500;
process.env.BRAIN_LEASE_TTL_MS = String(TTL_TESTE_MS);

// Os servidores precisam de um TTL folgado o bastante para o boot inteiro (scan + grafo) caber
// dentro dele, e curto o bastante para o caso de morte abrupta não custar um minuto.
const TTL_SERVIDOR_MS = 3000;
const TIQUE_SERVIDOR_MS = 1000;

// ---------------------------------------------------------------- fixture descartável
const fixture = mkdtempSync(join(tmpdir(), "brain-concorrencia-"));
const dbPath = join(fixture, "brain.db");
const configPath = join(fixture, "brain.config.json");

const configBase = {
  produto: "fixture de teste",
  codeExtensions: [".ts"],
  excludeDirs: ["node_modules", ".git"],
  excludeFiles: [],
  maxCodeFileBytes: 200000,
  github: { repos: [], syncIntervalMin: 60, commentsSinceDays: 30, maxItems: 100 },
  git: { repos: [], desde: "30 days ago", maximo: 200 },
};
const comoRoot = (p) => p.split("\\").join("/");

mkdirSync(join(fixture, "docs"), { recursive: true });
writeFileSync(
  configPath,
  JSON.stringify(
    { ...configBase, roots: [{ path: comoRoot(join(fixture, "docs")), source: "docs", repo: null }] },
    null,
    2
  )
);
process.env.BRAIN_DB = dbPath;
process.env.BRAIN_CONFIG = configPath;

const { openDb, versaoIndice, bumpVersaoIndice } = await import(modulo("db.js"));
const { Lease, TTL_MS, TIQUE_MS } = await import(modulo("lease.js"));
const { VectorIndex, preencherEmbeddings } = await import(modulo("vectors.js"));
const { DIMS, paraBlob } = await import(modulo("embeddings.js"));
// O MESMO embedder que o hook injeta nos servidores: é o que permite ao teste embutir de um lado
// e o servidor filho consultar do outro, com vetores que casam.
const { embedPassagens: embutirFalso } = await import(
  pathToFileURL(join(root, "scripts", "embeddings-falso.mjs")).href
);

// ---------------------------------------------------------------- runner
const casos = [];
const caso = (nome, fn) => casos.push({ nome, fn });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
// Vetor one-hot: da para conferir identidade sem modelo nenhum.
const vetorFake = (n) => Float32Array.from({ length: DIMS }, (_, i) => (i === n % DIMS ? 1 : 0));
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Espera ativa com prazo: o único jeito honesto de testar timer sem cravar sleep chutado. */
async function ate(cond, ms, oQue) {
  const prazo = Date.now() + ms;
  for (;;) {
    if (await cond()) return;
    if (Date.now() > prazo) {
      throw new Error(`timeout (${ms} ms) esperando ${typeof oQue === "function" ? oQue() : oQue}`);
    }
    await dormir(50);
  }
}

// ---------------------------------------------------------------- arnês de servidor
const servidores = [];

/** Uma fixture por caso: banco, config e pasta de documentos próprios, sem interferência. */
function criarFixture(nome, docs = {}, opts = {}) {
  const dir = join(fixture, nome);
  const docsDir = join(dir, "docs");
  mkdirSync(docsDir, { recursive: true });
  for (const [arquivo, conteudo] of Object.entries(docs)) {
    writeFileSync(join(docsDir, arquivo), conteudo);
  }
  // `lembrar` exige um root com source "decisao" e ESTOURA sem ele (memoria.ts:39-44). Só as
  // fixtures que exercitam a tool pagam o diretório extra; as demais seguem exatamente como antes.
  const decisoesDir = join(dir, "decisoes");
  const roots = [{ path: comoRoot(docsDir), source: "docs", repo: null }];
  if (opts.comDecisoes) {
    mkdirSync(decisoesDir, { recursive: true });
    roots.push({ path: comoRoot(decisoesDir), source: "decisao", repo: null });
  }
  const cfg = join(dir, "brain.config.json");
  writeFileSync(cfg, JSON.stringify({ ...configBase, roots }, null, 2));
  return {
    dir,
    docsDir,
    decisoesDir,
    db: join(dir, "brain.db"),
    config: cfg,
    registro: join(dir, "quem-embutiu.log"),
  };
}

/**
 * Sobe `dist/index.js` como o cliente MCP sobe: processo próprio, JSON-RPC por stdio. O stderr é
 * capturado (e não herdado) porque é nele que o servidor diz se nasceu líder ou seguidor — os
 * logs SÃO a asserção de metade destes casos.
 */
function subirServidor(fx, rotulo) {
  const child = spawn(process.execPath, ["--import", hookStub, join(root, "dist", "index.js")], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      BRAIN_DB: fx.db,
      BRAIN_CONFIG: fx.config,
      BRAIN_LEASE_TTL_MS: String(TTL_SERVIDOR_MS),
      BRAIN_STUB_REGISTRO: fx.registro,
    },
  });

  const s = { rotulo, child, pid: child.pid, err: "", vivo: true, saida: null };
  child.stderr.on("data", (d) => (s.err += d.toString()));
  child.on("exit", (code, sinal) => {
    s.vivo = false;
    s.saida = { code, sinal };
  });

  let buf = "";
  let proxId = 1;
  const pendentes = new Map();
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) !== -1) {
      const linha = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!linha) continue;
      try {
        const msg = JSON.parse(linha);
        if (msg.id !== undefined && pendentes.has(msg.id)) {
          pendentes.get(msg.id)(msg);
          pendentes.delete(msg.id);
        }
      } catch {
        /* ignora linhas não-JSON */
      }
    }
  });

  s.pedir = (method, params) =>
    new Promise((res, rej) => {
      const id = proxId++;
      pendentes.set(id, res);
      setTimeout(() => rej(new Error(`timeout em ${method} (${rotulo})`)), 20000);
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });

  s.handshake = async () => {
    await s.pedir("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "concorrencia", version: "0" },
    });
    child.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n"
    );
  };

  s.chamar = async (name, args) => {
    const r = await s.pedir("tools/call", { name, arguments: args });
    return r.result?.content?.[0]?.text ?? "";
  };

  /**
   * Como `chamar`, mas devolve o que `chamar` esconde: erro de protocolo e `isError`. Quem afirma
   * "a chamada CONCLUIU sem erro" precisa distinguir resposta vazia de falha — e para `chamar` as
   * duas são a mesma string vazia, que é justamente como um teste de CA1 passaria em silêncio.
   */
  s.chamarCru = async (name, args) => {
    const r = await s.pedir("tools/call", { name, arguments: args });
    const texto = (r.result?.content ?? []).map((c) => c.text ?? "").join("\n");
    const erroProtocolo = r.error ? JSON.stringify(r.error).slice(0, 300) : null;
    const isError = r.result?.isError === true;
    return {
      texto,
      erroProtocolo,
      isError,
      falhou: Boolean(erroProtocolo) || isError,
      // O que o CA1 proíbe pelo nome, venha na resposta ou no erro de protocolo.
      comLock: /SQLITE_BUSY|database is locked|database table is locked/i.test(
        texto + (erroProtocolo ?? "")
      ),
      resumo: () => `[${name}] ${erroProtocolo ?? texto.slice(0, 200)}`,
    };
  };

  /** Morte abrupta: em Windows isto é TerminateProcess e NENHUM handler do filho roda. */
  s.matar = () => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* já morreu */
    }
  };

  /** Despedida real de uma sessão MCP: o cliente fecha o stdin e o transporte stdio termina. */
  s.fecharStdin = () => child.stdin.end();

  s.bootou = () => /boot \((líder|seguidor)\)/.test(s.err);

  /** Um servidor que não bootou tem sempre um porquê no stderr; sem isto o teste só diz "timeout". */
  s.diagnostico = () => {
    const cabeca = `${rotulo} (pid ${s.pid}, ${s.vivo ? "vivo" : `morto ${JSON.stringify(s.saida)}`})`;
    // Morto = há uma exceção no stderr e ela é a resposta: mostra tudo. Vivo = só o rastro final.
    const corpo = s.vivo
      ? s.err.trim().split("\n").slice(-4).join(" | ")
      : s.err.trim().split("\n").join(" | ");
    return `${cabeca}: ${corpo || "<stderr vazio>"}`;
  };
  s.eLider = () => s.err.includes("boot (líder)");

  servidores.push(s);
  return s;
}

const lerLider = (caminho) => {
  const db = openDb(caminho);
  try {
    return db.prepare("SELECT * FROM lider WHERE id = 1").get() ?? null;
  } finally {
    db.close();
  }
};

const lerVersao = (caminho) => {
  const db = openDb(caminho);
  try {
    return Number(versaoIndice(db) || 0);
  } finally {
    db.close();
  }
};

const contar = (caminho, sql, ...args) => {
  const db = openDb(caminho);
  try {
    return Number(db.prepare(sql).get(...args).c);
  } finally {
    db.close();
  }
};

// ---------------------------------------------------------------- casos de unidade
caso("arnes-com-ttl-do-ambiente", async () => {
  ok(TTL_MS === TTL_TESTE_MS, `lease.ts leu TTL ${TTL_MS}, esperava ${TTL_TESTE_MS}`);
});

caso("lease-expirado-e-tomado", async () => {
  const db = openDb(dbPath);
  try {
    const l1 = new Lease(db);
    const l2 = new Lease(db);

    ok(l1.tentarAdquirir() === true, "l1 devia ganhar um lease livre");
    ok(l1.souLider === true, "l1 devia se saber líder");
    ok(l2.tentarAdquirir() === false, "l2 não pode ganhar enquanto o lease do l1 está vivo");
    ok(l2.souLider === false, "l2 devia se saber seguidor");

    const d = l2.dono();
    ok(d !== null, "dono() devia enxergar o líder");
    ok(d.expiraEm > Date.now(), "dono() devia mostrar lease no futuro");
    ok(d.pid === process.pid, `dono().pid ${d.pid} != ${process.pid}`);

    // O ponto do caso: só o tempo destrava a tomada de posse. É isto que dá o CA3 sem watchdog.
    await dormir(TTL_TESTE_MS + 250);
    ok(l2.tentarAdquirir() === true, "l2 devia tomar o lease depois de vencido");
    ok(l1.renovar() === false, "l1 renovou um lease que já não era dele");
    ok(l1.souLider === false, "l1 devia ter se rebaixado a seguidor ao perder");

    // A escapatória explícita: --force / forcar: true toma de um lease VIVO.
    ok(l1.tentarAdquirir() === false, "l1 não pode tomar lease vivo sem forçar");
    ok(l1.tentarAdquirir(true) === true, "forcar: true devia tomar a liderança na hora");
    ok(l2.renovar() === false, "l2 perdeu para o forçado e devia descobrir na renovação");

    // liberar() é condicionado à instância: quem não é dono não apaga o lease alheio.
    l2.liberar();
    ok(l1.dono() !== null, "liberar() de quem não é dono apagou o lease do outro");
    l1.liberar();
    ok(l1.dono() === null, "liberar() do dono devia esvaziar a tabela");
    l1.liberar(); // idempotente: é isto que o torna seguro num handler de exit
  } finally {
    db.close();
  }
});

caso("ttl-zero-desliga-o-lease", async () => {
  // O desligamento a quente do `## Rollback`: BRAIN_LEASE_TTL_MS=0 faz todo lease nascer vencido,
  // então todo processo se elege líder e o comportamento anterior à feature volta sem deploy.
  // Roda em processo filho porque TTL_MS é lido uma vez, no import.
  const filho = [
    `const { openDb } = await import(${JSON.stringify(modulo("db.js"))});`,
    `const { Lease, TTL_MS, TIQUE_MS } = await import(${JSON.stringify(modulo("lease.js"))});`,
    `const db = openDb(process.env.BRAIN_DB);`,
    `const a = new Lease(db); const b = new Lease(db);`,
    `const ra = a.tentarAdquirir();`,
    `await new Promise((r) => setTimeout(r, 5));`, // sem isto, mesmo milissegundo => empate
    `const rb = b.tentarAdquirir();`,
    `a.liberar(); b.liberar(); db.close();`,
    `console.log(JSON.stringify({ TTL_MS, TIQUE_MS, ra, rb }));`,
  ].join("\n");
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", filho], {
    env: { ...process.env, BRAIN_LEASE_TTL_MS: "0", BRAIN_DB: join(fixture, "ttl0.db") },
    encoding: "utf8",
  });
  ok(r.status === 0, `processo filho falhou: ${r.stderr || r.stdout}`);
  const out = JSON.parse(r.stdout.trim().split("\n").pop());
  // A armadilha que este caso existe para pegar: `Number(x) || 60_000` devolveria 60000 aqui.
  ok(out.TTL_MS === 0, `BRAIN_LEASE_TTL_MS=0 produziu TTL ${out.TTL_MS}, esperava 0`);
  ok(out.TIQUE_MS === 1000, `TIQUE_MS ${out.TIQUE_MS}, esperava o piso de 1000`);
  ok(out.ra === true && out.rb === true, "com TTL 0 os dois processos deviam se eleger líder");
});

caso("banco-antigo-abre-sem-passo-manual", async () => {
  // Migration aditiva: um banco escrito pelo código ANTIGO (sem lider/meta) tem de abrir com o
  // código novo e ganhar as tabelas vazias, sem backfill e sem intervenção.
  const antigo = join(fixture, "antigo.db");
  const cru = new DatabaseSync(antigo);
  cru.exec(
    "CREATE TABLE files (path TEXT PRIMARY KEY, mtime INTEGER NOT NULL, size INTEGER NOT NULL," +
      " source TEXT NOT NULL, indexed_at INTEGER NOT NULL);" +
      " INSERT INTO files VALUES ('/velho.md', 1, 1, 'docs', 1);"
  );
  cru.close();

  const db = openDb(antigo);
  try {
    const tabelas = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
    ok(tabelas.includes("lider"), "openDb não criou a tabela lider num banco antigo");
    ok(tabelas.includes("meta"), "openDb não criou a tabela meta num banco antigo");
    const n = db.prepare("SELECT COUNT(*) c FROM files").get().c;
    ok(Number(n) === 1, "o dado que já estava no banco antigo não sobreviveu");
    ok(new Lease(db).tentarAdquirir() === true, "não deu para adquirir lease no banco migrado");
  } finally {
    db.close();
  }
});

caso("versao-indice-conta", async () => {
  const db = openDb(join(fixture, "versao.db"));
  try {
    ok(versaoIndice(db) === "", `versão inicial devia ser vazia, veio '${versaoIndice(db)}'`);
    bumpVersaoIndice(db);
    ok(versaoIndice(db) === "1", `após o 1º bump esperava '1', veio '${versaoIndice(db)}'`);
    bumpVersaoIndice(db);
    bumpVersaoIndice(db);
    ok(versaoIndice(db) === "3", `após 3 bumps esperava '3', veio '${versaoIndice(db)}'`);
  } finally {
    db.close();
  }
});

caso("para-ao-perder-o-lease", async () => {
  // CA2, metade de unidade: ao perder o lease, o backfill para no lote corrente e diz que parou.
  const db = openDb(join(fixture, "backfill.db"));
  try {
    db.exec(
      "INSERT INTO docs (id, path, title, source, doc_type)" +
        " VALUES (1, '/backfill.md', 'backfill', 'docs', 'doc')"
    );
    const ins = db.prepare(
      "INSERT INTO chunks (doc_id, breadcrumb, ord, text, token_est) VALUES (1, 'b', ?, ?, 3)"
    );
    for (let i = 0; i < 70; i++) ins.run(i, `trecho ${i}`);

    // Costura da emenda 2026-09-09 (opts.embutir): vetor determinístico, sem carregar o modelo.
    let lotes = 0;
    const embutir = async (textos) => {
      lotes++;
      return textos.map(() => vetorFake(1));
    };

    let recheques = 0;
    const r = await preencherEmbeddings(db, { embutir, aindaSouLider: () => ++recheques === 1 });

    ok(r.interrompido === true, "perder o lease devia devolver interrompido: true");
    ok(r.feitos === 32, `esperava exatamente um lote (32) embutido, veio ${r.feitos}`);
    // O que prova que o recheque vem ANTES do lote e não depois: o 2º lote nunca chegou a ser
    // gerado. Se a ordem estivesse invertida, lotes seria 2 — CPU gasta por quem já não é líder.
    ok(lotes === 1, `embedder chamado ${lotes}x; a 2ª chamada é trabalho de quem já perdeu o lease`);
    ok(recheques === 2, `esperava 2 recheques (um por volta do while), veio ${recheques}`);
    // Saída limpa: o lote só termina no COMMIT, então não existe chunk pela metade no banco.
    const comVetor = Number(
      db.prepare("SELECT COUNT(*) c FROM chunks WHERE embedding IS NOT NULL").get().c
    );
    ok(comVetor === 32, `esperava 32 chunks embutidos no banco, tem ${comVetor}`);
    ok(r.restantes === 38, `restantes ${r.restantes}, esperava 38`);

    // Retomável, e o padrão sem aindaSouLider é o comportamento de hoje: o sucessor continua
    // de onde este parou, sem reembutir o que já tinha vetor.
    const r2 = await preencherEmbeddings(db, { embutir });
    ok(r2.interrompido === false, "sem aindaSouLider nada pode interromper o backfill");
    ok(r2.feitos === 38, `o sucessor devia embutir os 38 restantes, embutiu ${r2.feitos}`);
    ok(r2.restantes === 0, `sobraram ${r2.restantes} chunks sem vetor`);
  } finally {
    db.close();
  }
});

caso("cache-vetorial-expira-por-versao", async () => {
  // CA4, metade de unidade (a de ponta a ponta, com dois servidores, é o caso homônimo abaixo).
  // Um seguidor nunca varre e nunca chama marcarSujo(): sem a versão, o cache serviria para
  // sempre o índice vetorial que ele carregou no boot.
  const caminho = join(fixture, "versao-cache.db");
  const seguidor = openDb(caminho);
  const lider = openDb(caminho);
  try {
    lider.exec(
      "INSERT INTO docs (id, path, title, source, doc_type) VALUES (1, '/v.md', 'v', 'docs', 'doc')"
    );
    const insChunk = lider.prepare(
      "INSERT INTO chunks (doc_id, breadcrumb, ord, text, token_est, embedding)" +
        " VALUES (1, 'b', ?, ?, 3, ?)"
    );
    insChunk.run(0, "chunk do boot", paraBlob(vetorFake(0)));
    bumpVersaoIndice(lider);

    const q = vetorFake(0);
    const vec = new VectorIndex(seguidor, () => versaoIndice(seguidor));
    const controle = new VectorIndex(seguidor); // padrão () => "": o comportamento de hoje
    ok(vec.buscar(q, {}, 10).length === 1, "carga inicial devia enxergar 1 chunk");
    ok(controle.buscar(q, {}, 10).length === 1, "carga inicial do controle devia enxergar 1 chunk");

    // O líder indexa conteúdo novo, por outra conexão. Ninguém chama marcarSujo() no seguidor.
    insChunk.run(1, "chunk que o lider indexou depois", paraBlob(vetorFake(1)));
    bumpVersaoIndice(lider);

    ok(vec.buscar(q, {}, 10).length === 2, "a busca semântica do seguidor envelheceu (CA4)");
    ok(vec.tamanho === 2, `esperava 2 vetores em memória, tem ${vec.tamanho}`);

    // Controle: sem versaoAtual o cache fica congelado — é exatamente o defeito que a correção
    // do card criaria se esta task não existisse, e a prova de que o padrão não muda nada.
    ok(controle.buscar(q, {}, 10).length === 1, "sem versaoAtual o cache não podia recarregar");
    // E marcarSujo() segue sendo caminho válido de invalidação: a versão é 2º gatilho, não troca.
    controle.marcarSujo();
    ok(controle.buscar(q, {}, 10).length === 2, "marcarSujo() deixou de invalidar o cache");

    // Não recarrega à toa: a checagem é um SELECT por consulta, não uma recarga por consulta.
    insChunk.run(2, "chunk sem bump da versao", paraBlob(vetorFake(2)));
    ok(vec.buscar(q, {}, 10).length === 2, "recarregou sem a versão ter mudado");
  } finally {
    seguidor.close();
    lider.close();
  }
});

// ---------------------------------------------------------------- casos de servidor
caso("abrir-em-paralelo-nao-quebra", async () => {
  // Regressão do achado desta task, e ele é do tipo que só aparece sob concorrência real:
  // `PRAGMA journal_mode = WAL` pega uma trava exclusiva breve, e se `busy_timeout` ainda não foi
  // definido, quem perde a corrida leva `database is locked` NA HORA — sem espera e sem retry, o
  // processo morre no boot. Medido antes da correção: 12 mortes em 192 aberturas simultâneas.
  // É exatamente o que o CA1 proíbe, então a ordem dos dois PRAGMAs em openDb() é load-bearing.
  const RODADAS = 5;
  const POR_RODADA = 10;
  const fonte = [
    `const { openDb } = await import(${JSON.stringify(modulo("db.js"))});`,
    `openDb(process.env.D).close();`,
  ].join("\n");

  const quebrados = [];
  let aberturas = 0;
  for (let r = 0; r < RODADAS; r++) {
    // Banco novo a cada rodada: a corrida é na PRIMEIRA definição do journal mode.
    const alvo = join(fixture, "abrir-paralelo", `r${r}`, "brain.db");
    const filhos = await Promise.all(
      Array.from(
        { length: POR_RODADA },
        () =>
          new Promise((res) => {
            const c = spawn(process.execPath, ["--input-type=module", "-e", fonte], {
              env: { ...process.env, D: alvo },
              stdio: ["ignore", "ignore", "pipe"],
            });
            let e = "";
            c.stderr.on("data", (d) => (e += d.toString()));
            c.on("exit", (code) => res({ code, e }));
          })
      )
    );
    aberturas += filhos.length;
    quebrados.push(...filhos.filter((f) => f.code !== 0));
  }

  ok(
    quebrados.length === 0,
    `${quebrados.length}/${aberturas} processos morreram ao abrir o banco em paralelo: ` +
      `${(quebrados[0]?.e ?? "").split("\n").slice(0, 3).join(" | ").slice(0, 240)}`
  );
});

caso("um-so-lider", async () => {
  // CA1: é o caso que reproduz o defeito do card. 4 servidores contra a mesma fixture, subidos
  // ao mesmo tempo de propósito — a disputa tem de ser real, não encenada em série.
  const fx = criarFixture("um-so-lider", {
    "alfa.md": "# Alfa\n\nprimeiro documento da fixture, sobre alfa.\n",
    "beta.md": "# Beta\n\nsegundo documento da fixture, sobre beta.\n",
  });
  const ss = [0, 1, 2, 3].map((i) => subirServidor(fx, `s${i}`));

  await ate(
    () => ss.every((s) => s.bootou()),
    30000,
    () => `o boot dos 4 servidores -> ${ss.map((s) => s.diagnostico()).join(" ;; ")}`
  );
  // Deixa o trabalho de fundo acontecer (setTimeout de 500 ms + grafo + backfill): é AQUI que um
  // seguidor indisciplinado se denunciaria. Sem esta espera o caso passaria por chegar cedo.
  await ate(() => ss.some((s) => s.err.includes("grafo:")), 30000, "o líder reconstruir o grafo");
  await dormir(1500);

  const n = contar(fx.db, "SELECT COUNT(*) c FROM lider");
  ok(n === 1, `esperava exatamente 1 linha em lider, tem ${n}`);
  const dono = lerLider(fx.db);
  ok(Number(dono.expira_em) > Date.now(), "o lease do dono já estava vencido");

  const lideres = ss.filter((s) => s.eLider());
  const seguidores = ss.filter((s) => s.err.includes("boot (seguidor)"));
  ok(lideres.length === 1, `esperava 1 líder, ${lideres.length} se declararam líder`);
  ok(seguidores.length === 3, `esperava 3 seguidores, veio ${seguidores.length}`);
  ok(
    Number(dono.pid) === lideres[0].pid,
    `a tabela aponta o pid ${dono.pid}, mas quem logou "boot (líder)" foi ${lideres[0].pid}`
  );

  // As quatro operações pesadas do TD-2, pela evidência que cada uma deixa no stderr.
  for (const s of seguidores) {
    ok(!s.err.includes("grafo:"), `${s.rotulo} é seguidor e reconstruiu o grafo`);
    ok(!s.err.includes("embeddings:"), `${s.rotulo} é seguidor e gerou embeddings`);
    ok(!s.err.includes("vigia:"), `${s.rotulo} é seguidor e ligou o vigia`);
    ok(!s.err.includes("sync GitHub"), `${s.rotulo} é seguidor e disparou o sync do GitHub`);
  }
});

caso("embute-uma-vez", async () => {
  // CA2 de ponta a ponta: com 3 servidores vivos e chunks sem vetor, só um processo embute.
  // Documentos suficientes para o backfill levar vários lotes de 32: com um punhado deles o líder
  // terminaria antes de qualquer outro processo sequer olhar a cobertura, e o caso passaria por
  // velocidade em vez de por disciplina.
  const docs = {};
  for (let i = 0; i < 120; i++) {
    docs[`d${i}.md`] = `# Documento ${i}\n\nParagrafo do documento numero ${i} para gerar chunk.\n`;
  }
  const fx = criarFixture("embute-uma-vez", docs);
  const ss = [0, 1, 2].map((i) => subirServidor(fx, `s${i}`));
  await ate(
    () => ss.every((s) => s.bootou()),
    30000,
    () => `o boot dos 3 servidores -> ${ss.map((s) => s.diagnostico()).join(" ;; ")}`
  );

  await ate(
    () => contar(fx.db, "SELECT COUNT(*) c FROM chunks WHERE embedding IS NULL") === 0,
    30000,
    "o backfill zerar os chunks sem vetor"
  );

  const total = contar(fx.db, "SELECT COUNT(*) c FROM chunks");
  ok(total >= 120, `esperava ao menos 120 chunks indexados, veio ${total}`);

  // Dá tempo de um segundo processo se atropelar no backfill, se fosse fazê-lo.
  await dormir(1500);

  // A asserção que vale: QUEM chamou o embedder, medido dentro do stub. Pelo log não daria — um
  // processo que chega depois de o backfill terminar fica calado exatamente como um que respeitou
  // o lease, e os dois casos são indistinguíveis justo onde importa distinguir.
  const pids = [...new Set(readFileSync(fx.registro, "utf8").split("\n").filter(Boolean))];
  ok(
    pids.length === 1,
    `esperava 1 processo chamando embedPassagens, chamaram ${pids.length}: ${pids}`
  );
  const lideres = ss.filter((s) => s.eLider());
  ok(lideres.length === 1, `esperava 1 líder, veio ${lideres.length}`);
  ok(
    Number(pids[0]) === lideres[0].pid,
    `quem embutiu foi o pid ${pids[0]}, mas o líder é o ${lideres[0].pid}`
  );
  ok(
    contar(fx.db, "SELECT COUNT(*) c FROM chunks WHERE embedding IS NULL") === 0,
    "sobrou chunk sem vetor depois do backfill"
  );
});

caso("seguidor-nao-envelhece", async () => {
  // CA4 de ponta a ponta, em duas metades que provam coisas diferentes:
  //  - LÉXICA, inteiramente real: o líder indexa um arquivo novo de verdade e o seguidor o acha.
  //  - SEMÂNTICA, com sonda: um chunk que existe no índice vetorial e NÃO existe no FTS. Só o
  //    caminho semântico pode alcançá-lo, então achá-lo prova que o VectorIndex do seguidor
  //    recarregou. Sem esta separação o caso passaria de graça — com um stub de embeddings que é
  //    bag-of-words, qualquer coisa que o vetor acha o FTS também acharia.
  const fx = criarFixture("seguidor-nao-envelhece", {
    "alfa.md": "# Alfa\n\nDocumento de origem sobre alfa, presente desde o boot.\n",
  });
  const lider = subirServidor(fx, "lider");
  await ate(() => lider.eLider(), 30000, "o líder bootar");
  await ate(() => lider.err.includes("[brain] embeddings:"), 30000, "o backfill inicial do líder");

  const seg = subirServidor(fx, "seguidor");
  await ate(() => seg.err.includes("boot (seguidor)"), 30000, "o seguidor bootar");
  await seg.handshake();
  // O caminho semântico só liga depois que o modelo aquece (setTimeout de 500 ms no boot), e
  // `Buscador` degrada para só-léxico em silêncio até lá. Sem esperar por isto, as buscas abaixo
  // sairiam sem semântica e o caso viraria teatro.
  await ate(
    () => seg.err.includes("modelo de embeddings pronto"),
    30000,
    "o modelo de embeddings do seguidor ficar pronto"
  );

  // Aquece o cache do seguidor E confirma que o caminho semântico está vivo nele. Sem esta
  // checagem, tudo o que vem depois passaria mesmo com a busca semântica desligada.
  await ate(
    async () => (await seg.chamar("search_context", { query: "alfa origem", limit: 5 })).includes("alfa"),
    30000,
    "o seguidor responder a primeira busca"
  );
  const aquecimento = await seg.chamar("search_context", { query: "alfa origem", limit: 5 });
  ok(
    !aquecimento.includes("busca semântica indisponível"),
    "o seguidor caiu para só-léxico; o resto do caso perderia o sentido"
  );

  const versaoAntes = lerVersao(fx.db);

  // --- metade léxica: arquivo novo de verdade, indexado pelo líder ---
  const termo = "zeta" + Math.random().toString(36).slice(2, 8);
  writeFileSync(
    join(fx.docsDir, "novo.md"),
    `# Novo\n\nDocumento novo contendo o termo ${termo}, exclusivo desta rodada.\n`
  );
  await ate(
    () => contar(fx.db, "SELECT COUNT(*) c FROM docs WHERE path LIKE '%novo.md'") === 1,
    30000,
    "o vigia do líder indexar o arquivo novo"
  );
  // Espera, não asserção seca: a linha do banco aparece dentro do scan e o log sai depois dele,
  // por um pipe assíncrono. Conferir na hora seria uma corrida contra o próprio teste.
  await ate(
    () => lider.err.includes("índice atualizado"),
    30000,
    "o líder registrar a varredura do arquivo novo"
  );

  const lexica = await seg.chamar("search_context", { query: termo, limit: 5 });
  ok(lexica.includes(termo), `o seguidor não achou ${termo} por via léxica: ${lexica.slice(0, 200)}`);

  const versaoDepois = lerVersao(fx.db);
  ok(
    versaoDepois > versaoAntes,
    `meta.versao_indice não incrementou (${versaoAntes} -> ${versaoDepois})`
  );

  // --- metade semântica: sonda que existe só no índice vetorial ---
  const termoVec = "qsonda" + Math.random().toString(36).slice(2, 8);
  const textoSonda = `Sonda vetorial ${termoVec} alcancavel apenas por cosseno.`;
  const db = openDb(fx.db);
  let chunkSonda;
  try {
    const rDoc = db
      .prepare("INSERT INTO docs (path, title, source, doc_type) VALUES (?, ?, 'docs', 'doc')")
      .run("/sonda-vetorial.md", "sonda vetorial");
    const [vetor] = await embutirFalso([textoSonda]);
    const rChunk = db
      .prepare(
        "INSERT INTO chunks (doc_id, breadcrumb, ord, text, token_est, embedding)" +
          " VALUES (?, 'sonda', 0, ?, 8, ?)"
      )
      .run(Number(rDoc.lastInsertRowid), textoSonda, paraBlob(vetor));
    chunkSonda = Number(rChunk.lastInsertRowid);

    // O controle que dá sentido ao caso: a sonda não entrou no FTS, então o léxico não a alcança.
    const noFts = Number(
      db.prepare("SELECT COUNT(*) c FROM chunks_fts WHERE rowid = ?").get(chunkSonda).c
    );
    ok(noFts === 0, "a sonda vazou para o FTS; o caso deixaria de isolar o caminho semântico");
    bumpVersaoIndice(db);
  } finally {
    db.close();
  }

  let semantica = "";
  await ate(
    async () => {
      semantica = await seg.chamar("search_context", { query: textoSonda, limit: 5 });
      return semantica.includes("sonda-vetorial");
    },
    30000,
    "o seguidor alcançar a sonda por via semântica (o VectorIndex dele precisa recarregar)"
  );
  ok(
    !semantica.includes("busca semântica indisponível"),
    "a consulta que achou a sonda saiu sem o caminho semântico — impossível, algo está errado"
  );
});

caso("rebaixar-e-repromover", async () => {
  // O ciclo que apodrece em silêncio: perder a liderança e recuperá-la no mesmo processo. Se
  // `aoPerder` não zerasse `pesadoAtivo`, a repromoção cairia na guarda de idempotência e o
  // processo voltaria a ser líder SEM vigia e SEM backfill — líder de nome, índice parado.
  const fx = criarFixture("rebaixar-e-repromover", {
    "alfa.md": "# Alfa\n\nDocumento de origem para a fixture do rebaixamento.\n",
  });
  const a = subirServidor(fx, "a");
  await ate(() => a.eLider(), 30000, "o servidor A assumir a liderança");
  await ate(() => a.err.includes("vigia:"), 30000, "o servidor A ligar o vigia");

  // O teste rouba o lease como um `--force` faria, e o SEGURA renovando: sem segurar, o TTL de
  // 500 ms deste processo venceria antes de o A notar, e não haveria rebaixamento nenhum.
  const db = openDb(fx.db);
  const ladrao = new Lease(db);
  ok(ladrao.tentarAdquirir(true) === true, "não deu para tomar a liderança à força");
  const renovando = setInterval(() => {
    try {
      ladrao.renovar();
    } catch {
      /* banco ocupado neste tique não muda nada */
    }
  }, 150);
  try {
    await ate(() => a.err.includes("perdi a liderança"), 30000, "o servidor A se rebaixar");
  } finally {
    clearInterval(renovando);
  }
  ladrao.liberar();
  db.close();

  await ate(() => a.err.includes("assumi o índice"), 30000, "o servidor A ser repromovido");

  // Repromover tem de RELIGAR o vigia, não apenas mudar uma flag. Um arquivo novo é a prova.
  writeFileSync(
    join(fx.docsDir, "apos-repromocao.md"),
    "# Apos\n\nArquivo criado depois de o servidor A ser repromovido.\n"
  );
  await ate(
    () => contar(fx.db, "SELECT COUNT(*) c FROM docs WHERE path LIKE '%apos-repromocao.md'") === 1,
    30000,
    "o servidor A voltar a indexar depois de repromovido"
  );
  const vezes = a.err.split("vigia:").length - 1;
  ok(vezes === 2, `esperava o vigia ligado 2x (boot + repromoção), veio ${vezes}`);
});

caso("posse-apos-morte-abrupta", async () => {
  // CA3, a GARANTIA. Morte sem chance de handler é o caso que a máquina-alvo (Windows) impõe:
  // child.kill() vira TerminateProcess e nada do processo morto roda. Quem responde é o TTL.
  const fx = criarFixture("posse-apos-morte-abrupta", {
    "alfa.md": "# Alfa\n\nDocumento de origem para a fixture da morte abrupta.\n",
  });
  const a = subirServidor(fx, "a");
  await ate(() => a.eLider(), 30000, "o servidor A assumir a liderança");
  const b = subirServidor(fx, "b");
  await ate(() => b.err.includes("boot (seguidor)"), 30000, "o servidor B bootar como seguidor");

  const antes = lerLider(fx.db);
  ok(Number(antes.pid) === a.pid, "a tabela não apontava o A como líder antes da morte");

  a.matar();
  await ate(() => !a.vivo, 10000, "o processo A morrer");

  // Só o vencimento do TTL destrava a posse: nada avisou o B, e é esse o ponto.
  await ate(
    () => b.err.includes("assumi o índice"),
    TTL_SERVIDOR_MS + TIQUE_SERVIDOR_MS + 15000,
    "o servidor B assumir o índice sozinho"
  );
  const depois = lerLider(fx.db);
  ok(
    depois.instancia !== antes.instancia,
    "a instância dona do lease não mudou depois da morte do líder"
  );
  ok(Number(depois.pid) === b.pid, `esperava o pid ${b.pid} como novo dono, veio ${depois.pid}`);

  // A parte que apodrece em silêncio: promover não basta, o novo líder tem de VOLTAR A INDEXAR.
  ok(b.err.includes("vigia:"), "o novo líder não ligou o vigia ao ser promovido");
  writeFileSync(
    join(fx.docsDir, "depois-da-morte.md"),
    "# Depois\n\nArquivo criado depois de o lider original morrer.\n"
  );
  await ate(
    () => contar(fx.db, "SELECT COUNT(*) c FROM docs WHERE path LIKE '%depois-da-morte.md'") === 1,
    30000,
    "o novo líder indexar um arquivo criado após a promoção"
  );
});

caso("posse-apos-saida-graciosa", async () => {
  // CA3, o caminho comum: o cliente MCP fecha o stdin e o transporte stdio termina. Aqui a posse
  // não pode custar o TTL inteiro — o lease sai da tabela na hora e o sucessor assume no tique.
  const fx = criarFixture("posse-apos-saida-graciosa", {
    "alfa.md": "# Alfa\n\nDocumento de origem para a fixture da saida graciosa.\n",
  });
  const a = subirServidor(fx, "a");
  await ate(() => a.eLider(), 30000, "o servidor A assumir a liderança");
  const b = subirServidor(fx, "b");
  await ate(() => b.err.includes("boot (seguidor)"), 30000, "o servidor B bootar como seguidor");
  ok(Number(lerLider(fx.db).pid) === a.pid, "a tabela não apontava o A como líder antes da saída");

  const t0 = Date.now();
  a.fecharStdin();

  // "Na hora" tem de ser bem antes do TTL, senão o handler não estaria fazendo nada.
  await ate(() => lerLider(fx.db) === null, TTL_SERVIDOR_MS - 500, "a tabela lider ficar vazia");
  const msParaLiberar = Date.now() - t0;
  ok(
    msParaLiberar < TTL_SERVIDOR_MS,
    `liberar levou ${msParaLiberar} ms; com o TTL de ${TTL_SERVIDOR_MS} ms isso é esperar o vencimento`
  );

  await ate(
    () => b.err.includes("assumi o índice"),
    TIQUE_SERVIDOR_MS + 15000,
    "o servidor B assumir no tique seguinte"
  );
  const msParaAssumir = Date.now() - t0;
  ok(Number(lerLider(fx.db).pid) === b.pid, "o B logou a posse mas a tabela não o aponta");
  ok(
    msParaAssumir < TTL_SERVIDOR_MS + TIQUE_SERVIDOR_MS,
    `a posse levou ${msParaAssumir} ms — o caminho gracioso não pode custar o TTL inteiro`
  );
});

caso("seguidor-escreve-durante-reindex", async () => {
  // CA1, 2º cenário — o defeito do card na forma mais literal que ele tem. Durante a redação da
  // spec, um `lembrar` devolveu `database is locked` E MESMO ASSIM gravou a linha: falha PARCIAL,
  // que é pior que falhar limpo. Por isso não basta a tool responder sem erro — o caso confere
  // também que a decisão ficou INTEIRA (linha na tabela + arquivo no cofre).
  //
  // Documentos o bastante para o fullReindex do líder segurar a trava por um tempo real: com um
  // punhado deles a transação fecharia antes de o seguidor ser chamado, e o caso passaria por
  // velocidade em vez de por concorrência.
  const docs = {};
  for (let i = 0; i < 400; i++) {
    docs[`d${i}.md`] = `# Documento ${i}\n\nParagrafo do documento numero ${i}, sobre marmota e alfazema.\n`;
  }
  const fx = criarFixture("seguidor-escreve", docs, { comDecisoes: true });
  const lider = subirServidor(fx, "lider");
  await ate(() => lider.eLider(), 30000, () => `o líder bootar -> ${lider.diagnostico()}`);
  // O seguidor só sobe depois de o líder terminar o boot INTEIRO, e a ordem tem duas razões — a
  // segunda custou um vermelho intermitente. (1) O backfill de boot também escreve, e a disputa
  // que este caso mede é com o fullReindex, não com o resto do boot. (2) Com 400 documentos o boot
  // do líder pode levar mais que o TTL de 3 s da fixture, e o tique que renova o lease só começa
  // DEPOIS dele: um seguidor subindo nessa janela acharia o lease vencido e nasceria líder — e o
  // caso ficaria sem seguidor, esperando por um log que nunca viria.
  await ate(
    () => lider.err.includes("[brain] embeddings:"),
    60000,
    () => `o backfill inicial do líder -> ${lider.diagnostico()}`
  );
  const seg = subirServidor(fx, "seguidor");
  await ate(
    () => seg.err.includes("boot (seguidor)"),
    30000,
    () => `o seguidor bootar -> ${seg.diagnostico()}`
  );
  await lider.handshake();
  await seg.handshake();

  let reindexTerminou = false;
  const oReindex = lider
    .chamarCru("reindex", { full: true, forcar: true })
    .then((r) => ((reindexTerminou = true), r));

  // Martela o seguidor ENQUANTO a transação do líder está aberta, em vez de disparar uma vez e
  // torcer para cair na janela certa. Cada rodada faz uma LEITURA e uma ESCRITA — os dois lados
  // que o CA1 exige que concluam —, e a condição do laço garante que toda rodada da lista foi
  // emitida com o reindex ainda em voo. O teto de 40 só impede laço infinito se algo travar.
  const rodadas = [];
  for (let i = 0; !reindexTerminou && i < 40; i++) {
    const busca = await seg.chamarCru("search_context", { query: "marmota alfazema", limit: 3 });
    const lembrar = await seg.chamarCru("lembrar", {
      fato: `Decisao ${i} gravada por um seguidor durante a reindexacao completa do lider.`,
      tipo: "descoberta",
      escopo: "concorrencia",
    });
    rodadas.push({ i, busca, lembrar });
  }

  const reindex = await oReindex;
  ok(!reindex.falhou, `o reindex do líder falhou: ${reindex.resumo()}`);
  ok(rodadas.length >= 1, "nenhuma rodada do seguidor foi emitida durante o reindex");

  for (const { i, busca, lembrar } of rodadas) {
    ok(!busca.falhou, `search_context da rodada ${i} falhou: ${busca.resumo()}`);
    ok(!busca.comLock, `search_context da rodada ${i} bateu em lock: ${busca.resumo()}`);
    ok(!lembrar.falhou, `lembrar da rodada ${i} falhou: ${lembrar.resumo()}`);
    ok(!lembrar.comLock, `lembrar da rodada ${i} bateu em lock: ${lembrar.resumo()}`);
    ok(lembrar.texto.length > 0, `lembrar da rodada ${i} respondeu vazio`);
  }
  // Deliberadamente NÃO se afirma que a busca trouxe resultado: `fullReindex` é `clearAll` (em
  // autocommit) seguido de `scan` (em transação), então existe uma janela COMMITADA de índice
  // vazio, e uma busca honesta do seguidor pode cair nela e responder "Nenhum resultado". O CA1
  // pede que a chamada conclua sem erro, e é isso — e só isso — que se afirma aqui.

  // A prova contra a falha parcial: para cada `lembrar` que respondeu ok tem de haver linha na
  // tabela E arquivo em disco. Era exatamente aqui que o defeito original se escondia.
  const db = openDb(fx.db);
  try {
    const linhas = db
      .prepare("SELECT id, fato, doc_path FROM decisoes WHERE escopo = 'concorrencia' ORDER BY id")
      .all();
    ok(
      linhas.length === rodadas.length,
      `${rodadas.length} lembrar concluíram, mas a tabela tem ${linhas.length} decisões`
    );
    for (const l of linhas) {
      ok(
        existsSync(l.doc_path),
        `decisão ${l.id} ficou pela metade: linha gravada e arquivo ausente (${l.doc_path})`
      );
    }
  } finally {
    db.close();
  }
});

caso("reindex-nao-derruba-lider", async () => {
  // CA3 pelo avesso: mandar o PRÓPRIO líder reindexar tudo não pode custar-lhe a liderança.
  // `clearAll` hoje apaga docs, chunks, FTS e files — se um dia alguém acrescentar `lider` ou
  // `meta` a essa lista, o líder se derrubaria no meio do próprio trabalho e o índice ficaria
  // órfão até o TTL vencer. Este caso é o alarme dessa mudança.
  const fx = criarFixture("reindex-nao-derruba-lider", {
    "alfa.md": "# Alfa\n\nDocumento de origem para a fixture do reindex.\n",
    "beta.md": "# Beta\n\nSegundo documento, para o scan ter o que reindexar.\n",
  });
  const a = subirServidor(fx, "a");
  await ate(() => a.eLider(), 30000, () => `o servidor A assumir a liderança -> ${a.diagnostico()}`);
  await a.handshake();

  // Primeiro full só para levantar o contador acima de 1: se `meta` fosse apagado e recriado pelo
  // bump seguinte, o valor voltaria a '1' — indistinguível de um índice novo se o teste comparasse
  // contra 1. Com o contador em 2+, a queda para 1 fica visível.
  const primeiro = await a.chamarCru("reindex", { full: true });
  ok(!primeiro.falhou, `o primeiro reindex falhou: ${primeiro.resumo()}`);

  const antes = lerLider(fx.db);
  const versaoAntes = lerVersao(fx.db);
  ok(antes !== null && Number(antes.pid) === a.pid, "a tabela não apontava o A antes do reindex");
  ok(versaoAntes >= 2, `esperava versao_indice >= 2 antes do 2º full, veio ${versaoAntes}`);

  const r = await a.chamarCru("reindex", { full: true });
  ok(!r.falhou, `o reindex falhou: ${r.resumo()}`);
  ok(
    /Varridos \d+ arquivos/.test(r.texto),
    `o reindex não relatou varredura: ${r.texto.slice(0, 200)}`
  );

  const depois = lerLider(fx.db);
  ok(depois !== null, "o lease sumiu da tabela no fullReindex — `clearAll` levou `lider` junto");
  ok(
    depois.instancia === antes.instancia,
    "a instância dona do lease mudou durante o reindex do próprio dono"
  );
  ok(Number(depois.expira_em) >= Number(antes.expira_em), "o lease do líder não foi renovado");
  const versaoDepois = lerVersao(fx.db);
  ok(
    versaoDepois > versaoAntes,
    `meta.versao_indice não sobreviveu ao clearAll (${versaoAntes} -> ${versaoDepois})`
  );
  ok(!a.err.includes("perdi a liderança"), "o líder se rebaixou durante o próprio reindex");

  // Líder na tabela é barato; líder DE FATO é o que importa. Arquivo novo tem de ser indexado.
  writeFileSync(
    join(fx.docsDir, "apos-reindex.md"),
    "# Apos\n\nArquivo criado depois do fullReindex do proprio lider.\n"
  );
  await ate(
    () => contar(fx.db, "SELECT COUNT(*) c FROM docs WHERE path LIKE '%apos-reindex.md'") === 1,
    30000,
    "o líder voltar a indexar depois do próprio fullReindex"
  );
});

caso("reindex-recusa-e-forca", async () => {
  // O portão da tool, nos dois lados: a recusa e a escapatória (TD-5). E, no fim, a emenda
  // 2026-09-09 desta task — quem é promovido pelo `forcar` tem de assumir o TRABALHO de líder e
  // não só o título, senão o índice fica com um dono que não vigia nada.
  const fx = criarFixture("reindex-recusa-e-forca", {
    "alfa.md": "# Alfa\n\nDocumento de origem para a fixture da recusa.\n",
  });
  const a = subirServidor(fx, "a");
  await ate(() => a.eLider(), 30000, () => `o servidor A assumir a liderança -> ${a.diagnostico()}`);
  const b = subirServidor(fx, "b");
  await ate(
    () => b.err.includes("boot (seguidor)"),
    30000,
    () => `o servidor B bootar como seguidor -> ${b.diagnostico()}`
  );
  await b.handshake();
  await ate(() => a.err.includes("vigia:"), 30000, "o líder A ligar o vigia");
  // ESPERAR o boot de B terminar é o que dá sentido à última metade do caso, e custou uma
  // mutação para descobrir. `index.ts` só avalia `if (lease.souLider) assumirTrabalhoPesado()`
  // dentro do `setTimeout(…, 500)` do boot; se o `forcar` chegasse antes disso, B ganharia vigia
  // POR AQUELE caminho e o caso passaria mesmo sem o `aoAssumirLideranca` desta task — verde por
  // escalonamento, não por comportamento. "modelo de embeddings pronto" sai de dentro do mesmo
  // setTimeout, então vê-lo no stderr prova que aquela janela já fechou.
  await ate(
    () => b.err.includes("modelo de embeddings pronto"),
    30000,
    () => `o boot de B passar do setTimeout inicial -> ${b.diagnostico()}`
  );

  // --- a recusa ---
  const docsAntes = contar(fx.db, "SELECT COUNT(*) c FROM docs");
  const donoAntes = lerLider(fx.db);
  const recusa = await b.chamarCru("reindex", { full: true });

  ok(!recusa.falhou, `a recusa veio como erro de protocolo, não como resposta: ${recusa.resumo()}`);
  ok(
    /não reindexei/i.test(recusa.texto),
    `a recusa não diz que não reindexou: ${recusa.texto.slice(0, 200)}`
  );
  ok(
    recusa.texto.includes(String(a.pid)),
    `a recusa não é acionável — não cita o pid ${a.pid} do dono: ${recusa.texto.slice(0, 200)}`
  );
  ok(/forcar/i.test(recusa.texto), "a recusa não diz como sair dela (forcar: true)");

  // "Não escreve NADA" é a metade que importa: um `full` que rodasse antes de recusar teria
  // esvaziado o índice. `uso` é a exceção conhecida da spec (TD-2) e não entra nesta conta.
  ok(
    contar(fx.db, "SELECT COUNT(*) c FROM docs") === docsAntes,
    "a recusa mexeu na tabela docs — algo escreveu antes de recusar"
  );
  ok(
    lerLider(fx.db).instancia === donoAntes.instancia,
    "a recusa trocou o dono do lease — a tentativa que falha não pode escrever em `lider`"
  );

  // --- a escapatória ---
  const forcado = await b.chamarCru("reindex", { full: true, forcar: true });
  ok(!forcado.falhou, `o reindex forçado falhou: ${forcado.resumo()}`);
  ok(
    /Varridos \d+ arquivos/.test(forcado.texto),
    `o forçado não varreu: ${forcado.texto.slice(0, 200)}`
  );

  const donoDepois = lerLider(fx.db);
  ok(
    Number(donoDepois.pid) === b.pid,
    `esperava o pid ${b.pid} como dono depois do forcar, veio ${donoDepois.pid}`
  );
  await ate(() => a.err.includes("perdi a liderança"), 30000, "o servidor A se rebaixar");

  // --- a emenda: o promovido assume o trabalho, não só o título ---
  // Sem o `aoAssumirLideranca` que esta task acrescentou, B renovaria o lease para sempre no ramo
  // `if (this.lider)` do tique, sem nunca ligar vigia nem backfill — e como A já se rebaixou e
  // desligou o dele, NINGUÉM indexaria mais nada. O arquivo abaixo é o que separa os dois mundos.
  ok(b.err.includes("vigia:"), "B tomou a liderança e não ligou o vigia (líder só no nome)");
  // E veio pelo caminho certo: o tique anuncia "assumi o índice" ao promover, o `reindex` não.
  // Sem esta linha, um vigia ligado por promoção do tique passaria por prova da emenda.
  ok(
    !b.err.includes("assumi o índice"),
    "B foi promovido pelo tique, não pelo reindex — o caso deixou de provar a emenda"
  );
  writeFileSync(
    join(fx.docsDir, "apos-forcar.md"),
    "# Apos\n\nArquivo criado depois de B tomar a lideranca a forca.\n"
  );
  await ate(
    () => contar(fx.db, "SELECT COUNT(*) c FROM docs WHERE path LIKE '%apos-forcar.md'") === 1,
    30000,
    "o novo líder B indexar um arquivo criado depois da promoção"
  );
});

caso("cli-disputa-o-lease", async () => {
  // A Área 7, que nenhum outro caso alcança: a CLI é um processo à parte, sem MCP e sem stdio, e
  // é o segundo caminho de escrita pesada da feature. Três coisas se provam aqui — a recusa, a
  // espera que de fato REPETE, e a liberação do lease inclusive quando o script sai por erro.
  const fx = criarFixture("cli-disputa-o-lease", {
    "alfa.md": "# Alfa\n\nDocumento de origem para a fixture da CLI.\n",
  });

  /** A CLI roda como o usuário a roda: processo próprio, argv de verdade, stdout/stderr lidos. */
  const rodarCli = (args, env = {}, script = join(root, "dist", "cli.js")) =>
    new Promise((res) => {
      const c = spawn(process.execPath, [script, ...args], {
        cwd: root,
        env: { ...process.env, BRAIN_DB: fx.db, BRAIN_CONFIG: fx.config, ...env },
      });
      let out = "";
      let err = "";
      c.stdout.on("data", (d) => (out += d.toString()));
      c.stderr.on("data", (d) => (err += d.toString()));
      c.on("exit", (code) => res({ code, out, err }));
    });

  const db = openDb(fx.db);
  const dono = new Lease(db);
  ok(dono.tentarAdquirir() === true, "não consegui montar a fixture do lease");
  // Segurar o lease renovando é obrigatório: o TTL deste processo de teste é de 500 ms, e sem a
  // renovação ele venceria no meio da própria asserção — a CLI acharia o índice livre e o caso
  // testaria o contrário do que promete.
  const segurando = setInterval(() => {
    try {
      dono.renovar();
    } catch {
      /* banco ocupado neste tique não muda nada */
    }
  }, 150);

  try {
    const linhaDono = lerLider(fx.db);
    const docsAntes = contar(fx.db, "SELECT COUNT(*) c FROM docs");

    // --- 1. recusa, e recusa ACIONÁVEL ---
    // BRAIN_CLI_ESPERA_MS=0 troca os 10 s de espera por uma tentativa só: a espera é exercitada
    // no passo 2, e pagá-la aqui seria 10 s a cada rodada da suíte por nada.
    const recusa = await rodarCli([], { BRAIN_CLI_ESPERA_MS: "0" });
    ok(recusa.code === 1, `esperava código 1 na recusa, veio ${recusa.code}: ${recusa.err.slice(0, 200)}`);
    ok(recusa.err.includes(String(linhaDono.pid)), `a recusa não cita o pid do dono: ${recusa.err.slice(0, 200)}`);
    ok(recusa.err.includes(linhaDono.host), "a recusa não cita o host do dono");
    ok(/lease até \S/.test(recusa.err), "a recusa não diz até quando vale o lease do dono");
    ok(recusa.err.includes("--force"), "a recusa não diz como sair dela (--force)");
    ok(
      !/Varredura incremental|Reindexação completa/.test(recusa.out),
      "a CLI varreu antes de recusar — a disputa tem de vir antes de qualquer escrita"
    );
    ok(
      contar(fx.db, "SELECT COUNT(*) c FROM docs") === docsAntes,
      "a recusa mexeu na tabela docs"
    );
    ok(lerLider(fx.db).instancia === linhaDono.instancia, "a CLI roubou o lease em vez de recusar");

    // --- 2. a espera REPETE, não é um sleep só ---
    // A CLI sobe com 6 s de prazo enquanto o lease ainda está preso; ~1 s depois o dono some. Se
    // `adquirirComEspera` tentasse uma vez e dormisse o resto, ela terminaria em recusa. Concluir
    // com sucesso só é possível tentando de novo DEPOIS de o lease ser liberado.
    const esperando = rodarCli([], { BRAIN_CLI_ESPERA_MS: "6000" });
    await dormir(1000);
    clearInterval(segurando);
    dono.liberar();
    const persistente = await esperando;
    ok(
      persistente.code === 0,
      `a CLI desistiu em vez de repetir a tentativa (código ${persistente.code}): ${persistente.err.slice(0, 200)}`
    );
    ok(/Varredura incremental/.test(persistente.out), "a CLI ganhou o lease mas não varreu");
    ok(lerLider(fx.db) === null, "a CLI terminou e não devolveu o lease");

    // --- 3. sair por ERRO também devolve o lease ---
    // Um lease órfão de processo morto barraria a próxima CLI e o próximo servidor até o TTL
    // vencer. Não há como fazer a CLI real falhar no meio sem um ponto de injeção de falha no
    // código de produção — que seria maquinário permanente para um caso só —, então o teste
    // injeta o erro numa CÓPIA do artefato já compilado. A cópia mora em dist/ porque os imports
    // dela são relativos (`./config.js`) e só resolvem ao lado dos irmãos.
    const copia = join(root, "dist", "cli-que-estoura.tmp.js");
    const fonte = readFileSync(join(root, "dist", "cli.js"), "utf8");
    const marca = "const indexer = new Indexer(db, config);";
    ok(fonte.includes(marca), "não achei onde injetar o erro na cópia do dist/cli.js");
    writeFileSync(copia, fonte.replace(marca, marca + '\nthrow new Error("estouro proposital");'));
    try {
      const quebrada = await rodarCli([], { BRAIN_CLI_ESPERA_MS: "0" }, copia);
      ok(quebrada.code === 1, `esperava código 1 no estouro, veio ${quebrada.code}`);
      ok(/estouro proposital/.test(quebrada.err), `estourou no lugar errado: ${quebrada.err.slice(0, 200)}`);
      ok(lerLider(fx.db) === null, "a CLI saiu por erro e deixou o lease para trás");
    } finally {
      rmSync(copia, { force: true });
    }
  } finally {
    clearInterval(segurando);
    db.close();
  }
});

// ---------------------------------------------------------------- execução
console.log(`fixture: ${fixture}`);
console.log(`TTL_MS=${TTL_MS} TIQUE_MS=${TIQUE_MS} | servidores: TTL=${TTL_SERVIDOR_MS} ms\n`);

let falhas = 0;
for (const c of casos) {
  try {
    await c.fn();
    console.log(`  ok      ${c.nome}`);
  } catch (err) {
    falhas++;
    console.error(`  FALHOU  ${c.nome}: ${err.message}`);
  } finally {
    // Derruba os servidores DESTE caso antes do próximo. Sem isto eles se acumulam — cada um com
    // seu vigia, seu tique de lease e sua conexão — e os casos passam a disputar CPU e disco
    // entre si, que é exatamente como um teste de concorrência vira intermitente.
    for (const s of servidores.splice(0)) s.matar();
    await dormir(200);
  }
}

try {
  rmSync(fixture, { recursive: true, force: true });
} catch {
  // Windows às vezes ainda segura o arquivo do WAL; é um diretório temporário, o SO limpa.
}

console.log(
  falhas === 0
    ? `\nCONCORRENCIA OK (${casos.length} casos)`
    : `\nCONCORRENCIA FALHOU: ${falhas}/${casos.length}`
);
process.exit(falhas === 0 ? 0 : 1);
