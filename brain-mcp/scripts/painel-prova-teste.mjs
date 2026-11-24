// Teste da seção de gabarito do painel (`painel/prova.mjs`, F3 do épico #66, CA5).
//
//   node scripts/painel-prova-teste.mjs
//
// Códigos como os outros scripts do repo: 0 passou, 1 reprovou, 2 não medi.
//
// Tudo sobre fixtures (`scripts/fixtures/telemetria/prova/`): eventos e transcripts sintéticos, com
// caminhos fictícios, e um banco de chunks montado aqui, num diretório temporário, com o schema mínimo
// de `docs`/`chunks`. Nunca toca o índice vivo nem o diário vivo (`~/.claude/brain-telemetria`): o
// diretório do diário é sempre um temporário (R4).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { PassThrough } from "node:stream";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const fix = join(aqui, "fixtures", "telemetria", "prova");
const prova = await import(new URL("./painel/prova.mjs", import.meta.url));

const tmp = mkdtempSync(join(tmpdir(), "painel-prova-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));

const ler = (arq) => readFileSync(arq, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const eventos = ler(join(fix, "eventos.jsonl"));
const chunks = JSON.parse(readFileSync(join(fix, "chunks.json"), "utf8"));
const sha12 = (t) => createHash("sha256").update(t).digest("hex").slice(0, 12);

/** Banco temporário com o schema mínimo que `amostrar` lê (o do `db.ts`, só as colunas usadas). */
function criarDb(lista) {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE docs (id INTEGER PRIMARY KEY, path TEXT NOT NULL UNIQUE);
           CREATE TABLE chunks (id INTEGER PRIMARY KEY, doc_id INTEGER NOT NULL, text TEXT NOT NULL);`);
  const doc = new Map();
  for (const c of lista) {
    if (!doc.has(c.path)) doc.set(c.path, doc.size + 1);
    db.prepare("INSERT OR IGNORE INTO docs (id, path) VALUES (?, ?)").run(doc.get(c.path), c.path);
    db.prepare("INSERT INTO chunks (id, doc_id, text) VALUES (?, ?, ?)").run(c.id, doc.get(c.path), c.text);
  }
  return db;
}

// Dois chunks vivos mudam de forma, como numa reindexação: o 8 ganha outro id (999), o 9 muda de texto.
function dbDaFixture() {
  const lista = chunks.map((c) => (c.id === 8 ? { ...c, id: 998 } : c.id === 9 ? { ...c, text: "texto NOVO do chunk nove" } : c));
  return criarDb(lista);
}

/** Um ctx novo, com diário e projetos próprios: cada caso grava onde quiser sem ver o do vizinho. */
function novoCtx(extra = {}) {
  const dir = mkdtempSync(join(tmp, "diario-"));
  const projetos = join(tmp, "projetos-" + Math.random().toString(36).slice(2));
  cpSync(join(fix, "transcripts"), projetos, { recursive: true });
  return { eventos, dir, projetos, db: dbDaFixture(), args: [], agora: Date.UTC(2026, 10, 24, 12, 30), ...extra };
}

const amostra = (ctx, resultado) => {
  assert.equal(resultado.codigo, 0, resultado.linhas.join(" | "));
  const nome = /amostra criada: (\S+)/.exec(resultado.linhas[0])[1];
  return ler(join(ctx.dir, "gabarito", nome));
};
const chaveDe = (i) => `${i.sessao}|${i.prompt}|${i.pos}`;

let falhas = 0;
async function caso(nome, fn) {
  try {
    await fn();
    console.log(`ok   ${nome}`);
  } catch (e) {
    falhas++;
    console.log(`FALHA ${nome}\n     ${String(e.message).split("\n").join("\n     ")}`);
  }
}

// O universo válido da fixture, contado à mão (ver o gerador das fixtures): E1 tem 5 itens com prob
// (3 acima do limiar, 2 abaixo), E2 tem 2 (o chunk 998 achado pelo caminho, o 9 descartado por SHA),
// o p-sem-par tem 2 (pareado por horário), o notoria tem 2; a sessão sem transcript, o prompt sem turno
// no transcript, o `jev` indisponível e o item sem chunk não entram.
const VALIDOS = 11;
const VALIDOS_PESSOAL = 9;

await caso("semente fixa sorteia sempre os mesmos itens", async () => {
  const c1 = novoCtx();
  const c2 = novoCtx();
  const r1 = ler(join(c1.dir, "gabarito", /amostra criada: (\S+)/.exec(prova.amostrar(c1, 6, "semente-1").linhas[0])[1])).map(chaveDe);
  const r2 = ler(join(c2.dir, "gabarito", /amostra criada: (\S+)/.exec(prova.amostrar(c2, 6, "semente-1").linhas[0])[1])).map(chaveDe);
  assert.deepEqual(r1, r2);
  assert.equal(r1.length, 6);
  const c3 = novoCtx();
  const r3 = amostra(c3, prova.amostrar(c3, 6, "outra-semente")).map(chaveDe);
  assert.notDeepEqual([...r1].sort(), [...r3].sort(), "outra semente deveria sortear outros itens");
});

await caso("sem semente, a data UTC de hoje é a semente (mesmo dia, mesma amostra)", async () => {
  const c1 = novoCtx();
  const c2 = novoCtx();
  const r1 = amostra(c1, prova.amostrar(c1, 6)).map(chaveDe);
  const r2 = amostra(c2, prova.amostrar(c2, 6)).map(chaveDe);
  assert.deepEqual(r1, r2);
});

await caso("estratos: metade (para cima) acima do limiar, o resto abaixo", async () => {
  for (const [n, acima] of [[4, 2], [5, 3], [6, 3]]) {
    const ctx = novoCtx();
    const itens = amostra(ctx, prova.amostrar(ctx, n, "s"));
    assert.equal(itens.length, n);
    assert.equal(itens.filter((i) => i.prob >= i.limiar).length, acima, `n=${n}`);
  }
});

await caso("estrato curto completa com o outro; pedir mais que o universo devolve o universo", async () => {
  // Só o evento p-sem-par: um acima, um abaixo. Pedindo 4, saem 2.
  const so = eventos.filter((e) => e.prompt === "p-sem-par");
  const ctx = novoCtx({ eventos: so });
  const r = prova.amostrar(ctx, 4, "s");
  assert.equal(amostra(ctx, r).length, 2);
  assert.ok(r.linhas.some((l) => l.startsWith("faltaram 2")), r.linhas.join("|"));
  // Só itens acima do limiar: o estrato de baixo está vazio e o de cima o completa.
  const soAcima = eventos.filter((e) => e.prompt === "p-1").map((e) => ({ ...e, itens: e.itens.filter((i) => i.prob >= 0.5) }));
  const c2 = novoCtx({ eventos: soAcima });
  const itens = amostra(c2, prova.amostrar(c2, 3, "s"));
  assert.equal(itens.length, 3);
  assert.ok(itens.every((i) => i.prob >= i.limiar));
});

await caso("o universo inteiro sai sem repetir (sessao, prompt, pos) e sem item inválido", async () => {
  const ctx = novoCtx();
  const itens = amostra(ctx, prova.amostrar(ctx, 30, "s"));
  assert.equal(itens.length, VALIDOS);
  assert.equal(new Set(itens.map(chaveDe)).size, itens.length);
  // Descartados: sessão sem transcript, prompt sem turno no transcript, SHA que não bate, sem chunk, Jev indisponível.
  assert.ok(!itens.some((i) => i.sessao === "s-sem-transcript"));
  assert.ok(!itens.some((i) => i.prompt === "p-7"));
  assert.ok(!itens.some((i) => i.prompt === "p-2" && i.pos === 3), "o trecho cujo SHA não bate foi julgado");
  assert.ok(!itens.some((i) => i.prompt === "p-2" && i.pos === 4), "item sem chunk entrou no universo");
  assert.ok(!itens.some((i) => i.prompt === "p-4"));
});

await caso("nenhum item sem pergunta; pergunta ≤ 500 e trecho ≤ 600", async () => {
  const ctx = novoCtx();
  const itens = amostra(ctx, prova.amostrar(ctx, 30, "s"));
  for (const i of itens) {
    assert.ok(typeof i.pergunta === "string" && i.pergunta.trim().length > 0, `sem pergunta: ${chaveDe(i)}`);
    assert.ok(i.pergunta.length <= 500, `pergunta de ${i.pergunta.length}`);
    assert.ok(i.trecho.length > 0 && i.trecho.length <= 600, `trecho de ${i.trecho.length}`);
  }
  // O corte acontece de fato: a pergunta do p-1 e o chunk 1 passam dos limites na fixture.
  assert.equal(itens.find((i) => i.prompt === "p-1" && i.pos === 1).pergunta.length, 500);
  assert.equal(itens.find((i) => i.prompt === "p-1" && i.pos === 1).trecho.length, 600);
});

await caso("o formato da linha: campos do contrato, julgamento nulo, pos e chunk guardados", async () => {
  const ctx = novoCtx();
  const i = amostra(ctx, prova.amostrar(ctx, 30, "s")).find((x) => x.prompt === "p-1" && x.pos === 2);
  assert.deepEqual(Object.keys(i), ["v", "criado", "sessao", "prompt", "ts_evento", "caminho", "fonte", "pos", "chunk", "prob", "limiar", "mostrado", "grupo", "pergunta", "trecho", "julgamento", "nota"]);
  assert.equal(i.v, 1);
  assert.equal(i.julgamento, null);
  assert.equal(i.nota, "");
  assert.equal(i.chunk, 2);
  assert.equal(i.prob, 0.8);
  assert.equal(i.limiar, 0.5);
  assert.equal(i.mostrado, true);
  assert.equal(i.grupo, "com_filtro");
  assert.equal(i.fonte, "planning");
  assert.equal(i.criado, "2026-11-24T12:30:00.000Z");
});

await caso("o trecho é o chunk com o SHA gravado; o id que mudou é achado pelo caminho", async () => {
  const ctx = novoCtx();
  const itens = amostra(ctx, prova.amostrar(ctx, 30, "s"));
  const c = (id) => chunks.find((x) => x.id === id);
  assert.equal(itens.find((i) => i.prompt === "p-1" && i.pos === 2).trecho, c(2).text);
  // O evento diz chunk 999, que não existe; o texto sai de /w/h.md pelo SHA (chunk vivo 998).
  const reindexado = itens.find((i) => i.prompt === "p-2" && i.pos === 2);
  assert.equal(reindexado.chunk, 999);
  assert.equal(reindexado.trecho, c(8).text);
  assert.equal(sha12(reindexado.trecho), sha12(c(8).text));
});

await caso("o prompt do slash é <command-name> + argumento; o pareamento por horário acha o turno", async () => {
  const ctx = novoCtx();
  const itens = amostra(ctx, prova.amostrar(ctx, 30, "s"));
  assert.equal(itens.find((i) => i.prompt === "p-2" && i.pos === 1).pergunta, "/gm-spec spec da telemetria #66");
  assert.equal(itens.find((i) => i.prompt === "p-sem-par" && i.pos === 1).pergunta, "Qual o horario que casa este prompt?");
});

await caso("item com chunk nulo fica fora do universo", async () => {
  const ctx = novoCtx();
  const itens = amostra(ctx, prova.amostrar(ctx, 30, "s"));
  assert.ok(itens.every((i) => Number.isInteger(i.chunk)));
});

await caso("--ws restringe o universo ao workspace (lista crua e objeto)", async () => {
  for (const args of [["--ws", "notoria"], { ws: "notoria" }]) {
    const ctx = novoCtx({ args });
    const itens = amostra(ctx, prova.amostrar(ctx, 30, "s"));
    assert.equal(itens.length, 2);
    assert.ok(itens.every((i) => i.sessao === "s-3"));
  }
  const ctx = novoCtx({ args: ["--ws", "pessoal"] });
  assert.equal(amostra(ctx, prova.amostrar(ctx, 30, "s")).length, VALIDOS_PESSOAL);
  const sem = novoCtx({ args: undefined });
  assert.equal(amostra(sem, prova.amostrar(sem, 30, "s")).length, VALIDOS);
  const outro = prova.amostrar(novoCtx({ args: ["--ws", "inexistente"] }), 30, "s");
  assert.equal(outro.codigo, 2);
});

await caso("universo vazio e ctx.db nulo devolvem código 2 e não criam arquivo", async () => {
  const vazio = novoCtx({ eventos: [] });
  const r = prova.amostrar(vazio, 30, "s");
  assert.equal(r.codigo, 2);
  assert.ok(r.linhas.length >= 1);
  assert.ok(!existsSync(join(vazio.dir, "gabarito")));
  const semDb = novoCtx({ db: null });
  assert.equal(prova.amostrar(semDb, 30, "s").codigo, 2);
  assert.ok(!existsSync(join(semDb.dir, "gabarito")));
  assert.equal(prova.amostrar(novoCtx(), 0, "s").codigo, 2);
  assert.equal(prova.amostrar(novoCtx(), Number.NaN, "s").codigo, 2);
});

await caso("o nome do arquivo é amostra-AAAAMMDD-HHmm (UTC) e uma segunda rodada no minuto não o sobrescreve", async () => {
  const ctx = novoCtx();
  const r = prova.amostrar(ctx, 4, "s");
  assert.equal(r.linhas[0], "amostra criada: amostra-20261124-1230.jsonl");
  assert.deepEqual(readdirSync(join(ctx.dir, "gabarito")), ["amostra-20261124-1230.jsonl"]);
  const antes = readFileSync(join(ctx.dir, "gabarito", "amostra-20261124-1230.jsonl"), "utf8");
  const de_novo = prova.amostrar(ctx, 4, "outra");
  assert.equal(de_novo.codigo, 2);
  assert.equal(readFileSync(join(ctx.dir, "gabarito", "amostra-20261124-1230.jsonl"), "utf8"), antes);
});

await caso("as linhas devolvidas não trazem caminho nem pergunta (R1)", async () => {
  const ctx = novoCtx();
  const r = prova.amostrar(ctx, 30, "s");
  const saida = r.linhas.join("\n");
  assert.ok(!saida.includes("/w/"), saida);
  assert.ok(!saida.includes(ctx.dir), saida);
  for (const i of ler(join(ctx.dir, "gabarito", "amostra-20261124-1230.jsonl"))) {
    assert.ok(!saida.includes(i.pergunta.slice(0, 20)), saida);
  }
});

await caso("o teste não escreveu fora do diretório temporário", async () => {
  const vivo = join(process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME ?? "", ".claude"), "brain-telemetria", "gabarito");
  const antes = existsSync(vivo) ? readdirSync(vivo).length : 0;
  const ctx = novoCtx();
  prova.amostrar(ctx, 4, "s");
  assert.equal(existsSync(vivo) ? readdirSync(vivo).length : 0, antes);
});

// ---- julgar: terminal falso (PassThrough com isTTY) para provar o laço sem depender de um TTY real.

/** Um ctx com amostra de 4 itens já criada; devolve também o caminho do arquivo. */
function comAmostra() {
  const ctx = novoCtx();
  prova.amostrar(ctx, 4, "s");
  return { ctx, arquivo: join(ctx.dir, "gabarito", "amostra-20261124-1230.jsonl") };
}

/** Roda `julgar` com `respostas` digitadas (uma por linha) e devolve resultado e o que foi mostrado. */
async function julgarCom(ctx, arquivo, respostas, isTTY = true) {
  const stdin = new PassThrough();
  stdin.isTTY = isTTY;
  const stdout = new PassThrough();
  let mostrado = "";
  stdout.on("data", (d) => (mostrado += d));
  stdin.end(respostas.map((r) => r + "\n").join(""));
  const r = await prova.julgar({ ...ctx, stdin, stdout }, arquivo);
  return { r, mostrado };
}

await caso("julgar sem TTY sai 2 com a mensagem e deixa o arquivo intacto", async () => {
  const { ctx, arquivo } = comAmostra();
  const antes = readFileSync(arquivo, "utf8");
  const { r } = await julgarCom(ctx, arquivo, ["s"], false);
  assert.equal(r.codigo, 2);
  assert.match(r.linhas[0], /TTY/);
  assert.equal(readFileSync(arquivo, "utf8"), antes);
});

await caso("julgar grava s/n a cada resposta, pula com p e para com q", async () => {
  const { ctx, arquivo } = comAmostra();
  const antes = ler(arquivo);
  const { r, mostrado } = await julgarCom(ctx, arquivo, ["s", "talvez", "n", "p", "q"]);
  assert.equal(r.codigo, 0);
  assert.match(r.linhas[0], /julgados agora: 2 \(1 sim, 1 não\); pulados: 1; ainda sem julgamento: 2 \(saiu antes do fim\)/);
  const depois = ler(arquivo);
  assert.deepEqual(depois.map((i) => i.julgamento), ["sim", "nao", null, null]);
  // O resto da linha não muda: só `julgamento`.
  for (const [k, i] of depois.entries()) assert.deepEqual({ ...i, julgamento: null }, { ...antes[k], julgamento: null });
  // O texto vai ao terminal, e a resposta inválida foi perguntada de novo (4 prompts de resposta: s, talvez, n, p; q é o 5º).
  assert.ok(mostrado.includes(antes[0].pergunta) && mostrado.includes(antes[0].trecho));
  assert.equal(mostrado.split("[s]im, [n]ão").length - 1, 5);
  // Nada de arquivo temporário sobrando.
  assert.deepEqual(readdirSync(join(ctx.dir, "gabarito")), ["amostra-20261124-1230.jsonl"]);
});

await caso("julgar retoma onde parou: só pergunta o que está sem julgamento", async () => {
  const { ctx, arquivo } = comAmostra();
  await julgarCom(ctx, arquivo, ["s", "n", "q"]);
  const { r, mostrado } = await julgarCom(ctx, arquivo, ["n", "s"]);
  assert.match(r.linhas[0], /julgados agora: 2 \(1 sim, 1 não\); pulados: 0; ainda sem julgamento: 0$/);
  assert.equal(mostrado.split("[s]im, [n]ão").length - 1, 2);
  assert.deepEqual(ler(arquivo).map((i) => i.julgamento), ["sim", "nao", "nao", "sim"]);
  const de_novo = await julgarCom(ctx, arquivo, []);
  assert.equal(de_novo.r.codigo, 0);
  assert.match(de_novo.r.linhas[0], /nada a julgar/);
});

await caso("julgar: entrada que acaba no meio equivale a sair, sem perder o já julgado", async () => {
  const { ctx, arquivo } = comAmostra();
  const { r } = await julgarCom(ctx, arquivo, ["sim"]);
  assert.equal(r.codigo, 0);
  assert.deepEqual(ler(arquivo).map((i) => i.julgamento), ["sim", null, null, null]);
});

await caso("julgar aceita só o nome do arquivo (o que --amostrar imprime); inexistente sai 2", async () => {
  const { ctx } = comAmostra();
  const { r } = await julgarCom(ctx, "amostra-20261124-1230.jsonl", ["s", "q"]);
  assert.equal(r.codigo, 0);
  assert.match(r.linhas[0], /1 sim/);
  assert.equal((await julgarCom(ctx, "amostra-inexistente.jsonl", ["s"])).r.codigo, 2);
  assert.equal((await julgarCom(ctx, undefined, ["s"])).r.codigo, 2);
});

await caso("julgar: o que retorna não traz caminho nem pergunta (R1); o texto só vai ao terminal", async () => {
  const { ctx, arquivo } = comAmostra();
  const itens = ler(arquivo);
  const { r } = await julgarCom(ctx, arquivo, ["s", "q"]);
  const saida = r.linhas.join("\n");
  assert.ok(!saida.includes("/w/") && !saida.includes(itens[0].pergunta.slice(0, 20)), saida);
});

await caso("julgar não come linha que não é JSON", async () => {
  const { ctx, arquivo } = comAmostra();
  writeFileSync(arquivo, readFileSync(arquivo, "utf8") + "linha estranha\n");
  await julgarCom(ctx, arquivo, ["s", "q"]);
  assert.equal(readFileSync(arquivo, "utf8").split("\n").filter(Boolean).at(-1), "linha estranha");
});

console.log(falhas ? `\n${falhas} caso(s) reprovado(s)` : "\ntodos os casos passaram");
process.exit(falhas ? 1 : 0);
