// Painel de telemetria do brain (claude-brain#66): agregador. Le o diario de eventos do periodo e
// imprime as secoes que existirem em scripts/painel/ — `saude` (F1), `ganho` (F2), `prova` (F3). Secao
// ausente vira uma linha "nao instalada", e e isso que deixa as tres fases mergearem em qualquer ordem.
//
//   npm run painel                                  ultimos 7 dias
//   npm run painel -- --dias N                      ultimos N dias
//   npm run painel -- --desde AAAA-MM-DD --ate AAAA-MM-DD    datas UTC; `--ate` inclui o dia inteiro
//   npm run painel -- --amostrar N [--semente <texto>] [--ws <nome>]   sorteia a amostra do gabarito (F3)
//   npm run painel -- --julgar <arquivo>            julga a amostra no terminal (F3)
//
// Codigos: 0 ok · 1 alguma secao falhou · 2 nada para ler, argumento invalido ou secao da F3 ausente.
//
// Interface de secao (contrato entre as fases): `painel/<nome>.mjs` exporta
// `async function secao(ctx) -> string`. `ctx` e o objeto montado em `montarCtx` abaixo.
// A saida de toda secao so traz contagens, percentuais, nomes de `uso`, desfechos e motivos (R1):
// nunca caminho nem texto de prompt.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirPadrao, lerEventos } from "./painel/eventos.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), ".."); // brain-mcp/
const DIA_MS = 86400000;
const SECOES = ["saude", "ganho", "prova"];
const UTC = /^\d{4}-\d{2}-\d{2}$/;

class ArgumentoInvalido extends Error {}

/** Data AAAA-MM-DD (UTC) -> ms do inicio do dia; recusa data que nao existe (2026-02-31). */
function inicioDoDia(texto, nome) {
  const ms = UTC.test(texto) ? Date.parse(`${texto}T00:00:00Z`) : NaN;
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== texto) throw new ArgumentoInvalido(`${nome} espera uma data AAAA-MM-DD, veio ${JSON.stringify(texto)}`);
  return ms;
}

/** argv -> { dias, desde, ate, amostrar, julgar, semente, ws, argv }. Desconhecido ou sem valor = ArgumentoInvalido. */
function lerArgumentos(argv) {
  const COM_VALOR = new Set(["--dias", "--desde", "--ate", "--amostrar", "--julgar", "--semente", "--ws"]);
  const a = { dias: undefined, desde: undefined, ate: undefined, amostrar: undefined, julgar: undefined, semente: undefined, ws: undefined, argv: [...argv] };
  for (let i = 0; i < argv.length; i++) {
    const nome = argv[i];
    if (!COM_VALOR.has(nome)) throw new ArgumentoInvalido(`argumento desconhecido: ${nome}`);
    const valor = argv[++i];
    if (valor === undefined || valor.startsWith("--")) throw new ArgumentoInvalido(`${nome} espera um valor`);
    a[nome.slice(2)] = valor;
  }
  if (a.dias !== undefined && (a.desde !== undefined || a.ate !== undefined)) throw new ArgumentoInvalido("use --dias ou --desde/--ate, nao os dois");
  if ((a.desde === undefined) !== (a.ate === undefined)) throw new ArgumentoInvalido("--desde e --ate vao juntos");
  if (a.amostrar !== undefined && a.julgar !== undefined) throw new ArgumentoInvalido("--amostrar e --julgar nao vao juntos");
  if (a.dias !== undefined) {
    const n = Number(a.dias);
    if (!Number.isFinite(n) || n <= 0) throw new ArgumentoInvalido(`--dias espera um numero maior que zero, veio ${JSON.stringify(a.dias)}`);
    a.dias = n;
  }
  if (a.amostrar !== undefined) {
    const n = Number(a.amostrar);
    if (!Number.isInteger(n) || n <= 0) throw new ArgumentoInvalido(`--amostrar espera um inteiro maior que zero, veio ${JSON.stringify(a.amostrar)}`);
    a.amostrar = n;
  }
  return a;
}

/** [desde, ate) em ms. `--ate` inclui o dia inteiro; sem datas, os ultimos `dias` (padrao 7) ate `agora`. */
function periodo(a, agora) {
  if (a.desde !== undefined) {
    const desde = inicioDoDia(a.desde, "--desde");
    const ate = inicioDoDia(a.ate, "--ate") + DIA_MS;
    if (desde >= ate) throw new ArgumentoInvalido("--desde vem depois de --ate");
    return { desde, ate };
  }
  return { desde: agora - (a.dias ?? 7) * DIA_MS, ate: agora };
}

/** `node:sqlite` somente leitura, ou null se nao ha banco (o mesmo par de uso.mjs: BRAIN_DB ou data/brain.db). */
async function abrirDb(env) {
  const arquivo = env.BRAIN_DB || join(raiz, "data", "brain.db");
  if (!existsSync(arquivo)) return null;
  try {
    const { DatabaseSync } = await import("node:sqlite");
    return new DatabaseSync(arquivo, { readOnly: true });
  } catch {
    return null;
  }
}

