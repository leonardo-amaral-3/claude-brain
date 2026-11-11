// Teste do cliente do Jev (hooks/jev.js) e do filtro do hook de contexto, sem rede.
// Parte cliente: T1-T10. Parte hook: T11-T16 (hooks/brain-contexto.js contra o de origin/dev); a escolha do T16 tem caso sintetico sem indice.
//
// Uso: npm run jev        sai 0 se tudo passou, 1 na primeira falha ("FALHOU: <caso>"),
//                         2 se nao deu para medir ("NAO MEDI: <motivo>"): ambiente sem indice/dist,
//                         ou prompt de prova que nao serve mais. Dois nao e verde.
//
// Por que o env e o fetch sao trocados antes de qualquer coisa: este script nunca pode falar com a
// TypeSafe AI nem herdar a chave. Se um caso esquecer de injetar o `fetch` espiao, o global lanca e
// o caso falha em vez de sair para a rede.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function fail(msg) {
  console.error("FALHOU: " + msg);
  process.exit(1);
}

// Ordem de resolucao do contrato: layout do repo, depois o da instalacao.
const claudeHome = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const caminhoDoCliente = [join(root, "..", "hooks", "jev.js"), join(claudeHome, "hooks", "jev.js")].find((c) => existsSync(c));
if (!caminhoDoCliente) {
  fail("hooks/jev.js nao encontrado: rode este script de dentro do repo ou com os hooks instalados");
}
const jev = require(caminhoDoCliente);

process.env = jev.envSemJev(process.env);
globalThis.fetch = () => {
  throw new Error("rede proibida no teste");
};

function confere(condicao, caso) {
  if (!condicao) fail(caso);
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// fetch espiao: conta chamadas, guarda o que recebeu e responde com `responder(url, init)`.
function espiao(responder) {
  const espionado = {
    chamadas: [],
    fetch: async (url, init) => {
      espionado.chamadas.push({ url, init });
      return responder(url, init);
    },
  };
  return espionado;
}
const respostaJson = (corpo, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });

const NOUL = { tipo: "noul", instrucao: "serve?" };
const ESCOLHA = { tipo: "escolha", instrucao: "qual?", opcoes: { a: "primeira", b: "segunda", c: "terceira" } };
const TRECHOS = [
  { id: "specs/um.md", texto: "primeiro trecho" },
  { id: "specs/dois.md", texto: "segundo trecho" },
];
const COM_CHAVE = { BRAIN_JEV: "contexto", TYPESAFE_API_KEY: "chave-de-teste" };

// Captura stdout/stderr do processo durante `corpo`, para provar silencio.
async function silencioso(corpo) {
  const escrito = [];
  const out = process.stdout.write;
  const err = process.stderr.write;
  process.stdout.write = (c) => (escrito.push(String(c)), true);
  process.stderr.write = (c) => (escrito.push(String(c)), true);
  try {
    await corpo();
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
  }
  return escrito.join("");
}

