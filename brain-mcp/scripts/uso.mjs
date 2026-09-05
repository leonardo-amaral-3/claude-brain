// Relatório de uso do cérebro: quantas vezes o Claude chamou cada tool, e quantas voltaram vazias.
//   node scripts/uso.mjs [dias]     (default 14)
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = new DatabaseSync(join(root, "data", "brain.db"), { readOnly: true });
const dias = Number(process.argv[2] ?? 14);
const desde = Date.now() - dias * 86400000;

const total = db.prepare("SELECT COUNT(*) n FROM uso WHERE ts >= ?").get(desde).n;
if (!total) {
  console.log(`Nenhuma chamada nos últimos ${dias} dias.`);
  console.log("Se o servidor foi reiniciado agora, é esperado — o log começa a contar a partir daqui.");
  process.exit(0);
}

console.log(`Últimos ${dias} dias — ${total} chamadas\n`);
console.log("tool                chamadas   vazias   ms p50   resp média");
for (const r of db.prepare(
  `SELECT tool, COUNT(*) n, SUM(vazio) vazias, AVG(ms) ms, AVG(resp_chars) chars
   FROM uso WHERE ts >= ? GROUP BY tool ORDER BY n DESC`
).all(desde)) {
  console.log(
    `${r.tool.padEnd(18)} ${String(r.n).padStart(8)} ${String(r.vazias ?? 0).padStart(8)} ${String(Math.round(r.ms)).padStart(8)} ${String(Math.round(r.chars)).padStart(12)}`
  );
}

const porDia = db.prepare(
  `SELECT date(ts / 1000, 'unixepoch', 'localtime') dia, COUNT(*) n FROM uso WHERE ts >= ? GROUP BY dia ORDER BY dia`
).all(desde);
console.log("\nPor dia:");
for (const d of porDia) console.log(`  ${d.dia}  ${"#".repeat(Math.min(50, d.n))} ${d.n}`);

const vazias = db.prepare(
  `SELECT args, ts FROM uso WHERE ts >= ? AND vazio = 1 ORDER BY ts DESC LIMIT 10`
).all(desde);
if (vazias.length) {
  console.log("\nBuscas que voltaram vazias (candidatas a golden set / sinônimo faltando):");
  for (const v of vazias) console.log("  " + v.args);
}
