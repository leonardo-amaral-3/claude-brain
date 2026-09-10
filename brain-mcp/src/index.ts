import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, dbPath, packageRoot } from "./config.js";
import { openDb, versaoIndice, bumpVersaoIndice } from "./db.js";
import { Indexer } from "./indexer.js";
import { GithubSyncer } from "./githubSync.js";
import { VectorIndex, preencherEmbeddings } from "./vectors.js";
import { Buscador, registrarSinonimos } from "./search.js";
import { Grafo } from "./grafo.js";
import { Vigia } from "./vigia.js";
import { Lease } from "./lease.js";
import { aquecer } from "./embeddings.js";
import { preencherVetoresDeDecisoes } from "./memoria.js";
import { registerTools } from "./tools.js";

const config = loadConfig();
const db = openDb(dbPath);

// O lease decide quem faz TRABALHO PESADO (varredura, grafo, embeddings, syncs). Ele não decide
// quem responde consulta: um seguidor serve busca igual ao líder, e continua escrevendo `uso` e
// `lembrar` normalmente (TD-2). Precisa nascer antes do indexer, que consulta `souLider`.
const lease = new Lease(db);

const vec = new VectorIndex(db, () => versaoIndice(db));
const indexer = new Indexer(db, config, () => {
  vec.marcarSujo();
  // Só o líder escreve o contador: é ele quem mudou o conteúdo, e é por este número que os
  // VectorIndex dos seguidores descobrem que o cache em memória deles envelheceu (CA4).
  if (lease.souLider) bumpVersaoIndice(db);
});
const buscador = new Buscador(db, vec);
const grafo = new Grafo(db, {
  dir: join(packageRoot, "data", "git"),
  repos: config.git.repos.map((r) => r.repo),
});
const syncer = new GithubSyncer(config.github, join(packageRoot, "data", "github"), () => {
  const s = indexer.scan();
  console.error(`[brain] scan pós-sync GitHub: ${s.indexed} reindexados`);
});

// Eleição no boot. Quem ganha varre; quem perde não varre — é esta linha que elimina as N
// varreduras simultâneas dos mesmos arquivos que o card #1 reporta.
if (lease.tentarAdquirir()) {
  try {
    const stats = indexer.scan();
    console.error(
      `[brain] boot (líder): ${stats.scanned} arquivos, ${stats.indexed} reindexados em ${stats.ms} ms`
    );
  } catch (err) {
    console.error("[brain] indexação no boot falhou (servindo índice existente):", err);
  }
} else {
  const d = lease.dono();
  console.error(
    `[brain] boot (seguidor): índice mantido pelo pid ${d?.pid} — esta sessão só consulta`
  );
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

// `assumirTrabalhoPesado` é function declaration (hoisted) e idempotente: passá-la aqui é o que
// faz um `reindex {forcar:true}` num seguidor promover o processo de verdade, e não só de nome.
registerTools(server, db, indexer, syncer, buscador, grafo, vigia, lease, assumirTrabalhoPesado, produto);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[brain] servidor MCP conectado (stdio)");

// Saída graciosa: soltar o lease na hora poupa ao sucessor a espera do TTL inteiro.
//
// NENHUM destes caminhos é a garantia do CA3, e isso é de propósito. Em Windows não existe
// SIGTERM recebível — o `child.kill()` de um pai vira TerminateProcess e nada aqui roda. Quem
// garante a tomada de posse é o TTL vencendo; isto é otimização para a despedida normal (o
// cliente MCP fecha o stdin) e para o Ctrl+C.
const sair = (): void => {
  try {
    lease.liberar();
  } catch {
    /* já estamos saindo; falhar aqui não pode impedir o processo de morrer */
  }
};
// Encadeia em vez de sobrescrever: `server.connect()` já pôs o handler de limpeza do SDK aqui,
// e trocá-lo por este mataria o `close` do McpServer.
const oncloseDoSdk = transport.onclose;
transport.onclose = () => {
  sair();
  oncloseDoSdk?.();
};
process.on("exit", sair);
process.on("SIGINT", () => {
  sair();
  process.exit(0);
});

// Trabalho de fundo, depois do boot: nada aqui pode atrasar a primeira consulta.
//
// Idempotente de propósito: é chamada no boot pelo líder E de novo por quem for promovido no
// tique. Chamar duas vezes não pode duplicar vigia, grafo nem backfill.
let pesadoAtivo = false;
function assumirTrabalhoPesado(): void {
  if (pesadoAtivo) return;
  pesadoAtivo = true;

  const r = syncer.kickIfStale();
  if (r === "started") console.error("[brain] sync GitHub disparado em segundo plano");

  const v = vigia.iniciar();
  console.error(`[brain] vigia: ${v.vigiados} raízes de documento sob watcher`);

  try {
    const g = grafo.reconstruir();
    console.error(`[brain] grafo: ${g.entidades} entidades, ${g.arestas} arestas em ${g.ms} ms`);
  } catch (err) {
    console.error("[brain] reconstrucao do grafo falhou:", err);
  }

  // Chunks novos entram sem vetor; preenche aos poucos para a busca semântica não ficar cega.
  const cob = vec.cobertura();
  if (cob.total > cob.comEmbedding) {
    preencherEmbeddings(db, { limite: 2000, aindaSouLider: () => lease.souLider })
      .then((res) => {
        if (res.feitos) {
          vec.marcarSujo();
          // Sem guarda de liderança, e é deliberado: se estes chunks ganharam vetor, o conteúdo
          // do índice mudou de fato — mesmo que o lease tenha caído no último lote. Não avisar
          // os seguidores deixaria a busca semântica deles velha por uma tecnicalidade.
          bumpVersaoIndice(db);
          console.error(
            `[brain] embeddings: ${res.feitos} gerados em ${(res.ms / 1000).toFixed(1)} s, ${res.restantes} restantes`
          );
        }
      })
      .catch((err) => console.error("[brain] backfill de embeddings falhou:", err));
  }
}

setTimeout(() => {
  // Aquece o modelo de embeddings agora: sem isto a PRIMEIRA busca da sessao pagaria
  // os ~15 s de carga. Ate ficar pronto, a busca sai so com o lexico. Vale para TODO processo:
  // um seguidor não pode responder pior que o líder.
  aquecer().then(async () => {
    console.error("[brain] modelo de embeddings pronto");
    if (!lease.souLider) return; // backfill é trabalho pesado, logo é só do líder
    try {
      const n = await preencherVetoresDeDecisoes(db);
      if (n) console.error(`[brain] ${n} decisoes ganharam vetor`);
    } catch (err) {
      console.error("[brain] backfill de vetores de decisao falhou:", err);
    }
  });

  if (lease.souLider) assumirTrabalhoPesado();

  lease.iniciarTique(
    () => {
      console.error("[brain] assumi o índice (líder anterior sumiu)");
      assumirTrabalhoPesado();
    },
    () => {
      console.error("[brain] perdi a liderança do índice; virei seguidor");
      vigia.parar();
      // Zerar a guarda é o que torna o rebaixamento REVERSÍVEL: sem isto, um `aoAssumir`
      // posterior cairia no `return` de cima e o novo líder ficaria sem vigia e sem backfill.
      pesadoAtivo = false;
    }
  );
}, 500);