// Roda um script curto num processo filho com env saneado + so as variaveis do caso.
function filho(argumentos, env, entrada) {
  return new Promise((resolver) => {
    const proc = spawn(process.execPath, argumentos, { env: { ...jev.envSemJev(process.env), ...env }, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("close", (codigo) => resolver({ codigo, stdout, stderr }));
    proc.stdin.end(entrada ?? "");
  });
}

// ---- T1: desligado -------------------------------------------------------------------------
{
  const espia = espiao(() => respostaJson({}));
  const base = { uso: "contexto", fetch: espia.fetch };
  const semEnv = { ...base, env: { TYPESAFE_API_KEY: "chave-de-teste" } };
  confere(igual(await jev.julgar("p", TRECHOS, semEnv), [{ estado: "indisponivel", motivo: "desligado" }, { estado: "indisponivel", motivo: "desligado" }]), "T1 julgar sem BRAIN_JEV");
  confere(igual(await jev.decidir("e", { x: NOUL }, semEnv), { x: { estado: "indisponivel", motivo: "desligado" } }), "T1 decidir sem BRAIN_JEV");
  // entrada invalida tambem vale desligado: a barreira de uso vem antes da validacao
  confere(igual(await jev.julgar("p", [{ id: 1 }, null], semEnv), [{ estado: "indisponivel", motivo: "desligado" }, { estado: "indisponivel", motivo: "desligado" }]), "T1 julgar invalido sem BRAIN_JEV");
  confere(igual(await jev.decidir("e", { x: { tipo: "?" } }, semEnv), { x: { estado: "indisponivel", motivo: "desligado" } }), "T1 decidir invalido sem BRAIN_JEV");
  for (const valor of ["1", "*", "todos"]) {
    const r = await jev.julgar("p", TRECHOS, { ...base, env: { BRAIN_JEV: valor, TYPESAFE_API_KEY: "chave-de-teste" } });
    confere(r.every((x) => x.motivo === "desligado"), `T1 BRAIN_JEV=${valor} nao liga nada`);
  }
  const outroUso = await jev.julgar("p", TRECHOS, { ...base, env: { BRAIN_JEV: "parada", TYPESAFE_API_KEY: "chave-de-teste" } });
  confere(outroUso.every((x) => x.motivo === "desligado"), "T1 uso parada ligado nao liga contexto");
  confere(jev.ligado("contexto", {}) === false && jev.ligado("contexto", COM_CHAVE) === true, "T1 ligado()");
  confere(jev.ligado("contexto", { BRAIN_JEV: " Contexto , parada", BRAIN_JEV_FALSO: "" }) === true, "T1 ligado() com trim, caixa e falso vazio");
  confere(espia.chamadas.length === 0, "T1 espiao 0");
}

// ---- T2: uso invalido e sem chave ----------------------------------------------------------
{
  const espia = espiao(() => respostaJson({}));
  const invalido = await jev.julgar("p", TRECHOS, { uso: "inventado", env: COM_CHAVE, fetch: espia.fetch });
  confere(invalido.every((x) => x.motivo === "entrada_invalida"), "T2 uso fora da tabela");
  const semUso = await jev.decidir("e", { x: NOUL }, { env: COM_CHAVE, fetch: espia.fetch });
  confere(igual(semUso, { x: { estado: "indisponivel", motivo: "entrada_invalida" } }), "T2 sem uso");
  const semChave = await jev.julgar("p", TRECHOS, { uso: "contexto", env: { BRAIN_JEV: "contexto" }, fetch: espia.fetch });
  confere(semChave.every((x) => x.motivo === "sem_chave"), "T2 sem chave");
  const chaveVazia = await jev.decidir("e", { x: NOUL }, { uso: "contexto", env: { BRAIN_JEV: "contexto", TYPESAFE_API_KEY: "" }, fetch: espia.fetch });
  confere(chaveVazia.x.motivo === "sem_chave", "T2 chave vazia");
  confere(espia.chamadas.length === 0, "T2 espiao 0");
}

// ---- T3: cliente falso ---------------------------------------------------------------------
{
  const espia = espiao(() => respostaJson({}));
  const r = await jev.julgar("p", TRECHOS, { uso: "contexto", env: { ...COM_CHAVE, BRAIN_JEV_FALSO: "sim" }, fetch: espia.fetch });
  confere(r.length === 2 && r.every((x) => x.estado === "ok" && x.probabilidade === 0.95 && x.sim === true), "T3 falso sim = 0.95");
  const vazio = await jev.julgar("p", TRECHOS, { uso: "contexto", env: { ...COM_CHAVE, BRAIN_JEV_FALSO: "" }, fetch: espia.fetch });
  confere(vazio.every((x) => x.motivo === "resposta_invalida" && x.detalhe === "roteiro"), "T3 falso vazio = roteiro ilegivel, nunca o real");
  confere(espia.chamadas.length === 0, "T3 espiao 0 nos dois");
  // Emenda 2: a validacao vem antes do falso, entao o falso recusa o que o real recusaria.
  const falsoSim = { uso: "contexto", env: { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: "sim" }, fetch: espia.fetch };
  const textoVazio = await jev.julgar("p", [{ id: "a", texto: "" }, { id: "b", texto: "t" }, { texto: "sem id" }], falsoSim);
  confere(
    igual(textoVazio.map((x) => (x.estado === "ok" ? "ok" : x.motivo)), ["entrada_invalida", "ok", "entrada_invalida"]),
    "T3 falso: trecho com texto vazio ou sem id = entrada_invalida, so nele"
  );
  const vinte = await jev.julgar("p", Array.from({ length: 20 }, (_, i) => ({ id: "t" + i, texto: "x" })), falsoSim);
  confere(vinte.slice(0, 16).every((x) => x.estado === "ok") && vinte.slice(16).every((x) => x.motivo === "entrada_invalida"), "T3 falso: 20 trechos = 16 + 4, como o real");
  confere((await jev.julgar(5, TRECHOS, falsoSim)).every((x) => x.motivo === "entrada_invalida"), "T3 falso: pergunta nao string");
  confere((await jev.decidir("e", { x: { tipo: "noul", instrucao: 5 } }, falsoSim)).x.motivo === "entrada_invalida", "T3 falso: decidir com instrucao nao string");
  confere(espia.chamadas.length === 0, "T3 espiao 0 depois da validacao");
}

// ---- T4: roteiro e variacoes do falso ------------------------------------------------------
{
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const pasta = mkdtempSync(join(tmpdir(), "jev-teste-"));
  const roteiro = join(pasta, "roteiro.json");
  const escreve = (conteudo) => writeFileSync(roteiro, typeof conteudo === "string" ? conteudo : JSON.stringify(conteudo));
  const em = (falso) => ({ uso: "contexto", env: { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: falso } });

  escreve({
    regras: [
      { quando: { pergunta: "p1", trechoId: "SPECS\\Dois" }, responde: { probabilidade: 0.9 } },
      { quando: { id: "alvo" }, responde: { probabilidade: 0.7 } },
      { quando: { trechoId: "nunca" }, responde: { probabilidade: 0.6 } },
      { quando: { id: "fora" }, responde: { indisponivel: "http" } },
      { quando: { id: "tortoescolha" }, responde: { escolha: "zzz" } },
      { quando: { id: "escolhe" }, responde: { escolha: "b", confianca: 0.8 } },
    ],
    padrao: { probabilidade: 0.05 },
  });
  const julgado = await jev.julgar("p1", TRECHOS, em(roteiro));
  confere(julgado[0].probabilidade === 0.05 && julgado[1].probabilidade === 0.9 && julgado[1].sim === true, "T4 regra por pergunta + trechoId (norm de caixa e barra)");
  confere((await jev.julgar("outra", TRECHOS, em(roteiro)))[1].probabilidade === 0.05, "T4 pergunta diferente cai no padrao");

  const decidido = await jev.decidir("estado texto", { alvo: NOUL, outro: NOUL, fora: NOUL, tortoescolha: ESCOLHA, escolhe: ESCOLHA }, em(roteiro));
  confere(decidido.alvo.probabilidade === 0.7, "T4 regra por id no decidir");
  confere(decidido.outro.probabilidade === 0.05, "T4 trechoId no decidir nao casa; padrao");
  confere(igual([decidido.fora.motivo, decidido.fora.estado], ["http", "indisponivel"]), "T4 responde indisponivel:http");
  confere(decidido.tortoescolha.motivo === "resposta_invalida", "T4 escolha fora de opcoes");
  confere(decidido.escolhe.escolha === "b" && decidido.escolhe.confianca === 0.8 && Math.abs(decidido.escolhe.probabilidades.a - 0.1) < 1e-9, "T4 escolha com confianca e resto dividido");

  // regra por `pergunta` com estado nao string nao casa
  escreve({ regras: [{ quando: { pergunta: "x" }, responde: { probabilidade: 0.9 } }], padrao: { probabilidade: 0.1 } });
  confere((await jev.decidir({ k: 1 }, { z: NOUL }, em(roteiro))).z.probabilidade === 0.1, "T4 pergunta com estado objeto nao casa");

  // sem padrao e sem regra que case, e responde de tipo errado
  escreve({ regras: [] });
  confere((await jev.decidir("e", { z: NOUL }, em(roteiro))).z.motivo === "resposta_invalida", "T4 sem padrao");
  escreve({ padrao: { probabilidade: 0.5 } });
  confere((await jev.decidir("e", { z: ESCOLHA }, em(roteiro))).z.motivo === "resposta_invalida", "T4 responde de tipo errado");

  // roteiro ilegivel
  escreve("{ nao e json");
  confere((await jev.julgar("p", TRECHOS, em(roteiro))).every((x) => x.motivo === "resposta_invalida"), "T4 roteiro ilegivel");
  confere((await jev.julgar("p", TRECHOS, em(join(pasta, "inexistente.json")))).every((x) => x.motivo === "resposta_invalida"), "T4 roteiro inexistente");

  // falso sim / nao em escolha
  const sim = await jev.decidir("e", { q: ESCOLHA, u: { tipo: "escolha", instrucao: "?", opcoes: { so: "um" } } }, em("sim"));
  confere(sim.q.escolha === "a" && sim.q.confianca === 0.95 && sim.q.confianca === sim.q.probabilidades.a && Math.abs(sim.q.probabilidades.b - 0.025) < 1e-9, "T4 falso sim escolha");
  confere(sim.u.confianca === 1 && sim.u.probabilidades.so === 1, "T4 falso sim com uma opcao = 1.0");
  const nao = await jev.decidir("e", { q: ESCOLHA, n: NOUL }, em("nao"));
  confere(nao.q.escolha === "a" && Math.abs(nao.q.confianca - 1 / 3) < 1e-9 && nao.n.probabilidade === 0.05 && nao.n.sim === false, "T4 falso nao");
  const fora = await jev.decidir("e", { q: NOUL }, em("indisponivel"));
  confere(igual(fora.q, { estado: "indisponivel", motivo: "rede", detalhe: "falso" }), "T4 falso indisponivel");
}

// ---- T5: falso lento, em processo filho ----------------------------------------------------
{
  const programa = `
    const jev = require(${JSON.stringify(caminhoDoCliente)});
    const inicio = Date.now();
    jev.julgar("p", [{ id: "a", texto: "t" }, { id: "b", texto: "t" }], { uso: "contexto", timeoutMs: 200 }).then((r) => {
      process.stdout.write(JSON.stringify({ r, ms: Date.now() - inicio }));
    });`;
  const saida = await filho(["-e", programa], { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: "lento" });
  confere(saida.codigo === 0, `T5 o filho sai 0 depois de resolver (saiu ${saida.codigo}; 13 = event loop vazio)`);
  const { r, ms } = JSON.parse(saida.stdout);
  confere(r.length === 2 && r.every((x) => x.motivo === "timeout"), "T5 todos timeout");
  confere(ms >= 190 && ms < 250, `T5 resolve em < 250 ms (levou ${ms})`);
}

// ---- T6: adaptador real, o que sai --------------------------------------------------------
{
  const espia = espiao(() => respostaJson({ answers: { relevante: { noul: 0.5 } } }));
  const longo = "x".repeat(5000);
  await jev.julgar(longo, [{ id: "caminho/secreto.md", texto: longo, titulo: "tit", fonte: "src" }], { uso: "contexto", env: COM_CHAVE, fetch: espia.fetch });
  confere(espia.chamadas.length === 1, "T6 uma requisicao por trecho");
  const { url, init } = espia.chamadas[0];
  const corpo = JSON.parse(init.body);
  confere(url === "https://api.typesafe.ai/v1/systemone" && init.method === "POST", "T6 URL e metodo");
  confere(init.headers.Authorization === "Bearer chave-de-teste" && init.headers["Content-Type"] === "application/json", "T6 headers");
  confere(corpo.model === "jev-latest" && corpo.questions.relevante.type === "noul" && corpo.questions.relevante.instructions === jev.INSTRUCAO_PADRAO, "T6 corpo noul");
  confere(corpo.state.pergunta.length === 4000 && corpo.state.trecho.texto.length === 4000, "T6 pergunta e texto cortados em 4000");
  confere(!init.body.includes("caminho/secreto") && !init.body.includes("secreto.md"), "T6 o id do trecho nao sai");
  confere(init.signal && typeof init.signal.aborted === "boolean", "T6 signal presente");

  const esp2 = espiao(() => respostaJson({ answers: { e: { choice: "a", confidence: 0.9, probabilities: { a: 0.9 } } } }));
  await jev.decidir({ k: "v" }, { e: ESCOLHA }, { uso: "contexto", env: COM_CHAVE, fetch: esp2.fetch });
  const corpoEscolha = JSON.parse(esp2.chamadas[0].init.body);
  confere(igual(corpoEscolha.questions.e, { type: "choice", instructions: "qual?", criteria: ESCOLHA.opcoes }), "T6 corpo choice");
  confere(igual(corpoEscolha.state, { k: "v" }), "T6 estado estruturado vai como veio");

  const esp3 = espiao(() => respostaJson({}));
  const gigante = await jev.decidir({ t: "y".repeat(jev.MAX_ESTADO) }, { x: NOUL }, { uso: "contexto", env: COM_CHAVE, fetch: esp3.fetch });
  confere(gigante.x.motivo === "entrada_invalida" && esp3.chamadas.length === 0, "T6 estado acima de MAX_ESTADO nao e cortado nem enviado");
}

// ---- T7: adaptador real, o que volta -------------------------------------------------------
{
  const opcoes = (resposta) => ({ uso: "contexto", env: COM_CHAVE, fetch: espiao(() => respostaJson(resposta)).fetch });
  const [um] = await jev.julgar("p", [TRECHOS[0]], opcoes({ answers: { relevante: { noul: 0.7 } } }));
  confere(um.estado === "ok" && um.sim === true && um.probabilidade === 0.7, "T7 noul 0.7");
  const [baixo] = await jev.julgar("p", [TRECHOS[0]], opcoes({ answers: { relevante: { noul: 0.2 } } }));
  confere(baixo.sim === false, "T7 noul 0.2 e nao");
  const [fronteira] = await jev.julgar("p", [TRECHOS[0]], opcoes({ answers: { relevante: { noul: 0.5 } } }));
  confere(fronteira.sim === true && fronteira.probabilidade === 0.5, "T7 noul 0.5 e sim (sim = probabilidade >= 0.5)");

  const r = await jev.decidir("e", { e: ESCOLHA, n: NOUL, quebrada: NOUL, ausente: NOUL }, opcoes({
    answers: { e: { choice: "b", confidence: 0.6, probabilities: { b: 0.6, a: 0.4 } }, n: { noul: 0.3 }, quebrada: { noul: 1.4 } },
  }));
  confere(r.e.estado === "ok" && r.e.escolha === "b" && r.e.confianca === 0.6 && igual(Object.keys(r.e.probabilidades).sort(), ["a", "b", "c"]) && r.e.probabilidades.c === 0, "T7 choice com probabilidades nas chaves de opcoes (ausente vira 0)");
  confere(r.n.probabilidade === 0.3, "T7 a chave boa segue boa");
  confere(r.quebrada.motivo === "resposta_invalida" && r.ausente.motivo === "resposta_invalida", "T7 noul 1.4 e chave ausente: invalida so nela");
  const foraDeOpcoes = await jev.decidir("e", { e: ESCOLHA }, opcoes({ answers: { e: { choice: "z", confidence: 0.9, probabilities: {} } } }));
  confere(foraDeOpcoes.e.motivo === "resposta_invalida", "T7 choice fora de opcoes");
  const semAnswers = await jev.decidir("e", { e: NOUL }, opcoes({ resposta: 1 }));
  confere(semAnswers.e.motivo === "resposta_invalida", "T7 corpo sem answers");
  const ilegivel = await jev.decidir("e", { e: NOUL }, { uso: "contexto", env: COM_CHAVE, fetch: async () => ({ ok: true, status: 200, json: async () => { throw new Error("nao e json"); } }) });
  confere(ilegivel.e.motivo === "resposta_invalida", "T7 JSON ilegivel");
}

// ---- T8: adaptador real, falhas ------------------------------------------------------------
{
  const barulho = await silencioso(async () => {
    const http = await jev.julgar("p", [TRECHOS[0]], { uso: "contexto", env: COM_CHAVE, fetch: async () => respostaJson({}, 429) });
    confere(igual(http[0], { estado: "indisponivel", motivo: "http", detalhe: "429" }), "T8 429");
    const rede = await jev.julgar("p", [TRECHOS[0]], { uso: "contexto", env: COM_CHAVE, fetch: async () => { throw new Error("sem rede"); } });
    confere(rede[0].motivo === "rede", "T8 fetch que rejeita");
    const lanca = await jev.decidir("e", { x: NOUL }, { uso: "contexto", env: COM_CHAVE, fetch: () => { throw new Error("sincrono"); } });
    confere(lanca.x.motivo === "rede", "T8 fetch que lanca de forma sincrona");

    // so termina no abort
    const preso = (_url, init) => new Promise((_ok, rejeita) => init.signal.addEventListener("abort", () => rejeita(new Error("abortado"))));
    const inicio = Date.now();
    const lento = await jev.julgar("p", [TRECHOS[0]], { uso: "contexto", env: COM_CHAVE, fetch: preso, timeoutMs: 200 });
    const levou = Date.now() - inicio;
    confere(lento[0].motivo === "timeout" && levou < 250, `T8 timeout em < 250 ms (levou ${levou})`);

    // fetch que ignora o sinal: o prazo ainda vale
    const inicio2 = Date.now();
    const surdo = await jev.decidir("e", { x: NOUL }, { uso: "contexto", env: COM_CHAVE, fetch: () => new Promise(() => {}), timeoutMs: 200 });
    const levou2 = Date.now() - inicio2;
    confere(surdo.x.motivo === "timeout" && levou2 < 250, `T8 fetch que ignora o sinal (levou ${levou2})`);

    // 20 trechos: 16 julgados e 4 entrada_invalida
    const espia = espiao(() => respostaJson({ answers: { relevante: { noul: 0.9 } } }));
    const muitos = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, texto: `texto ${i}` }));
    const r = await jev.julgar("p", muitos, { uso: "contexto", env: COM_CHAVE, fetch: espia.fetch });
    confere(r.length === 20 && r.slice(0, 16).every((x) => x.estado === "ok") && r.slice(16).every((x) => x.motivo === "entrada_invalida"), "T8 20 trechos = 16 + 4");
    confere(espia.chamadas.length === 16, "T8 so 16 requisicoes");
  });
  confere(barulho === "", `T8 nada escrito em stdout/stderr (escreveu: ${JSON.stringify(barulho)})`);
}

