// Testes e medicoes da telemetria do brain (claude-brain#66, F1).
//
//   node scripts/telemetria.mjs                 roda todos os casos
//   node scripts/telemetria.mjs --caso gravador roda um caso
//   node scripts/telemetria.mjs --custo         o portao do CA4: o hook ligado nao custa mais de 20 ms
//   node scripts/telemetria.mjs --conferir --dias N   cobertura do diario sobre os transcripts (G5)
//
// Codigos: 0 passou, 1 reprovou, 2 nao medi (sem indice, sem brain-workspaces.json). Como injecao.mjs
// e eval.mjs.
//
// Isolamento (R4): nenhum caso grava no diario vivo (~/.claude/brain-telemetria). Todo caso usa um
// diretorio temporario em BRAIN_TELEMETRIA_DIR, e todo filho que um caso subir parte de
// `envSemJev(process.env)` (que tira BRAIN_JEV*, BRAIN_TELEMETRIA* e a chave) e acrescenta so as
// variaveis do caso. Assim um BRAIN_TELEMETRIA_AB ou BRAIN_TELEMETRIA_DIR exportado no shell nao
// muda o resultado de teste nenhum. A unica excecao e o caso `poluicao`, que de proposito passa
// BRAIN_TELEMETRIA=1 ao ambiente das suites para provar que elas se protegem sozinhas.
//
// A saida so traz contagens e nomes de caso (R1): nunca caminho de prompt nem texto.
//
// Modos: `--custo` (o portao do CA4, parte 2) e `--conferir --dias N` (a G5: cobertura do diario sobre
// os transcripts). Nao ha stub que passe: caso que nao existe nao e listado.
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lerEventos } from "./painel/eventos.mjs";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), ".."); // brain-mcp/
const repo = join(root, ".."); // raiz do repo
const require = createRequire(import.meta.url);
const DIA_MS = 86400000;

// ---------------------------------------------------------------- ambiente dos filhos

/**
 * O cliente do Jev do repo (com a lista do que sai do ambiente). Via `semJev`, que resolve repo e
 * depois instalacao, mas aqui o caso e sempre o do repo: o que se testa e o que vai ser commitado.
 * @returns {{ envSemJev: (env: object) => object }}
 */
function clienteDoRepo() {
  const caminho = join(repo, "hooks", "jev.js");
  const cliente = require(caminho);
  if (typeof cliente.envSemJev !== "function") throw new Error("hooks/jev.js sem envSemJev");
  return cliente;
}

/** Ambiente-base de todo filho: o do shell sem Jev e sem telemetria, mais o que o caso acrescentar. */
export function envDoFilho(extra = {}) {
  return { ...clienteDoRepo().envSemJev(process.env), ...extra };
}

// ---------------------------------------------------------------- infraestrutura de caso

function novoTmp(prefixo) {
  return fs.mkdtempSync(join(os.tmpdir(), `${prefixo}-`));
}

function verificador() {
  const falhas = [];
  let n = 0;
  return {
    ok(cond, msg) {
      n++;
      if (!cond) falhas.push(msg);
    },
    igual(real, esperado, msg) {
      n++;
      if (JSON.stringify(real) !== JSON.stringify(esperado)) {
        falhas.push(`${msg}: esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(real)}`);
      }
    },
    get falhas() {
      return falhas;
    },
    get n() {
      return n;
    },
  };
}

/** Roda `fn` e confere que nada foi escrito em stdout nem stderr do proprio processo. */
function semSaida(fn) {
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  let escrito = 0;
  process.stdout.write = (...a) => ((escrito += String(a[0]).length), true);
  process.stderr.write = (...a) => ((escrito += String(a[0]).length), true);
  try {
    return { retorno: fn(), escrito };
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
  }
}

// ---------------------------------------------------------------- caso: gravador

