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

  private ultimaVersao = "";

  // versaoAtual: o contador que o lider incrementa a cada mudanca de conteudo. Um seguidor nunca
  // varre e nunca chama marcarSujo(), entao sem este segundo gatilho ele serviria para sempre o
  // indice vetorial que carregou no boot. O padrao (() => "") mantem o comportamento de antes.
  constructor(
    private db: DatabaseSync,
    private versaoAtual: () => string = () => ""
  ) {}

  marcarSujo(): void {
    this.sujo = true;
    this.cacheCobertura = null;
  }

  get tamanho(): number {
    return this.linhas.length;
  }

  private garantirCarregado(): void {
    // Um SELECT numa tabela de uma linha por consulta (microssegundos); a recarga so acontece
    // quando a versao mudou, e custa o mesmo que o marcarSujo() de hoje ja custa.
    const v = this.versaoAtual();
    if (this.carregado && !this.sujo && v === this.ultimaVersao) return;
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
    this.ultimaVersao = v;
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
  opts: {
    limite?: number;
    onProgresso?: (feitos: number, total: number) => void;
    /** Reconferido antes de cada lote: ao perder o lease o backfill para aqui, limpo. */
    aindaSouLider?: () => boolean;
    /**
     * Costura de teste (emenda 2026-09-09). Em producao ninguem passa isto: o padrao e o
     * embedPassagens real. Existe porque o caso `para-ao-perder-o-lease` precisa de um 1o lote
     * completo para provar que o recheque vem ANTES do 2o, e carregar o modelo de verdade
     * custaria download de ~120 MB e ~15 s por rodada num teste que roda a cada task.
     */
    embutir?: (textos: string[]) => Promise<Float32Array[]>;
  } = {}
): Promise<{ feitos: number; restantes: number; ms: number; interrompido: boolean }> {
  const t0 = Date.now();
  const totalPendente = (
    db.prepare("SELECT COUNT(*) n FROM chunks WHERE embedding IS NULL").get() as { n: number }
  ).n;
  const alvo = Math.min(opts.limite ?? Infinity, totalPendente);
  const upd = db.prepare("UPDATE chunks SET embedding = ? WHERE id = ?");
  const embutir = opts.embutir ?? embedPassagens;
  let feitos = 0;
  let interrompido = false;

  while (feitos < alvo) {
    // Antes de gastar o lote, nao depois: perder o lease no meio do backfill nao pode custar uma
    // chamada de embedding a mais. Como o lote so termina no COMMIT, sair aqui nunca deixa chunk
    // pela metade — o proximo lider retoma de onde este parou.
    if (opts.aindaSouLider && !opts.aindaSouLider()) {
      interrompido = true;
      break;
    }
    const lote = db
      .prepare("SELECT id, text FROM chunks WHERE embedding IS NULL LIMIT ?")
      .all(Math.min(LOTE, alvo - feitos)) as unknown as { id: number; text: string }[];
    if (lote.length === 0) break;

    const vetores = await embutir(lote.map((c) => c.text));
    db.exec("BEGIN IMMEDIATE");
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
  return { feitos, restantes, ms: Date.now() - t0, interrompido };
}
