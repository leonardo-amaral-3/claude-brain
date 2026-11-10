// Roteador de source: antes da busca, pergunta ao Jev em qual fonte do índice o documento deve
// estar e, com confiança suficiente, restringe a busca a ela.
//
// Por que um módulo à parte: o escolhedor entra por injeção (`EscolherFonte`), e assim o
// comportamento todo (limiar, teto, queda para a busca como veio) é testável com um Jev falso e
// sem rede. O único código que conhece o cliente do Jev é o adaptador `escolherFonteJev`.
//
// Regra de ouro: toda falha cai para a busca como veio. O roteador nunca lança por causa do Jev,
// nunca escreve nos filtros que recebeu e nunca recebe os `args` da tool (a tabela `uso` grava o
// que chegou, e o filtro do roteador não pode vazar para ela nem para o golden set).
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { packageRoot } from "./config.js";
import type { Filtros, Resultado, Diagnostico } from "./search.js";

/** O pedaço do contrato do cliente que o roteador usa: os tipos ficam numa interface local. */
interface ClienteJev {
  decidir(
    estado: string,
    perguntas: Record<string, { tipo: "escolha"; instrucao: string; opcoes: Record<string, string> }>,
    opcoes: { uso: typeof USO_ROTEADOR; timeoutMs: number }
  ): Promise<Record<string, unknown>>;
}

/** Escolha já validada contra a forma de saída do cliente. `null` = indisponível. */
export type EscolhaDeFonte = { opcao: string; probabilidade: number } | null;
/** estado = a query já cortada; opcoes = nome → descrição; orcamentoMs = o teto do roteador. */
export type EscolherFonte = (
  estado: string,
  opcoes: Readonly<Record<string, string>>,
  orcamentoMs: number
) => Promise<EscolhaDeFonte>;

export const USO_ROTEADOR = "roteador";
export const LIMIAR_ROTEADOR = 0.8;
export const TETO_ROTEADOR_MS = 1000;
export const QUALQUER = "qualquer";
const MAX_QUERY = 500;

export const INSTRUCAO_ROTEADOR =
  "O estado é a consulta que uma sessão do Claude Code fez ao índice de contexto de um workspace de software. Em qual fonte do índice está, mais provavelmente, o documento que responde a ela?";

const DESCRICAO: Record<string, string> = {
  planning: "specs, PRDs e tasks de cards",
  docs: "documentação dos repositórios",
  diario: "diário das sessões do Claude Code",
  memoria: "notas de memória do Claude Code",
  mapa: "mapas de arquitetura dos repositórios",
  notas: "notas soltas",
  code: "código-fonte dos repositórios",
  github: "cards (issues) e PRs do GitHub, com comentários",
  decisao: "decisões registradas durante as sessões",
  git: "mensagens de commit",
  [QUALQUER]: "a resposta pode estar em mais de uma fonte, ou em nenhuma em particular",
};

/**
 * Ligado quando `roteador` está na lista de `BRAIN_JEV` (separada por vírgula, sem curinga). É a
 * mesma leitura do cliente, feita aqui para conferir o uso ANTES de carregá-lo. Sem I/O.
 * Ligar manda a query ao Jev quando houver chave, o que exige o aval do Leonardo.
 */
export function roteadorLigado(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.BRAIN_JEV ?? "")
    .split(",")
    .some((u) => u.trim().toLowerCase() === USO_ROTEADOR);
}

/** A query cortada em 500 code points (não parte um par surrogate). Vai como string. */
export function estadoDoRoteador(query: string): string {
  return Array.from(query.trim()).slice(0, MAX_QUERY).join("");
}

/**
 * Uma entrada por fonte, na ordem recebida, e `qualquer` sempre por último. A lista de fontes vai
 * só aqui: o Jev a recebe como os critérios da escolha, e repeti-la no estado criaria duas
 * verdades para a mesma lista.
 */
export function opcoesDoRoteador(fontes: readonly string[]): Record<string, string> {
  const opcoes: Record<string, string> = {};
  for (const f of fontes) opcoes[f] = DESCRICAO[f] ?? f;
  opcoes[QUALQUER] = DESCRICAO[QUALQUER];
  return opcoes;
}

/**
 * Primeiro caminho existente: o `hooks/` ao lado do pacote (repo ou worktree) e só depois o da
 * instalação. É o que faz a suíte de uma worktree testar o cliente da worktree. Os padrões são
 * avaliados a cada chamada, então o ambiente é lido na hora.
 */
