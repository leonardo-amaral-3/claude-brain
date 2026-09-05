// Avaliação de retrieval: roda o golden set contra o servidor e mede hit@1, hit@5 e MRR.
// Sem isto, toda mudança em ranking é fé — é o que separa "mexi no BM25" de "melhorou".
//   node scripts/eval.mjs            # roda tudo
//   node scripts/eval.mjs natural    # só as queries em linguagem natural
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const golden = JSON.parse(readFileSync(join(root, "scripts", "golden.json"), "utf8"));
const filtroEstilo = process.argv[2];
const casos = filtroEstilo ? golden.filter((g) => g.estilo === filtroEstilo) : golden;

const child = spawn(process.execPath, [join(root, "dist", "index.js")], { stdio: ["pipe", "pipe", "ignore"] });
let buf = "";
const pending = new Map();
child.stdout.on("data", (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try {
      const m = JSON.parse(line);
      if (m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    } catch { /* linha não-JSON */ }
  }
});
let nextId = 1;
const request = (method, params) =>
  new Promise((res, rej) => {
    const id = nextId++;
    pending.set(id, res);
    setTimeout(() => rej(new Error("timeout " + method)), 30000);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });

await request("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "eval", version: "0" } });
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");

const BS = String.fromCharCode(92);
const norm = (s) => s.split(BS).join("/").toLowerCase();
let hit1 = 0, hit5 = 0, mrr = 0;
const falhas = [];

for (const caso of casos) {
  const r = await request("tools/call", { name: "search_context", arguments: { query: caso.q, limit: 5 } });
  const txt = r.result?.content?.[0]?.text ?? "";
  // paths vêm na 3ª linha de cada bloco de resultado
  const paths = txt.split(String.fromCharCode(10)).map((l) => l.trim()).filter((l) => /^[A-Za-z]:/.test(l));
  const alvos = (Array.isArray(caso.esperado) ? caso.esperado : [caso.esperado]).map((a) => a.toLowerCase());
  const rank = paths.findIndex((p) => alvos.some((a) => norm(p).includes(a)));
  if (rank === 0) hit1++;
  if (rank >= 0 && rank < 5) { hit5++; mrr += 1 / (rank + 1); }
  const marca = rank === 0 ? "✓@1" : rank > 0 ? `~@${rank + 1}` : "✗   ";
  console.log(`${marca} [${caso.estilo}] ${caso.q}`);
  if (rank !== 0) falhas.push({ caso, veio: paths.slice(0, 3).map((p) => norm(p).split("/").slice(-2).join("/")) });
}

const n = casos.length;
console.log(`\nhit@1 ${hit1}/${n} (${Math.round((hit1 / n) * 100)}%)  ·  hit@5 ${hit5}/${n} (${Math.round((hit5 / n) * 100)}%)  ·  MRR ${(mrr / n).toFixed(2)}`);
if (falhas.length) {
  console.log("\nNão vieram em 1º:");
  for (const f of falhas) console.log(`  "${f.caso.q}"\n    esperado: ${[].concat(f.caso.esperado).join(" ou ")}\n    veio:     ${f.veio.join(" | ")}`);
}
child.kill();
process.exit(hit5 === n ? 0 : 1);
