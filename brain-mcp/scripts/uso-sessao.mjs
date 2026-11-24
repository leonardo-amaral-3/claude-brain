// Prova as colunas `sessao` e `tool_use_id` de `uso` (card #68, F2 do epico #66): a migracao
// aditiva de um banco com o schema ANTIGO, o INSERT do wrapper do servidor e a idempotencia.
//
// Nunca toca o indice vivo: banco e config temporarios, `BRAIN_SOMENTE_CONSULTA=1` (o servidor nao
// vira lider nem indexa). Sobe `dist/index.js` (rode `npm run build` antes). Codigo 0/1/2.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { semJev } from "./sem-jev.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist", "index.js");
if (!existsSync(dist)) {
  console.error("sem dist/index.js: rode `npm run build` antes");
  process.exit(2);
}
const limpeza = semJev(root);
if (limpeza.erro) {
  console.error("FALHOU: " + limpeza.erro);
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "uso-sessao-"));
let falhas = 0;
const ok = (cond, msg) => {
  if (!cond) {
    falhas++;
    console.error("FALHOU: " + msg);
  }
};

const config = join(tmp, "brain.config.json");
writeFileSync(config, JSON.stringify({ roots: [], git: { repos: [] } }));

/** Banco com o `uso` de ANTES de semantica/sessao/tool_use_id e duas linhas velhas. */
function bancoAntigo(nome) {
  const caminho = join(tmp, nome);
  const cru = new DatabaseSync(caminho);
  cru.exec(
    "CREATE TABLE uso (id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, tool TEXT NOT NULL," +
      " args TEXT, ms INTEGER NOT NULL, resp_chars INTEGER NOT NULL, vazio INTEGER NOT NULL);"
  );
  const ins = cru.prepare("INSERT INTO uso (ts, tool, args, ms, resp_chars, vazio) VALUES (?, 'search_context', '{}', 10, 100, 0)");
  ins.run(1);
  ins.run(2);
  cru.close();
  return caminho;
}

/** Sobe o servidor, roda `chamadas` (lista de params de tools/call) e o encerra. */
async function servidor(db, env, chamadas) {
  const filho = spawn(process.execPath, [dist], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, BRAIN_DB: db, BRAIN_CONFIG: config, BRAIN_SOMENTE_CONSULTA: "1", ...env },
  });
  let stderr = "";
  filho.stderr.on("data", (d) => (stderr += d));
  let buf = "";
  const espera = new Map();
  filho.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) !== -1) {
      const linha = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      try {
        const msg = JSON.parse(linha);
        if (msg.id !== undefined && espera.has(msg.id)) espera.get(msg.id)(msg), espera.delete(msg.id);
      } catch {}
    }
  });
  let id = 1;
  const pedir = (method, params) =>
    new Promise((res, rej) => {
      const meu = id++;
      espera.set(meu, res);
      setTimeout(() => rej(new Error(`timeout em ${method}\n${stderr}`)), 90000);
      filho.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: meu, method, params }) + "\n");
    });
  try {
    await pedir("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "uso-sessao", version: "0" } });
    filho.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
    for (const p of chamadas) await pedir("tools/call", p);
  } finally {
    filho.kill();
  }
  return stderr;
}

const linhas = (caminho) => {
  const d = new DatabaseSync(caminho, { readOnly: true });
  try {
    const cols = d.prepare("PRAGMA table_info(uso)").all().map((c) => c.name);
    const rows = d.prepare("SELECT ts, tool, semantica, sessao, tool_use_id FROM uso ORDER BY id").all();
    return { cols, rows };
  } finally {
    d.close();
  }
};
const busca = (meta) => ({ name: "search_context", arguments: { query: "teste de sessao" }, ...(meta ? { _meta: meta } : {}) });

try {
  const db = bancoAntigo("antigo.db");
  await servidor(db, { CLAUDE_CODE_SESSION_ID: "sessao-teste" }, [busca({ "claudecode/toolUseId": "toolu_teste" }), busca(null)]);
  let { cols, rows } = linhas(db);
  for (const c of ["semantica", "sessao", "tool_use_id"]) ok(cols.includes(c), `coluna ${c} ausente: [${cols}]`);
  ok(rows.length === 4, `esperava 4 linhas (2 velhas + 2 novas), vieram ${rows.length}`);
  for (const r of rows.slice(0, 2)) ok(r.sessao === null && r.tool_use_id === null && r.semantica === null, `linha antiga devia ficar NULL: ${JSON.stringify(r)}`);
  ok(rows[2]?.sessao === "sessao-teste" && rows[2]?.tool_use_id === "toolu_teste", `1a nova: ${JSON.stringify(rows[2])}`);
  ok(rows[3]?.sessao === "sessao-teste" && rows[3]?.tool_use_id === null, `2a nova (sem _meta): ${JSON.stringify(rows[3])}`);

  // Idempotente: segundo servidor no mesmo banco sobe sem erro e sem perder linha.
  const err2 = await servidor(db, { CLAUDE_CODE_SESSION_ID: "outra" }, [busca(null)]);
  ok(!/duplicate column|SqliteError|Error:/i.test(err2), `segundo servidor reclamou: ${err2.slice(0, 300)}`);
  ({ rows } = linhas(db));
  ok(rows.length === 5 && rows[4].sessao === "outra", `apos o 2o servidor: ${JSON.stringify(rows.slice(4))}`);

  // Sem a variavel: sessao NULL (o `semJev` apagou a do nosso ambiente; garantimos vazia no filho).
  const db3 = bancoAntigo("sem-variavel.db");
  await servidor(db3, { CLAUDE_CODE_SESSION_ID: "" }, [busca(null)]);
  ({ rows } = linhas(db3));
  ok(rows.length === 3 && rows[2].sessao === null, `sem a variavel, sessao devia ser NULL: ${JSON.stringify(rows[2])}`);
} catch (e) {
  falhas++;
  console.error("FALHOU: " + (e?.stack || e));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (falhas) {
  console.error(`${falhas} falha(s)`);
  process.exit(1);
}
console.log("uso-sessao OK");