// ---- T9: entradas ruins --------------------------------------------------------------------
{
  const espia = espiao(() => respostaJson({}));
  const base = { uso: "contexto", env: COM_CHAVE, fetch: espia.fetch };
  confere(igual(await jev.julgar("p", null, base), []) && igual(await jev.julgar("p", [], base), []) && igual(await jev.julgar("p", "texto", base), []), "T9 trechos nulo, vazio ou nao array");
  const semId = await jev.julgar("p", [{ texto: "t" }, { id: "a", texto: "" }], base);
  confere(semId.every((x) => x.motivo === "entrada_invalida"), "T9 trecho sem id ou sem texto");
  confere(igual(await jev.decidir("e", {}, base), {}) && igual(await jev.decidir("e", null, base), {}), "T9 perguntas vazias ou nao objeto");
  const opcoesVazias = await jev.decidir("e", { x: { tipo: "escolha", instrucao: "?", opcoes: {} } }, base);
  confere(opcoesVazias.x.motivo === "entrada_invalida", "T9 opcoes vazias");
  const muitas = {};
  for (let i = 0; i < 256; i++) muitas["o" + i] = "d";
  confere((await jev.decidir("e", { x: { tipo: "escolha", instrucao: "?", opcoes: muitas } }, base)).x.motivo === "entrada_invalida", "T9 256 opcoes");
  delete muitas.o0;
  const so255 = await jev.decidir("e", { x: { tipo: "escolha", instrucao: "?", opcoes: muitas } }, { ...base, fetch: espiao(() => respostaJson({ answers: {} })).fetch });
  confere(so255.x.motivo === "resposta_invalida", "T9 255 opcoes passam da validacao");
  confere((await jev.decidir("e", { x: { tipo: "outro", instrucao: "?" } }, base)).x.motivo === "entrada_invalida", "T9 tipo desconhecido");
  confere((await jev.decidir("e", { x: { tipo: "noul", instrucao: 5 } }, base)).x.motivo === "entrada_invalida", "T9 instrucao nao string");
  const circular = {};
  circular.eu = circular;
  confere((await jev.decidir(circular, { x: NOUL }, base)).x.motivo === "entrada_invalida", "T9 estado circular");
  confere((await jev.julgar("p", TRECHOS, undefined)).every((x) => x.motivo === "entrada_invalida"), "T9 sem opcoes");
  confere(espia.chamadas.length === 0, "T9 nada foi enviado");
}

