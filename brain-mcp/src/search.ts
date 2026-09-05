// Busca híbrida: BM25 (léxico) + cosseno (semântico), fundidos por RRF, reordenados por
// autoridade/recência e colapsados por conteúdo.
//
// Por que híbrido: BM25 acerta quando você já sabe a palavra ("blocklist fragmento") e erra
// quando você descreve o problema ("por que aparece duas vezes"). Embedding faz o inverso.
// RRF combina os dois sem precisar calibrar escalas incompatíveis — só usa a posição no ranking.

import type { DatabaseSync } from "node:sqlite";
import { embedQuery, jaPronto } from "./embeddings.js";
import type { VectorIndex, FiltrosVec } from "./vectors.js";

// ---------------------------------------------------------------- tokenização

// Palavras sem conteúdo semântico. Sem esta lista elas entravam no AND do FTS,
// obrigando a preposição a existir no trecho — e a busca premiava chunks longos
// e genéricos em vez do documento certo.
const STOPWORDS = new Set(
  ("ao aos as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para pra " +
    "com sem sob sobre entre ate apos ante ou mas que se como quando onde quem qual quais porque pq " +
    "seu sua seus suas meu minha nosso nossa este esta estes estas esse essa esses essas isso isto " +
    "aquele aquela aquilo ser sao foi foram sendo estar estao esteve tem ter tinha havia haver " +
    "fazer faz feito usar usa usado funciona funcionar deve pode posso quero preciso queria " +
    "mais menos muito pouco todo toda todos todas ja nao sim so tambem entao assim aqui agora hoje " +
    "the of in to for and or is are how what where when why does did an").split(" ")
);

// Vocabulário do domínio: o jeito que a pergunta é feita raramente é o jeito que o documento
// foi escrito. Estes termos entram SÓ na passada OR — no AND eles destruiriam a precisão.
const SINONIMOS: Record<string, string[]> = {
  aih: ["autorizacao", "internacao", "sisaih"],
  sisaih: ["aih", "importacao"],
  critica: ["criticas", "inconsistencia", "inconsistencias"],
  criticas: ["critica", "inconsistencia"],
  inconsistencia: ["critica", "criticas"],
  fragmento: ["fragmentacao", "fragmentada", "fragmentado"],
  consolidada: ["consolidacao", "consolidado", "consolidar"],
  consolidacao: ["consolidada", "consolidado"],
  designacao: ["designar", "designada", "designado"],
  designar: ["designacao", "designada"],
  competencia: ["competencias", "faturamento"],
  faturista: ["faturamento", "faturistas"],
  auditoria: ["auditorias", "auditar"],
  pendencia: ["pendencias", "pendente"],
  instituicao: ["instituicoes", "hospital"],
  solicitante: ["responsavel"],
  responsavel: ["solicitante"],
  esteira: ["gm", "fluxo"],
  spec: ["especificacao", "tech-spec"],
};

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Tokens de conteúdo da query. Se sobrar nada, devolve como veio. */
export function tokensDe(query: string): string[] {
  const todos = [...query.matchAll(/[\p{L}\p{N}_]+/gu)].map((m) => normalizar(m[0])).filter((t) => t.length >= 2);
  const conteudo = todos.filter((t) => !STOPWORDS.has(t));
  return conteudo.length ? conteudo : todos;
}

/**
 * Acrescenta o vocabulario do dominio de quem instalou (bloco `sinonimos` do config) ao
 * dicionario embutido. Chamado uma vez no boot: mapa mutavel de modulo e o suficiente aqui,
 * e evita arrastar a config inteira ate a funcao de expansao.
 */
export function registrarSinonimos(extra?: Record<string, string[]>): void {
  for (const [termo, lista] of Object.entries(extra ?? {})) {
    const chave = normalizar(termo);
    SINONIMOS[chave] = [...new Set([...(SINONIMOS[chave] ?? []), ...lista.map(normalizar)])];
  }
}

function expandir(tokens: string[]): string[] {
  const fora = new Set(tokens);
  for (const t of tokens) for (const syn of SINONIMOS[t] ?? []) fora.add(syn);
  return [...fora];
}

export function matchExpr(tokens: string[], op: "AND" | "OR"): string {
  return tokens.map((t) => `"${t}"`).join(` ${op} `);
}

// ---------------------------------------------------------------- reordenação

