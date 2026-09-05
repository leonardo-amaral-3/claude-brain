// Grafo de entidades do produto.
//
// Até aqui o cérebro só sabia que dois documentos compartilhavam palavras. O card #1072,
// o PR #1078, a spec em planning/1072-… e o arquivo aihDeFragmento.ts são a MESMA história,
// e essa ligação existe explícita nos dados — só nunca tinha sido lida:
//
//   - o corpo do PR traz "**Card:** #1072"
//   - o branch do PR ("feat/1072-gestao-aihs-linha-fragmento") traz número E slug da feature
//   - a pasta em planning começa com o número do card
//   - specs e PRs citam os arquivos que mexem, em crase
//
// Reconstrução é sempre total: com ~3k documentos custa menos de um segundo e evita toda a
// classe de bug de grafo incremental que fica dessincronizado.

import type { DatabaseSync } from "node:sqlite";
import { lerCommitsEstruturados } from "./gitSync.js";

export type TipoEntidade = "card" | "pr" | "feature" | "arquivo" | "doc" | "sessao" | "decisao" | "commit";
export type Relacao = "implementa" | "pertence" | "toca" | "referencia" | "registra" | "decide";

export interface Entidade {
  id: number;
  tipo: TipoEntidade;
  chave: string;
  titulo: string | null;
  repo: string | null;
  status: string | null;
  data: string | null;
  doc_path: string | null;
}

export interface Vizinho {
  rel: Relacao;
  direcao: "saindo" | "entrando";
  entidade: Entidade;
  origem: string | null;
}

const EXT_CODIGO = /\.(ts|tsx|js|jsx|mjs|cjs|py|sql|prisma|zmodel|sh|ps1|ya?ml|toml)$/i;

