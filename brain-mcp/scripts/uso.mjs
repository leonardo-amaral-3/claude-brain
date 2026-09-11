// Relatório de uso do cérebro: quantas vezes o Claude chamou cada tool, quanto cada chamada
// realmente demorou, e quantas buscas foram respondidas sem a metade semântica.
//
// Percentil, e não média, porque a média mente sobre latência: medido em 2026-09-11 sobre as
// chamadas de `search_context`, o p50 era 148 ms e a média 484 ms — refém de um p99 de 7,6 s. O
// relatório antigo rotulava `ms p50` uma coluna que era `AVG(ms)`, e com isso fazia parecer lenta
// uma busca que é rápida na esmagadora maioria das vezes.
//
//   node scripts/uso.mjs [dias]              (default 14)
//   BRAIN_DB=<caminho> node scripts/uso.mjs
//
// O BRAIN_DB não é conveniência: o banco vivo mora na INSTALAÇÃO, e o checkout não tem nenhum. É
// por ele que o relatório roda daqui apontando para lá.
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Mesmo par que `src/config.ts:104`: a variável primeiro, o caminho ao lado do pacote como queda.
const caminho = process.env.BRAIN_DB || join(root, "data", "brain.db");
const db = new DatabaseSync(caminho, { readOnly: true });
const dias = Number(process.argv[2] ?? 14);
const desde = Date.now() - dias * 86400000;

const total = db.prepare("SELECT COUNT(*) n FROM uso WHERE ts >= ?").get(desde).n;
if (!total) {
  console.log(`Nenhuma chamada nos últimos ${dias} dias.`);
  console.log("Se o servidor foi reiniciado agora, é esperado — o log começa a contar a partir daqui.");
  process.exit(0);
}

// Este relatório abre somente-leitura e não passa pelo `dist/`, então não tem como migrar o banco
// que recebe — e recebe bancos de todas as idades, porque o BRAIN_DB aponta para qualquer
// instalação e a coluna `semantica` chegou depois de mais de mil chamadas. Sem esta guarda, um
// banco ainda não migrado derrubaria o relatório inteiro em "no such column: semantica": uma
// coluna nova matando um relatório que existe desde antes dela.
const temSemantica = db
  .prepare("PRAGMA table_info(uso)")
  .all()
  .some((c) => c.name === "semantica");

// `COUNT(semantica)` e **não** `COUNT(semantica IS NOT NULL)`. O segundo parece a mesma coisa e é o
// oposto: `semantica IS NOT NULL` devolve 0 ou 1 e nunca NULL, então o COUNT não descarta linha
// nenhuma e as chamadas anteriores à migração entram no denominador — diluindo a fração até ela
// deixar de significar o que o nome diz.
const soLexico = temSemantica
  ? "SUM(semantica = 0) * 1.0 / NULLIF(COUNT(semantica), 0)"
  : "NULL";

/**
 * Percentil por índice no vetor ordenado, sem interpolação — exatamente a conta que originou os
 * números do CA1. `floor(p * (n - 1))` nunca sai do vetor, e com n = 1 devolve o único valor.
 */
const pct = (v, p) => v[Math.floor(p * (v.length - 1))];

const msPorTool = new Map();
for (const r of db.prepare("SELECT tool, ms FROM uso WHERE ts >= ?").all(desde)) {
  let v = msPorTool.get(r.tool);
  if (!v) msPorTool.set(r.tool, (v = []));
  v.push(Number(r.ms));
}
// A ordenação fica aqui, e não num `ORDER BY`: é o vetor ordenado que define o percentil, e
// deixá-lo à vista dispensa confiar numa cláusula de SQL que uma edição futura pode encurtar.
for (const v of msPorTool.values()) v.sort((a, b) => a - b);

// Cabeçalho e linhas saem da mesma função, que é o único jeito de eles não desalinharem quando
// alguém acrescentar uma coluna.
const colunas = (tool, n, vazias, p50, p90, frac, chars) =>
  `${tool.padEnd(18)} ${n.padStart(8)} ${vazias.padStart(8)} ${p50.padStart(8)} ` +
  `${p90.padStart(8)} ${frac.padStart(10)} ${chars.padStart(12)}`;

console.log(`Últimos ${dias} dias — ${total} chamadas\n`);
console.log(colunas("tool", "chamadas", "vazias", "p50", "p90", "só-léxico", "resp média"));
for (const r of db.prepare(
  `SELECT tool, COUNT(*) n, SUM(vazio) vazias, AVG(resp_chars) chars, ${soLexico} so_lexico
   FROM uso WHERE ts >= ? GROUP BY tool ORDER BY n DESC`
).all(desde)) {
  const v = msPorTool.get(r.tool) ?? [];
  // `—`, nunca `0 %`, quando o denominador é nulo. São dois casos diferentes e em nenhum dos dois
  // um zero seria verdade: ou a tool não é `search_context` e não tem meia-busca a medir, ou as
  // linhas são todas anteriores à migração e ninguém mediu nada.
  const frac =
    r.so_lexico === null || r.so_lexico === undefined
      ? "—"
      : `${(Number(r.so_lexico) * 100).toFixed(1)}%`;
  console.log(
    colunas(
      r.tool,
      String(r.n),
      String(r.vazias ?? 0),
      v.length ? String(pct(v, 0.5)) : "—",
      v.length ? String(pct(v, 0.9)) : "—",
      frac,
      String(Math.round(r.chars))
    )
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
