// Embeddings locais (transformers.js, CPU) para a metade semântica da busca híbrida.
//
// Modelo: multilingual-e5-small — 384 dims, treinado para retrieval com assimetria
// query/passagem. Os prefixos "query: " e "passage: " NÃO são decorativos: o modelo foi
// treinado com eles e a qualidade cai sem.
//
// Carregamento é preguiçoso: quem só usa a busca léxica nunca paga os ~14 s de boot do modelo.

const MODELO = "Xenova/multilingual-e5-small";
export const DIMS = 384;
const MAX_CHARS = 3000; // ~750 tokens; o tokenizer trunca em 512 de qualquer forma

type Extractor = (
  texts: string[],
  opts: { pooling: "mean"; normalize: boolean }
) => Promise<{ tolist(): number[][] }>;

let extractorPromise: Promise<Extractor> | null = null;
let pronto = false;

async function getExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      // Sem telemetria e sem tentar baixar de novo o que já está no cache do usuário.
      (env as { allowRemoteModels?: boolean }).allowRemoteModels = true;
      const pipe = await pipeline("feature-extraction", MODELO);
      pronto = true;
      return pipe as unknown as Extractor;
    })();
  }
  return extractorPromise;
}

/** True quando o modelo já está pronto para uso imediato. */
export function jaPronto(): boolean {
  return pronto;
}

/** Dispara a carga do modelo sem bloquear ninguém. Chamado no boot do servidor. */
export function aquecer(): Promise<void> {
  return getExtractor().then(
    () => {
      pronto = true;
    },
    (err) => {
      console.error("[brain] modelo de embeddings indisponivel:", err);
    }
  );
}

function paraFloat32(v: number[]): Float32Array {
  return Float32Array.from(v);
}

/** Vetores de trechos indexados. Prefixo "passage: " conforme o treino do e5. */
export async function embedPassagens(textos: string[]): Promise<Float32Array[]> {
  if (textos.length === 0) return [];
  const extractor = await getExtractor();
  const entrada = textos.map((t) => "passage: " + t.slice(0, MAX_CHARS));
  const saida = await extractor(entrada, { pooling: "mean", normalize: true });
  return saida.tolist().map(paraFloat32);
}

/** Vetor de uma consulta. Prefixo "query: " conforme o treino do e5. */
export async function embedQuery(texto: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const saida = await extractor(["query: " + texto.slice(0, MAX_CHARS)], {
    pooling: "mean",
    normalize: true,
  });
  return paraFloat32(saida.tolist()[0]);
}

/** Vetores já vêm normalizados, então o produto interno é o cosseno. */
export function cosseno(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function paraBlob(v: Float32Array): Uint8Array {
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
}

export function deBlob(b: Uint8Array): Float32Array {
  // Cópia: o buffer vindo do SQLite pode não estar alinhado a 4 bytes.
  const copia = new Uint8Array(b.byteLength);
  copia.set(b);
  return new Float32Array(copia.buffer);
}
