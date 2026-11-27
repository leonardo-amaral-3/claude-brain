#!/usr/bin/env node
// O que é mecânico no trem do /gm-release (card #81, F3 do épico #78): quais cards entram no trem e o que
// o G5 pede de cada PR. A skill decide; este script só lê (`gh project item-list`, `gh pr list`,
// `gh pr view`, `git fetch`, `git merge-base`) e nunca escreve em nada.
//
// Uso (no cwd do repo do módulo):
//   node trem.mjs cards --repo <owner>/<repo> --project <n> --owner <o> (--corte <sha> | --main) [--base <dev>]
//   node trem.mjs itens --repo <owner>/<repo> --pr <n>
//
// `cards` lê do board os cards em 🧪 Validação em Dev ou 🚂 Release (abertos ou fechados: o `/gm-ship` e o
// `/gm-correcao` fecham o card validado sem movê-lo) e as PRs mergeadas na `--base` (padrão `dev`) cuja
// primeira linha é `**Card:** #<n>`. Um card está *no corte* quando tem PR mergeada e o merge commit de
// TODAS as suas PRs é ancestral do `--corte`; com `--main`, ancestral de `origin/main` (é o que a Phase 7
// mede depois do merge do trem). Saída:
//   {no_corte: [{card, titulo, status, prs:[n..]}], fora: [{card, titulo, status, prs:[n..], motivo}]}
// `itens` extrai do `## Validação em dev` da PR cada item de checklist:
//   {itens: [{tipo: "comando"|"humano", texto, comando, esperado}]}
// Item sem prefixo é `humano`. Código 0 quando leu; 2 para argumento ou leitura; outro é falha do script.
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const STATUS_DO_TREM = ["🧪 Validação em Dev", "🚂 Release"];
const LIMITE_ITENS = 1000;
const LIMITE_PRS = 500;

class ErroDeUso extends Error {}

function lerOpcoes(argv, { valor, bandeira }) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const nome = argv[i];
    if (bandeira.includes(nome)) {
      if (nome in out) throw new ErroDeUso(`${nome} repetido`);
      out[nome] = true;
    } else if (valor.includes(nome)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new ErroDeUso(`${nome} precisa de um valor`);
      if (nome in out) throw new ErroDeUso(`${nome} repetido`);
      out[nome] = v;
    } else {
      throw new ErroDeUso(`argumento inesperado: ${nome}`);
    }
  }
  const faltando = valor.filter((n) => !(n in out) && !OPCIONAIS.has(n));
  if (faltando.length > 0) throw new ErroDeUso(`faltam: ${faltando.join(", ")}`);
  return out;
}
const OPCIONAIS = new Set(["--corte", "--base"]);

function repoValido(repo) {
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) throw new ErroDeUso("--repo deve ser <owner>/<repo>");
}
function numeroValido(nome, v) {
  if (!/^[1-9][0-9]*$/.test(v)) throw new ErroDeUso(`${nome} deve ser um número`);
}

