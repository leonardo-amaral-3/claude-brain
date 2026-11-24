// Testes e medicoes da telemetria do brain (claude-brain#66, F1).
//
//   node scripts/telemetria.mjs                 roda todos os casos
//   node scripts/telemetria.mjs --caso gravador roda um caso
//
// Codigos: 0 passou, 1 reprovou, 2 nao medi (sem indice, sem brain-workspaces.json). Como injecao.mjs
// e eval.mjs.
//
// Isolamento (R4): nenhum caso grava no diario vivo (~/.claude/brain-telemetria). Todo caso usa um
// diretorio temporario em BRAIN_TELEMETRIA_DIR, e todo filho que um caso subir parte de
// `envSemJev(process.env)` (que tira BRAIN_JEV*, BRAIN_TELEMETRIA* e a chave) e acrescenta so as
// variaveis do caso. Assim um BRAIN_TELEMETRIA_AB ou BRAIN_TELEMETRIA_DIR exportado no shell nao
// muda o resultado de teste nenhum.
//
// A saida so traz contagens e nomes de caso (R1): nunca caminho de prompt nem texto.
//
// Casos que as proximas tasks acrescentam, em CASOS abaixo: eventos, stdout, ab, poluicao; e os
// modos --custo e --conferir. Nao ha stub que passe: caso que nao existe nao e listado.
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { semJev } from "./sem-jev.mjs";

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

// ---------------------------------------------------------------- execucao

// Proximas tasks acrescentam aqui: eventos, stdout, ab, poluicao.
const CASOS = {
  gravador: casoGravador,
};

async function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--caso");
  const escolhido = i >= 0 ? argv[i + 1] : undefined;
  const desconhecido = argv.filter((a, k) => a.startsWith("--") && a !== "--caso" && argv[k - 1] !== "--caso");
  if (desconhecido.length || (i >= 0 && !escolhido)) {
    console.error(`argumento desconhecido ou sem valor: ${desconhecido.join(" ") || "--caso"}`);
    process.exit(2);
  }
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
      console.log(`FALHOU  ${nome}: exceção ${e?.name ?? "?"}`);
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
