import { join } from "node:path";
import { loadConfig, dbPath, packageRoot } from "./config.js";
import { openDb } from "./db.js";
import { Indexer } from "./indexer.js";
import { GithubSyncer } from "./githubSync.js";
import { preencherEmbeddings } from "./vectors.js";
import { Grafo } from "./grafo.js";
import { sincronizarGit } from "./gitSync.js";

const full = process.argv.includes("--full");
const github = process.argv.includes("--github");
const embed = process.argv.includes("--embed");
const grafo = process.argv.includes("--grafo");
const git = process.argv.includes("--git");
const config = loadConfig();
const db = openDb(dbPath);
const indexer = new Indexer(db, config);

if (github) {
  const syncer = new GithubSyncer(config.github, join(packageRoot, "data", "github"), () => {});
  console.log("Sincronizando GitHub…");
  const gs = await syncer.syncNow();
  console.log(
    `Sync GitHub: ${gs.repos} repos, ${gs.itemsWritten} itens escritos, ${gs.newComments} comentários novos em ${gs.ms} ms` +
      (gs.errors.length ? `\nErros: ${gs.errors.join("; ")}` : "")
  );
}

if (git) {
  console.log("Lendo histórico de git…");
  const gs = sincronizarGit(config.git.repos, join(packageRoot, "data", "git"), {
    desde: config.git.desde,
    maximo: config.git.maximo,
  });
  console.log(
    `Git: ${gs.commits} commits de ${gs.repos} repos em ${gs.arquivos} arquivos mensais (${(gs.ms / 1000).toFixed(1)} s)` +
      (gs.erros.length ? `\nErros: ${gs.erros.join("; ")}` : "")
  );
}

const stats = full ? indexer.fullReindex() : indexer.scan();
console.log(
  `${full ? "Reindexação completa" : "Varredura incremental"}: ${stats.scanned} arquivos, ` +
    `${stats.indexed} (re)indexados, ${stats.removed} removidos em ${stats.ms} ms\n`
);

if (embed) {
  const pendentes = (
    db.prepare("SELECT COUNT(*) n FROM chunks WHERE embedding IS NULL").get() as { n: number }
  ).n;
  if (pendentes === 0) {
    console.log("Embeddings: nada pendente.\n");
  } else {
    console.log(`Gerando embeddings de ${pendentes} chunks (o modelo carrega na 1ª vez, ~15 s)…`);
    let ultimo = 0;
    const r = await preencherEmbeddings(db, {
      onProgresso: (feitos, total) => {
        if (feitos - ultimo >= 320 || feitos === total) {
          console.log(`  ${feitos}/${total} (${Math.round((feitos / total) * 100)}%)`);
          ultimo = feitos;
        }
      },
    });
    console.log(
      `Embeddings: ${r.feitos} gerados em ${(r.ms / 1000).toFixed(1)} s, ${r.restantes} restantes.\n`
    );
  }
}

if (grafo) {
  const g = new Grafo(db, {
    dir: join(packageRoot, "data", "git"),
    repos: config.git.repos.map((r) => r.repo),
  }).reconstruir();
  console.log(`Grafo: ${g.entidades} entidades, ${g.arestas} arestas em ${g.ms} ms
`);
}

const bySource = db
  .prepare(
    `SELECT d.source, COUNT(DISTINCT d.id) AS docs, COUNT(c.id) AS chunks,
            SUM(CASE WHEN c.embedding IS NOT NULL THEN 1 ELSE 0 END) AS vetores
     FROM docs d LEFT JOIN chunks c ON c.doc_id = d.id
     GROUP BY d.source ORDER BY docs DESC`
  )
  .all() as { source: string; docs: number; chunks: number; vetores: number | null }[];

console.log("Fonte          docs   chunks  vetores");
for (const r of bySource) {
  console.log(
    `${r.source.padEnd(14)} ${String(r.docs).padStart(4)}   ${String(r.chunks).padStart(6)}   ${String(r.vetores ?? 0).padStart(6)}`
  );
}
const totals = db
  .prepare(
    `SELECT (SELECT COUNT(*) FROM docs) AS d, (SELECT COUNT(*) FROM chunks) AS c,
            (SELECT COUNT(*) FROM chunks WHERE embedding IS NOT NULL) AS v`
  )
  .get() as { d: number; c: number; v: number };
console.log(
  `${"TOTAL".padEnd(14)} ${String(totals.d).padStart(4)}   ${String(totals.c).padStart(6)}   ${String(totals.v).padStart(6)}`
);

// sanidade: nada de node_modules/cdk.out no índice
const leaked = db
  .prepare(
    `SELECT path FROM docs WHERE
       replace(path, '\\', '/') LIKE '%/node_modules/%'
       OR replace(path, '\\', '/') LIKE '%/cdk.out/%'
       OR replace(path, '\\', '/') LIKE '%/.git/%'
     LIMIT 5`
  )
  .all() as { path: string }[];
if (leaked.length) {
  console.error("\nATENÇÃO — paths vazados no índice:");
  for (const l of leaked) console.error("  " + l.path);
  process.exitCode = 1;
} else {
  console.log("\nSanidade OK: nenhum path de node_modules/cdk.out/.git no índice.");
}