function executar(comando, argumentos) {
  const r = spawnSync(comando, argumentos, { encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new ErroDeUso(`não consegui rodar ${comando}: ${r.error.message}`);
  return r;
}

function gh(argumentos, rotulo) {
  const r = executar("gh", argumentos);
  if (r.status !== 0) throw new ErroDeUso(`${rotulo} falhou: ${r.stderr.trim() || `código ${r.status}`}`);
  try {
    return JSON.parse(r.stdout);
  } catch {
    throw new ErroDeUso(`${rotulo}: resposta que não é JSON`);
  }
}

// A primeira linha da PR é `**Card:** #<n>` (lida por máquina também pela revisão de CI).
export function cardDaPr(corpo) {
  const primeira = String(corpo ?? "").replace(/^﻿/, "").split(/\r?\n/, 1)[0];
  const m = primeira.match(/^\*\*Card:\*\*\s*#([1-9][0-9]*)\s*$/);
  return m ? Number(m[1]) : null;
}

// O corpo da seção `## Validação em dev` até a próxima `## `; só linhas de checklist contam, e o texto de
// orientação (entre colchetes, sem `- [ ]`) fica de fora. `[comando]` leva o comando no primeiro trecho em
// crase e o esperado depois da seta; `[humano]` e item sem prefixo são `humano`.
export function extrairItens(corpo) {
  const linhas = String(corpo ?? "").split(/\r?\n/);
  const inicio = linhas.findIndex((l) => /^##\s+Validação em dev\s*$/i.test(l));
  if (inicio === -1) return [];
  const itens = [];
  for (const linha of linhas.slice(inicio + 1)) {
    if (/^##\s/.test(linha)) break;
    const m = linha.match(/^\s*[-*]\s+\[[ xX]\]\s+(.*\S)\s*$/);
    if (!m) continue;
    const texto = m[1];
    const comando = texto.match(/^\[comando\]\s*(.*)$/i);
    if (comando) {
      const resto = comando[1];
      const crase = resto.match(/^(`+)(.+?)\1\s*(.*)$/);
      if (crase) {
        const esperado = crase[3].replace(/^(?:→|->|=>)\s*/, "").trim();
        itens.push({ tipo: "comando", texto: resto, comando: crase[2].trim(), esperado });
      } else {
        // Comando sem crase não dá para rodar sem adivinhar onde ele acaba: vai para o humano.
        itens.push({ tipo: "humano", texto: resto, comando: null, esperado: null });
      }
      continue;
    }
    const humano = texto.match(/^\[humano\]\s*(.*)$/i);
    itens.push({ tipo: "humano", texto: (humano ? humano[1] : texto).trim(), comando: null, esperado: null });
  }
  return itens;
}

function ancestral(commit, alvo) {
  const r = executar("git", ["merge-base", "--is-ancestor", commit, alvo]);
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  throw new ErroDeUso(`git merge-base falhou para ${commit}: ${r.stderr.trim() || `código ${r.status}`}`);
}

function cards(argv) {
  const o = lerOpcoes(argv, {
    valor: ["--repo", "--project", "--owner", "--corte", "--base"],
    bandeira: ["--main"],
  });
  repoValido(o["--repo"]);
  numeroValido("--project", o["--project"]);
  if (("--corte" in o) === ("--main" in o)) throw new ErroDeUso("use exatamente um entre --corte <sha> e --main");
  const base = o["--base"] ?? "dev";

  const board = gh(["project", "item-list", o["--project"], "--owner", o["--owner"], "--limit", String(LIMITE_ITENS), "--format", "json"], "gh project item-list");
  if (!Array.isArray(board?.items)) throw new ErroDeUso("gh project item-list: resposta fora da forma");
  if (typeof board.totalCount === "number" && board.totalCount > board.items.length) {
    throw new ErroDeUso(`o board tem ${board.totalCount} itens e só ${board.items.length} vieram: leitura parcial`);
  }
  const prs = gh(["pr", "list", "--repo", o["--repo"], "--base", base, "--state", "merged", "--limit", String(LIMITE_PRS), "--json", "number,body,mergeCommit"], "gh pr list");
  if (!Array.isArray(prs)) throw new ErroDeUso("gh pr list: resposta fora da forma");
  if (prs.length >= LIMITE_PRS) throw new ErroDeUso(`${prs.length} PRs mergeadas na ${base}: leitura possivelmente parcial`);

  const busca = executar("git", ["fetch", "origin"]);
  if (busca.status !== 0) throw new ErroDeUso(`git fetch origin falhou: ${busca.stderr.trim()}`);
  const alvo = "--main" in o ? "origin/main" : o["--corte"];

  const prsDoCard = new Map();
  for (const pr of prs) {
    const n = cardDaPr(pr?.body);
    if (n === null) continue;
    if (!prsDoCard.has(n)) prsDoCard.set(n, []);
    prsDoCard.get(n).push(pr);
  }

  const no_corte = [];
  const fora = [];
  const candidatos = board.items
    .filter((i) => STATUS_DO_TREM.includes(i?.status) && i?.content?.repository === o["--repo"] && Number.isInteger(i.content.number))
    .sort((a, b) => a.content.number - b.content.number);
  for (const item of candidatos) {
    const card = item.content.number;
    const ficha = { card, titulo: item.content.title ?? item.title ?? "", status: item.status };
    const dele = (prsDoCard.get(card) ?? []).sort((a, b) => a.number - b.number);
    const numeros = dele.map((p) => p.number);
    if (dele.length === 0) {
      fora.push({ ...ficha, prs: [], motivo: `nenhuma PR mergeada na ${o["--base"] ?? "dev"} com **Card:** #${card}` });
      continue;
    }
    const sem = dele.filter((p) => typeof p.mergeCommit?.oid !== "string");
    if (sem.length > 0) throw new ErroDeUso(`PR #${sem[0].number} mergeada sem mergeCommit na resposta do gh`);
    const de_fora = dele.filter((p) => !ancestral(p.mergeCommit.oid, alvo));
    if (de_fora.length === 0) no_corte.push({ ...ficha, prs: numeros });
    else fora.push({ ...ficha, prs: numeros, motivo: `PR ${de_fora.map((p) => `#${p.number}`).join(", ")} não está em ${alvo}` });
  }
  return { no_corte, fora };
}

function itens(argv) {
  const o = lerOpcoes(argv, { valor: ["--repo", "--pr"], bandeira: [] });
  repoValido(o["--repo"]);
  numeroValido("--pr", o["--pr"]);
  const pr = gh(["pr", "view", o["--pr"], "--repo", o["--repo"], "--json", "body"], "gh pr view");
  if (typeof pr?.body !== "string") throw new ErroDeUso("gh pr view: PR sem corpo");
  return { itens: extrairItens(pr.body) };
}

function main() {
  const [sub, ...resto] = process.argv.slice(2);
  let saida;
  try {
    if (sub === "cards") saida = cards(resto);
    else if (sub === "itens") saida = itens(resto);
    else throw new ErroDeUso(`subcomando desconhecido: ${sub ?? "(nenhum)"}. Uso: cards | itens`);
  } catch (erro) {
    if (!(erro instanceof ErroDeUso)) throw erro;
    process.stderr.write(`trem.mjs: ${erro.message}\n`, () => process.exit(2));
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