const urlDaSecao = (secoesDir, nome) => new URL(`${nome}.mjs`, secoesDir instanceof URL ? secoesDir : pathToFileURL(String(secoesDir).endsWith(sep) ? secoesDir : secoesDir + sep));

/**
 * @param {{ argv: string[], secoesDir: URL | string, env: Record<string, string | undefined> }} opcoes
 * @returns {Promise<{ codigo: number, saida: string }>}
 */
export async function rodar({ argv, secoesDir, env }) {
  let a;
  let janela;
  const agora = Date.now();
  try {
    a = lerArgumentos(argv);
    janela = periodo(a, agora);
  } catch (e) {
    if (!(e instanceof ArgumentoInvalido)) throw e;
    return { codigo: 2, saida: e.message };
  }
  const { desde, ate } = janela;
  const dir = dirPadrao(env);
  const claudeHome = env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
  const lidos = lerEventos({ dir, desde, ate });
  const db = await abrirDb(env);

  const carregarSecao = async (nome) => {
    const url = urlDaSecao(secoesDir, nome);
    if (!existsSync(fileURLToPath(url))) return null;
    return import(url.href);
  };
  const ctx = {
    eventos: lidos.eventos,
    invalidas: lidos.invalidas,
    outraVersao: lidos.outraVersao,
    desde,
    ate,
    agora,
    dir,
    claudeHome,
    projetos: join(claudeHome, "projects"),
    db,
    args: a,
    lerEventos: ({ desde: d, ate: t }) => lerEventos({ dir, desde: d, ate: t }),
    carregarSecao,
  };

  try {
    // --amostrar e --julgar entregam o trabalho a F3 e nao passam pela regra de periodo vazio.
    if (a.amostrar !== undefined || a.julgar !== undefined) {
      let prova;
      try {
        prova = await carregarSecao("prova");
      } catch (e) {
        return { codigo: 1, saida: `(prova: falhou — ${e?.name ?? "Error"})` };
      }
      if (!prova) return { codigo: 2, saida: "seção prova não instalada" };
      try {
        const r = a.amostrar !== undefined ? await prova.amostrar(ctx, a.amostrar, a.semente) : await prova.julgar(ctx, a.julgar);
        return { codigo: r.codigo, saida: r.linhas.join("\n") };
      } catch (e) {
        return { codigo: 1, saida: `(prova: falhou — ${e?.name ?? "Error"})` };
      }
    }

    const dia = (ms) => new Date(ms).toISOString().slice(0, 10);
    const periodoTexto = `${dia(desde)} a ${dia(ate - 1)} (UTC)`;
    if (!lidos.eventos.length) {
      const motivo = existsSync(dir) ? "não há evento no período" : "o diário de telemetria não existe";
      return { codigo: 2, saida: `Telemetria, ${periodoTexto}: ${motivo}. Ligue com BRAIN_TELEMETRIA=1 no ambiente e reinicie as sessões.` };
    }
    const tipos = new Map();
    for (const e of lidos.eventos) tipos.set(e.evento, (tipos.get(e.evento) ?? 0) + 1);
    const porTipo = ["contexto", "jev"].filter((t) => tipos.has(t)).map((t) => `${t} ${tipos.get(t)}`);
    const outros = lidos.eventos.length - [...tipos].filter(([t]) => t === "contexto" || t === "jev").reduce((s, [, c]) => s + c, 0);
    const partes = [`Telemetria, ${periodoTexto}`, `  eventos: ${porTipo.join(" · ")}${outros ? ` · outros ${outros}` : ""}`, `  linhas inválidas: ${lidos.invalidas} · de outra versão (ignoradas): ${lidos.outraVersao}`];

    let codigo = 0;
    for (const nome of SECOES) {
      partes.push("");
      let modulo;
      try {
        modulo = await carregarSecao(nome);
      } catch (e) {
        partes.push(`(${nome}: falhou — ${e?.name ?? "Error"})`);
        codigo = 1;
        continue;
      }
      if (!modulo) {
        partes.push(`(${nome}: seção não instalada)`);
        continue;
      }
      try {
        partes.push(String(await modulo.secao(ctx)));
      } catch (e) {
        partes.push(`(${nome}: falhou — ${e?.name ?? "Error"})`);
        codigo = 1;
      }
    }
    return { codigo, saida: partes.join("\n") };
  } finally {
    try {
      db?.close();
    } catch {
      /* ja fechado */
    }
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { codigo, saida } = await rodar({ argv: process.argv.slice(2), secoesDir: new URL("./painel/", import.meta.url), env: process.env });
  process.stdout.write(saida + "\n");
  process.exitCode = codigo;
}