// Peso por tipo de documento: a spec é o contrato, a nota solta é palpite. A decisão
// registrada é o que menos deve se perder.
//
// ATENÇÃO à escala. Estes números parecem tímidos e são deliberadamente tímidos: o score RRF
// do 1º lugar é 1/61 e o do 2º é 1/62 — 1,6% de diferença. Um multiplicador "modesto" de 1,3
// empurraria um documento ~18 posições, e a autoridade deixaria de desempatar para passar a
// mandar. A primeira versão fazia isso: uma decisão só tangencialmente relevante passou na
// frente da nota que respondia a pergunta. Autoridade é desempate, não é relevância.
const PESO_TIPO: Record<string, number> = {
  decisao: 1.06,
  spec: 1.05,
  "tech-spec": 1.05,
  prd: 1.04,
  mapa: 1.03,
  memoria: 1.024,
  task: 1.01,
  handoff: 1.01,
  card: 1.0,
  pr: 1.0,
  diario: 1.0,
  code: 1.0,
  commit: 1.0,
  doc: 0.99,
  readme: 0.99,
  changelog: 0.99,
  nota: 0.98,
};

function pesoAutoridade(r: LinhaBruta): number {
  let p = PESO_TIPO[r.doc_type] ?? 1;
  if (r.status === "arquivado") p *= 0.92;
  if (!r.data) return p;
  const dias = (Date.now() - Date.parse(r.data)) / 86_400_000;
  if (dias <= 30) p *= 1.015;
  else if (dias > 365) p *= 0.98;
  return p;
}

// ---------------------------------------------------------------- tipos

interface LinhaBruta {
  chunk_id: number;
  full_text: string;
  path: string;
  title: string;
  source: string;
  repo: string | null;
  feature: string | null;
  doc_type: string;
  status: string | null;
  data: string | null;
  breadcrumb: string;
  snip: string;
}

export interface Resultado extends LinhaBruta {
  score: number;
  tambemEm: string[];
}

export interface Filtros extends FiltrosVec {}

export interface Diagnostico {
  lexicais: number;
  vetoriais: number;
  semantica: boolean;
  colapsados: number;
}

const POOL = 60;
const TIMEOUT_EMBED_MS = 4000;
const RRF_K = 60;

export class Buscador {
  constructor(
    private db: DatabaseSync,
    private vec: VectorIndex
  ) {}

  private sqlBase(where: string): string {
    return `
      SELECT c.id AS chunk_id, c.text AS full_text,
             d.path, d.title, d.source, d.repo, d.feature, d.doc_type, d.status, d.data,
             c.breadcrumb, snippet(chunks_fts, 0, '«', '»', ' … ', 40) AS snip
      FROM chunks_fts
      JOIN chunks c ON c.id = chunks_fts.rowid
      JOIN docs d ON d.id = c.doc_id
      WHERE chunks_fts MATCH ? ${where}
      ORDER BY bm25(chunks_fts, 1.0, 3.0, 5.0)
      LIMIT ?`;
  }

  private condicoes(f: Filtros): { where: string; params: (string | number)[] } {
    const conds: string[] = [];
    const params: (string | number)[] = [];
    if (f.source) (conds.push("d.source = ?"), params.push(f.source));
    if (f.repo) (conds.push("d.repo = ?"), params.push(f.repo));
    if (f.feature) (conds.push("d.feature = ?"), params.push(f.feature));
    if (f.doc_type) (conds.push("d.doc_type = ?"), params.push(f.doc_type));
    if (!f.incluirArquivadas && !f.feature) conds.push("(d.status IS NULL OR d.status <> 'arquivado')");
    return { where: conds.length ? "AND " + conds.join(" AND ") : "", params };
  }

  /** Passada léxica: AND para precisão, OR (com sinônimos) para cobertura. */
  private lexico(tokens: string[], f: Filtros): LinhaBruta[] {
    const { where, params } = this.condicoes(f);
    const stmt = this.db.prepare(this.sqlBase(where));
    const rows = stmt.all(matchExpr(tokens, "AND"), ...params, POOL) as unknown as LinhaBruta[];
    if (rows.length < POOL && tokens.length > 1) {
      const jaTem = new Set(rows.map((r) => r.chunk_id));
      const alargado = matchExpr(expandir(tokens), "OR");
      for (const r of stmt.all(alargado, ...params, POOL) as unknown as LinhaBruta[]) {
        if (!jaTem.has(r.chunk_id)) rows.push(r);
      }
    }
    return rows;
  }

  private hidratar(chunkIds: number[]): Map<number, LinhaBruta> {
    const mapa = new Map<number, LinhaBruta>();
    if (chunkIds.length === 0) return mapa;
    const marcadores = chunkIds.map(() => "?").join(",");
    const rows = this.db
      .prepare(
        `SELECT c.id AS chunk_id, c.text AS full_text,
                d.path, d.title, d.source, d.repo, d.feature, d.doc_type, d.status, d.data,
                c.breadcrumb, substr(c.text, 1, 300) AS snip
         FROM chunks c JOIN docs d ON d.id = c.doc_id
         WHERE c.id IN (${marcadores})`
      )
      .all(...chunkIds) as unknown as LinhaBruta[];
    for (const r of rows) mapa.set(r.chunk_id, r);
    return mapa;
  }

