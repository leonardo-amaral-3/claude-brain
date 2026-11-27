#!/usr/bin/env node
// As condições do merge na dev do /gm-ship (card #81, F3 do épico #78), em script: o que é mecânico
// fica aqui, testável sem cota e sem a Validação em dev; a skill só decide o que fazer com a `acao`.
//
// Só lê: `gh pr view`, `gh pr checks`, `git fetch`, `git merge-base` e `sensivel.mjs --consultar`.
// Nunca faz merge, push nem escreve em arquivo.
//
// Uso (no cwd da worktree da PR):
//   node merge-dev.mjs --repo <owner>/<repo> --pr <n> --spec <spec.md> --base <dev> --ci <sim|nao>
// Saída: uma linha JSON
//   {pode, head, condicoes:{base, mergeavel, atualizada, ci, g4, sensivel}, falhas:[..], acao}
// com `acao` em "merge" | "atualizar" | "esperar-ci" | "parar". Código 0 sempre que conseguiu ler;
// código 2 para argumento ou leitura (mensagem em pt-BR no stderr); outro código é falha do script.
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ACOES = ["merge", "atualizar", "esperar-ci", "parar"];
const SENSIVEL = join(dirname(fileURLToPath(import.meta.url)), "..", "gm-spec", "sensivel.mjs");

class ErroDeUso extends Error {}

export function lerArgumentos(argv) {
  const valores = {};
  const nomes = ["--repo", "--pr", "--spec", "--base", "--ci"];
  for (let i = 0; i < argv.length; i++) {
    const nome = argv[i];
    if (!nomes.includes(nome)) {
      throw new ErroDeUso(`argumento inesperado: ${nome}. Uso: ${nomes.map((n) => `${n} <valor>`).join(" ")}`);
    }
    const valor = argv[++i];
    if (valor === undefined || valor.startsWith("--")) throw new ErroDeUso(`${nome} precisa de um valor`);
    if (nome in valores) throw new ErroDeUso(`${nome} repetido`);
    valores[nome] = valor;
  }
  const faltando = nomes.filter((n) => !(n in valores));
  if (faltando.length > 0) throw new ErroDeUso(`faltam: ${faltando.join(", ")}`);
  if (!/^[^/\s]+\/[^/\s]+$/.test(valores["--repo"])) throw new ErroDeUso("--repo deve ser <owner>/<repo>");
  if (!/^[1-9][0-9]*$/.test(valores["--pr"])) throw new ErroDeUso("--pr deve ser um número de PR");
  if (valores["--ci"] !== "sim" && valores["--ci"] !== "nao") throw new ErroDeUso("--ci deve ser sim ou nao");
  return { repo: valores["--repo"], pr: valores["--pr"], spec: valores["--spec"], base: valores["--base"], ci: valores["--ci"] };
}

function executar(comando, argumentos) {
  const r = spawnSync(comando, argumentos, { encoding: "utf8", timeout: 120000 });
  if (r.error) throw new ErroDeUso(`não consegui rodar ${comando}: ${r.error.message}`);
  return r;
}

const gh = (argumentos) => executar("gh", argumentos);
const git = (argumentos) => executar("git", argumentos);

function jsonDe(texto, rotulo) {
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErroDeUso(`${rotulo}: resposta que não é JSON`);
  }
}

