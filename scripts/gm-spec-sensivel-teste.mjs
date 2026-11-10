#!/usr/bin/env node
// Testa skills/gm-spec/sensivel.mjs sem rede e sem framework (padrão de skills-comum-teste.mjs).
// Uso: node scripts/gm-spec-sensivel-teste.mjs
// Sai 0 se todos os cenários passam, 1 se algum falha.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const caminhoModulo = join(aqui, "..", "skills", "gm-spec", "sensivel.mjs");
const { CATEGORIAS, decidir, unir, montarLinha } = await import(pathToFileURL(caminhoModulo).href);

let falhas = 0;
function afirmar(ok, msg) {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${msg}`);
  if (!ok) falhas++;
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Monta um objeto com o mesmo valor nas quatro categorias, e permite trocar algumas.
const nas4 = (valor, trocas = {}) => Object.fromEntries(CATEGORIAS.map((c) => [c, c in trocas ? trocas[c] : valor]));
const nao = (confianca) => ({ estado: "ok", resposta: "nao", confianca });
const sim = (confianca) => ({ estado: "ok", resposta: "sim", confianca });
const indisponivel = { estado: "indisponivel", motivo: "teste" };

console.log("decidir: a regra de CA1, fechada por inversão");
{
  let r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95)) });
  afirmar(r.sensivel === false && igual(r.motivos, []), "autor nao ×4 e Jev nao 0,95 ×4 → não sensível, sem motivos");

  r = decidir({ autor: nas4("nao", { dado: "sim" }), jev: nas4(nao(0.99)) });
  afirmar(igual(r.motivos, ["autor"]) && r.sensivel, "autor dado=sim, Jev nao 0,99 → só autor (o Jev não dispensa)");
  afirmar(igual(r.categorias.dado.motivos, ["autor"]) && igual(r.categorias.deploy.motivos, []), "o motivo fica só na categoria afetada");

  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { deploy: sim(0.6) }) });
  afirmar(igual(r.motivos, ["jev-sim"]) && igual(r.categorias.deploy.motivos, ["jev-sim"]), "Jev deploy sim 0,60 → jev-sim em deploy");

  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { deploy: sim(0.01) }) });
  afirmar(igual(r.motivos, ["jev-sim"]), "Jev sim vale em qualquer confiança");

  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { migration: nao(0.89) }) });
  afirmar(igual(r.motivos, ["confianca-baixa"]), "Jev migration nao 0,89 → confiança baixa");
  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { migration: nao(0.9) }) });
  afirmar(r.sensivel === false, "Jev migration nao 0,90 exato → não sensível (a borda é limpa)");

  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { faturamento: indisponivel }) });
  afirmar(igual(r.motivos, ["jev-indisponivel"]), "Jev faturamento indisponível → jev-indisponivel");

  r = decidir({ autor: nas4("sim"), jev: nas4(indisponivel) });
  afirmar(igual(r.motivos, ["autor", "jev-indisponivel"]), "autor sim + Jev indisponível → autor, jev-indisponivel, nessa ordem");
}

console.log("decidir: valor inesperado nunca deixa passar (fail-closed)");
{
  const jevLimpo = nas4(nao(0.95));
  for (const [rotulo, valor] of [["undefined", undefined], ['"Sim"', "Sim"], ['"não"', "não"], ["null", null]]) {
    const r = decidir({ autor: nas4(valor), jev: jevLimpo });
    afirmar(r.sensivel && CATEGORIAS.every((c) => igual(r.categorias[c].motivos, ["autor"])), `autor ${rotulo} → motivo autor nas quatro`);
  }

  let r = decidir({ autor: { dado: "nao", faturamento: "nao", migration: "nao" }, jev: jevLimpo });
  afirmar(igual(r.categorias.deploy.motivos, ["autor"]) && igual(r.categorias.dado.motivos, []), "autor sem a chave deploy → autor só em deploy");

  const { dado, ...semDado } = jevLimpo;
  r = decidir({ autor: nas4("nao"), jev: semDado });
  afirmar(igual(r.categorias.dado.motivos, ["jev-indisponivel"]) && igual(r.categorias.deploy.motivos, []), "jev sem a chave dado → jev-indisponivel só em dado");

  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { dado: nao(NaN) }) });
  afirmar(igual(r.categorias.dado.motivos, ["jev-indisponivel"]), "confianca NaN → jev-indisponivel (resposta inválida)");

  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { dado: nao(1.5) }) });
  afirmar(igual(r.categorias.dado.motivos, ["jev-indisponivel"]), "confianca fora de [0,1] → jev-indisponivel");

  r = decidir({ autor: nas4("nao"), jev: undefined });
  afirmar(CATEGORIAS.every((c) => igual(r.categorias[c].motivos, ["jev-indisponivel"])), "jev inteiro undefined → jev-indisponivel nas quatro");

  r = decidir({ autor: nas4("nao"), jev: nas4({ resposta: "talvez" }) });
  afirmar(CATEGORIAS.every((c) => igual(r.categorias[c].motivos, ["jev-indisponivel"])), "resposta fora do contrato → jev-indisponivel");
}

console.log("montarLinha: texto exato");
{
  const m = (motivos, categorias) => Object.fromEntries(CATEGORIAS.map((c) => [c, categorias.includes(c) ? motivos : []]));
  const autorDado = { ...m(["jev-indisponivel"], CATEGORIAS), dado: ["autor", "jev-indisponivel"] };
  afirmar(montarLinha(autorDado) === "Spec sensível: sim — autor (dado); Jev indisponível (as quatro)", "autor (dado); Jev indisponível (as quatro)");
  afirmar(montarLinha(m([], [])) === "Spec sensível: não", "sem motivos → Spec sensível: não");
  afirmar(
    montarLinha(m(["confianca-baixa"], ["faturamento", "migration"])) === "Spec sensível: sim — confiança baixa (faturamento, migration)",
    "duas categorias → confiança baixa (faturamento, migration)",
  );
  afirmar(
    montarLinha({ dado: ["jev-indisponivel", "autor"], faturamento: [], deploy: [], migration: [] }) === "Spec sensível: sim — autor (dado); Jev indisponível (dado)",
    "os motivos saem na ordem de MOTIVOS, não na ordem de entrada",
  );
}

console.log("unir: o veredito só cresce");
{
  const vazio = nas4([]);
  let r = unir({ ...vazio, dado: ["autor"] }, vazio);
  afirmar(igual(r.uniao.dado, ["autor"]) && igual(r.novos, []), "autor em dado antes, atual limpo → dado continua com autor, sem novos");

  r = unir(vazio, { ...vazio, deploy: ["jev-sim"] });
  afirmar(igual(r.uniao.deploy, ["jev-sim"]) && igual(r.novos, ["jev-sim:deploy"]), "jev-sim novo em deploy → entra em novos");

  r = unir(vazio, { ...vazio, deploy: ["jev-indisponivel"], dado: ["confianca-baixa"] });
  afirmar(igual(r.novos, []) && igual(r.uniao.deploy, ["jev-indisponivel"]), "jev-indisponivel e confiança baixa novos não entram em novos");

  r = unir({ ...vazio, deploy: ["jev-sim"] }, { ...vazio, deploy: ["jev-sim", "autor"] });
  afirmar(igual(r.uniao.deploy, ["autor", "jev-sim"]) && igual(r.novos, ["autor:deploy"]), "só o par que não estava antes é novo; a união sai em ordem de MOTIVOS");

  r = unir(undefined, { ...vazio, migration: ["autor"] });
  afirmar(igual(r.uniao.migration, ["autor"]) && igual(r.novos, ["autor:migration"]), "sem rodada anterior → anterior vazio");

  r = unir({ dado: { motivos: ["autor"] } }, vazio);
  afirmar(igual(r.uniao.dado, ["autor"]), "aceita também a forma { categoria: { motivos } } do decidir");
}

console.log("estático: um cliente só, sem rede nem processo (CA6)");
{
  const fonte = readFileSync(caminhoModulo, "utf8");
  const proibido = /fetch\s*\(|XMLHttpRequest|WebSocket|undici|["'](node:)?(http|https|http2|net|tls|dgram|child_process)["']/;
  afirmar(!proibido.test(fonte), "o fonte não casa rede nem child_process");

  // `import(` dinâmico só dentro de carregarJev: a posição de cada um tem de cair no corpo dela.
  const inicio = fonte.indexOf("export async function carregarJev");
  const fim = fonte.indexOf("\n}\n", inicio);
  const posicoes = [...fonte.matchAll(/\bimport\s*\(/g)].map((x) => x.index);
  afirmar(inicio !== -1 && fim !== -1, "carregarJev existe no fonte");
  afirmar(posicoes.every((p) => p > inicio && p < fim), `todo import( dinâmico está em carregarJev (${posicoes.length} encontrado(s))`);
}

console.log(falhas === 0 ? "\ntudo certo" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
