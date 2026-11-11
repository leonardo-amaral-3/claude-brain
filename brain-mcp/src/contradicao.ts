import type { DecisaoRelacionada } from "./memoria.js";

/** O par levado ao juiz. Só o `fato` de cada lado sai do processo (R6). */
export interface ParDecisoes {
  nova: string;
  anterior: string;
}

/** Devolve P(a nova contradiz a anterior) em [0,1] e rejeita em qualquer falha. */
export type JulgarPar = (par: ParDecisoes, signal: AbortSignal) => Promise<number>;

/** O mínimo que o #46 precisa do cliente do #42 (D2, D3). `juizJev.ts` só liga nomes. */
export interface ClienteJev {
  ligado(): boolean | Promise<boolean>;
  /** `probabilidade` é a da resposta dada; `juizJev.ts` converte se o #42 der a de "sim". */
  perguntar(texto: string, signal: AbortSignal): Promise<{ resposta: "sim" | "não"; probabilidade: number } | null>;
}

// 0,70 porque 0,5 é cara ou coroa e a marca precisa ganhar do ruído de "mesmo assunto".
// Provisório até a medição do critério 4.
export const LIMIAR_CONTRADICAO = 0.7;
export const PRAZO_PADRAO_MS = 4000;
// O maior atraso que o `setTimeout` aceita (2^31 - 1). Acima disso o Node dispara em ~1 ms
// (TimeoutOverflowWarning), o julgamento sempre "estoura" e marca nenhuma aparece.
export const PRAZO_MAXIMO_MS = 2147483647;
// Igual ao tamanho da lista de vizinhas de hoje, reafirmado aqui para que ampliar a lista não
// aumente sozinho o que sai do cofre rumo ao Jev.
export const TETO_PARES = 5;

/** Lê o ambiente a cada chamada: só inteiro de 1 a `PRAZO_MAXIMO_MS` vale, o resto volta ao padrão. */
export function prazoJulgamentoMs(): number {
  const bruto = process.env.BRAIN_CONTRADICAO_PRAZO_MS;
  if (bruto === undefined || !/^\d+$/.test(bruto)) return PRAZO_PADRAO_MS;
  const valor = Number(bruto);
  return valor > 0 && valor <= PRAZO_MAXIMO_MS ? valor : PRAZO_PADRAO_MS;
}

export function montarPergunta(par: ParDecisoes): string {
  return (
    `Duas decisões registradas no mesmo cofre de decisões de projeto.\n\n` +
    `Decisão anterior: ${par.anterior}\n\n` +
    `Decisão nova: ${par.nova}\n\n` +
    `A decisão nova contradiz a decisão anterior, isto é, as duas não podem valer ao mesmo tempo?`
  );
}

/**
 * Converte o cliente mínimo do Jev numa função `JulgarPar`. Nunca rejeita: `null` é "Jev desligado
 * ou indisponível". Resposta fora de "sim"/"não" é falha, não palpite — sem normalizar caixa nem
 * acento, porque contrato quebrado não se adivinha.
 */
export async function criarJulgarPar(cliente: ClienteJev): Promise<JulgarPar | null> {
  try {
    if (!(await cliente.ligado())) return null;
  } catch (err) {
    console.error("[brain] contradicao: predicado do Jev falhou:", (err as Error).message);
    return null;
  }
  return async (par, signal) => {
    const resultado = await cliente.perguntar(montarPergunta(par), signal);
    if (resultado === null || resultado === undefined) throw new Error("jev sem resposta");
    const { resposta, probabilidade } = resultado;
    if (typeof probabilidade !== "number" || !Number.isFinite(probabilidade) || probabilidade < 0 || probabilidade > 1) {
      throw new Error(`probabilidade invalida: ${String(probabilidade)}`);
    }
    if (resposta === "sim") return probabilidade;
    if (resposta === "não") return 1 - probabilidade;
    throw new Error(`resposta invalida: ${String(resposta)}`);
  };
}

/**
 * Julga cada vizinha contra a decisão nova. `null` = não julgado (o aviso sai como hoje); `Map`
 * (possivelmente vazio) = julgado, com só as vizinhas ≥ `LIMIAR_CONTRADICAO`. Tudo ou nada: uma
 * vizinha sem marca passaria por "o Jev disse que não" quando ele talvez nem tenha respondido.
 * Nunca rejeita — o `lembrar` já gravou a decisão e um erro aqui faria quem chamou gravar de novo.
 */
export async function julgarContradicoes(
  nova: string,
  vizinhas: DecisaoRelacionada[],
  julgar: JulgarPar | null,
  prazoMs: number = prazoJulgamentoMs()
): Promise<Map<number, number> | null> {
  if (julgar === null || vizinhas.length === 0) return null;
  const candidatas = vizinhas.slice(0, TETO_PARES);
  const controle = new AbortController();
  const inicio = Date.now();
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    const promessas = candidatas.map((v) => {
      // O `then` transforma `throw` síncrono do juiz em rejeição.
      const promessa = Promise.resolve().then(() => julgar({ nova, anterior: v.fato }, controle.signal));
      // Defesa contra refatoração: se o `Promise.all` virar um laço com `await`, a rejeição tardia
      // ficaria sem dono e o Node derrubaria o servidor com `unhandledRejection`.
      promessa.catch(() => {});
      return promessa;
    });
    const prazo = new Promise<never>((_, rejeitar) => {
      temporizador = setTimeout(() => rejeitar(new Error(`prazo de ${prazoMs} ms`)), prazoMs);
    });
    const probabilidades = await Promise.race([Promise.all(promessas), prazo]);
    const marcas = new Map<number, number>();
    probabilidades.forEach((p, i) => {
      if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1) {
        throw new Error(`probabilidade invalida: ${String(p)}`);
      }
      if (p >= LIMIAR_CONTRADICAO) marcas.set(candidatas[i].id, p);
    });
    console.error(
      `[brain] contradicao: ${candidatas.length} pares julgados em ${Date.now() - inicio} ms, ${marcas.size} acima de ${LIMIAR_CONTRADICAO}`
    );
    return marcas;
  } catch (err) {
    controle.abort();
    console.error(`[brain] contradicao: aviso sem marca (${(err as Error).message})`);
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}

/** O aviso do `lembrar`. Sem marca, é byte a byte o formato de antes desta feature. */
export function formatarAviso(vizinhas: DecisaoRelacionada[], marcas: Map<number, number> | null): string {
  if (vizinhas.length === 0) return "";
  return (
    "\n\nJá havia registro sobre o mesmo assunto — confira se alguma contradiz esta e, se sim, " +
    "chame lembrar de novo com supersede:<id>:\n" +
    vizinhas
      .map((d) => {
        const p = marcas?.get(d.id);
        const marca = p === undefined ? "" : ` [contradição provável, Jev ${p.toFixed(2)}]`;
        return `  #${d.id} (${d.data}${d.escopo ? ", " + d.escopo : ""}, semelhança ${d.semelhanca.toFixed(2)})${marca}: ${d.fato}`;
      })
      .join("\n")
  );
}
