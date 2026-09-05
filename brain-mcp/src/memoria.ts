// Memória ativa: o cérebro passa a escrever, não só ler.
//
// Antes, tudo que era decidido numa sessão só entrava no índice se o usuário lembrasse de rodar
// /diario no fim. Sessão que morre antes disso levava junto o "por quê" — e o porquê é justamente
// a parte que ninguém reconstrói lendo o diff depois.
//
// A decisão vira um arquivo markdown no cofre (visível no Obsidian, indexado como qualquer doc)
// E uma linha na tabela `decisoes` — o arquivo é o artefato durável, a linha é o que permite
// detectar que uma decisão nova fala do mesmo assunto que uma antiga.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { loadConfig, packageRoot } from "./config.js";
import { cosseno, deBlob, embedPassagens, paraBlob } from "./embeddings.js";
import type { Grafo } from "./grafo.js";

export interface DadosDecisao {
  fato: string;
  tipo: string;
  escopo?: string;
  porque?: string;
  alternativas?: string;
  refs?: string[];
  supersede?: number;
}

export interface DecisaoRelacionada {
  id: number;
  data: string;
  escopo: string | null;
  fato: string;
  semelhanca: number;
}

const LIMIAR_MESMO_ASSUNTO = 0.82;

function dirDecisoes(): string {
  const cfg = loadConfig();
  const raiz = cfg.roots.find((r) => r.source === "decisao");
  if (!raiz) throw new Error('brain.config.json nao tem root com source "decisao"');
  return raiz.path;
}

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Decisões anteriores que falam do mesmo assunto. NÃO afirma que há contradição — julgar isso
 * automaticamente seria chute com cara de certeza. Traz os candidatos com a semelhança medida
 * para quem está escrevendo decidir se substitui ou convive.
 */
export async function decisoesRelacionadas(
  db: DatabaseSync,
  fato: string,
  escopo?: string
): Promise<DecisaoRelacionada[]> {
  const candidatos = db
    .prepare(
      `SELECT id, data, escopo, fato, embedding FROM decisoes
       WHERE supersedida_por IS NULL AND (? IS NULL OR escopo = ? OR escopo IS NULL)
       ORDER BY ts DESC LIMIT 300`
    )
    .all(escopo ?? null, escopo ?? null) as unknown as (Omit<DecisaoRelacionada, "semelhanca"> & {
    embedding: Uint8Array | null;
  })[];
  if (candidatos.length === 0) return [];

  try {
    const [q] = await embedPassagens([fato]);
    return candidatos
      .filter((c) => c.embedding)
      .map((c) => ({
        id: c.id,
        data: c.data,
        escopo: c.escopo,
        fato: c.fato,
        semelhanca: cosseno(q, deBlob(c.embedding!)),
      }))
      .filter((c) => c.semelhanca >= LIMIAR_MESMO_ASSUNTO)
      .sort((a, b) => b.semelhanca - a.semelhanca)
      .slice(0, 5);
  } catch {
    // Sem embeddings: cai para sobreposição de termos, que é grosseiro mas melhor que nada.
    const termos = new Set(fato.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []);
    return candidatos
      .map((c) => {
        const outros = new Set(c.fato.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []);
        let comum = 0;
        for (const t of termos) if (outros.has(t)) comum++;
        return { id: c.id, data: c.data, escopo: c.escopo, fato: c.fato, semelhanca: comum / Math.max(1, termos.size) };
      })
      .filter((c) => c.semelhanca >= 0.5)
      .sort((a, b) => b.semelhanca - a.semelhanca)
      .slice(0, 5);
  }
}

/**
 * Publica a decisão no card do board como comentário `<!-- gm:decisao -->`.
 *
 * O cofre (`notoria/claude/decisoes`) e o índice do brain são LOCAIS: a revisão
 * automática de PR, que roda no GitHub Actions, não enxerga nenhum dos dois.
 * Sem isto o revisor do CI vê o problema, a spec e as tasks, mas não vê o que
 * foi DESCARTADO — que é justamente a parte que impede alguém de reintroduzir
 * uma alternativa já morta e o revisor de re-litigar a discussão.
 *
 * Melhor-esforço por princípio: a decisão já está gravada no cofre, no banco e
 * no grafo quando isto roda. Falha de rede, card inexistente ou `gh` ausente
 * não podem derrubar o registro local — só custam a cópia no GitHub.
 */
function publicarDecisaoNoCard(d: DadosDecisao, id: number, titulo: string): string | null {
  const m = /^#?(\d+)$/.exec((d.escopo ?? "").trim());
  if (!m) return null; // escopo é feature/arquivo, não card — nada a publicar
  const numero = m[1];

  // Descobre o repo pelo índice local já sincronizado, sem gastar chamada de API.
  // Só cai para o probe remoto se o card ainda não tiver sido indexado.
  const repos = loadConfig().github?.repos ?? [];
  let alvo: string | null = null;
  for (const repoFull of repos) {
    const curto = repoFull.split("/")[1] ?? repoFull;
    if (existsSync(join(packageRoot, "data", "github", "docs", curto, "cards", `${numero}.md`))) {
      alvo = repoFull;
      break;
    }
  }
  if (!alvo) {
    for (const repoFull of repos) {
      try {
        execFileSync("gh", ["issue", "view", numero, "--repo", repoFull, "--json", "number"], {
          encoding: "utf8",
          windowsHide: true,
          stdio: ["ignore", "pipe", "ignore"],
        });
        alvo = repoFull;
        break;
      } catch {
        /* card não existe neste repo — tenta o próximo */
      }
    }
  }
  if (!alvo) return null;

  const corpo =
    `<!-- gm:decisao -->\n` +
    `## 🧠 Decisão · ${titulo}\n\n` +
    `${d.fato}\n` +
    (d.porque ? `\n**Por quê:** ${d.porque}\n` : "") +
    (d.alternativas ? `\n**Descartado:** ${d.alternativas}\n` : "") +
    (d.supersede ? `\n**Substitui** a decisão #${d.supersede}.\n` : "") +
    (d.refs?.length ? `\n**Refs:** ${d.refs.join(" · ")}\n` : "") +
    `\n<sub>Registrada pelo \`lembrar\` do brain (decisão #${id}). ` +
    `A revisão automática de PR lê estes comentários como camada da linhagem do card.</sub>\n`;

  execFileSync("gh", ["issue", "comment", numero, "--repo", alvo, "--body", corpo], {
    encoding: "utf8",
    windowsHide: true,
  });
  return `${alvo}#${numero}`;
}