  /**
   * Colapsa trechos com o mesmo conteúdo vindos de fontes diferentes — o caso clássico é a
   * spec de planning que o card do GitHub embute inteira no corpo. Fica o vencedor do ranking
   * (a spec canônica, por peso de autoridade) anotado com onde mais aquilo aparece.
   */
  private colapsar(rows: Resultado[], limit: number): { saida: Resultado[]; colapsados: number } {
    const porConteudo = new Map<string, Resultado>();
    const primeiros: Resultado[] = [];
    const sobras: Resultado[] = [];
    const porDoc = new Map<string, number>();
    let colapsados = 0;

    for (const r of rows) {
      const chave = normalizar(r.full_text.slice(0, 300)).replace(/\s+/g, " ").trim();
      const anterior = porConteudo.get(chave);
      if (anterior) {
        const onde = r.source === "github" ? rotuloGithub(r) : r.doc_type;
        if (onde && !anterior.tambemEm.includes(onde)) anterior.tambemEm.push(onde);
        colapsados++;
        continue;
      }
      const n = porDoc.get(r.path) ?? 0;
      if (n >= 2) continue; // no máximo 2 trechos do mesmo documento
      porConteudo.set(chave, r);
      porDoc.set(r.path, n + 1);
      // Diversidade antes de profundidade: um documento só ganha o segundo trecho depois que
      // todos os outros documentos já tiveram o primeiro. Sem isso, dois trechos do mesmo PR
      // ocupavam 1º e 2º e empurravam a resposta certa para o 3º.
      (n === 0 ? primeiros : sobras).push(r);
    }
    return { saida: [...primeiros, ...sobras].slice(0, limit), colapsados };
  }

  async buscar(
    query: string,
    filtros: Filtros,
    limit: number
  ): Promise<{ resultados: Resultado[]; diag: Diagnostico }> {
    const tokens = tokensDe(query);
    const lexicais = tokens.length ? this.lexico(tokens, filtros) : [];

    // Semântico é best-effort e NUNCA pode travar a busca. Duas proteções:
    // (1) se o modelo ainda está carregando (o boot aquece em segundo plano), esta consulta
    //     sai só com o léxico em vez de esperar os ~15 s de carga;
    // (2) mesmo pronto, a inferência corre contra um timeout — degradar é sempre melhor
    //     que pendurar quem perguntou.
    let vetoriais: { chunkId: number; score: number }[] = [];
    let semantica = false;
    if (jaPronto() && this.vec.cobertura().comEmbedding > 0) {
      try {
        const q = await Promise.race([
          embedQuery(query),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT_EMBED_MS)),
        ]);
        vetoriais = this.vec.buscar(q, filtros, POOL);
        semantica = true;
      } catch (err) {
        console.error("[brain] busca semântica pulada nesta consulta:", (err as Error).message);
      }
    }

    // Reciprocal Rank Fusion
    const pontos = new Map<number, number>();
    lexicais.forEach((r, i) => pontos.set(r.chunk_id, (pontos.get(r.chunk_id) ?? 0) + 1 / (RRF_K + i + 1)));
    vetoriais.forEach((v, i) => pontos.set(v.chunkId, (pontos.get(v.chunkId) ?? 0) + 1 / (RRF_K + i + 1)));

    const conhecidos = new Map<number, LinhaBruta>(lexicais.map((r) => [r.chunk_id, r]));
    const faltantes = [...pontos.keys()].filter((id) => !conhecidos.has(id));
    for (const [id, row] of this.hidratar(faltantes)) conhecidos.set(id, row);

    const ordenados: Resultado[] = [...pontos.entries()]
      .map(([id, rrf]) => {
        const row = conhecidos.get(id);
        if (!row) return null;
        return { ...row, score: rrf * pesoAutoridade(row), tambemEm: [] as string[] };
      })
      .filter((r): r is Resultado => r !== null)
      .sort((a, b) => b.score - a.score);

    const { saida, colapsados } = this.colapsar(ordenados, limit);
    return {
      resultados: saida,
      diag: { lexicais: lexicais.length, vetoriais: vetoriais.length, semantica, colapsados },
    };
  }
}

function rotuloGithub(r: LinhaBruta): string {
  const m = r.title.match(/\[(card|pr) #(\d+)\]/);
  return m ? `${m[1]} #${m[2]}` : "github";
}