// ---- T10: CLI ------------------------------------------------------------------------------
{
  const cli = (entrada, env) => filho([caminhoDoCliente], env ?? {}, entrada);
  const desligado = await cli(JSON.stringify({ op: "julgar", uso: "contexto", pergunta: "x", trechos: [{ id: "a", texto: "b" }] }));
  confere(desligado.codigo === 0 && desligado.stderr === "", "T10 julgar desligado: exit 0, stderr vazia");
  confere(desligado.stdout === '{"ok":true,"resultado":[{"estado":"indisponivel","motivo":"desligado"}]}\n', `T10 envelope desligado (${desligado.stdout.trim()})`);

  const falso = await cli(JSON.stringify({ op: "decidir", uso: "contexto", estado: "e", perguntas: { q: NOUL } }), { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: "sim" });
  confere(JSON.parse(falso.stdout).resultado.q.probabilidade === 0.95 && falso.codigo === 0, "T10 decidir com falso");

  const ruim = await cli("{");
  confere(ruim.codigo === 0 && ruim.stdout === '{"ok":false,"motivo":"entrada_invalida"}\n', "T10 stdin invalida");
  const opDesconhecida = await cli(JSON.stringify({ op: "outra" }));
  confere(opDesconhecida.stdout === '{"ok":false,"motivo":"entrada_invalida"}\n' && opDesconhecida.codigo === 0, "T10 op desconhecida");

  // carregar o modulo nao escreve nada (emenda 1)
  const carga = await filho(["-e", `require(${JSON.stringify(caminhoDoCliente)})`], {});
  confere(carga.stdout === "" && carga.stderr === "" && carga.codigo === 0, "T10 carregar o modulo e silencioso");
}