export function caminhoDoJev(
  raiz: string = packageRoot,
  claudeHome: string = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"),
  existe: (p: string) => boolean = existsSync
): string | null {
  const candidatos = [join(raiz, "..", "hooks", "jev.js"), join(claudeHome, "hooks", "jev.js")];
  return candidatos.find((c) => existe(c)) ?? null;
}

/**
 * Lê a resposta da pergunta `fonte`. Só devolve escolha quando a forma é a de uma resposta `ok`
 * do tipo `escolha`. Não valida limiar nem pertencimento à lista: isso é do `rotear`, para que o
 * Jev falso dos testes passe pelas mesmas regras.
 */
export function paraEscolha(saida: unknown): EscolhaDeFonte {
  const r = (saida as { fonte?: unknown } | null | undefined)?.fonte as
    | { estado?: unknown; tipo?: unknown; escolha?: unknown; confianca?: unknown }
    | null
    | undefined;
  if (r == null || typeof r !== "object") return null;
  if (r.estado !== "ok" || r.tipo !== "escolha") return null;
  if (typeof r.escolha !== "string" || typeof r.confianca !== "number") return null;
  return { opcao: r.escolha, probabilidade: r.confianca };
}

// Sem cache próprio: o `require` já guarda o módulo, e o `existsSync` custa microssegundos. Um
// cliente instalado depois do boot é achado sem reiniciar; um atualizado só vale numa sessão nova.
function carregarJev(): unknown {
  const c = caminhoDoJev();
  return c ? createRequire(import.meta.url)(c) : null;
}

export function criarEscolherFonteJev(carregar: () => unknown = carregarJev): EscolherFonte {
  return async (estado, opcoes, orcamentoMs) => {
    try {
      const jev = carregar() as ClienteJev | null | undefined;
      if (jev == null || typeof jev !== "object" || typeof jev.decidir !== "function") return null;
      const saida = await jev.decidir(
        estado,
        { fonte: { tipo: "escolha", instrucao: INSTRUCAO_ROTEADOR, opcoes: { ...opcoes } } },
        { uso: USO_ROTEADOR, timeoutMs: orcamentoMs }
      );
      return paraEscolha(saida);
    } catch {
      return null;
    }
  };
}

export const escolherFonteJev: EscolherFonte = criarEscolherFonteJev();

export async function rotear(
  query: string,
  filtros: Filtros,
  limit: number,
  deps: {
    ligado: boolean;
    fontes: readonly string[];
    escolher: EscolherFonte;
    buscar: (q: string, f: Filtros, l: number) => Promise<{ resultados: Resultado[]; diag: Diagnostico }>;
    tetoMs?: number; // padrão TETO_ROTEADOR_MS; só os testes passam outro
    limiar?: number; // padrão LIMIAR_ROTEADOR; só os testes passam outro
  }
): Promise<{ resultados: Resultado[]; diag: Diagnostico; roteado: string | null }> {
  const comoVeio = async () => ({ ...(await deps.buscar(query, filtros, limit)), roteado: null });
  if (!deps.ligado || filtros.source) return comoVeio();

  const teto = deps.tetoMs ?? TETO_ROTEADOR_MS;
  const limiar = deps.limiar ?? LIMIAR_ROTEADOR;
  const opcoes = opcoesDoRoteador(deps.fontes);

  // `Promise.resolve().then` faz um `throw` síncrono do escolhedor virar rejeição. A promessa que
  // perde a corrida fica com o `catch` pendurado e nunca vira `unhandledRejection`.
  const escolha = Promise.resolve()
    .then(() => deps.escolher(estadoDoRoteador(query), opcoes, teto))
    .catch(() => null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const estouro = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), teto);
  });
  const e: unknown = await Promise.race([escolha, estouro]).finally(() => clearTimeout(timer));

  const c = e as { opcao?: unknown; probabilidade?: unknown } | null | undefined;
  if (
    c == null ||
    typeof c !== "object" ||
    typeof c.opcao !== "string" ||
    typeof c.probabilidade !== "number" ||
    !Number.isFinite(c.probabilidade) ||
    c.probabilidade < limiar ||
    c.probabilidade > 1 ||
    c.opcao === QUALQUER ||
    !deps.fontes.includes(c.opcao)
  ) {
    return comoVeio();
  }

  // Uma cópia: `filtros` nunca é escrito.
  const r = await deps.buscar(query, { ...filtros, source: c.opcao }, limit);
  if (r.resultados.length > 0) return { ...r, roteado: c.opcao };
  return comoVeio();
}