/** Unidade de hooks/telemetria.js num diretorio temporario. */
async function casoGravador() {
  const v = verificador();
  const tele = require(join(repo, "hooks", "telemetria.js"));
  const tmp = novoTmp("telemetria-gravador");
  try {
    // ligada(): as quatro combinacoes de BRAIN_TELEMETRIA / BRAIN_JEV_FALSO / BRAIN_TELEMETRIA_DIR.
    v.igual(tele.ligada({}), false, "ligada sem BRAIN_TELEMETRIA");
    v.igual(tele.ligada({ BRAIN_TELEMETRIA: "0" }), false, "ligada com BRAIN_TELEMETRIA=0");
    v.igual(tele.ligada({ BRAIN_TELEMETRIA: "1" }), true, "ligada so com BRAIN_TELEMETRIA=1");
    v.igual(
      tele.ligada({ BRAIN_TELEMETRIA: "1", BRAIN_JEV_FALSO: "sim" }),
      false,
      "o falso do Jev desliga sem BRAIN_TELEMETRIA_DIR",
    );
    v.igual(
      tele.ligada({ BRAIN_TELEMETRIA: "1", BRAIN_JEV_FALSO: "sim", BRAIN_TELEMETRIA_DIR: "" }),
      false,
      "o falso do Jev desliga com BRAIN_TELEMETRIA_DIR vazia",
    );
    v.igual(
      tele.ligada({ BRAIN_TELEMETRIA: "1", BRAIN_JEV_FALSO: "sim", BRAIN_TELEMETRIA_DIR: tmp }),
      true,
      "o falso com BRAIN_TELEMETRIA_DIR liga",
    );
    v.igual(tele.ligada({ BRAIN_TELEMETRIA: "1", BRAIN_TELEMETRIA_DIR: tmp }), true, "DIR sem o falso liga");

    // dirTelemetria() e arquivoDoDia().
    v.igual(tele.dirTelemetria({ BRAIN_TELEMETRIA_DIR: tmp }), tmp, "dirTelemetria usa BRAIN_TELEMETRIA_DIR");
    v.igual(
      tele.dirTelemetria({ CLAUDE_CONFIG_DIR: "/x/claude" }),
      join("/x/claude", "brain-telemetria"),
      "dirTelemetria cai em CLAUDE_CONFIG_DIR",
    );
    v.igual(
      tele.dirTelemetria({ CLAUDE_CONFIG_DIR: "/x/claude", BRAIN_TELEMETRIA_DIR: "" }),
      join("/x/claude", "brain-telemetria"),
      "BRAIN_TELEMETRIA_DIR vazia e ignorada",
    );
    const ts = Date.UTC(2026, 10, 24, 23, 59, 59);
    v.igual(
      tele.arquivoDoDia(ts, { BRAIN_TELEMETRIA_DIR: tmp }),
      join(tmp, "eventos-2026-11-24.jsonl"),
      "arquivoDoDia usa a data UTC",
    );
    v.igual(
      tele.arquivoDoDia(ts + 1000, { BRAIN_TELEMETRIA_DIR: tmp }),
      join(tmp, "eventos-2026-11-25.jsonl"),
      "arquivoDoDia vira o dia na meia-noite UTC",
    );

    // gravar(): desligada nao grava e nao cria o diretorio.
    const dirDesligada = join(tmp, "desligada");
    v.igual(tele.gravar({ ts, evento: "contexto" }, { BRAIN_TELEMETRIA_DIR: dirDesligada }), false, "gravar desligada");
    v.ok(!fs.existsSync(dirDesligada), "gravar desligada nao cria o diretorio");

    // gravar(): `v` primeiro, uma linha, terminada em \n, sem stdout/stderr.
    const dir = join(tmp, "diario");
    const env = { BRAIN_TELEMETRIA: "1", BRAIN_TELEMETRIA_DIR: dir };
    const r = semSaida(() => tele.gravar({ ts, evento: "contexto", sessao: "s-1", prompt: "p-1" }, env));
    v.igual(r.retorno, true, "gravar ligada devolve true");
    v.igual(r.escrito, 0, "gravar nao escreve em stdout/stderr");
    const arq = join(dir, "eventos-2026-11-24.jsonl");
    const texto = fs.readFileSync(arq, "utf8");
    v.ok(texto.endsWith("\n") && texto.split("\n").length === 2, "uma linha terminada em \\n");
    v.igual(Object.keys(JSON.parse(texto))[0], "v", "`v` e a primeira chave");
    v.igual(JSON.parse(texto).v, 1, "v = 1");
    // `v` do chamador nao vence o do gravador.
    tele.gravar({ v: 99, ts, evento: "jev" }, env);
    const ultima = fs.readFileSync(arq, "utf8").trim().split("\n").pop();
    v.igual(JSON.parse(ultima).v, 1, "v do chamador nao sobrescreve");
    v.igual(Object.keys(JSON.parse(ultima))[0], "v", "`v` continua primeiro com v do chamador");

    // Corte de MAX_LINHA: contexto perde `itens`, jev perde `notas`, os dois ganham cortado: true.
    const grande = "x".repeat(200);
    const itens = Array.from({ length: 80 }, (_, i) => ({ caminho: `/w/${grande}${i}.md`, pos: i + 1 }));
    tele.gravar({ ts, evento: "contexto", itens, mostrados: 3 }, env);
    tele.gravar({ ts, evento: "jev", notas: Array.from({ length: 4000 }, () => 0.123456), itens: 7 }, env);
    const linhas = fs.readFileSync(arq, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const ctxCortado = linhas[2];
    const jevCortado = linhas[3];
    v.ok(ctxCortado.cortado === true && !("itens" in ctxCortado), "contexto grande: sem itens, cortado: true");
    v.igual(ctxCortado.mostrados, 3, "o corte preserva os demais campos do contexto");
    v.ok(jevCortado.cortado === true && !("notas" in jevCortado), "jev grande: sem notas, cortado: true");
    v.igual(jevCortado.itens, 7, "o corte do jev nao tira `itens` (que ali e um inteiro)");
    v.ok(Buffer.byteLength(JSON.stringify(ctxCortado), "utf8") <= tele.MAX_LINHA, "a linha cortada cabe em MAX_LINHA");
    // Linha que cabe nao e tocada.
    tele.gravar({ ts, evento: "contexto", itens: [{ caminho: "/w/a.md", pos: 1 }] }, env);
    const pequena = fs.readFileSync(arq, "utf8").trim().split("\n").pop();
    v.ok(!pequena.includes("cortado") && pequena.includes("/w/a.md"), "linha pequena nao e cortada");

    // Retencao: so o de hoje-91 some, so quando o arquivo do dia e CRIADO.
    const dirR = join(tmp, "retencao");
    fs.mkdirSync(join(dirR, "gabarito"), { recursive: true });
    const hojeTs = Date.UTC(2026, 10, 24, 12, 0, 0);
    const nomeDe = (dias) => `eventos-${new Date(hojeTs - dias * DIA_MS).toISOString().slice(0, 10)}.jsonl`;
    for (const dias of [91, 90, 89]) fs.writeFileSync(join(dirR, nomeDe(dias)), "{}\n");
    fs.writeFileSync(join(dirR, "outro.txt"), "x");
    fs.writeFileSync(join(dirR, "gabarito", "amostra-20200101-0000.jsonl"), "{}\n");
    const envR = { BRAIN_TELEMETRIA: "1", BRAIN_TELEMETRIA_DIR: dirR };
    // Arquivo do dia ja existe: nao varre.
    fs.writeFileSync(join(dirR, nomeDe(0)), "");
    tele.gravar({ ts: hojeTs, evento: "contexto" }, envR);
    v.ok(fs.existsSync(join(dirR, nomeDe(91))), "o arquivo do dia ja existia: a retencao nao varre");
    // Arquivo do dia novo: varre.
    fs.unlinkSync(join(dirR, nomeDe(0)));
    tele.gravar({ ts: hojeTs, evento: "contexto" }, envR);
    v.ok(!fs.existsSync(join(dirR, nomeDe(91))), "hoje-91 sai na criacao do arquivo do dia");
    v.ok(fs.existsSync(join(dirR, nomeDe(90))), "hoje-90 fica");
    v.ok(fs.existsSync(join(dirR, nomeDe(89))), "hoje-89 fica");
    v.ok(fs.existsSync(join(dirR, "outro.txt")), "outro.txt nunca e tocado");
    v.ok(fs.existsSync(join(dirR, "gabarito", "amostra-20200101-0000.jsonl")), "gabarito/ nunca e tocado");

    // Destino indisponivel: BRAIN_TELEMETRIA_DIR e um arquivo comum.
    const arquivoComum = join(tmp, "arquivo-comum");
    fs.writeFileSync(arquivoComum, "x");
    const indisponivel = semSaida(() =>
      tele.gravar({ ts, evento: "contexto" }, { BRAIN_TELEMETRIA: "1", BRAIN_TELEMETRIA_DIR: arquivoComum }),
    );
    v.igual(indisponivel.retorno, false, "destino indisponivel devolve false, sem excecao");
    v.igual(indisponivel.escrito, 0, "destino indisponivel nao escreve nada");
    v.igual(fs.readFileSync(arquivoComum, "utf8"), "x", "o arquivo comum fica como estava");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return v;
}

// ---------------------------------------------------------------- hook de verdade

/** "Nao medi": o ambiente nao deixa medir (sem indice, sem config, sem prompt que sirva). Codigo 2. */
class NaoMedi extends Error {}

const HOOK = join(repo, "hooks", "brain-contexto.js");
const FALSO_SIM = { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: "sim" };
const FALSO_NAO = { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: "nao" };
const TIMEOUT_HOOK = 15000; // o harness da 10 s ao hook; aqui e so rede contra travar a rodada

/**
 * Um spawn do hook, com o JSON do UserPromptSubmit na stdin (ou `stdin` cru). O env parte do
 * `envSemJev(process.env)` (sem Jev, sem BRAIN_TELEMETRIA*, sem BRAIN_HOOK_DEBUG) e leva so o do caso.
 * @returns {Promise<{ codigo: number|null, stdout: string, stderr: string, ms: number }>}
 */
function rodarHook({ hook = HOOK, prompt, payload, stdin, env = {}, cwd = repo }) {
  return new Promise((resolver) => {
    const ambiente = envDoFilho(env);
    delete ambiente.BRAIN_HOOK_DEBUG;
    const entrada =
      stdin ?? JSON.stringify({ hook_event_name: "UserPromptSubmit", cwd, session_id: "sessao-teste", prompt_id: "prompt-teste", prompt, ...payload });
    const inicio = Date.now();
    const proc = spawn(process.execPath, [hook], { env: ambiente, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const corte = setTimeout(() => proc.kill("SIGKILL"), TIMEOUT_HOOK);
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("close", (codigo) => {
      clearTimeout(corte);
      resolver({ codigo, stdout, stderr, ms: Date.now() - inicio });
    });
    proc.stdin.end(entrada);
  });
}

/** Linhas do diario temporario, em ordem de gravacao (arquivos por nome). */
function lerDiario(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => /^eventos-.*\.jsonl$/.test(n))
    .sort()
    .flatMap((n) => fs.readFileSync(join(dir, n), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
}

/** Pre-voo do hook (o mesmo de injecao.mjs): sem config, indice ou dist/ o "nao injetou" nao prova nada. */
function preVoo() {
  const cfg = require(join(repo, "hooks", "brain-config.js")).carregar();
  if (!cfg) throw new NaoMedi("sem lista de workspaces utilizavel (brain-workspaces.json)");
  if (!cfg.db || !fs.existsSync(cfg.db)) throw new NaoMedi(`indice nao encontrado: ${cfg.db || "(chave db ausente)"}`);
  const dist = join(dirname(cfg.db), "..", "dist");
  for (const modulo of ["db.js", "search.js"]) {
    if (!fs.existsSync(join(dist, modulo))) throw new NaoMedi(`${join(dist, modulo)} nao existe: o hook importa o dist/ da instalacao`);
  }
  return { db: cfg.db, dist };
}

/**
 * Escolhe, contra o indice vivo, um prompt de cada tipo: um slash que resolve entidade, um texto que
 * injeta pelo passo 5 (com o falso `sim`) e um curto. Nao achou = nao medi, como injecao.mjs.
 */
async function escolherPrompts() {
  preVoo();
  const tmp = novoTmp("telemetria-prompts");
  try {
    const desfechoDe = async (prompt, env) => {
      const dir = join(tmp, String(Math.random()).slice(2));
      await rodarHook({ prompt, env: { ...env, BRAIN_TELEMETRIA: "1", BRAIN_TELEMETRIA_DIR: dir } });
      return lerDiario(dir).find((l) => l.evento === "contexto")?.desfecho;
    };
    let entidade;
    for (const c of ["/gm-spec #42", "/gm-spec #45", "/gm-card #66", "/gm-implement #67"]) {
      if ((await desfechoDe(c, {})) === "entidade") {
        entidade = c;
        break;
      }
    }
    let texto;
    for (const c of ["como o hook de contexto filtra os trechos que injeta", "como funciona o roteador de source do brain", "qual o contrato do cliente do jev"]) {
      if ((await desfechoDe(c, FALSO_SIM)) === "injetado") {
        texto = c;
        break;
      }
    }
    if (!entidade) throw new NaoMedi("nenhum slash de prova resolve entidade no indice vivo: troque a lista em escolherPrompts");
    if (!texto) throw new NaoMedi("nenhum texto de prova injeta pelo passo 5 no indice vivo: troque a lista em escolherPrompts");
    return { entidade, texto, curto: "ok" };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const ehInt = (x) => Number.isInteger(x);
const ehIntOuNulo = (x) => x === null || Number.isInteger(x);
const ehStrOuNulo = (x) => x === null || typeof x === "string";
const ehNumOuNulo = (x) => x === null || (typeof x === "number" && Number.isFinite(x));
const DESFECHOS = ["sem_payload", "ignorado", "curto", "sem_indice", "entidade", "sem_candidatos", "sem_enviaveis", "jev_reprovou_tudo", "injetado", "erro"];
const JEVS = [null, "desligado", "sem_chave", "sem_enviaveis", "ok", "indisponivel", "prazo_hook", "erro", "sem_filtro_ab"];

/** Confere um evento `contexto` contra a tabela do contrato: chaves na ordem, tipos e enums. */
function conferirContexto(v, nome, l) {
  const chaves = ["v", "ts", "evento", "sessao", "prompt", "ws", "tipo", "comando", "alvo_chars", "alvo_tokens", "desfecho", "entidade", "candidatos", "jev", "jev_motivo", "grupo", "enviados", "aprovados", "limiar", "mostrados", "itens", "ms_busca", "ms_jev", "ms_total", "erro"];
  v.igual(Object.keys(l), chaves, `${nome}: chaves do evento contexto, na ordem do contrato`);
  v.ok(l.v === 1 && l.evento === "contexto" && ehInt(l.ts), `${nome}: v, evento e ts`);
  v.ok(ehStrOuNulo(l.sessao) && ehStrOuNulo(l.prompt) && ehStrOuNulo(l.ws) && ehStrOuNulo(l.comando) && ehStrOuNulo(l.entidade) && ehStrOuNulo(l.jev_motivo) && ehStrOuNulo(l.erro), `${nome}: campos string|null`);
  v.ok([null, "slash", "texto"].includes(l.tipo), `${nome}: tipo`);
  v.ok(ehIntOuNulo(l.alvo_chars) && ehIntOuNulo(l.alvo_tokens) && ehIntOuNulo(l.candidatos) && ehIntOuNulo(l.enviados) && ehIntOuNulo(l.aprovados) && ehIntOuNulo(l.ms_busca) && ehIntOuNulo(l.ms_jev), `${nome}: campos inteiro|null`);
  v.ok(ehInt(l.mostrados) && ehInt(l.ms_total) && ehNumOuNulo(l.limiar), `${nome}: mostrados, ms_total, limiar`);
  v.ok(DESFECHOS.includes(l.desfecho), `${nome}: desfecho ${l.desfecho} esta no enum`);
  v.ok(JEVS.includes(l.jev), `${nome}: jev ${l.jev} esta no enum`);
  v.ok([null, "com_filtro", "sem_filtro"].includes(l.grupo), `${nome}: grupo`);
  v.ok(Array.isArray(l.itens), `${nome}: itens e array`);
  const pos = new Set();
  for (const it of l.itens) {
    v.igual(Object.keys(it), ["caminho", "fonte", "pos", "chunk", "trecho_sha", "prob", "mostrado"], `${nome}: chaves de item`);
    v.ok(typeof it.caminho === "string" && ehStrOuNulo(it.fonte) && ehInt(it.pos) && ehIntOuNulo(it.chunk) && ehStrOuNulo(it.trecho_sha) && ehNumOuNulo(it.prob) && typeof it.mostrado === "boolean", `${nome}: tipos do item ${it.pos}`);
    v.ok(!pos.has(it.pos), `${nome}: pos unico (${it.pos})`);
    pos.add(it.pos);
    v.ok(it.trecho_sha === null || /^[0-9a-f]{12}$/.test(it.trecho_sha), `${nome}: trecho_sha de 12 hex`);
  }
}

// ---------------------------------------------------------------- caso: eventos

/**
 * Para cada desfecho alcancavel sem rede: roda o hook com a telemetria ligada (diretorio temporario)
 * e desligada, e confere uma linha `contexto` com o desfecho certo, sessao/prompt do payload, os tipos
 * do contrato, nenhum texto de prompt no arquivo e a stdout byte a byte igual a da execucao desligada.
 */
async function casoEventos() {
  const v = verificador();
  const prompts = await escolherPrompts();
  const { db, dist } = preVoo();
  const tmp = novoTmp("telemetria-eventos");
  try {
    const CANARIO = "canarioxyzzy7731";
    const SEM_ACHADO = `${CANARIO} qwertzuiop asdfghjklm poiuytrewq`;
    const NAO_WS = join(tmp, "fora-de-workspace");
    fs.mkdirSync(NAO_WS);

    // `erro`: um indice que nao e banco. O workspace aponta o db para um arquivo de texto e o dist/ para
    // o da instalacao; openDb lanca, e o evento so pode levar `e.name[:code]`, nunca `e.message`.
    const pastaErro = join(tmp, "indice-quebrado");
    fs.mkdirSync(join(pastaErro, "data"), { recursive: true });
    fs.writeFileSync(join(pastaErro, "data", "brain.db"), "isto nao e um banco sqlite\n");
    fs.symlinkSync(dist, join(pastaErro, "dist"), "dir");
    const wsErro = join(pastaErro, "workspaces.json");
    fs.writeFileSync(wsErro, JSON.stringify({ db: join(pastaErro, "data", "brain.db"), workspaces: [{ nome: "teste", prefixo: repo }] }));

    // `prazo_hook`: copia do hook ao lado de um jev.js que liga e nunca resolve. O falso `lento` nao
    // serve: responde `timeout` em 2000 ms, antes do prazo de 2200 ms do hook (brain-contexto.js).
    const pastaPrazo = join(tmp, "hooks-prazo");
    fs.mkdirSync(pastaPrazo);
    for (const f of ["brain-contexto.js", "brain-config.js", "telemetria.js"]) fs.copyFileSync(join(repo, "hooks", f), join(pastaPrazo, f));
    fs.writeFileSync(join(pastaPrazo, "jev.js"), "module.exports = { ligado: () => true, julgar: () => new Promise(() => {}) };\n");

    const casos = [
      { nome: "sem_payload", stdin: "{nao e json", esperado: { desfecho: "sem_payload", tipo: null, sessao: null, prompt: null } },
      { nome: "ignorado", prompt: prompts.texto, payload: { source: "loop" }, esperado: { desfecho: "ignorado", tipo: null } },
      { nome: "curto", prompt: prompts.curto, esperado: { desfecho: "curto", tipo: "texto", alvo_chars: 2, candidatos: null, jev: null } },
      { nome: "curto-slash-sem-argumento", prompt: "/clear", esperado: { desfecho: "curto", tipo: "slash", comando: "/clear", alvo_chars: 0 } },
      { nome: "sem_indice", prompt: prompts.texto, cwd: NAO_WS, esperado: { desfecho: "sem_indice", tipo: "texto", ws: null } },
      { nome: "entidade", prompt: prompts.entidade, esperado: { desfecho: "entidade", tipo: "slash", jev: null, candidatos: null } },
      { nome: "sem_candidatos", prompt: SEM_ACHADO, env: FALSO_SIM, esperado: { desfecho: "sem_candidatos", tipo: "texto", candidatos: 0, jev: null, itens: [] } },
      { nome: "slash-com-argumento-sem-achado", prompt: `/gm-spec ${SEM_ACHADO}`, env: FALSO_SIM, esperado: { desfecho: "sem_candidatos", tipo: "slash", comando: "/gm-spec" } },
      { nome: "slash-que-e-caminho", prompt: `/home/leo/${CANARIO}/arquivo ${SEM_ACHADO}`, env: FALSO_SIM, esperado: { desfecho: "sem_candidatos", tipo: "slash", comando: "(outro)" } },
      { nome: "jev_reprovou_tudo", prompt: prompts.texto, env: FALSO_NAO, esperado: { desfecho: "jev_reprovou_tudo", jev: "ok", aprovados: 0, mostrados: 0 }, jev: true },
      { nome: "injetado", prompt: prompts.texto, env: FALSO_SIM, esperado: { desfecho: "injetado", jev: "ok", limiar: 0.5 }, jev: true },
      { nome: "injetado-sem-jev", prompt: prompts.texto, esperado: { desfecho: "injetado", jev: "desligado", enviados: null, aprovados: null, limiar: null } },
      { nome: "jev-indisponivel", prompt: prompts.texto, env: { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: "indisponivel" }, esperado: { desfecho: "injetado", jev: "indisponivel", jev_motivo: "rede", aprovados: null }, jev: true },
      { nome: "jev-sem_chave", prompt: prompts.texto, env: { BRAIN_JEV: "contexto" }, esperado: { desfecho: "injetado", jev: "sem_chave", enviados: null, limiar: null } },
      { nome: "jev-prazo_hook", prompt: prompts.texto, hook: join(pastaPrazo, "brain-contexto.js"), env: { BRAIN_JEV: "contexto" }, esperado: { desfecho: "injetado", jev: "prazo_hook" } },
      { nome: "erro", prompt: prompts.texto, env: { BRAIN_WORKSPACES: wsErro }, esperado: { desfecho: "erro" } },
    ];

    for (const c of casos) {
      const dir = join(tmp, `diario-${c.nome}`);
      const base = { hook: c.hook, prompt: c.prompt, stdin: c.stdin, payload: c.payload, cwd: c.cwd };
      const desligada = await rodarHook({ ...base, env: { ...c.env } });
      const ligada = await rodarHook({ ...base, env: { ...c.env, BRAIN_TELEMETRIA: "1", BRAIN_TELEMETRIA_DIR: dir } });
      v.igual(ligada.stdout, desligada.stdout, `${c.nome}: stdout com a telemetria ligada = desligada, byte a byte`);
      v.ok(ligada.codigo === 0 && desligada.codigo === 0, `${c.nome}: codigo 0`);
      v.igual([ligada.stderr, desligada.stderr], ["", ""], `${c.nome}: stderr vazia`);

      const linhas = lerDiario(dir);
      const contexto = linhas.filter((l) => l.evento === "contexto");
      v.igual(contexto.length, 1, `${c.nome}: uma linha contexto por execucao`);
      if (contexto.length !== 1) continue;
      const l = contexto[0];
      conferirContexto(v, c.nome, l);
      for (const [campo, valor] of Object.entries(c.esperado)) v.igual(l[campo], valor, `${c.nome}: ${campo}`);
      if (c.nome !== "sem_payload") v.igual([l.sessao, l.prompt], ["sessao-teste", "prompt-teste"], `${c.nome}: sessao e prompt do payload`);
      v.ok(l.ms_total >= 0 && l.ms_total <= ligada.ms, `${c.nome}: ms_total (${l.ms_total}) cabe no tempo do spawn`);
      if (c.nome === "entidade") {
        v.ok(typeof l.entidade === "string" && l.mostrados > 0 && l.itens.length === l.mostrados && l.itens.every((i) => i.mostrado && i.chunk === null && i.trecho_sha === null && i.prob === null), "entidade: itens sao os slots, sem chunk, sha nem prob");
      }
      if (["injetado", "jev_reprovou_tudo", "injetado-sem-jev", "jev-indisponivel", "jev-sem_chave", "jev-prazo_hook"].includes(c.nome)) {
        v.ok(l.candidatos > 0 && l.itens.length === Math.min(l.candidatos, 10), `${c.nome}: itens = os primeiros 10 candidatos (${l.itens.length} de ${l.candidatos})`);
        v.ok(l.itens.filter((i) => i.mostrado).length === l.mostrados, `${c.nome}: itens mostrados = mostrados`);
        v.ok(l.itens.every((i) => i.chunk !== null && i.trecho_sha !== null), `${c.nome}: chunk e trecho_sha em todo item do passo 5`);
        v.ok(ehInt(l.ms_busca), `${c.nome}: ms_busca`);
      }
      if (c.nome === "injetado") {
        v.ok(l.aprovados === l.enviados && l.itens.filter((i) => i.prob !== null).length === l.enviados, "injetado: prob em todo item enviado, aprovados = enviados");
        v.ok(ehInt(l.ms_jev), "injetado: ms_jev");
      }
      if (c.nome === "jev_reprovou_tudo") v.ok(l.itens.every((i) => i.prob === 0.05 && !i.mostrado), "jev_reprovou_tudo: prob 0.05, nenhum mostrado");
      if (c.nome === "jev-prazo_hook") v.ok(l.ms_jev >= 2200 && l.enviados !== null, `jev-prazo_hook: ms_jev (${l.ms_jev}) venceu o prazo de 2200 ms`);
      if (c.nome === "erro") v.ok(l.erro !== null && l.erro !== "" && !/not a database/i.test(l.erro) && !/ /.test(l.erro), `erro: so name[:code], sem a mensagem (${l.erro})`);

      // O evento `jev`: so nos casos com o falso. Mesma sessao e prompt, cliente falso, notas do tamanho de itens.
      const jevs = linhas.filter((x) => x.evento === "jev");
      if (c.jev) {
        v.igual(jevs.length, 1, `${c.nome}: uma linha jev`);
        const j = jevs[0];
        if (j) {
          v.ok(j.sessao === l.sessao && j.prompt === l.prompt && j.cliente === "falso" && j.uso === "contexto" && j.op === "julgar", `${c.nome}: jev com a mesma sessao e prompt, cliente falso`);
          v.ok(Array.isArray(j.notas) && j.notas.length === j.itens && j.itens === l.enviados, `${c.nome}: notas (${j.notas?.length}) do tamanho de itens (${j.itens}) = enviados`);
        }
      } else {
        v.ok(jevs.length === 0 || c.nome.startsWith("jev-"), `${c.nome}: sem linha jev`);
      }

      // Privacidade (R2): nem o prompt, nem o argumento, nem a mensagem do erro, nenhuma palavra-canario.
      const arquivo = fs.readdirSync(dir).map((n) => fs.readFileSync(join(dir, n), "utf8")).join("");
      // Prompt curto ("ok") e slash sem argumento ("/clear") nao entram: "ok" e valor de `jev` e o nome
      // do comando e gravado de proposito. O que nao pode vazar e texto, e ele so existe a partir de 12.
      if (c.prompt && c.prompt.length >= 12 && !c.nome.startsWith("curto")) v.ok(!arquivo.includes(c.prompt), `${c.nome}: o prompt nao esta no diario`);
      v.ok(!arquivo.includes(CANARIO) && !arquivo.includes("qwertzuiop"), `${c.nome}: nenhuma palavra do argumento no diario`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return v;
}

// ---------------------------------------------------------------- caso: ab (CA3, a chave)

/** O `u` do hook (brain-contexto.js, sortearGrupo): SHA-256 do prompt_id, 32 bits, em [0, 1). */
const uDe = (promptId) => parseInt(createHash("sha256").update(promptId).digest("hex").slice(0, 8), 16) / 2 ** 32;

/** Um prompt_id de teste cujo `u` esta do lado pedido: a prova nao depende de sorte. */
function promptComU(lado) {
  for (let i = 0; i < 10000; i++) {
    const id = `ab-${i}`;
    const u = uDe(id);
    if (lado === "alto" ? u > 0.9 : u < 0.1) return id;
  }
  throw new Error("nenhum prompt_id de teste achado");
}

/** A chave do A/B: o sorteio, o grupo no evento, e "sem a variavel nada e sorteado". */
async function casoAb() {
  const v = verificador();
  const prompts = await escolherPrompts();
  const tmp = novoTmp("telemetria-ab");
  try {
    const alto = promptComU("alto");
    const baixo = promptComU("baixo");
    let n = 0;
    // Roda o hook uma vez com a telemetria ligada (a menos que `tele: false`) e devolve a stdout e o contexto gravado.
    const rodar = async ({ ab, promptId = "prompt-teste", jev = FALSO_SIM, tele = true }) => {
      const dir = join(tmp, `d${n++}`);
      const env = { ...jev, ...(ab === undefined ? {} : { BRAIN_TELEMETRIA_AB: ab }), ...(tele ? { BRAIN_TELEMETRIA: "1", BRAIN_TELEMETRIA_DIR: dir } : {}) };
      const r = await rodarHook({ prompt: prompts.texto, env, payload: { prompt_id: promptId } });
      v.ok(r.codigo === 0 && r.stderr === "", `ab ${ab}: codigo 0 e stderr vazia`);
      const linhas = lerDiario(dir);
      return { stdout: r.stdout, contexto: linhas.find((l) => l.evento === "contexto"), jevs: linhas.filter((l) => l.evento === "jev") };
    };

    // Referencias: o Jev desligado (a stdout que o `sem_filtro` tem de repetir) e o Jev ligado sem A/B.
    const desligado = await rodar({ jev: {}, tele: false });
    const ligado = await rodar({});
    v.ok(desligado.stdout !== "" && ligado.stdout !== "" && desligado.stdout !== ligado.stdout, "ab: as referencias existem e diferem (o cabecalho filtrado nao e o do Jev desligado)");
    v.igual([ligado.contexto.grupo, ligado.contexto.jev], [null, "ok"], "ab sem variavel: nenhum sorteio, o Jev filtra");

    // p = 1: todo prompt elegivel sai sem_filtro, a stdout e a do Jev desligado, e o Jev nem e chamado.
    for (const id of [alto, baixo, "prompt-teste"]) {
      const r = await rodar({ ab: "1", promptId: id });
      v.igual([r.contexto.grupo, r.contexto.jev], ["sem_filtro", "sem_filtro_ab"], `ab=1 (${id}): grupo sem_filtro, jev sem_filtro_ab`);
      v.igual(r.stdout, desligado.stdout, `ab=1 (${id}): a stdout e a do Jev desligado`);
      v.ok(r.jevs.length === 0, `ab=1 (${id}): o Jev nao foi chamado`);
      v.ok(r.contexto.desfecho === "injetado" && r.contexto.enviados === null && r.contexto.aprovados === null && r.contexto.limiar === null && r.contexto.itens.every((i) => i.prob === null), `ab=1 (${id}): sem enviados, aprovados, limiar nem prob`);
      v.ok(r.contexto.itens.filter((i) => i.mostrado).length === r.contexto.mostrados && r.contexto.mostrados > 0, `ab=1 (${id}): itens mostrados = mostrados`);
    }
    // Sem prompt_id: sorteio comum, e com p = 1 continua sem_filtro.
    v.igual((await rodar({ ab: "1", promptId: undefined })).contexto.grupo, "sem_filtro", "ab=1 sem prompt_id: sorteia");

    // p = 0.0001 e `u` conhecido maior: com_filtro, a stdout e a do Jev ligado.
    const raro = await rodar({ ab: "0.0001", promptId: alto });
    v.igual([raro.contexto.grupo, raro.contexto.jev], ["com_filtro", "ok"], "ab=0.0001 com u alto: com_filtro, o Jev filtra");
    v.igual(raro.stdout, ligado.stdout, "ab=0.0001 com u alto: a stdout e a do Jev ligado");
    v.ok(raro.jevs.length === 1, "ab=0.0001 com u alto: o Jev foi chamado");

    // Determinismo: p = 0.5 e dois prompt_id de lados opostos; a mesma execucao repetida cai no mesmo grupo.
    for (const [id, grupo] of [[alto, "com_filtro"], [baixo, "sem_filtro"]]) {
      const a = await rodar({ ab: "0.5", promptId: id });
      const b = await rodar({ ab: "0.5", promptId: id });
      v.igual([a.contexto.grupo, b.contexto.grupo], [grupo, grupo], `ab=0.5 (u=${uDe(id).toFixed(3)}): o mesmo prompt_id sorteia sempre ${grupo}`);
    }

    // Valor invalido: nenhum sorteio, grupo null, o Jev filtra como hoje.
    for (const ab of ["abc", "0", "-1", "2", "", "NaN", "Infinity"]) {
      const r = await rodar({ ab });
      v.igual([r.contexto.grupo, r.contexto.jev], [null, "ok"], `ab=${JSON.stringify(ab)}: sem sorteio`);
      v.igual(r.stdout, ligado.stdout, `ab=${JSON.stringify(ab)}: a stdout e a do Jev ligado`);
    }

    // Sem a telemetria ligada o A/B nao existe: nao ha sorteio e a stdout e a do Jev ligado.
    const semTele = await rodar({ ab: "1", tele: false });
    v.igual(semTele.stdout, ligado.stdout, "ab=1 sem BRAIN_TELEMETRIA: nao sorteia, a stdout e a do Jev ligado");

    // Sem o Jev (fora de BRAIN_JEV, ou sem chave e sem falso) nao ha sorteio: todo com_filtro sairia sem filtro.
    const foraDoJev = await rodar({ ab: "1", jev: {} });
    v.igual([foraDoJev.contexto.grupo, foraDoJev.contexto.jev], [null, "desligado"], "ab=1 com o Jev fora de BRAIN_JEV: sem sorteio");
    const semChave = await rodar({ ab: "1", jev: { BRAIN_JEV: "contexto" } });
    v.igual([semChave.contexto.grupo, semChave.contexto.jev], [null, "sem_chave"], "ab=1 sem chave nem falso: sem sorteio");
    v.igual(semChave.stdout, desligado.stdout, "ab=1 sem chave: a stdout e a de sempre (sem filtro)");

    // Prompt que nao chega ao passo 5 com candidatos (curto) nao e sorteado.
    const dirCurto = join(tmp, "d-curto");
    await rodarHook({ prompt: prompts.curto, env: { ...FALSO_SIM, BRAIN_TELEMETRIA_AB: "1", BRAIN_TELEMETRIA: "1", BRAIN_TELEMETRIA_DIR: dirCurto } });
    v.igual(lerDiario(dirCurto)[0]?.grupo, null, "ab=1 em prompt curto: grupo null");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return v;
}

// ---------------------------------------------------------------- caso: stdout (CA4, parte 1)

/** A stdout com a telemetria desligada, ligada e ligada com destino indisponivel e a mesma: byte a byte, codigo 0, stderr vazia. */
async function casoStdout() {
  const v = verificador();
  const prompts = await escolherPrompts();
  const tmp = novoTmp("telemetria-stdout");
  try {
    const arquivoComum = join(tmp, "arquivo-comum");
    fs.writeFileSync(arquivoComum, "x");
    const casos = [
      { nome: "injeta pelo passo 5", prompt: prompts.texto, env: FALSO_SIM },
      { nome: "entidade", prompt: prompts.entidade, env: {} },
      { nome: "curto", prompt: prompts.curto, env: {} },
    ];
    for (const c of casos) {
      const dirOk = join(tmp, `diario-${c.nome}`);
      const bracos = {
        desligada: { ...c.env },
        ligada: { ...c.env, BRAIN_TELEMETRIA: "1", BRAIN_TELEMETRIA_DIR: dirOk },
        indisponivel: { ...c.env, BRAIN_TELEMETRIA: "1", BRAIN_TELEMETRIA_DIR: arquivoComum },
      };
      const r = {};
      for (const [nome, env] of Object.entries(bracos)) r[nome] = await rodarHook({ prompt: c.prompt, env });
      v.ok(r.desligada.stdout.length > 0 === (c.nome !== "curto"), `${c.nome}: ${c.nome === "curto" ? "nao injeta" : "injeta"} (${r.desligada.stdout.length} bytes)`);
      v.igual(r.ligada.stdout, r.desligada.stdout, `${c.nome}: ligada = desligada`);
      v.igual(r.indisponivel.stdout, r.desligada.stdout, `${c.nome}: destino indisponivel = desligada`);
      for (const [nome, x] of Object.entries(r)) {
        v.ok(x.codigo === 0, `${c.nome}/${nome}: codigo 0 (${x.codigo})`);
        v.igual(x.stderr, "", `${c.nome}/${nome}: stderr vazia`);
      }
      v.ok(lerDiario(dirOk).some((l) => l.evento === "contexto"), `${c.nome}: o braco ligado gravou`);
      v.igual(fs.readFileSync(arquivoComum, "utf8"), "x", `${c.nome}: o destino indisponivel ficou como estava`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return v;
}

// ---------------------------------------------------------------- caso: poluicao (R4)

/**
 * Roda as suites da F1 que carregam o jev.js ou o hook com `BRAIN_TELEMETRIA=1` e um
 * `CLAUDE_CODE_SESSION_ID` unico NO AMBIENTE (de proposito, sem `envSemJev`: o que se mede e se elas
 * se protegem sozinhas), e confere que nenhum diario do lugar padrao ganhou linha com esse sessao.
 * A saida das suites e descartada; o codigo delas e so informado (a prova delas e o proprio comando).
 * Este caso nunca escreve no diario vivo: so le. Limite conhecido: o hook toma o `sessao` do payload, nao
 * do ambiente, entao um vazamento vindo so do hook nao leva a marca plantada; o hook so grava com o
 * falso se houver BRAIN_TELEMETRIA_DIR (`ligada`), e essa trava e o que o caso `ab`/`gravador` provam.
 */
async function casoPoluicao() {
  const v = verificador();
  const sessao = `poluicao-${randomBytes(6).toString("hex")}`;
  const suites = [
    { nome: "npm run jev", args: [join(root, "scripts", "jev.mjs")], cwd: root },
    { nome: "classificar-parada-teste", args: [join(repo, "scripts", "classificar-parada-teste.mjs")], cwd: repo },
    { nome: "gm-triage-jev-teste", args: [join(repo, "scripts", "gm-triage-jev-teste.mjs")], cwd: repo },
  ];
  const casa = process.env.CLAUDE_CONFIG_DIR || join(os.homedir(), ".claude");
  const lugares = new Set([join(casa, "brain-telemetria")]);
  // Se o shell exporta BRAIN_TELEMETRIA_DIR, e la que um vazamento cairia: confere tambem.
  if (process.env.BRAIN_TELEMETRIA_DIR) lugares.add(process.env.BRAIN_TELEMETRIA_DIR);

  const env = { ...process.env, BRAIN_TELEMETRIA: "1", CLAUDE_CODE_SESSION_ID: sessao };
  for (const suite of suites) {
    const r = spawnSync(process.execPath, suite.args, { cwd: suite.cwd, env, encoding: "utf8", timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
    if (r.error) throw new NaoMedi(`a suite ${suite.nome} nao subiu: ${r.error.code ?? r.error.name}`);
    console.log(`  suite ${suite.nome}: codigo ${r.status}`);
  }

  const vazados = [];
  for (const dir of lugares) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    for (const nome of fs.readdirSync(dir).filter((n) => /^eventos-.*\.jsonl$/.test(n))) {
      const arq = join(dir, nome);
      const n = fs.readFileSync(arq, "utf8").split("\n").filter((l) => l.includes(`"sessao":"${sessao}"`)).length;
      if (n) vazados.push({ arq, n });
    }
  }
  v.ok(vazados.length === 0, "nenhuma suite gravou no diario do lugar padrao");
  if (vazados.length) {
    const total = vazados.reduce((a, x) => a + x.n, 0);
    console.log(`  VAZOU: ${total} linha(s) com sessao ${sessao} em ${vazados.length} arquivo(s). Para tira-las:`);
    for (const x of vazados) console.log(`    grep -v '"sessao":"${sessao}"' ${JSON.stringify(x.arq)} > ${JSON.stringify(x.arq + ".limpo")} && mv ${JSON.stringify(x.arq + ".limpo")} ${JSON.stringify(x.arq)}`);
  }
  return v;
}

// ---------------------------------------------------------------- --custo (CA4, parte 2)

const AQUECIMENTO = 3;
const MEDIDAS = 30;
const LIMITE_MS = 20;
// Mesma definicao de percentil do repo (uso.mjs): indice floor(p * (n - 1)) no vetor ordenado.
const pct = (v, p) => [...v].sort((a, b) => a - b)[Math.floor(p * (v.length - 1))];

/**
 * O portao do CA4: a mediana do tempo de parede do hook ligado (dois bracos: destino bom e destino
 * indisponivel) nao passa a do desligado em mais de 20 ms. 3 rodadas de aquecimento descartadas, depois
 * 30 execucoes por braco, INTERCALADAS (desligada, ligada, indisponivel, desligada, ...) para a deriva
 * da maquina cair igual nos tres. Dois prompts: o que injeta pelo passo 5 (com o falso `sim`) e o de
 * entidade. So imprime numeros.
 */
async function custo() {
  const prompts = await escolherPrompts();
  const tmp = novoTmp("telemetria-custo");
  let codigo = 0;
  try {
    const arquivoComum = join(tmp, "arquivo-comum");
    fs.writeFileSync(arquivoComum, "x");
    const casos = [
      { nome: "injeta pelo passo 5 (Jev falso sim)", prompt: prompts.texto, env: FALSO_SIM },
      { nome: "entidade", prompt: prompts.entidade, env: {} },
    ];
    console.log(`custo da telemetria no hook: ${AQUECIMENTO} rodadas de aquecimento, ${MEDIDAS} execucoes por braco, intercaladas (tempo de parede do spawn)`);
    for (const c of casos) {
      const bracos = {
        desligada: { ...c.env },
        ligada: { ...c.env, BRAIN_TELEMETRIA: "1", BRAIN_TELEMETRIA_DIR: join(tmp, "diario") },
        indisponivel: { ...c.env, BRAIN_TELEMETRIA: "1", BRAIN_TELEMETRIA_DIR: arquivoComum },
      };
      const amostras = { desligada: [], ligada: [], indisponivel: [] };
      for (let rodada = 0; rodada < AQUECIMENTO + MEDIDAS; rodada++) {
        for (const [nome, env] of Object.entries(bracos)) {
          const r = await rodarHook({ prompt: c.prompt, env });
          if (r.codigo !== 0) throw new Error(`o hook saiu com codigo ${r.codigo} no braco ${nome}`);
          if (rodada >= AQUECIMENTO) amostras[nome].push(r.ms);
        }
      }
      const med = Object.fromEntries(Object.entries(amostras).map(([k, x]) => [k, pct(x, 0.5)]));
      const dLigada = med.ligada - med.desligada;
      const dIndisp = med.indisponivel - med.desligada;
      const passou = dLigada <= LIMITE_MS && dIndisp <= LIMITE_MS;
      console.log(`  ${c.nome}`);
      console.log(`    mediana (ms): desligada ${med.desligada} · ligada ${med.ligada} · ligada com destino indisponivel ${med.indisponivel}`);
      console.log(`    diferenca (ms): ligada ${dLigada >= 0 ? "+" : ""}${dLigada} · destino indisponivel ${dIndisp >= 0 ? "+" : ""}${dIndisp} (limite +${LIMITE_MS})  ${passou ? "passou" : "FALHOU"}`);
      if (!passou) codigo = 1;
    }
    console.log(codigo === 0 ? "custo: as duas diferencas ficaram dentro de 20 ms nos dois prompts" : "custo: REPROVADO");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return codigo;
}

// ---------------------------------------------------------------- --conferir (G5)

const MS_ANTES = 2000; // o mesmo par por horario que o painel da F2 usa: [ts - 2000, ts + 15000]
const MS_DEPOIS = 15000;

/** Texto de uma entrada `user` do transcript: o `content` string, ou os blocos `text` concatenados. */
function textoDaEntrada(e) {
  const c = e?.message?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.filter((b) => b?.type === "text").map((b) => b.text ?? "").join("");
  return "";
}

/**
 * Entrada de prompt (premissa P16 da spec): `user`, fora de sidechain, sem `isMeta`, sem bloco
 * `tool_result`, texto que nao comeca com `<local-command` e que nao e resumo de compactacao.
 * Slash command e UMA entrada (a `isMeta` com a skill expandida nao conta).
 */
function ehEntradaDePrompt(e) {
  if (e?.type !== "user" || e.isSidechain === true || e.isMeta === true || e.isCompactSummary === true) return false;
  const c = e.message?.content;
  if (Array.isArray(c) && c.some((b) => b?.type === "tool_result")) return false;
  return !textoDaEntrada(e).startsWith("<local-command");
}

/** O transcript `<projetos>/*\/<sessao>.jsonl`, ou null. */
function acharTranscript(projetos, sessao) {
  if (!fs.existsSync(projetos) || !/^[\w-]+$/.test(sessao)) return null;
  for (const d of fs.readdirSync(projetos, { withFileTypes: true })) {
    const arq = join(projetos, d.name, `${sessao}.jsonl`);
    if (d.isDirectory() && fs.existsSync(arq)) return arq;
  }
  return null;
}

/**
 * Cobertura do diario sobre os transcripts. Para cada sessao com evento `contexto` no periodo e
 * transcript ainda existente: os prompts do transcript no periodo (regra de entrada de prompt) e quantos
 * tem evento, por `promptId` ou, na falta, por horario. Mede as premissas P1 e P6: se nenhum evento casa
 * por `promptId`, o payload nao traz o id que o transcript usa. So contagens (R1).
 */
export function conferirCobertura({ dir, projetos, desde, ate }) {
  const lidos = lerEventos({ dir, desde, ate });
  const eventos = lidos.eventos.filter((e) => e.evento === "contexto");
  const { invalidas, outraVersao } = lidos;
  const porSessao = new Map();
  for (const e of eventos) {
    if (typeof e.sessao !== "string") continue;
    if (!porSessao.has(e.sessao)) porSessao.set(e.sessao, []);
    porSessao.get(e.sessao).push(e);
  }
  const r = { eventos: eventos.length, invalidas, outraVersao, semSessao: eventos.filter((e) => typeof e.sessao !== "string").length, sessoes: porSessao.size, semTranscript: 0, prompts: 0, comEvento: 0, porPromptId: 0, soPorHorario: 0, semEvento: 0, eventosSemPar: 0 };
  for (const [sessao, evs] of porSessao) {
    const arq = acharTranscript(projetos, sessao);
    if (!arq) {
      r.semTranscript++;
      continue;
    }
    const prompts = [];
    for (const linha of fs.readFileSync(arq, "utf8").split("\n")) {
      if (!linha) continue;
      let e;
      try {
        e = JSON.parse(linha);
      } catch {
        continue;
      }
      const t = Date.parse(e?.timestamp);
      if (ehEntradaDePrompt(e) && t >= desde && t < ate) prompts.push({ id: e.promptId ?? null, t });
    }
    // Duas passadas: o casamento exato por promptId reserva o evento antes de a janela de horario
    // poder levar o evento de outro prompt (senao o prompt sem evento proprio parece coberto).
    const usados = new Set();
    const exatos = prompts.map((p) => {
      const e = evs.find((x) => p.id !== null && x.prompt === p.id && !usados.has(x));
      if (e) usados.add(e);
      return e ?? null;
    });
    prompts.forEach((p, i) => {
      r.prompts++;
      if (exatos[i]) {
        r.comEvento++;
        r.porPromptId++;
        return;
      }
      const horario = evs.find((e) => !usados.has(e) && e.ts >= p.t - MS_ANTES && e.ts <= p.t + MS_DEPOIS);
      if (horario) {
        r.comEvento++;
        r.soPorHorario++;
        usados.add(horario);
      } else {
        r.semEvento++;
      }
    });
    r.eventosSemPar += evs.filter((e) => !usados.has(e)).length;
  }
  return r;
}

/** `--conferir --dias N`: imprime a cobertura. Codigo 2 sem diario ou sem evento no periodo. */
function conferir(dias) {
  const agora = Date.now();
  const dir = require(join(repo, "hooks", "telemetria.js")).dirTelemetria(process.env);
  const casa = process.env.CLAUDE_CONFIG_DIR || join(os.homedir(), ".claude");
  const r = conferirCobertura({ dir, projetos: join(casa, "projects"), desde: agora - dias * DIA_MS, ate: agora });
  console.log(`conferir: ultimos ${dias} dia(s)`);
  if (r.eventos === 0) {
    console.log(`  nao ha evento contexto no periodo (diario ${fs.existsSync(dir) ? "existe" : "nao existe"}): ligue BRAIN_TELEMETRIA=1 no ambiente e reinicie as sessoes`);
    return 2;
  }
  console.log(`  eventos contexto: ${r.eventos} em ${r.sessoes} sessao(oes)${r.semSessao ? ` (${r.semSessao} sem sessao)` : ""} · linhas invalidas ${r.invalidas} · outra versao ${r.outraVersao}`);
  console.log(`  sessoes sem transcript (so conta o que ainda existe): ${r.semTranscript}`);
  const pc = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "n/a");
  console.log(`  prompts nos transcripts dessas sessoes: ${r.prompts}`);
  console.log(`  cobertura (prompt com evento): ${r.comEvento}/${r.prompts} = ${pc(r.comEvento, r.prompts)}  (meta da G5: 95% ou mais)`);
  console.log(`    casaram por prompt = promptId: ${r.porPromptId} · so por horario: ${r.soPorHorario} · sem evento: ${r.semEvento}`);
  console.log(`  eventos sem prompt no transcript: ${r.eventosSemPar}`);
  if (r.prompts > 0 && r.porPromptId === 0) console.log("  ATENCAO: nenhum evento casou por promptId: o prompt_id do payload nao e o promptId do transcript (P1/P6); a F2 casa so por horario");
  return 0;
}

// ---------------------------------------------------------------- caso: conferir (o proprio --conferir, sobre fixtures)

/** Prova o `--conferir`: um transcript e um diario de mentira, com cada forma de prompt que a regra distingue. */
async function casoConferir() {
  const v = verificador();
  const tmp = novoTmp("telemetria-conferir");
  try {
    const agora = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const sessao = "sessao-conferir";
    const projetos = join(tmp, "projects", "-x");
    fs.mkdirSync(projetos, { recursive: true });
    const t = (min) => agora - min * 60000;
    const user = (texto, promptId, ms, extra = {}) => ({ type: "user", promptId, timestamp: iso(ms), message: { role: "user", content: texto }, ...extra });
    const transcript = [
      user("primeiro prompt", "p-1", t(50)),
      { type: "assistant", timestamp: iso(t(50) + 1000), message: { role: "assistant", content: [{ type: "text", text: "ok" }] } },
      user([{ type: "tool_result", tool_use_id: "x", content: "r" }], "p-1", t(50) + 2000),
      user("/gm-spec #1", "p-2", t(40)), // slash: a entrada do <command-message>
      user("skill expandida", "p-2", t(40) + 10, { isMeta: true }),
      user("<local-command-stdout>x</local-command-stdout>", "p-x", t(35)),
      user("de sidechain", "p-s", t(34), { isSidechain: true }),
      user("sem evento", "p-3", t(30)),
      user("so por horario", "p-4-outro-id", t(20)),
      user("resumo", "p-c", t(15), { isCompactSummary: true }),
      user("antigo, fora do periodo", "p-0", agora - 10 * DIA_MS),
    ];
    fs.writeFileSync(join(projetos, `${sessao}.jsonl`), transcript.map((e) => JSON.stringify(e)).join("\n") + "\n");
    const evento = (prompt, ms, s = sessao) => ({ v: 1, ts: ms, evento: "contexto", sessao: s, prompt });
    const dir = join(tmp, "diario");
    fs.mkdirSync(dir);
    const eventos = [evento("p-1", t(50) + 100), evento("p-2", t(40) + 100), evento("id-diferente", t(20) + 500), evento("p-orfao", t(5)), evento(null, t(4), "sessao-sem-transcript")];
    const dia = (ms) => iso(ms).slice(0, 10);
    // Os eventos podem cair em dois dias UTC: um arquivo por dia, como o gravador.
    for (const e of eventos) fs.appendFileSync(join(dir, `eventos-${dia(e.ts)}.jsonl`), JSON.stringify(e) + "\n");
    fs.appendFileSync(join(dir, `eventos-${dia(t(50))}.jsonl`), "{linha quebrada\n" + JSON.stringify({ v: 2, ts: t(50), evento: "contexto" }) + "\n");

    const r = conferirCobertura({ dir, projetos: join(tmp, "projects"), desde: agora - DIA_MS, ate: agora + 60000 });
    v.igual(r.eventos, 5, "conferir: eventos contexto v=1 no periodo");
    v.igual([r.invalidas, r.outraVersao], [1, 1], "conferir: linha invalida e outra versao so contadas");
    v.igual([r.sessoes, r.semTranscript], [2, 1], "conferir: duas sessoes, uma sem transcript");
    v.igual(r.prompts, 4, "conferir: prompts = entradas de prompt no periodo (sem tool_result, isMeta, local-command, sidechain, compactacao, nem o fora do periodo)");
    v.igual([r.porPromptId, r.soPorHorario, r.semEvento, r.comEvento], [2, 1, 1, 3], "conferir: por promptId, so por horario, sem evento, com evento");
    v.igual(r.eventosSemPar, 1, "conferir: o evento orfao nao tem prompt no transcript");

    // E o comando: codigo 2 sem evento, codigo 0 com, e a saida so traz contagens (nenhum caminho nem id).
    const sem = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--conferir", "--dias", "1"], { env: envDoFilho({ CLAUDE_CONFIG_DIR: join(tmp, "casa-vazia") }), encoding: "utf8" });
    v.ok(sem.status === 2 && /BRAIN_TELEMETRIA=1/.test(sem.stdout), "conferir: sem evento, codigo 2 com o motivo");
    const casa = join(tmp, "casa");
    fs.mkdirSync(casa);
    fs.symlinkSync(join(tmp, "projects"), join(casa, "projects"), "dir");
    const com = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--conferir", "--dias", "1"], { env: envDoFilho({ CLAUDE_CONFIG_DIR: casa, BRAIN_TELEMETRIA_DIR: dir }), encoding: "utf8" });
    v.ok(com.status === 0 && /cobertura.*3\/4 = 75\.0%/.test(com.stdout), `conferir: com evento, codigo 0 e cobertura 3/4 (${com.stdout.split("\n").find((l) => l.includes("cobertura"))?.trim()})`);
    v.ok(!com.stdout.includes(sessao) && !com.stdout.includes("p-1") && !com.stdout.includes(tmp), "conferir: a saida nao traz id nem caminho");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return v;
}

// ---------------------------------------------------------------- execucao

const CASOS = {
  gravador: casoGravador,
  eventos: casoEventos,
  ab: casoAb,
  stdout: casoStdout,
  conferir: casoConferir,
  poluicao: casoPoluicao,
};

async function main() {
  const argv = process.argv.slice(2);
  const valor = (nome) => {
    const i = argv.indexOf(nome);
    return i < 0 ? undefined : argv[i + 1];
  };
  const comValor = new Set(["--caso", "--dias"]);
  const sozinhos = new Set(["--custo", "--conferir"]);
  const desconhecido = argv.filter((a, k) => (a.startsWith("--") && !comValor.has(a) && !sozinhos.has(a)) || (!a.startsWith("--") && !comValor.has(argv[k - 1] ?? "")));
  const semValor = [...comValor].filter((n) => argv.includes(n) && (valor(n) === undefined || valor(n).startsWith("--")));
  if (desconhecido.length || semValor.length) {
    console.error(`argumento desconhecido ou sem valor: ${[...desconhecido, ...semValor].join(" ")}`);
    process.exit(2);
  }

  if (argv.includes("--custo")) {
    try {
      process.exit(await custo());
    } catch (e) {
      if (e instanceof NaoMedi) {
        console.log(`NÃO MEDI  custo: ${e.message}`);
        process.exit(2);
      }
      console.log(`FALHOU  custo: ${e?.name ?? "?"}: ${e?.message ?? ""}`);
      process.exit(1);
    }
  }
  if (argv.includes("--conferir")) {
    const dias = valor("--dias") === undefined ? 1 : Number(valor("--dias"));
    if (!Number.isFinite(dias) || dias <= 0) {
      console.error("--dias espera um numero maior que zero");
      process.exit(2);
    }
    process.exit(conferir(dias));
  }

  const escolhido = valor("--caso");
  if (escolhido && !CASOS[escolhido]) {
    console.error(`caso desconhecido: ${escolhido} (existem: ${Object.keys(CASOS).join(", ")})`);
    process.exit(2);
  }
  const nomes = escolhido ? [escolhido] : Object.keys(CASOS);
  let codigo = 0;
  for (const nome of nomes) {
    let v;
    try {
      v = await CASOS[nome]();
    } catch (e) {
      if (e instanceof NaoMedi) {
        console.log(`NÃO MEDI  ${nome}: ${e.message}`);
        codigo = Math.max(codigo, 2);
        continue;
      }
      console.log(`FALHOU  ${nome}: exceção ${e?.name ?? "?"}: ${e?.message ?? ""}`);
      codigo = Math.max(codigo, 1);
      continue;
    }
    if (v.falhas.length) {
      console.log(`FALHOU  ${nome}: ${v.falhas.length} de ${v.n} verificações`);
      for (const f of v.falhas) console.log(`  - ${f}`);
      codigo = Math.max(codigo, 1);
    } else {
      console.log(`passou  ${nome}: ${v.n} verificações`);
    }
  }
  process.exit(codigo);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