export async function registrarDecisao(
  db: DatabaseSync,
  grafo: Grafo,
  d: DadosDecisao
): Promise<{ id: number; path: string }> {
  const dir = dirDecisoes();
  mkdirSync(dir, { recursive: true });
  const data = hoje();
  const nome = `${data}-${slug(d.fato) || "decisao"}.md`;
  const caminho = join(dir, nome);

  // Título é a primeira frase; se precisar cortar, corta na palavra inteira.
  const primeira = d.fato.split(/(?<=[.!?])\s/)[0];
  const titulo = primeira.length <= 110 ? primeira : primeira.slice(0, 110).replace(/\s+\S*$/, "") + "…";
  const corpo =
    `---\n` +
    `data: ${data}\n` +
    `tipo: ${d.tipo}\n` +
    (d.escopo ? `escopo: ${d.escopo}\n` : "") +
    (d.supersede ? `substitui: ${d.supersede}\n` : "") +
    `---\n\n` +
    `# ${titulo}\n\n` +
    `${d.fato}\n` +
    (d.porque ? `\n**Por quê:** ${d.porque}\n` : "") +
    (d.alternativas ? `\n**Descartado:** ${d.alternativas}\n` : "") +
    (d.refs?.length ? `\n**Refs:** ${d.refs.join(" · ")}\n` : "");
  writeFileSync(caminho, corpo, "utf8");

  const res = db
    .prepare(
      `INSERT INTO decisoes (ts, data, tipo, escopo, fato, porque, alternativas, refs, doc_path, supersede)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      Date.now(),
      data,
      d.tipo,
      d.escopo ?? null,
      d.fato,
      d.porque ?? null,
      d.alternativas ?? null,
      d.refs?.length ? JSON.stringify(d.refs) : null,
      caminho,
      d.supersede ?? null
    );
  const id = Number(res.lastInsertRowid);

  if (d.supersede) {
    db.prepare("UPDATE decisoes SET supersedida_por = ? WHERE id = ?").run(id, d.supersede);
  }

  // Embedding da decisão: é o que permite detectar depois que outra fala do mesmo assunto.
  // Tem de ser AGUARDADO, não disparado e esquecido: o servidor MCP morre junto com a sessão
  // e um .then() pendente morre com ele — foi exatamente assim que a primeira decisão gravada
  // ficou sem vetor. Se falhar, a coluna fica NULL e o backfill do próximo boot resolve.
  try {
    const [v] = await Promise.race([
      embedPassagens([d.fato]),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 30000)),
    ]);
    db.prepare("UPDATE decisoes SET embedding = ? WHERE id = ?").run(paraBlob(v), id);
  } catch (err) {
    console.error("[brain] decisao gravada sem vetor (o backfill preenche depois):", (err as Error).message);
  }

  // Liga no grafo: a decisão passa a aparecer na vizinhança do card/feature/arquivo.
  try {
    const idDec = db
      .prepare(
        `INSERT INTO entidades (tipo, chave, titulo, data, doc_path) VALUES ('decisao', ?, ?, ?, ?)
         ON CONFLICT(chave) DO UPDATE SET titulo = excluded.titulo RETURNING id`
      )
      .get(`decisao:${id}`, titulo, data, caminho) as { id: number } | undefined;
    if (idDec && d.escopo) {
      const insArest = db.prepare("INSERT OR IGNORE INTO arestas (de, para, rel, origem) VALUES (?, ?, 'decide', 'lembrar')");
      for (const alvo of grafo.resolver(d.escopo).slice(0, 3)) insArest.run(idDec.id, alvo.id);
    }
  } catch (err) {
    console.error("[brain] decisao gravada, mas nao ligada no grafo:", err);
  }

  // Espelha no card, para o revisor do CI enxergar o descartado (o cofre e local).
  try {
    const onde = publicarDecisaoNoCard(d, id, titulo);
    if (onde) console.error(`[brain] decisao #${id} publicada em ${onde}`);
  } catch (err) {
    console.error("[brain] decisao gravada, mas nao publicada no card:", (err as Error).message);
  }

  return { id, path: caminho };
}

/** Preenche vetores de decisões que ficaram sem — chamado no boot, junto com o dos chunks. */
export async function preencherVetoresDeDecisoes(db: DatabaseSync): Promise<number> {
  const pend = db
    .prepare("SELECT id, fato FROM decisoes WHERE embedding IS NULL LIMIT 200")
    .all() as unknown as { id: number; fato: string }[];
  if (pend.length === 0) return 0;
  const vetores = await embedPassagens(pend.map((p) => p.fato));
  const upd = db.prepare("UPDATE decisoes SET embedding = ? WHERE id = ?");
  for (let i = 0; i < pend.length; i++) upd.run(paraBlob(vetores[i]), pend[i].id);
  return pend.length;
}
