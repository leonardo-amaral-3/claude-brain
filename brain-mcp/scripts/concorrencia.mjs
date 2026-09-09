// Testes de concorrência do índice, no estilo de smoke.mjs: sem framework, porque o repo não tem
// um e esta feature não vai introduzir um.
//
// A diferença para o smoke: este roda ISOLADO. smoke.mjs e eval.mjs exercitam o índice real da
// instalação (137 MB, 5.757 docs) — legítimo, porque só leem. Aqui se escreve, se toma liderança
// e se mata processo, então rodar contra o índice vivo seria destrutivo. Daí a fixture
// descartável: BRAIN_CONFIG + BRAIN_DB + BRAIN_LEASE_TTL_MS próprios, num diretório temporário
// que morre no fim.
//
// As tasks seguintes acrescentam casos AQUI. Esta primeira leva só os de unidade — o helper de
// spawn do servidor por JSON-RPC nasce quando houver comportamento de servidor para exercitar.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modulo = (nome) => pathToFileURL(join(root, "dist", nome)).href;

// TTL curto: o padrão de 60 s tornaria o caso do lease vencido inviável de rodar. Precisa ser
// definido ANTES do import de dist/lease.js — TTL_MS é lido do ambiente no topo do módulo, uma
// vez só. Servidores filhos das tasks seguintes recebem o seu próprio pelo env do spawn.
const TTL_TESTE_MS = 500;
process.env.BRAIN_LEASE_TTL_MS = String(TTL_TESTE_MS);

// ---------------------------------------------------------------- fixture descartável
const fixture = mkdtempSync(join(tmpdir(), "brain-concorrencia-"));
const dbPath = join(fixture, "brain.db");
const configPath = join(fixture, "brain.config.json");
mkdirSync(join(fixture, "docs"), { recursive: true });
writeFileSync(
  configPath,
  JSON.stringify(
    {
      produto: "fixture de teste",
      roots: [{ path: join(fixture, "docs").split("\\").join("/"), source: "docs", repo: null }],
      codeExtensions: [".ts"],
      excludeDirs: ["node_modules", ".git"],
      excludeFiles: [],
      maxCodeFileBytes: 200000,
      github: { repos: [], syncIntervalMin: 60, commentsSinceDays: 30, maxItems: 100 },
      git: { repos: [], desde: "30 days ago", maximo: 200 },
    },
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

// ---------------------------------------------------------------- runner
const casos = [];
const caso = (nome, fn) => casos.push({ nome, fn });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
// Vetor one-hot: da para conferir identidade sem modelo nenhum.
const vetorFake = (n) => Float32Array.from({ length: DIMS }, (_, i) => (i === n % DIMS ? 1 : 0));
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------- casos
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
  // CA4, metade de unidade (a de ponta a ponta, com dois servidores, é da task 3). Um seguidor
  // nunca varre e nunca chama marcarSujo(): sem a versão, o cache serviria para sempre o índice
  // vetorial que ele carregou no boot.
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

// ---------------------------------------------------------------- execução
console.log(`fixture: ${fixture}`);
console.log(`TTL_MS=${TTL_MS} TIQUE_MS=${TIQUE_MS}\n`);

let falhas = 0;
for (const c of casos) {
  try {
    await c.fn();
    console.log(`  ok      ${c.nome}`);
  } catch (err) {
    falhas++;
    console.error(`  FALHOU  ${c.nome}: ${err.message}`);
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
