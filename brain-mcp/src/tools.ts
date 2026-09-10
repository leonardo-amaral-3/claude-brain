import { z } from "zod";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DatabaseSync } from "node:sqlite";
import type { Indexer } from "./indexer.js";
import type { GithubSyncer } from "./githubSync.js";
import type { Buscador } from "./search.js";
import { matchExpr, normalizar as normalize } from "./search.js";
import type { Grafo, Entidade } from "./grafo.js";
import { registrarDecisao, decisoesRelacionadas } from "./memoria.js";
import type { Lease } from "./lease.js";

const SOURCES = ["planning", "docs", "diario", "memoria", "mapa", "notas", "code", "github", "decisao", "git"] as const;

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

export function registerTools(
  server: McpServer,
  db: DatabaseSync,
  indexer: Indexer,
  syncer: GithubSyncer,
  buscador: Buscador,
  grafo: Grafo,
  vigia: { agendar(motivo: string): void },
  lease: Lease,
  /**
   * Chamado quando o `reindex` PROMOVE este processo a líder. Sem isto ele viraria líder de nome:
   * em `index.ts` o trabalho pesado só arranca no boot ou no `aoAssumir` do tique, e o tique só
   * chama `aoAssumir` para quem era seguidor — um promovido por aqui cairia para sempre no ramo
   * que apenas renova o lease, sem vigia e sem backfill (emenda 2026-09-09 da spec).
   */
  aoAssumirLideranca: () => void,
  produto: string
): void {
  // Toda chamada vira uma linha em `uso` — é o que transforma "acho que o Claude
  // não usa o cérebro" em número. Ver: npm run uso
  const registerTool = (name: string, cfg: unknown, handler: (args: any) => Promise<any>): void => {
    (server as any).registerTool(name, cfg, async (args: any) => {
      const t0 = Date.now();
      let resp: any;
      try {
        resp = await handler(args);
        return resp;
      } finally {
        try {
          const txt: string = resp?.content?.[0]?.text ?? "";
          db.prepare(
            "INSERT INTO uso (ts, tool, args, ms, resp_chars, vazio) VALUES (?, ?, ?, ?, ?, ?)"
          ).run(
            Date.now(),
            name,
            JSON.stringify(args ?? {}).slice(0, 500),
            Date.now() - t0,
            txt.length,
            /^Nenhum resultado|^Query vazia|^Nenhuma/.test(txt) ? 1 : 0
          );
        } catch {
          /* log de uso nunca pode derrubar a tool */
        }
      }
    });
  };

  registerTool(
    "search_context",
    {
      title: "Buscar no cérebro do produto",
      description:
        `Busca híbrida (BM25 + similaridade semântica) sobre TODO o contexto do produto ${produto}: specs de planning (PRD/tech-spec/tasks), docs, diário de sessões, memória, mapas de arquitetura, notas do produto, cards/PRs do GitHub e o próprio código-fonte dos repos. ` +
        "USE ESTA TOOL ANTES de explorar arquivos manualmente ou lançar agentes de exploração — uma consulta aqui costuma achar de uma vez a spec, o card e o arquivo que implementam algo. " +
        "Aceita tanto palavras-chave (`blocklist fragmento`) quanto a pergunta inteira (`por que a AIH aparece duas vezes?`) — a metade semântica cobre o caso em que você não sabe o termo exato. " +
        "Filtre por source ('mapa' para arquitetura, 'code' para código, 'diario' para histórico de sessões, 'github' para cards/PRs).",
      inputSchema: {
        query: z.string().describe("Termos de busca (pt-BR; acentos são ignorados)"),
        source: z.enum(SOURCES).optional().describe("Filtrar por fonte"),
        repo: z.string().optional().describe("ex.: modulo-processos, shd-rpa, processos-criticas"),
        feature: z.string().optional().describe("slug da pasta da feature em planning/docs"),
        doc_type: z
          .string()
          .optional()
          .describe("prd | tech-spec | spec | task | handoff | changelog | readme | diario | memoria | mapa | code | doc"),
        incluir_arquivadas: z.boolean().optional().describe("incluir features em _arquivo/ (default false)"),
        limit: z.number().int().min(1).max(30).optional().describe("máx. de resultados (default 8)"),
      },
    },
    async (args) => {
      if (!args.query || !args.query.trim()) return text("Query vazia — informe ao menos um termo.");
      const { resultados: rows, diag } = await buscador.buscar(
        args.query,
        {
          source: args.source,
          repo: args.repo,
          feature: args.feature,
          doc_type: args.doc_type,
          incluirArquivadas: args.incluir_arquivadas,
        },
        args.limit ?? 8
      );
      if (rows.length === 0) {
        return text(
          `Nenhum resultado para "${args.query}". Tente termos mais curtos/sinônimos, ou remova filtros. ` +
            `Para visão geral use list_features ou busque source="mapa".`
        );
      }
      const out = rows
        .map((r, i) => {
          const metaBits = [r.source, r.repo, r.feature, r.doc_type !== "doc" ? r.doc_type : null, r.status, r.data]
            .filter(Boolean)
            .join(" · ");
          const eco = r.tambemEm.length ? ` (mesmo conteúdo em: ${r.tambemEm.join(", ")})` : "";
          return `${i + 1}. ${r.breadcrumb}${eco}\n   [${metaBits}]\n   ${r.path}\n   ${r.snip.replace(/\s+/g, " ").trim()}`;
        })
        .join("\n\n");
      const rodape = diag.semantica ? "" : "\n(busca semântica indisponível nesta consulta — só léxico)";
      return text(out + rodape + "\n\nUse read_doc(path) para ler o documento inteiro ou uma seção.");
    }
  );

  registerTool(
    "read_doc",
    {
      title: "Ler documento indexado",
      description:
        "Lê um documento do índice direto do disco (sempre fresco). Passe o path retornado por search_context. " +
        "Opcionalmente passe heading para ler só uma seção (match parcial, sem acentos). Documentos muito grandes são truncados com a lista de headings disponíveis.",
      inputSchema: {
        path: z.string().describe("Caminho absoluto do arquivo (como retornado por search_context)"),
        heading: z.string().optional().describe("Ler apenas a seção cujo heading contém este texto"),
      },
    },
    async (args) => {
      const target = isAbsolute(args.path) ? resolve(args.path) : null;
      if (!target) return text("Passe um caminho absoluto (use o path retornado por search_context).");
      const norm = (p: string) => resolve(p).replace(/\\/g, "/").toLowerCase();
      const allowed = indexer.roots.some((r) => norm(target).startsWith(norm(r.path) + "/") || norm(target) === norm(r.path));
      if (!allowed) return text("Caminho fora das raízes indexadas pelo cérebro — use as tools de arquivo normais para lê-lo.");
      let content: string;
      try {
        content = readFileSync(target, "utf8");
      } catch (err) {
        return text(`Não consegui ler ${args.path}: ${(err as Error).message}`);
      }

      if (args.heading) {
        const lines = content.split("\n");
        const want = normalize(args.heading);
        let start = -1;
        let level = 0;
        for (let i = 0; i < lines.length; i++) {
          const m = lines[i].match(/^(#{1,6})\s+(.+)/);
          if (m && normalize(m[2]).includes(want)) {
            start = i;
            level = m[1].length;
            break;
          }
        }
        if (start === -1) {
          const headings = lines
            .filter((l) => /^#{1,6}\s/.test(l))
            .slice(0, 60)
            .join("\n");
          return text(`Heading contendo "${args.heading}" não encontrado. Headings do documento:\n${headings}`);
        }
        let end = lines.length;
        for (let i = start + 1; i < lines.length; i++) {
          const m = lines[i].match(/^(#{1,6})\s/);
          if (m && m[1].length <= level) {
            end = i;
            break;
          }
        }
        content = lines.slice(start, end).join("\n");
      }

      const LIMIT = 60000;
      if (content.length > LIMIT) {
        const headings = content
          .split("\n")
          .filter((l) => /^#{1,6}\s/.test(l))
          .slice(0, 80)
          .join("\n");
        content =
          content.slice(0, LIMIT) +
          `\n\n[... truncado em ${LIMIT} caracteres. Use o parâmetro heading para ler uma seção específica. Headings:\n${headings}\n]`;
      }
      return text(content);
    }
  );

  registerTool(
    "list_features",
    {
      title: "Catálogo de features",
      description:
        "Lista as features documentadas em planning/docs (ativas e arquivadas), com repo, tipos de docs disponíveis e datas. " +
        "Bom ponto de partida para entender o que já existe antes de propor algo novo.",
      inputSchema: {
        repo: z.string().optional().describe("filtrar por repo"),
        apenas_ativas: z.boolean().optional().describe("omitir features arquivadas (default false)"),
      },
    },
    async (args) => {
      const conds: string[] = ["feature IS NOT NULL"];
      const params: string[] = [];
      if (args.repo) {
        conds.push("repo = ?");
        params.push(args.repo);
      }
      const rows = db
        .prepare(
          `SELECT feature, repo,
                  MAX(CASE WHEN status = 'arquivado' THEN 1 ELSE 0 END) AS arquivado,
                  GROUP_CONCAT(DISTINCT doc_type) AS tipos,
                  COUNT(*) AS n_docs,
                  MAX(data) AS ultima_data
           FROM docs WHERE ${conds.join(" AND ")}
           GROUP BY feature, repo
           ORDER BY arquivado ASC, ultima_data DESC`
        )
        .all(...params) as {
        feature: string;
        repo: string | null;
        arquivado: number;
        tipos: string;
        n_docs: number;
        ultima_data: string | null;
      }[];
      const filtered = args.apenas_ativas ? rows.filter((r) => !r.arquivado) : rows;
      if (filtered.length === 0) return text("Nenhuma feature encontrada com esses filtros.");
      const out = filtered
        .map(
          (r) =>
            `- ${r.feature} [${r.repo ?? "?"}]${r.arquivado ? " (arquivada)" : ""} — ${r.n_docs} docs (${r.tipos}) · última: ${r.ultima_data ?? "?"}`
        )
        .join("\n");
      return text(out + "\n\nUse feature_timeline(feature) para ver a evolução de uma delas.");
    }
  );

  registerTool(
    "feature_timeline",
    {
      title: "Linha do tempo de uma feature",
      description:
        "Mostra a evolução de uma feature: PRD → tech-spec → tasks (com status individual) e, na sequência, entradas do diário, notas de memória e cards/PRs do GitHub que mencionam a feature. " +
        "Use para entender em que pé a feature está e o que já foi decidido, antes de mexer nela.",
      inputSchema: {
        feature: z.string().describe("slug da feature (ver list_features)"),
      },
    },
    async (args) => {
      const docs = db
        .prepare(
          `SELECT path, title, doc_type, status, data FROM docs WHERE feature = ?
           ORDER BY CASE doc_type
             WHEN 'prd' THEN 0 WHEN 'spec' THEN 1 WHEN 'tech-spec' THEN 2
             WHEN 'handoff' THEN 3 WHEN 'task' THEN 4 ELSE 5 END, path`
        )
        .all(args.feature) as { path: string; title: string; doc_type: string; status: string | null; data: string | null }[];
      if (docs.length === 0) {
        return text(`Nenhum doc com feature="${args.feature}". Confira o slug com list_features.`);
      }
      const docsOut = docs
        .map((d) => `- [${d.doc_type}] ${d.title}${d.status ? ` — ${d.status}` : ""} (${d.data ?? "?"})\n  ${d.path}`)
        .join("\n");

      // menções no diário, na memória e no GitHub (o número da feature costuma ser o card)
      const terms = args.feature
        .split(/[-_]/)
        .filter((t: string) => t.length >= 3 && !/^\d+$/.test(t));
      const cardNum = args.feature.match(/^(\d{3,5})-/)?.[1];
      if (cardNum) terms.push(cardNum);
      let related: { path: string; title: string; source: string; data: string | null }[] = [];
      if (terms.length > 0) {
        const stmt = db.prepare(
          `SELECT DISTINCT d.path, d.title, d.source, d.data
           FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid JOIN docs d ON d.id = c.doc_id
           WHERE chunks_fts MATCH ? AND d.source IN ('diario','memoria','github')
           ORDER BY d.data DESC LIMIT 15`
        );
        related = stmt.all(matchExpr(terms, "AND")) as typeof related;
        if (related.length === 0 && terms.length > 1) {
          related = stmt.all(matchExpr(terms, "OR")) as typeof related;
        }
      }
      const relatedOut = related.length
        ? "\n\nMenções no diário/memória/GitHub:\n" +
          related.map((r) => `- [${r.source}] ${r.title} (${r.data ?? "?"})\n  ${r.path}`).join("\n")
        : "\n\n(sem menções no diário/memória/GitHub)";

      return text(`Feature: ${args.feature}\n\nDocumentos:\n${docsOut}${relatedOut}`);
    }
  );

  registerTool(
    "recent_activity",
    {
      title: "O que mudou recentemente",
      description:
        "Briefing do que aconteceu nos últimos N dias em todo o workspace: PRs e cards movimentados no GitHub, sessões registradas no diário, notas de memória novas, specs/docs/mapas editados e volume de código alterado por repo. " +
        "Ótimo primeiro comando de uma sessão para se situar ('o que rolou desde a última vez?'). Se o sync do GitHub estiver velho, ele dispara em segundo plano — rode de novo em ~1 min para incluir as novidades.",
      inputSchema: {
        dias: z.number().int().min(1).max(90).optional().describe("janela em dias (default 7)"),
        incluir_codigo: z.boolean().optional().describe("incluir resumo de arquivos de código alterados (default true)"),
      },
    },
    async (args) => {
      const kicked = syncer.kickIfStale();
      const dias = args.dias ?? 7;
      const cutoff = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
      const rows = db
        .prepare(
          `SELECT source, repo, doc_type, title, status, data, path FROM docs
           WHERE data >= ? ORDER BY data DESC, source`
        )
        .all(cutoff) as {
        source: string;
        repo: string | null;
        doc_type: string;
        title: string;
        status: string | null;
        data: string | null;
        path: string;
      }[];

      const fmt = (r: (typeof rows)[number]) =>
        `- [${r.doc_type}${r.status ? " " + r.status : ""}] ${r.title}${r.repo ? ` — ${r.repo}` : ""} (${r.data})`;
      const section = (label: string, items: typeof rows, cap: number) => {
        if (!items.length) return "";
        const shown = items.slice(0, cap).map(fmt).join("\n");
        const more = items.length > cap ? `\n  (+${items.length - cap} mais — use search_context com filtros)` : "";
        return `\n## ${label} (${items.length})\n${shown}${more}\n`;
      };

      const github = rows.filter((r) => r.source === "github");
      const decisoes = rows.filter((r) => r.source === "decisao");
      const diario = rows.filter((r) => r.source === "diario");
      const memoria = rows.filter((r) => r.source === "memoria");
      const docsRows = rows.filter((r) => ["planning", "docs", "mapa", "notas"].includes(r.source));
      const code = rows.filter((r) => r.source === "code");

      let out = `Atividade dos últimos ${dias} dias (desde ${cutoff}):\n`;
      // Decisões vêm primeiro: é o que muda o que se pode fazer, não só o que mudou.
      out += section("Decisões registradas", decisoes, 15);
      out += section("GitHub — cards e PRs movimentados", github, 25);
      out += section("Diário de sessões", diario, 10);
      out += section("Memória", memoria, 10);
      out += section("Specs, docs, mapas e notas", docsRows, 15);
      if (args.incluir_codigo !== false && code.length) {
        const byRepo = new Map<string, number>();
        for (const r of code) byRepo.set(r.repo ?? "?", (byRepo.get(r.repo ?? "?") ?? 0) + 1);
        out += `\n## Código alterado\n`;
        for (const [repo, n] of [...byRepo.entries()].sort((a, b) => b[1] - a[1])) {
          out += `- ${repo}: ${n} arquivos\n`;
        }
      }
      if (rows.length === 0) out += "\n(nenhuma atividade indexada na janela)\n";

      const st = syncer.readState();
      out += `\nÚltimo sync GitHub: ${st.lastSyncIso ? st.lastSyncIso.replace("T", " ").slice(0, 16) + " UTC" : "nunca"}`;
      if (st.lastError) out += ` (último erro: ${st.lastError})`;
      if (kicked === "started" || kicked === "running") {
        out += "\n(sync do GitHub rodando em segundo plano — repita a chamada em ~1 min para dados frescos)";
      }
      return text(out);
    }
  );

  registerTool(
    "reindex",
    {
      title: "Reindexar o cérebro",
      description:
        "Re-varre as fontes locais e atualiza o índice. Incremental por padrão (só arquivos alterados); full=true refaz tudo do zero; github=true também sincroniza cards/PRs do GitHub antes (pode levar ~1 min). " +
        "Normalmente desnecessário — o índice se atualiza sozinho no boot e a cada consulta quando está velho. Use após criar mapas novos, mudar a config ou quando quiser GitHub fresco na hora.",
      inputSchema: {
        full: z.boolean().optional().describe("true = reindexação completa"),
        github: z.boolean().optional().describe("true = sincronizar GitHub agora (síncrono)"),
        forcar: z
          .boolean()
          .optional()
          .describe("tomar a liderança do índice de outro processo que já o mantém"),
      },
    },
    async (args) => {
      // Reindexar é escrita pesada, logo exige a liderança (TD-5). `tentarAdquirir` devolve true
      // também para quem JÁ era o dono, então o caso comum — processo único, que é o líder —
      // passa direto por aqui e de quebra renova o lease.
      //
      // Recusar é RESPOSTA, não erro de protocolo: quem chamou precisa LER o motivo e escolher, e
      // um erro viraria só "a tool falhou" no cliente. Nada foi escrito até este ponto, e a
      // tentativa que fracassa não muda uma linha da tabela — a recusa vem antes do 1º write.
      if (!lease.tentarAdquirir(args.forcar === true)) {
        const d = lease.dono();
        return text(
          `Não reindexei: o índice está sob outro processo (pid ${d?.pid ?? "?"} em ${d?.host ?? "?"}), ` +
            `que é quem varre e mantém tudo atualizado — normalmente não há nada a fazer aqui.\n` +
            `Se quiser reindexar assim mesmo, repita com forcar: true para tomar a liderança dele.`
        );
      }
      // Ganhou o lease. Se isto foi uma PROMOÇÃO, é agora que o processo assume o trabalho de
      // líder (vigia, grafo, backfill); se já era líder, a chamada é idempotente e não faz nada.
      aoAssumirLideranca();

      let ghLine = "";
      if (args.github) {
        const gs = await syncer.syncNow();
        ghLine = `Sync GitHub: ${gs.repos} repos, ${gs.itemsWritten} itens atualizados, ${gs.newComments} comentários novos em ${gs.ms} ms.` +
          (gs.errors.length ? ` Erros: ${gs.errors.join("; ")}` : "") + "\n";
      }
      const stats = args.full ? indexer.fullReindex() : indexer.scan();
      const bySource = db
        .prepare("SELECT source, COUNT(*) AS docs FROM docs GROUP BY source ORDER BY docs DESC")
        .all() as { source: string; docs: number }[];
      const chunks = (db.prepare("SELECT COUNT(*) AS n FROM chunks").get() as { n: number }).n;
      const g = grafo.reconstruir();
      const lines = bySource.map((r) => `  ${r.source}: ${r.docs} docs`).join("\n");
      return text(
        ghLine +
          `Varridos ${stats.scanned} arquivos, ${stats.indexed} (re)indexados, ${stats.removed} removidos em ${stats.ms} ms.\n` +
          `Índice atual (${chunks} chunks):\n${lines}\n` +
          `Grafo: ${g.entidades} entidades, ${g.arestas} arestas (${g.ms} ms).`
      );
    }
  );

  registerTool(
    "vizinhanca",
    {
      title: "O que está ligado a isto",
      description:
        "Percorre o grafo do produto a partir de um card, PR, feature ou arquivo e mostra o que está ligado a ele: " +
        "qual PR implementou o card, qual spec o descreve, quais arquivos ele toca, quais sessões e decisões o mencionam. " +
        "Use ANTES de mexer em algo para saber o que aquilo puxa junto ('o que mudou por causa do #1072?', " +
        "'quais decisões tocaram aihDeFragmento.ts?'). As ligações vêm dos dados (corpo do PR, branch, pasta de planning, " +
        "arquivos citados em crase), não de adivinhação — arquivo com nome ambíguo simplesmente não é ligado.",
      inputSchema: {
        alvo: z
          .string()
          .describe("número do card (1072), #1072, slug da feature, ou nome de arquivo (aihDeFragmento.ts)"),
        limite: z.number().int().min(1).max(60).optional().describe("máx. de vizinhos por entidade (default 20)"),
      },
    },
    async (args) => {
      const alvos = grafo.resolver(args.alvo);
      if (alvos.length === 0) {
        return text(
          `Nada no grafo para "${args.alvo}". Tente o número do card, o slug da feature ou o nome exato do arquivo. ` +
            `Se o grafo estiver vazio, rode reindex.`
        );
      }
      const limite = args.limite ?? 20;
      const blocos = alvos.slice(0, 4).map((e: Entidade) => {
        const vs = grafo.vizinhos(e.id);
        if (vs.length === 0) return `## ${e.tipo} — ${e.titulo ?? e.chave}\n(sem ligações)`;
        const porRel = new Map<string, string[]>();
        for (const v of vs.slice(0, limite)) {
          const seta = v.direcao === "saindo" ? "→" : "←";
          const rot = `${seta} [${v.entidade.tipo}] ${v.entidade.titulo ?? v.entidade.chave}` +
            (v.entidade.status ? ` (${v.entidade.status})` : "") +
            (v.entidade.doc_path ? `\n     ${v.entidade.doc_path}` : "");
          const chave = v.rel;
          if (!porRel.has(chave)) porRel.set(chave, []);
          porRel.get(chave)!.push(rot);
        }
        const corpo = [...porRel.entries()]
          .map(([rel, itens]) => `  ${rel}:\n` + itens.map((i) => "   " + i).join("\n"))
          .join("\n");
        const sobra = vs.length > limite ? `\n  (+${vs.length - limite} ligações não mostradas)` : "";
        return `## ${e.tipo} — ${e.titulo ?? e.chave}${e.status ? ` [${e.status}]` : ""}\n` +
          (e.doc_path ? `${e.doc_path}\n` : "") + corpo + sobra;
      });
      return text(blocos.join("\n\n"));
    }
  );

  registerTool(
    "lembrar",
    {
      title: "Registrar uma decisão no cérebro",
      description:
        "Grava uma decisão, descoberta ou restrição no cofre (<workspace>/claude/decisoes/) e no grafo, NA HORA. " +
        "Use assim que algo for decidido durante a sessão — não espere o /diario do fim: se a sessão morrer antes, " +
        "o conhecimento se perde. Registre o que foi decidido, POR QUÊ, e o que foi descartado (o descartado é a " +
        "parte que mais se perde e a que mais evita retrabalho depois). " +
        "A tool devolve decisões anteriores do mesmo escopo que falam do mesmo assunto — leia antes de confirmar: " +
        "se alguma contradiz esta, passe o id dela em 'supersede'.",
      inputSchema: {
        fato: z.string().min(10).describe("O que foi decidido/descoberto, em uma ou duas frases"),
        tipo: z
          .enum(["decisao", "descoberta", "restricao", "pendencia"])
          .optional()
          .describe("default: decisao"),
        escopo: z
          .string()
          .optional()
          .describe("a que se refere: número do card, slug da feature ou arquivo (liga no grafo)"),
        porque: z.string().optional().describe("a razão — é isto que evita refazer a discussão depois"),
        alternativas: z.string().optional().describe("o que foi considerado e descartado, e por quê"),
        refs: z.array(z.string()).optional().describe("links, paths, PRs relacionados"),
        supersede: z.number().int().optional().describe("id de uma decisão anterior que esta substitui"),
      },
    },
    async (args) => {
      const relacionadas = await decisoesRelacionadas(db, args.fato, args.escopo);
      const r = await registrarDecisao(db, grafo, {
        fato: args.fato,
        tipo: args.tipo ?? "decisao",
        escopo: args.escopo,
        porque: args.porque,
        alternativas: args.alternativas,
        refs: args.refs,
        supersede: args.supersede,
      });
      indexer.scan();
      vigia.agendar("decisao");
      const aviso = relacionadas.length
        ? "\n\nJá havia registro sobre o mesmo assunto — confira se alguma contradiz esta e, se sim, " +
          "chame lembrar de novo com supersede:<id>:\n" +
          relacionadas
            .map((d) => `  #${d.id} (${d.data}${d.escopo ? ", " + d.escopo : ""}, semelhança ${d.semelhanca.toFixed(2)}): ${d.fato}`)
            .join("\n")
        : "";
      return text(`Registrado como #${r.id} em ${r.path}` + (args.supersede ? ` (substitui #${args.supersede})` : "") + aviso);
    }
  );
}