// `## Execution` da spec: só o corpo dessa seção conta, e a linha precisa ter texto depois dos dois pontos.
export function temMotivoDaBase(textoDaSpec) {
  const linhas = textoDaSpec.split("\n");
  const inicio = linhas.findIndex((l) => /^##\s+Execution\s*$/.test(l));
  if (inicio === -1) return false;
  for (const linha of linhas.slice(inicio + 1)) {
    if (/^##\s/.test(linha)) break;
    if (/^\s*(?:[-*]\s*)?\**Motivo da base:\**\s*\S/.test(linha)) return true;
  }
  return false;
}

// O último comentário `<!-- gm:g4 -->` da PR (create-or-update deixa um só, mas o último vence), lido nos
// campos que a condição confere. Todo `achado` precisa de tratamento: `corrigido em <sha>` ou
// `refutado: <porquê>` — qualquer outra coisa conta como sem tratamento.
export function lerG4(comentarios) {
  const corpos = comentarios.map((c) => c?.body).filter((b) => typeof b === "string" && b.includes("<!-- gm:g4 -->"));
  if (corpos.length === 0) return null;
  const corpo = corpos.at(-1);
  const campo = (rotulo) => corpo.match(new RegExp(`^\\W*${rotulo}:\\s*\`?([0-9a-f]{7,40})\`?`, "im"))?.[1] ?? null;
  const portao = corpo.match(/^\W*Portão local:\s*verde em\s*`?([0-9a-f]{7,40})`?/im)?.[1] ?? null;
  const semTratamento = [];
  let naTabela = false;
  for (const linha of corpo.split("\n")) {
    const t = linha.trim();
    if (!t.startsWith("|")) {
      naTabela = false;
      continue;
    }
    const celulas = t.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (celulas.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separador
    if (!naTabela) {
      naTabela = true;
      if (/^achado$/i.test(celulas[0])) continue; // cabeçalho
    }
    const tratamento = celulas.slice(2).join("|").trim();
    if (!/^(corrigido em\s+`?[0-9a-f]{7,40}`?|refutado:\s*\S.*)$/i.test(tratamento)) semTratamento.push(celulas[0]);
  }
  return { headFinal: campo("Head final"), portaoVerdeEm: portao, semTratamento };
}

// Prefixo de sha: o comentário pode abreviar.
const mesmoSha = (curto, longo) => typeof curto === "string" && typeof longo === "string" && curto.length >= 7 && longo.startsWith(curto);

export function avaliar({ pr, checks, atualizada, g4, sensivel, motivoDaBase, base, ci }) {
  const falhas = [];
  const condicoes = {};
  const fixa = (nome, ok, falha) => {
    condicoes[nome] = ok;
    if (!ok) falhas.push(`${nome}: ${falha}`);
  };

  fixa("base", pr.state === "OPEN" && (pr.baseRefName === base || motivoDaBase),
    pr.state !== "OPEN" ? `PR não está aberta (${pr.state})` : `base da PR é ${pr.baseRefName}, esperada ${base}, e a spec não traz Motivo da base`);
  fixa("mergeavel", pr.mergeable === "MERGEABLE", `mergeable é ${pr.mergeable}`);
  fixa("atualizada", atualizada, `origin/${base} tem commit que o head não tem`);

  let pendente = false;
  let ciRuim = false;
  if (ci === "sim") {
    const buckets = checks.map((c) => c?.bucket);
    pendente = buckets.length === 0 || buckets.includes("pending");
    const ruins = buckets.filter((b) => b !== "pass" && b !== "skipping" && b !== "pending");
    ciRuim = ruins.length > 0;
    fixa("ci", !pendente && !ciRuim,
      ruins.length > 0 ? `checks em ${[...new Set(ruins)].join(", ")}` : buckets.length === 0 ? "nenhum check ainda" : "checks pendentes");
  } else {
    fixa("ci", g4 !== null && mesmoSha(g4.portaoVerdeEm, pr.headRefOid), "o Portão local do gm:g4 não está verde no head atual");
  }

  if (g4 === null) fixa("g4", false, "a PR não tem comentário gm:g4");
  else if (g4.semTratamento.length > 0) fixa("g4", false, `achado sem tratamento: ${g4.semTratamento.join("; ")}`);
  else fixa("g4", mesmoSha(g4.headFinal, pr.headRefOid), `Head final do gm:g4 (${g4.headFinal ?? "ausente"}) não é o head atual`);

  fixa("sensivel", sensivel.sensivel === false, `spec sensível: ${sensivel.motivo}`);

  const pode = falhas.length === 0;
  // `parar` ganha de tudo que a sessão não conserta sozinha; depois atualizar (muda o head e o CI recomeça,
  // esperar antes seria esperar o head errado); só então esperar o CI.
  const duras = ["base", "mergeavel", "g4", "sensivel"].some((n) => !condicoes[n]) || (ci === "nao" && !condicoes.ci) || ciRuim;
  let acao = "merge";
  if (!pode) acao = duras ? "parar" : !condicoes.atualizada ? "atualizar" : "esperar-ci";
  return { pode, condicoes, falhas, acao };
}

function consultarSensivel(spec) {
  const r = executar(process.execPath, [SENSIVEL, "--consultar", "--spec", spec]);
  if (r.status !== 0) throw new ErroDeUso(`sensivel.mjs --consultar saiu com código ${r.status}: ${r.stderr.trim()}`);
  const saida = jsonDe(r.stdout.trim().split("\n").at(-1) ?? "", "sensivel.mjs --consultar");
  if (typeof saida?.sensivel !== "boolean") throw new ErroDeUso("sensivel.mjs --consultar: saída fora da forma");
  return saida;
}

function ler(argv) {
  const { repo, pr: numero, spec, base, ci } = lerArgumentos(argv);
  const caminhoSpec = resolve(spec);
  if (basename(caminhoSpec) !== "spec.md") throw new ErroDeUso("--spec deve apontar para um arquivo chamado spec.md");
  let textoDaSpec;
  try {
    textoDaSpec = readFileSync(caminhoSpec, "utf8");
  } catch (erro) {
    throw new ErroDeUso(`não consegui ler ${caminhoSpec}: ${erro.message}`);
  }

  const visao = gh(["pr", "view", numero, "--repo", repo, "--json", "state,baseRefName,mergeable,headRefOid,comments"]);
  if (visao.status !== 0) throw new ErroDeUso(`gh pr view falhou: ${visao.stderr.trim()}`);
  const pr = jsonDe(visao.stdout, "gh pr view");
  if (typeof pr?.headRefOid !== "string" || pr.headRefOid === "") throw new ErroDeUso("gh pr view: sem headRefOid");

  // `gh pr checks` sai com 8 (pendente) ou 1 (falha) e mesmo assim imprime o JSON: o código não é erro.
  let checks = [];
  if (ci === "sim") {
    const r = gh(["pr", "checks", numero, "--repo", repo, "--json", "bucket"]);
    if (r.stdout.trim() === "") throw new ErroDeUso(`gh pr checks falhou: ${r.stderr.trim() || `código ${r.status}`}`);
    checks = jsonDe(r.stdout, "gh pr checks");
    if (!Array.isArray(checks)) throw new ErroDeUso("gh pr checks: resposta fora da forma");
  }

  const busca = git(["fetch", "origin"]);
  if (busca.status !== 0) throw new ErroDeUso(`git fetch origin falhou: ${busca.stderr.trim()}`);
  const ancestral = git(["merge-base", "--is-ancestor", `origin/${base}`, pr.headRefOid]);
  if (ancestral.status !== 0 && ancestral.status !== 1) {
    throw new ErroDeUso(`git merge-base falhou: ${ancestral.stderr.trim() || `código ${ancestral.status}`}`);
  }

  const veredito = avaliar({
    pr,
    checks,
    atualizada: ancestral.status === 0,
    g4: lerG4(Array.isArray(pr.comments) ? pr.comments : []),
    sensivel: consultarSensivel(caminhoSpec),
    motivoDaBase: temMotivoDaBase(textoDaSpec),
    base,
    ci,
  });
  return { pode: veredito.pode, head: pr.headRefOid, condicoes: veredito.condicoes, falhas: veredito.falhas, acao: veredito.acao };
}

function main() {
  let saida;
  try {
    saida = ler(process.argv.slice(2));
  } catch (erro) {
    if (!(erro instanceof ErroDeUso)) throw erro;
    process.stderr.write(`merge-dev.mjs: ${erro.message}\n`, () => process.exit(2));
    return;
  }
  process.stdout.write(JSON.stringify(saida) + "\n", () => process.exit(0));
}

function ehPontoDeEntrada() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (ehPontoDeEntrada()) main();
