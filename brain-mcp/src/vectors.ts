// Índice vetorial em memória.
//
// Sem sqlite-vec de propósito: nesta escala (~7k chunks x 384 dims = 10 MB) a força bruta
// custa poucos milissegundos e não exige extensão nativa. Se o índice passar de ~100k chunks,
// aí sim vale trocar por ANN — o formato de armazenamento (BLOB em chunks.embedding) não muda.

import type { DatabaseSync } from "node:sqlite";
import { cosseno, deBlob, embedPassagens, paraBlob } from "./embeddings.js";

export interface FiltrosVec {
  source?: string;
  repo?: string;
  feature?: string;
  doc_type?: string;
  incluirArquivadas?: boolean;
}

interface Linha {
  chunkId: number;
  vec: Float32Array;
  source: string;
  repo: string | null;
  feature: string | null;
  docType: string;
  status: string | null;
}

export class VectorIndex {
  private linhas: Linha[] = [];
  private carregado = false;
  private sujo = true;

  constructor(private db: DatabaseSync) {}

  marcarSujo(): void {
    this.sujo = true;
    this.cacheCobertura = null;
  }

  get tamanho(): number {
    return this.linhas.length;
  }

  private garantirCarregado(): void {
    if (this.carregado && !this.sujo) return;
    const rows = this.db
      .prepare(
        `SELECT c.id AS chunkId, c.embedding AS emb,
                d.source, d.repo, d.feature, d.doc_type AS docType, d.status
         FROM chunks c JOIN docs d ON d.id = c.doc_id
         WHERE c.embedding IS NOT NULL`
      )
      .all() as unknown as (Omit<Linha, "vec"> & { emb: Uint8Array })[];
    this.linhas = rows.map((r) => ({
      chunkId: r.chunkId,
      vec: deBlob(r.emb),
      source: r.source,
      repo: r.repo,
      feature: r.feature,
      docType: r.docType,
      status: r.status,
    }));
    this.carregado = true;
    this.sujo = false;
  }

  private passaFiltro(l: Linha, f: FiltrosVec): boolean {
    if (f.source && l.source !== f.source) return false;
    if (f.repo && l.repo !== f.repo) return false;
    if (f.feature && l.feature !== f.feature) return false;
    if (f.doc_type && l.docType !== f.doc_type) return false;
    if (!f.incluirArquivadas && !f.feature && l.status === "arquivado") return false;
    return true;
  }

  /** Top-K por cosseno, já respeitando os mesmos filtros da busca léxica. */
  buscar(q: Float32Array, filtros: FiltrosVec, topK: number): { chunkId: number; score: number }[] {
    this.garantirCarregado();
    const heap: { chunkId: number; score: number }[] = [];
    let menor = -Infinity;
    for (const l of this.linhas) {
      if (!this.passaFiltro(l, filtros)) continue;
      const s = cosseno(q, l.vec);
      if (heap.length < topK) {
        heap.push({ chunkId: l.chunkId, score: s });
        if (heap.length === topK) {
          heap.sort((a, b) => a.score - b.score);
          menor = heap[0].score;
        }
      } else if (s > menor) {
        heap[0] = { chunkId: l.chunkId, score: s };
        heap.sort((a, b) => a.score - b.score);
        menor = heap[0].score;
      }
    }
    return heap.sort((a, b) => b.score - a.score);
  }

  private cacheCobertura: { em: number; valor: { comEmbedding: number; total: number } } | null = null;

  /** Cacheado por 30 s: isto roda no caminho de toda busca e é um COUNT da tabela inteira. */
  cobertura(): { comEmbedding: number; total: number } {
    if (this.cacheCobertura && Date.now() - this.cacheCobertura.em < 30_000) return this.cacheCobertura.valor;
    const r = this.db
      .prepare(
        "SELECT COUNT(*) total, SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) com FROM chunks"
      )
      .get() as { total: number; com: number | null };
    const valor = { comEmbedding: r.com ?? 0, total: r.total };
    this.cacheCobertura = { em: Date.now(), valor };
    return valor;
  }
}

const LOTE = 32;

/**
 * Preenche embeddings dos chunks que ainda não têm. Idempotente e retomável:
 * pode ser interrompido a qualquer momento, na próxima vez continua de onde parou.
 */
export async function preencherEmbeddings(
  db: DatabaseSync,
  opts: { limite?: number; onProgresso?: (feitos: number, total: number) => void } = {}
): Promise<{ feitos: number; restantes: number; ms: number }> {
  const t0 = Date.now();
  const totalPendente = (
    db.prepare("SELECT COUNT(*) n FROM chunks WHERE embedding IS NULL").get() as { n: number }
  ).n;
  const alvo = Math.min(opts.limite ?? Infinity, totalPendente);
  const upd = db.prepare("UPDATE chunks SET embedding = ? WHERE id = ?");
  let feitos = 0;

  while (feitos < alvo) {
    const lote = db
      .prepare("SELECT id, text FROM chunks WHERE embedding IS NULL LIMIT ?")
      .all(Math.min(LOTE, alvo - feitos)) as unknown as { id: number; text: string }[];
    if (lote.length === 0) break;

    const vetores = await embedPassagens(lote.map((c) => c.text));
    db.exec("BEGIN");
    try {
      for (let i = 0; i < lote.length; i++) upd.run(paraBlob(vetores[i]), lote[i].id);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    feitos += lote.length;
    opts.onProgresso?.(feitos, alvo);
  }

  const restantes = (
    db.prepare("SELECT COUNT(*) n FROM chunks WHERE embedding IS NULL").get() as { n: number }
  ).n;
  return { feitos, restantes, ms: Date.now() - t0 };
}