/** Caminhos e nomes de arquivo citados em crase, com ou sem `:linhas` no fim. */
function arquivosCitados(texto: string): string[] {
  const achados = new Set<string>();
  for (const m of texto.matchAll(/`([^`\n]{3,120})`/g)) {
    const bruto = m[1].trim().replace(/:\d+(-\d+)?$/, "");
    if (!EXT_CODIGO.test(bruto)) continue;
    if (/\s/.test(bruto)) continue;
    achados.add(bruto.replace(/^\.?\//, ""));
  }
  return [...achados];
}

/** Números de card citados como #1234 (3 a 5 dígitos — evita casar com `#fff` e afins). */
function cardsCitados(texto: string): number[] {
  const nums = new Set<number>();
  for (const m of texto.matchAll(/#(\d{3,5})\b/g)) nums.add(Number(m[1]));
  return [...nums];
}

interface DocLinha {
  id: number;
  path: string;
  title: string;
  source: string;
  repo: string | null;
  feature: string | null;
  doc_type: string;
  status: string | null;
  data: string | null;
  frontmatter_json: string | null;
}

export interface StatsGrafo {
  entidades: number;
  arestas: number;
  ms: number;
}

export class Grafo {
  constructor(
    private db: DatabaseSync,
    private git: { dir: string; repos: string[] } | null = null
  ) {}

  // ------------------------------------------------------------ construção

  reconstruir(): StatsGrafo {
    const t0 = Date.now();
    const db = this.db;

    // As decisões são gravadas pelo usuário (tool `lembrar`), não derivadas de arquivo —
    // precisam sobreviver à reconstrução.
    db.exec("BEGIN");
    try {
      // Apaga TUDO, inclusive decisões. A versão anterior preservava entidades de decisão
      // achando que estava protegendo dado que não vem de arquivo — mas os cards eram
      // recriados com ids novos e o ON DELETE CASCADE levava junto as arestas `decide`
      // que apontavam para eles. Resultado: a decisão sobrevivia, órfã, e o grafo mentia.
      // Decisão também é derivada, só que da tabela `decisoes` (ver passada 4).
      db.exec("DELETE FROM arestas");
      db.exec("DELETE FROM entidades");

      const docs = db
        .prepare(
          `SELECT id, path, title, source, repo, feature, doc_type, status, data, frontmatter_json FROM docs`
        )
        .all() as unknown as DocLinha[];

      const textoDe = db.prepare(
        "SELECT group_concat(text, '\n') AS t FROM (SELECT text FROM chunks WHERE doc_id = ? ORDER BY ord LIMIT 40)"
      );

      const insEnt = db.prepare(
        `INSERT INTO entidades (tipo, chave, titulo, repo, status, data, doc_path)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(chave) DO UPDATE SET
           titulo = COALESCE(excluded.titulo, titulo),
           status = COALESCE(excluded.status, status),
           data = COALESCE(excluded.data, data),
           doc_path = COALESCE(excluded.doc_path, doc_path)`
      );
      const idDe = db.prepare("SELECT id FROM entidades WHERE chave = ?");
      const insArest = db.prepare(
        "INSERT OR IGNORE INTO arestas (de, para, rel, origem) VALUES (?, ?, ?, ?)"
      );

      const ent = (
        tipo: TipoEntidade,
        chave: string,
        campos: Partial<Entidade> = {}
      ): number => {
        insEnt.run(
          tipo,
          chave,
          campos.titulo ?? null,
          campos.repo ?? null,
          campos.status ?? null,
          campos.data ?? null,
          campos.doc_path ?? null
        );
        return (idDe.get(chave) as { id: number }).id;
      };
      const liga = (de: number, para: number, rel: Relacao, origem: string): void => {
        if (de !== para) insArest.run(de, para, rel, origem);
      };

      // Índice de arquivos de código: só ligamos quando o nome resolve para UM único
      // arquivo. Uma citação a `index.ts` casaria com centenas — ligação ambígua é pior
      // que ligação ausente, porque mente com aparência de precisão.
      const porBasename = new Map<string, string[]>();
      const porSufixo = new Map<string, string[]>();
      for (const d of docs) {
        if (d.source !== "code") continue;
        const rel = d.path.split(/[\\/]/).join("/");
        const base = rel.split("/").pop()!;
        (porBasename.get(base) ?? porBasename.set(base, []).get(base)!).push(d.path);
        const partes = rel.split("/");
        for (let n = 2; n <= Math.min(5, partes.length); n++) {
          const suf = partes.slice(-n).join("/");
          (porSufixo.get(suf) ?? porSufixo.set(suf, []).get(suf)!).push(d.path);
        }
      }
      const resolveArquivo = (citado: string): string | null => {
        const direto = porSufixo.get(citado);
        if (direto?.length === 1) return direto[0];
        const base = citado.split("/").pop()!;
        const porNome = porBasename.get(base);
        return porNome?.length === 1 ? porNome[0] : null;
      };

      const arquivoEnt = new Map<string, number>();
      const entArquivo = (caminho: string, repo: string | null): number => {
        let id = arquivoEnt.get(caminho);
        if (id === undefined) {
          const rel = caminho.split(/[\\/]/).join("/");
          id = ent("arquivo", "arquivo:" + rel, { titulo: rel.split("/").slice(-2).join("/"), repo, doc_path: caminho });
          arquivoEnt.set(caminho, id);
        }
        return id;
      };

      // ---- passada 1: cria cards, PRs, features e docs de planning
      // Cards e PRs dividem a numeração DENTRO de um repo, mas repos diferentes repetem
      // números à vontade: o #1078 do faturamento não tem nada a ver com o #1078 do
      // processos. Por isso a resolução é sempre repo-primeiro, e o atalho só-por-número
      // vale apenas para números que aparecem uma única vez no workspace inteiro.
      interface Ref {
        id: number;
        tipo: "card" | "pr";
      }
      const porRepoNumero = new Map<string, Ref>();
      const ocorrenciasDoNumero = new Map<number, Ref[]>();
      const cardsPorNumero = new Map<number, number>(); // usado pelo casamento por slug de feature
      const featurePorSlug = new Map<string, number>();

      const entFeature = (slug: string, repo: string | null): number => {
        let id = featurePorSlug.get(slug);
        if (id === undefined) {
          id = ent("feature", "feature:" + slug, { titulo: slug, repo });
          featurePorSlug.set(slug, id);
        }
        return id;
      };

      for (const d of docs) {
        const fm = d.frontmatter_json ? (JSON.parse(d.frontmatter_json) as Record<string, unknown>) : {};
        if (d.source === "github" && typeof fm.numero === "number") {
          const tipo: TipoEntidade = fm.tipo === "pr" ? "pr" : "card";
          const id = ent(tipo, `${tipo}:${d.repo}#${fm.numero}`, {
            titulo: d.title,
            repo: d.repo,
            status: d.status,
            data: d.data,
            doc_path: d.path,
          });
          const ref: Ref = { id, tipo: tipo as "card" | "pr" };
          porRepoNumero.set(`${d.repo}#${fm.numero}`, ref);
          if (!ocorrenciasDoNumero.has(fm.numero)) ocorrenciasDoNumero.set(fm.numero, []);
          ocorrenciasDoNumero.get(fm.numero)!.push(ref);
          if (tipo === "card") cardsPorNumero.set(fm.numero, id);
        } else if ((d.source === "planning" || d.source === "docs") && d.feature) {
          entFeature(d.feature, d.repo);
        }
      }

      const numeroUnico = new Map<number, Ref>();
      for (const [n, refs] of ocorrenciasDoNumero) if (refs.length === 1) numeroUnico.set(n, refs[0]);
      const resolveNumero = (n: number, repo: string | null): Ref | undefined =>
        (repo ? porRepoNumero.get(`${repo}#${n}`) : undefined) ?? numeroUnico.get(n);

      // ---- passada 2: arestas
      let arestas = 0;
      for (const d of docs) {
        if (d.source === "code") continue;
        const fm = d.frontmatter_json ? (JSON.parse(d.frontmatter_json) as Record<string, unknown>) : {};
        const corpo = ((textoDe.get(d.id) as { t: string | null } | undefined)?.t ?? "").slice(0, 40000);

        let origemId: number | null = null;
        let rotulo = "";
        if (d.source === "github" && typeof fm.numero === "number") {
          const tipo = fm.tipo === "pr" ? "pr" : "card";
          origemId = (idDe.get(`${tipo}:${d.repo}#${fm.numero}`) as { id: number }).id;
          rotulo = "github";
        } else if (d.source === "diario") {
          origemId = ent("sessao", "sessao:" + d.path, { titulo: d.title, data: d.data, doc_path: d.path });
          rotulo = "diario";
        } else if (d.feature) {
          origemId = ent("doc", "doc:" + d.path, {
            titulo: d.title,
            repo: d.repo,
            status: d.status,
            data: d.data,
            doc_path: d.path,
          });
          rotulo = "planning";
          const fid = entFeature(d.feature, d.repo);
          liga(origemId, fid, "pertence", rotulo);
          arestas++;
        }
        if (origemId === null) continue;

        // PR -> card explícito, e branch com número + slug da feature
        const branch = typeof fm.branch === "string" ? fm.branch : "";
        // "**Card:** #n" (norma da esteira gm), "closes/fixes #n" (convenção do GitHub) e o
        // número no nome do branch — três formas de dizer a mesma coisa, as três em uso aqui.
        const cardExplicito =
          corpo.match(/\*\*Card:\*\*\s*#(\d+)/)?.[1] ??
          corpo.match(/\b(?:closes?|closed|fix(?:es|ed)?|resolve[sd]?)\s+#(\d{3,5})\b/i)?.[1] ??
          branch.match(/\/(\d{3,5})-/)?.[1];
        if (cardExplicito) {
          const alvo = resolveNumero(Number(cardExplicito), d.repo);
          if (alvo) {
            liga(origemId, alvo.id, "implementa", rotulo);
            arestas++;
          }
        }
        const slugBranch = branch.match(/\/\d{3,5}-([a-z0-9-]+)/)?.[1];
        if (slugBranch && featurePorSlug.has(slugBranch)) {
          liga(origemId, featurePorSlug.get(slugBranch)!, "pertence", rotulo);
          arestas++;
        }

        // feature cujo slug começa com o número do card
        if (d.feature) {
          const num = d.feature.match(/^(\d{3,5})-/)?.[1];
          const alvo = num ? cardsPorNumero.get(Number(num)) : undefined;
          if (alvo !== undefined) {
            liga(featurePorSlug.get(d.feature)!, alvo, "implementa", "slug");
            arestas++;
          }
        }

        // menções a outros cards
        for (const n of cardsCitados(corpo)) {
          const alvo = resolveNumero(n, d.repo);
          if (!alvo) continue;
          liga(origemId, alvo.id, d.source === "diario" ? "registra" : "referencia", rotulo);
          arestas++;
        }

        // arquivos citados
        for (const cit of arquivosCitados(corpo)) {
          const caminho = resolveArquivo(cit);
          if (!caminho) continue;
          liga(origemId, entArquivo(caminho, d.repo), "toca", rotulo);
          arestas++;
        }
      }

      // ---- passada 4 (antes da 3, para reaproveitar os resolvedores): decisões.
      // A tabela `decisoes` é a fonte de verdade; a entidade e as arestas são derivadas dela
      // como qualquer outra coisa, então uma reconstrução sempre reconverge — e decisão
      // apagada da tabela some do grafo em vez de virar órfã.
      const decisoes = db
        .prepare(
          "SELECT id, fato, escopo, data, doc_path FROM decisoes WHERE supersedida_por IS NULL"
        )
        .all() as unknown as {
        id: number;
        fato: string;
        escopo: string | null;
        data: string;
        doc_path: string | null;
      }[];
      for (const dec of decisoes) {
        const idDec = ent("decisao", `decisao:${dec.id}`, {
          titulo: dec.fato.slice(0, 140),
          data: dec.data,
          doc_path: dec.doc_path,
        });
        if (!dec.escopo) continue;
        // escopo pode ser número de card, slug de feature ou nome de arquivo
        const num = dec.escopo.match(/(\d{3,5})/)?.[1];
        const alvos: number[] = [];
        const porNumero = num ? resolveNumero(Number(num), null) : undefined;
        if (porNumero) alvos.push(porNumero.id);
        if (featurePorSlug.has(dec.escopo)) alvos.push(featurePorSlug.get(dec.escopo)!);
        const arq = resolveArquivo(dec.escopo);
        if (arq) alvos.push(entArquivo(arq, null));
        for (const alvo of alvos) {
          liga(idDec, alvo, "decide", "lembrar");
          arestas++;
        }
      }

      // ---- passada 3: commits que citam card viram entidade.
      // Só esses: um commit sem card é história que a busca textual já cobre, e criar
      // entidade para todos inflaria o grafo em ordens de grandeza sem responder nada novo.
      if (this.git) {
        for (const c of lerCommitsEstruturados(this.git.dir, this.git.repos)) {
          const alvos = c.cards.map((n) => resolveNumero(n, c.repo)).filter((x): x is Ref => x !== undefined);
          if (alvos.length === 0) continue;
          const idC = ent("commit", `commit:${c.repo}@${c.sha}`, {
            titulo: `${c.sha} ${c.assunto}`.slice(0, 140),
            repo: c.repo,
            data: c.data,
          });
          for (const alvo of alvos) {
            // squash-merge do GitHub carimba o número do PR no assunto; o card vem por dentro dele
            liga(idC, alvo.id, alvo.tipo === "card" ? "implementa" : "pertence", "git");
            arestas++;
          }
          for (const arq of c.arquivos) {
            const caminho = resolveArquivo(arq);
            if (!caminho) continue;
            liga(idC, entArquivo(caminho, c.repo), "toca", "git");
            arestas++;
          }
        }
      }

      db.exec("COMMIT");
      const totEnt = (db.prepare("SELECT COUNT(*) n FROM entidades").get() as { n: number }).n;
      const totArest = (db.prepare("SELECT COUNT(*) n FROM arestas").get() as { n: number }).n;
      return { entidades: totEnt, arestas: totArest, ms: Date.now() - t0 };
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  // ------------------------------------------------------------ consulta

  /** Resolve "1072", "#1072", "card 1072", "aihDeFragmento.ts" ou um slug para entidades. */
  resolver(consulta: string): Entidade[] {
    const q = consulta.trim();
    const num = q.match(/(\d{3,5})/)?.[1];
    const achados: Entidade[] = [];
    if (num) {
      achados.push(
        ...(this.db
          .prepare("SELECT * FROM entidades WHERE chave LIKE ? OR chave LIKE ? ORDER BY tipo")
          .all(`%#${num}`, `feature:${num}-%`) as unknown as Entidade[])
      );
    }
    if (achados.length === 0) {
      achados.push(
        ...(this.db
          .prepare(
            "SELECT * FROM entidades WHERE chave LIKE ? OR titulo LIKE ? ORDER BY (tipo = 'arquivo') DESC LIMIT 10"
          )
          .all(`%${q}%`, `%${q}%`) as unknown as Entidade[])
      );
    }
    return achados;
  }

  vizinhos(entidadeId: number): Vizinho[] {
    const saindo = this.db
      .prepare(
        `SELECT a.rel, a.origem, e.* FROM arestas a JOIN entidades e ON e.id = a.para WHERE a.de = ?`
      )
      .all(entidadeId) as unknown as (Entidade & { rel: Relacao; origem: string | null })[];
    const entrando = this.db
      .prepare(
        `SELECT a.rel, a.origem, e.* FROM arestas a JOIN entidades e ON e.id = a.de WHERE a.para = ?`
      )
      .all(entidadeId) as unknown as (Entidade & { rel: Relacao; origem: string | null })[];
    return [
      ...saindo.map((r) => ({ rel: r.rel, direcao: "saindo" as const, origem: r.origem, entidade: r })),
      ...entrando.map((r) => ({ rel: r.rel, direcao: "entrando" as const, origem: r.origem, entidade: r })),
    ];
  }

  stats(): { entidades: number; arestas: number; porTipo: { tipo: string; n: number }[] } {
    return {
      entidades: (this.db.prepare("SELECT COUNT(*) n FROM entidades").get() as { n: number }).n,
      arestas: (this.db.prepare("SELECT COUNT(*) n FROM arestas").get() as { n: number }).n,
      porTipo: this.db
        .prepare("SELECT tipo, COUNT(*) n FROM entidades GROUP BY tipo ORDER BY n DESC")
        .all() as unknown as { tipo: string; n: number }[],
    };
  }
}