console.log("jev: T1-T10 OK (parte cliente; sem rede)");

// ==== Parte hook: T11-T16 ======================================================================
// Roda o hook da worktree contra o de origin/dev, sempre com o cliente falso: nada aqui toca a rede.

function naoMedi(motivo) {
  console.error("NÃO MEDI: " + motivo);
  process.exit(2);
}

// Escolha dos aprovados do T16 (#51). O roteiro do falso casa por substring do caminho normalizado
// (regraCasa do hooks/jev.js): a regra de A aprova todo trecho cujo caminho CONTEM o de A, e o hook
// usa o caminho como id. Fica de fora todo candidato de 6 em diante cujo caminho esta contido no de
// um dos cinco primeiros (igual incluso), porque a regra dele aprovaria aquele. O sentido inverso
// (o candidato contem o caminho de um dos cinco) nao aprova ninguem dos cinco e fica (emenda
// 2026-11-11). O conjunto fecha: um de fora nao contem nenhum aprovado, senao o dos cinco que o
// contem tambem conteria. Devolve na ordem do ranking; vazio = nao ha como provar.
function aprovadosDoT16(enviados) {
  const cinco = enviados.slice(0, 5);
  return enviados.slice(5).filter((c) => !cinco.some((b) => b.caminho.includes(c.caminho)));
}

