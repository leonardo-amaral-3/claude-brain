// Construtores das fixtures da secao Ganho: eventos `contexto` e transcripts sinteticos, no formato
// do contrato da spec do epico #66 e do que o Claude Code grava (P6, P16). Caminhos ficticios.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const T0 = Date.parse("2026-11-24T12:00:00.000Z");
const iso = (ms) => new Date(ms).toISOString();

export const prompt = (promptId, texto, ms, extra = {}) => ({
  type: "user", promptId, timestamp: iso(ms), message: { role: "user", content: texto }, ...extra,
});
export const meta = (promptId, texto, ms) => prompt(promptId, texto, ms, { isMeta: true });
export const toolResult = (promptId, ms) => ({
  type: "user", promptId, timestamp: iso(ms),
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "ok" }] },
});
export const usa = (nome, input, ms, extra = {}) => ({
  type: "assistant", timestamp: iso(ms),
  message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_" + ms, name: nome, input }] }, ...extra,
});
export const diz = (texto, ms, extra = {}) => ({
  type: "assistant", timestamp: iso(ms), message: { role: "assistant", content: [{ type: "text", text: texto }] }, ...extra,
});

export const item = (caminho, pos, mostrado = true, extra = {}) => ({
  caminho, fonte: "planning", pos, chunk: null, trecho_sha: null, prob: null, mostrado, ...extra,
});

export function contexto(sobre = {}) {
  return {
    v: 1, ts: T0, evento: "contexto", sessao: "sA", prompt: "p", ws: "pessoal", tipo: "texto", comando: null,
    alvo_chars: 40, alvo_tokens: 6, desfecho: "injetado", entidade: null, candidatos: 3, jev: "ok", jev_motivo: null,
    grupo: null, enviados: 3, aprovados: 2, limiar: 0.5, mostrados: 1, itens: [], ms_busca: 80, ms_jev: 300,
    ms_total: 400, erro: null, ...sobre,
  };
}

/** Escreve `<projetos>/<dir>/<sessao>.jsonl`. */
export function transcript(projetos, dir, sessao, entradas) {
  const arq = join(projetos, dir, `${sessao}.jsonl`);
  mkdirSync(dirname(arq), { recursive: true });
  writeFileSync(arq, entradas.map((e) => JSON.stringify(e)).join("\n") + "\n");
}
