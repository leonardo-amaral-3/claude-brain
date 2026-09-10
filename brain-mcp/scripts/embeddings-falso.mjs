// Substituto determinístico de `dist/embeddings.js`, SÓ para scripts/concorrencia.mjs.
// Injetado por embeddings-falso-hook.mjs; nenhum código de produção sabe que ele existe.
//
// Por que existe (emenda 2026-09-09 da spec do card #1): os casos que sobem servidor de verdade
// precisam que um processo SPAWNADO gere embeddings — `Buscador` só toma o caminho semântico
// quando `jaPronto()` é true. O modelo real (Xenova/multilingual-e5-small) tem 470 MB e só está
// cacheado no node_modules da INSTALAÇÃO; com `allowRemoteModels = true`, cada servidor spawnado
// baixaria os 470 MB e pagaria ~15 s, numa suíte que roda a cada task e num repo público.
//
// O que este stub NÃO enfraquece: os vetores são bag-of-words com hashing trick, então texto que
// compartilha termo tem cosseno > 0 e texto sem termo em comum tem cosseno 0. É o suficiente para
// provar que um seguidor RECARREGOU o índice vetorial — que é a propriedade do CA4. A QUALIDADE
// da busca continua provada onde a spec a pôs: `npm run eval` contra o índice real, no ship.

import { appendFileSync } from "node:fs";

export const DIMS = 384;

// Quando o teste aponta BRAIN_STUB_REGISTRO para um arquivo, cada chamada de embedPassagens
// deixa o pid de quem chamou. É a única forma honesta de afirmar "só o LÍDER embutiu": pelo log
// não dá — um processo que chega tarde e não acha trabalho pendente fica calado igualzinho a um
// que respeitou o lease.
const registro = process.env.BRAIN_STUB_REGISTRO;

let pronto = false;

export function jaPronto() {
  return pronto;
}

export function aquecer() {
  pronto = true;
  return Promise.resolve();
}

/**
 * Bag-of-words normalizado por hashing trick. Determinístico entre processos — é isso que permite
 * ao teste embutir de um lado e consultar do outro.
 */
function vetor(texto) {
  const v = new Float32Array(DIMS);
  const tokens = String(texto).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    v[(h >>> 0) % DIMS] += 1;
  }
  // Normaliza: o resto do código trata `cosseno` como produto interno de vetores unitários.
  let norma = 0;
  for (let i = 0; i < DIMS; i++) norma += v[i] * v[i];
  norma = Math.sqrt(norma) || 1;
  for (let i = 0; i < DIMS; i++) v[i] /= norma;
  return v;
}

// Sem os prefixos "query: "/"passage: " do e5: aqui eles só acrescentariam uma dimensão comum a
// tudo, que empurraria todos os cossenos para cima e tornaria o teste menos discriminante.
export async function embedPassagens(textos) {
  if (registro) {
    try {
      appendFileSync(registro, process.pid + "\n");
    } catch {
      /* o teste que se vire sem este lote */
    }
  }
  // Atraso deliberado por lote. Sem ele o stub termina o backfill inteiro antes de o segundo
  // processo sequer olhar, e o caso deixaria de distinguir "o lease barrou" de "chegou tarde".
  await new Promise((r) => setTimeout(r, 25));
  return textos.map(vetor);
}

export async function embedQuery(texto) {
  return vetor(texto);
}

// As três abaixo são cópias literais das de embeddings.ts: são puras, e reimplementá-las aqui
// evita que o hook tenha de importar o módulo real (o que o faria interceptar a si mesmo).
export function cosseno(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function paraBlob(v) {
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
}

export function deBlob(b) {
  const copia = new Uint8Array(b.byteLength);
  copia.set(b);
  return new Float32Array(copia.buffer);
}