// Roteiro do falso que aprova (0.95) so os caminhos dados; o resto cai no padrao (0.05).
const roteiroDoT16 = (aprovados) => ({
  regras: aprovados.map((a) => ({ quando: { trechoId: a.caminho }, responde: { probabilidade: 0.95 } })),
  padrao: { probabilidade: 0.05 },
});

// Caso sintetico da escolha (#51): roda antes do pre-voo, sem indice e sem rede.
{
  const c = (posicao, caminho) => ({ posicao, probabilidade: 0.95, caminho });
  const lista = [
    c(1, "/r/a.md"),
    c(2, "/r/b.md"),
    c(3, "/r/c.md"),
    c(4, "/r/d.md"),
    c(5, "/r/e.md"),
    c(6, "/r/e.md"),
    c(7, "/r/f.md"),
    c(8, "/r/b.md/g.md"),
    c(9, "g.md"),
    c(10, "/r/c"),
    c(11, "/r/f.md"),
  ];
  // 6 repete o 5 e 10 esta contido no 3: fora. 8 contem o 2 e 9 esta contido no 8 (aprovado): ficam.
  confere(igual(aprovadosDoT16(lista).map((x) => x.posicao), [7, 8, 9, 11]), "T16 escolha sintetica: so 7, 8, 9 e 11 escapam da colisao");
  confere(aprovadosDoT16(lista.slice(0, 6).concat([c(7, "/r/a.md"), c(8, "/r/b.md")])).length === 0, "T16 escolha sintetica: tudo colide = nenhum aprovado");
  const limpa = ["/r/a.md", "/r/b.md", "/r/c.md", "/r/d.md", "/r/e.md", "/r/f.md", "/r/g.md"].map((p, i) => c(i + 1, p));
  confere(igual(aprovadosDoT16(limpa), limpa.slice(5)), "T16 escolha sintetica: sem colisao aprova 6..n");
  // O falso real confirma que o roteiro aprova exatamente esses. Sem try/finally: o confere sai com process.exit.
  const pastaSintetica = mkdtempSync(join(tmpdir(), "jev-t16-"));
  process.on("exit", () => rmSync(pastaSintetica, { recursive: true, force: true }));
  const roteiroSintetico = join(pastaSintetica, "roteiro-t16-sintetico.json");
  writeFileSync(roteiroSintetico, JSON.stringify(roteiroDoT16(aprovadosDoT16(lista))));
  const vs = await jev.julgar("p", lista.map((x) => ({ id: x.caminho, texto: "t" })), {
    uso: "contexto",
    env: { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: roteiroSintetico },
  });
  // O hook descarta o filtro inteiro se algum veredito nao for 'ok' (hooks/brain-contexto.js:287).
  confere(vs.length === lista.length && vs.every((v) => v.estado === "ok"), "T16 escolha sintetica: todo veredito do falso e 'ok'");
  // 0.5 = LIMIAR_JEV do hook (hooks/brain-contexto.js:238).
  confere(
    igual(lista.filter((_, i) => vs[i].estado === "ok" && vs[i].probabilidade >= 0.5).map((x) => x.posicao), [7, 8, 9, 11]),
    "T16 escolha sintetica: o falso aprova so 7, 8, 9 e 11"
  );
  console.log("jev: T16 escolha sintetica OK (sem indice)");
}

const repo = join(root, "..");
const hookDaWorktree = join(repo, "hooks", "brain-contexto.js");
const norm = (s) => String(s).toLowerCase().replace(/\\/g, "/");
const semCr = (s) => s.replace(/\r/g, "");

// Pre-voo minimo, o mesmo do injecao.mjs: sem indice e sem dist/ o hook nao injeta nada, e "nao
// injetou" seria indistinguivel de "o filtro esvaziou o bloco".
const cfgDoHook = require(join(repo, "hooks", "brain-config.js"));
const conf = cfgDoHook.carregar();
if (!conf) naoMedi(`sem lista de workspaces utilizavel em ${cfgDoHook.ARQUIVO}`);
if (!conf.db || !existsSync(conf.db)) naoMedi(`indice nao encontrado: ${conf.db || "(chave db ausente)"}`);
const distDoIndice = join(dirname(conf.db), "..", "dist");
for (const modulo of ["db.js", "search.js"]) {
  if (!existsSync(join(distDoIndice, modulo))) naoMedi(`${join(distDoIndice, modulo)} nao existe: o hook importa o dist/ da instalacao`);
}

