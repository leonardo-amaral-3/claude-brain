import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, dbPath, packageRoot } from "./config.js";
import { openDb } from "./db.js";
import { Indexer } from "./indexer.js";
import { GithubSyncer } from "./githubSync.js";
import { VectorIndex, preencherEmbeddings } from "./vectors.js";
import { Buscador, registrarSinonimos } from "./search.js";
import { Grafo } from "./grafo.js";
import { Vigia } from "./vigia.js";
import { aquecer } from "./embeddings.js";
import { preencherVetoresDeDecisoes } from "./memoria.js";
import { sincronizarGit } from "./gitSync.js";
import { registerTools } from "./tools.js";

const config = loadConfig();
const db = openDb(dbPath);
const vec = new VectorIndex(db);
const indexer = new Indexer(db, config, () => vec.marcarSujo());
const buscador = new Buscador(db, vec);
const grafo = new Grafo(db, {
  dir: join(packageRoot, "data", "git"),
  repos: config.git.repos.map((r) => r.repo),
});
const syncer = new GithubSyncer(config.github, join(packageRoot, "data", "github"), () => {
  const s = indexer.scan();
  console.error(`[brain] scan pós-sync GitHub: ${s.indexed} reindexados`);
});

try {
  const stats = indexer.scan();
  console.error(`[brain] boot: ${stats.scanned} arquivos, ${stats.indexed} reindexados em ${stats.ms} ms`);
} catch (err) {
  console.error("[brain] indexação no boot falhou (servindo índice existente):", err);
}

// Sem nome no config, a instrucao fala do "produto" e pronto: e melhor generico do que citar
// um produto que nao e o de quem instalou.
const produto = config.produto || "deste workspace";
registrarSinonimos(config.sinonimos);

const server = new McpServer(
  { name: "brain", version: "0.3.0" },
  {
    instructions:
      `Cérebro do produto ${produto}: índice de busca híbrida (palavra-chave + semântica) sobre ` +
      "specs de planning (PRD/tech-spec/tasks), docs, diário de sessões, notas de memória, mapas de arquitetura, " +
      "cards/PRs do GitHub, histórico de commits e o código-fonte de todos os repos do workspace. " +
      "Antes de explorar o código manualmente ou lançar agentes de exploração para entender finalidade, " +
      "histórico ou localização de algo no produto, consulte search_context (e read_doc para aprofundar) — " +
      "aceita tanto palavra-chave quanto a pergunta inteira. Para orientação estrutural de um repo, busque com " +
      'source="mapa". Para o estado de uma feature, use list_features/feature_timeline. Para saber o que uma mudança ' +
      "puxa junto (card ↔ PR ↔ spec ↔ arquivos ↔ decisões), use vizinhanca. Decisões tomadas durante a sessão devem " +
      "ser gravadas na hora com lembrar — não espere o fim da sessão. No começo de uma sessão, recent_activity dá o " +
      "briefing do que mudou.",
  }
);

const vigia = new Vigia(config, indexer, (motivo, n) =>
  console.error(`[brain] índice atualizado (${motivo}): ${n} arquivos`)
);

registerTools(server, db, indexer, syncer, buscador, grafo, vigia, produto);

await server.connect(new StdioServerTransport());
console.error("[brain] servidor MCP conectado (stdio)");

// Trabalho de fundo, depois do boot: nada aqui pode atrasar a primeira consulta.
setTimeout(() => {
  const r = syncer.kickIfStale();
  if (r === "started") console.error("[brain] sync GitHub disparado em segundo plano");

  // Aquece o modelo de embeddings agora: sem isto a PRIMEIRA busca da sessao pagaria
  // os ~15 s de carga. Ate ficar pronto, a busca sai so com o lexico.
  aquecer().then(async () => {
    console.error("[brain] modelo de embeddings pronto");
    try {
      const n = await preencherVetoresDeDecisoes(db);
      if (n) console.error(`[brain] ${n} decisoes ganharam vetor`);
    } catch (err) {
      console.error("[brain] backfill de vetores de decisao falhou:", err);
    }
  });

  const v = vigia.iniciar();
  console.error(`[brain] vigia: ${v.vigiados} raízes de documento sob watcher`);

  // Chunks novos entram sem vetor; preenche aos poucos para a busca semântica não ficar cega.
  try {
    const g = grafo.reconstruir();
    console.error(`[brain] grafo: ${g.entidades} entidades, ${g.arestas} arestas em ${g.ms} ms`);
  } catch (err) {
    console.error("[brain] reconstrucao do grafo falhou:", err);
  }

  const cob = vec.cobertura();
  if (cob.total > cob.comEmbedding) {
    preencherEmbeddings(db, { limite: 2000 })
      .then((res) => {
        if (res.feitos) {
          vec.marcarSujo();
          console.error(
            `[brain] embeddings: ${res.feitos} gerados em ${(res.ms / 1000).toFixed(1)} s, ${res.restantes} restantes`
          );
        }
      })
      .catch((err) => console.error("[brain] backfill de embeddings falhou:", err));
  }
}, 500);