// Pasta temporaria com a referencia (hook e config de origin/dev) e os roteiros; apagada na saida.
const pastaTemporaria = mkdtempSync(join(tmpdir(), "jev-hook-"));
process.on("exit", () => rmSync(pastaTemporaria, { recursive: true, force: true }));

// O hook faz require('./brain-config.js'): a referencia precisa dos dois lado a lado, da mesma ref.
const doGit = (arquivo) => {
  try {
    return execFileSync("git", ["show", `origin/dev:hooks/${arquivo}`], { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 8 * 1024 * 1024 });
  } catch {
    return null;
  }
};
const hookDeReferencia = join(pastaTemporaria, "referencia", "brain-contexto.js");
{
  const hook = doGit("brain-contexto.js");
  const config = doGit("brain-config.js");
  if (hook === null || config === null) naoMedi("git show origin/dev:hooks/brain-contexto.js falhou (falta o fetch de origin/dev?)");
  mkdirSync(join(pastaTemporaria, "referencia"));
  writeFileSync(hookDeReferencia, hook);
  writeFileSync(join(pastaTemporaria, "referencia", "brain-config.js"), config);
}

const CWD_DE_PROVA = join(homedir(), "pessoal", "claude-brain");
const PROMPT_DE_PROVA = "como o hook de contexto filtra os trechos que injeta";
const PROMPT_DE_ENTIDADE = "/gm-spec #42";

// Um hook, um prompt: devolve a stdout crua, a stderr e quanto levou. O env nunca leva a chave.
function rodarHook(caminho, prompt, env) {
  return new Promise((resolver) => {
    const ambiente = { ...jev.envSemJev(process.env), ...env };
    if (!env.BRAIN_HOOK_DEBUG) delete ambiente.BRAIN_HOOK_DEBUG;
    const inicio = Date.now();
    const proc = spawn(process.execPath, [caminho], { env: ambiente, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    // O harness real da 10 s ao hook; aqui o corte e mais folgado so para nao pendurar o teste.
    const corte = setTimeout(() => proc.kill("SIGKILL"), 15000);
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("close", (codigo) => {
      clearTimeout(corte);
      resolver({ codigo, stdout, stderr, ms: Date.now() - inicio });
    });
    proc.stdin.end(JSON.stringify({ hook_event_name: "UserPromptSubmit", cwd: CWD_DE_PROVA, prompt }));
  });
}

// O indice vivo muda durante a rodada (o servidor escreve nele). Por isso cada comparacao roda
// referencia e worktree em seguida e, se divergir, repete o par uma vez: so a divergencia que se
// repete conta.
async function parIgual(prompt, envDaWorktree) {
  let ultimo;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const referencia = await rodarHook(hookDeReferencia, prompt, {});
    const worktree = await rodarHook(hookDaWorktree, prompt, envDaWorktree);
    ultimo = { referencia, worktree };
    if (semCr(referencia.stdout) === semCr(worktree.stdout)) return { igual: true, ...ultimo };
  }
  return { igual: false, ...ultimo };
}

// Caminhos dos slots de um bloco: a linha logo depois da linha de meta de cada `N. titulo`.
function caminhosDoBloco(stdout) {
  if (!stdout.trim()) return [];
  const texto = JSON.parse(stdout).hookSpecificOutput.additionalContext;
  const linhas = texto.split("\n");
  const caminhos = [];
  linhas.forEach((l, i) => {
    if (/^\d+\. /.test(l) && linhas[i + 2] !== undefined) caminhos.push(norm(linhas[i + 2].trim()));
  });
  return caminhos;
}
const textoDoBloco = (stdout) => (stdout.trim() ? JSON.parse(stdout).hookSpecificOutput.additionalContext : "");

// Linhas de debug `[brain-contexto] jev <posicao> <probabilidade> <path>`: so os candidatos enviados.
const candidatosEnviados = (stderr) =>
  [...stderr.matchAll(/^\[brain-contexto\] jev (\d+) (\S+) (.+)$/gm)].map((m) => ({ posicao: Number(m[1]), probabilidade: Number(m[2]), caminho: norm(m[3]) }));

const FALSO_SIM = { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: "sim" };

// ---- T11: flag desligada = byte a byte o hook de origin/dev -------------------------------
const t11 = await parIgual(PROMPT_DE_PROVA, {});
if (!textoDoBloco(t11.referencia.stdout).includes("busca lexica automatica")) {
  naoMedi("troque o prompt de prova: com a flag desligada o hook nao injeta pelo caminho de texto");
}
confere(t11.igual, "T11 flag desligada: stdout igual a do hook de origin/dev");
const caminhosDeT11 = caminhosDoBloco(t11.worktree.stdout);

// pre-condicao: candidatos suficientes para T16 (>= 6), contados pelas linhas de debug
const sondagem = await rodarHook(hookDaWorktree, PROMPT_DE_PROVA, { ...FALSO_SIM, BRAIN_HOOK_DEBUG: "1" });
const enviados = candidatosEnviados(sondagem.stderr);
if (enviados.length < 6) naoMedi(`troque o prompt de prova: so ${enviados.length} candidatos chegam ao Jev (T16 precisa de 6 ou mais)`);

// ---- T12: o Jev nega tudo = stdout vazia ---------------------------------------------------
{
  const r = await rodarHook(hookDaWorktree, PROMPT_DE_PROVA, { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: "nao" });
  confere(r.codigo === 0 && r.stdout === "", `T12 falso nao: stdout vazia (saiu ${JSON.stringify(r.stdout.slice(0, 40))})`);
}

// ---- T13: o Jev aprova tudo = os mesmos caminhos de T11, na mesma ordem, com o cabecalho novo --
{
  // Repete o par (sem filtro, com filtro) se o indice mexeu entre uma e outra.
  let ok = false;
  let detalhe = "";
  for (let tentativa = 0; tentativa < 2 && !ok; tentativa++) {
    const sem = await rodarHook(hookDaWorktree, PROMPT_DE_PROVA, {});
    const com = await rodarHook(hookDaWorktree, PROMPT_DE_PROVA, { ...FALSO_SIM, BRAIN_HOOK_DEBUG: "1" });
    const n = candidatosEnviados(com.stderr).length;
    const cabecalho = `filtrada pelo Jev: ${n} de ${n} candidatos passaram; abaixo, os 5 primeiros`;
    ok = igual(caminhosDoBloco(sem.stdout), caminhosDoBloco(com.stdout)) && textoDoBloco(com.stdout).includes(cabecalho);
    detalhe = `n=${n}`;
  }
  confere(ok, `T13 falso sim: mesmos caminhos e cabecalho novo (${detalhe})`);
}

// ---- T14: Jev indisponivel, sem chave, ou lento = igual ao de hoje --------------------------
{
  const casos = [
    ["indisponivel", { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: "indisponivel" }],
    ["sem chave nem falso", { BRAIN_JEV: "contexto" }],
    ["lento", { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: "lento" }],
  ];
  for (const [nome, env] of casos) {
    const r = await parIgual(PROMPT_DE_PROVA, env);
    confere(r.igual, `T14 ${nome}: stdout igual a do hook de origin/dev`);
    // 2200 ms de prazo do hook + 1000 ms de folga para o resto do hook e o spawn
    if (nome === "lento") confere(r.worktree.ms < 3200, `T14 lento resolve em < 3200 ms (levou ${r.worktree.ms})`);
  }
}

// ---- T15: caminho de entidade nao muda e nao chama o cliente -------------------------------
{
  const sem = await parIgual(PROMPT_DE_ENTIDADE, {});
  const bloco = textoDoBloco(sem.referencia.stdout);
  if (!bloco || bloco.includes("busca lexica automatica")) {
    naoMedi("troque o prompt de entidade: com a flag desligada o bloco esta vazio ou nao veio do grafo");
  }
  const com = await parIgual(PROMPT_DE_ENTIDADE, { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: "nao" });
  confere(com.igual, "T15 entidade com falso nao: igual ao da flag desligada");
}

// ---- T16: o Jev aprova so os candidatos de 6 em diante que escapam da colisao = so esses, na ordem do ranking --
{
  // Os aprovados dependem do conjunto exato de caminhos, e o T12-T15 rodam o hook muitas vezes com o
  // indice vivo mudando: sonda de novo logo antes da rodada e, se divergir, repete o par uma vez (T13).
  let ok = false;
  let detalhe = "";
  for (let tentativa = 0; tentativa < 2 && !ok; tentativa++) {
    const sonda = await rodarHook(hookDaWorktree, PROMPT_DE_PROVA, { ...FALSO_SIM, BRAIN_HOOK_DEBUG: "1" });
    const atuais = candidatosEnviados(sonda.stderr);
    if (atuais.length < 6) naoMedi(`troque o prompt de prova: so ${atuais.length} candidatos chegam ao Jev (T16 precisa de 6 ou mais)`);
    const n = atuais.length;
    const aprovados = aprovadosDoT16(atuais);
    if (!aprovados.length) {
      naoMedi("troque o prompt de prova: nenhum candidato de 6 em diante escapa da colisao de caminho com os cinco primeiros");
    }
    const k = aprovados.length;
    const roteiro = join(pastaTemporaria, "roteiro-t16.json");
    writeFileSync(roteiro, JSON.stringify(roteiroDoT16(aprovados)));
    const r = await rodarHook(hookDaWorktree, PROMPT_DE_PROVA, { BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: roteiro });
    // O hook mostra so os LIMITE_FINAL primeiros que passaram (hooks/brain-contexto.js:484), como o cabecalho.
    const esperados = aprovados.slice(0, 5).map((a) => a.caminho);
    const caminhosOk = igual(caminhosDoBloco(r.stdout), esperados);
    const cabecalhoOk = textoDoBloco(r.stdout).includes(`${k} de ${n} candidatos passaram; abaixo, os ${Math.min(k, 5)} primeiros`);
    ok = caminhosOk && cabecalhoOk;
    const posicoes = aprovados.map((a) => a.posicao).join(",");
    detalhe = `candidatos ${posicoes} de ${n}: caminhos ${caminhosOk ? "ok" : "divergem"}, cabecalho ${k} de ${n} ${cabecalhoOk ? "ok" : "ausente"}`;
  }
  confere(ok, `T16 so os aprovados, na ordem do ranking, e cabecalho k de n (${detalhe})`);
}

console.log("jev: T11-T16 OK (parte hook; cliente falso, sem rede)");
