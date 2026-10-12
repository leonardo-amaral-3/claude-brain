#!/usr/bin/env node
// Testa scripts/skills-comum.mjs numa cópia temporária de skills/ — o repo nunca é escrito.
// Uso: node scripts/skills-comum-teste.mjs [caminho-do-script]   (padrão: o skills-comum.mjs ao lado)
// Sai 0 se todos os cenários passam, 1 se algum falha.
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const aqui = dirname(fileURLToPath(import.meta.url));
const root = join(aqui, "..");
const script = resolve(process.argv[2] ?? join(aqui, "skills-comum.mjs"));
const CABECALHOS = ["## Como perguntar e como aprovar", "## Convenções de saída"];

let falhas = 0;
function afirmar(ok, msg) {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${msg}`);
  if (!ok) falhas++;
}

// Monta <tmp>/skills e <tmp>/scripts/skills-comum.mjs; o script acha a raiz pelo pai da pasta dele.
function copiaTemporaria() {
  const dir = mkdtempSync(join(tmpdir(), "skills-comum-"));
  cpSync(join(root, "skills"), join(dir, "skills"), { recursive: true });
  cpSync(script, join(dir, "scripts", "skills-comum.mjs"));
  return dir;
}

function rodar(dir, ...args) {
  const r = spawnSync(process.execPath, [join(dir, "scripts", "skills-comum.mjs"), ...args], { encoding: "utf8" });
  return { codigo: r.status, saida: r.stdout + r.stderr };
}

const ler = (dir, skill) => readFileSync(join(dir, "skills", skill, "SKILL.md"), "utf8");
const escrever = (dir, skill, texto) => writeFileSync(join(dir, "skills", skill, "SKILL.md"), texto);
const ocorrencias = (texto, linha) => texto.split("\n").filter((l) => l === linha).length;
const nomesSkills = (dir) => readdirSync(join(dir, "skills")).filter((n) => n.startsWith("gm-"));

// Região de um cabeçalho: do cabeçalho até o próximo "## " (as skills de teste não têm "## " em cerca
// dentro dos blocos — ver spec Área 3).
function regiao(linhas, cabecalho) {
  const h = linhas.indexOf(cabecalho);
  let fim = linhas.findIndex((l, i) => i > h && l.startsWith("## "));
  if (fim === -1) fim = linhas.length;
  return { h, fim };
}

// Cenário 1 — a fonte ganha uma terceira seção e só o gm-ship tem o cabeçalho dela.
{
  console.log("cenário 1: fonte com 3 seções, só gm-ship com a terceira");
  const dir = copiaTemporaria();
  try {
    const fonte = join(dir, "skills", "_comum", "convencoes.md");
    writeFileSync(fonte, readFileSync(fonte, "utf8").replace(/\n*$/, "\n\n## Seção nova\n\nTexto da seção nova.\n"));
    escrever(dir, "gm-ship", ler(dir, "gm-ship").replace(/\n*$/, "\n\n## Seção nova\n\nrascunho\n"));
    const antes = Object.fromEntries(nomesSkills(dir).map((n) => [n, ler(dir, n)]));

    const r = rodar(dir);
    afirmar(r.codigo === 1, `carimbo sai 1 com skill incompleta (saiu ${r.codigo})`);
    afirmar(/gm-card: blocos incompletos \(falta Seção nova\)/.test(r.saida), "nomeia gm-card como incompleta");
    afirmar(nomesSkills(dir).filter((n) => n !== "gm-ship").every((n) => ler(dir, n) === antes[n]),
      "nenhuma skill incompleta foi escrita (gm-card: " +
        `${antes["gm-card"].split("\n").length} → ${ler(dir, "gm-card").split("\n").length} linhas)`);
    const ship = ler(dir, "gm-ship");
    afirmar(ship.includes("## Seção nova\n\nTexto da seção nova.\n") && ocorrencias(ship, "## Seção nova") === 1,
      "gm-ship, que tem as 3, recebe a terceira uma vez");
    const c = rodar(dir, "--check");
    afirmar(c.codigo === 1, `--check sai 1 com skill incompleta (saiu ${c.codigo})`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Cenário 2 — gm-explore com os dois blocos em ordem inversa e os dois divergentes.
{
  console.log("cenário 2: gm-explore com os blocos em ordem inversa, os dois divergentes");
  const dir = copiaTemporaria();
  try {
    const original = ler(dir, "gm-explore");
    const linhas = original.split("\n");
    const a = regiao(linhas, CABECALHOS[0]);
    const b = regiao(linhas, CABECALHOS[1]);
    const [p, q] = a.h < b.h ? [a, b] : [b, a];
    const blocoP = linhas.slice(p.h, p.fim).map((l, i) => (i === 2 ? l + " DIVERGE" : l));
    const blocoQ = linhas.slice(q.h, q.fim).map((l, i) => (i === 2 ? l + " DIVERGE" : l));
    if (q.fim === linhas.length && blocoQ.at(-1) !== "") blocoQ.push("");
    if (p.fim === linhas.length && blocoP.at(-1) !== "") blocoP.push("");
    const invertido = [...linhas.slice(0, p.h), ...blocoQ, ...linhas.slice(p.fim, q.h), ...blocoP, ...linhas.slice(q.fim)];
    escrever(dir, "gm-explore", invertido.join("\n"));
    const linhasAntes = invertido.length;

    const r = rodar(dir);
    afirmar(r.codigo === 0, `carimbo sai 0 (saiu ${r.codigo})`);
    const depois = ler(dir, "gm-explore");
    afirmar(CABECALHOS.every((c) => ocorrencias(depois, c) === 1), "cada cabeçalho aparece uma vez");
    afirmar(!depois.includes("DIVERGE"), "as duas divergências foram carimbadas por cima");
    const linhasDepois = depois.split("\n").length;
    afirmar(Math.abs(linhasDepois - linhasAntes) <= 1, `sem duplicação (${linhasAntes} → ${linhasDepois} linhas)`);
    const c = rodar(dir, "--check");
    afirmar(c.codigo === 0, `--check sai 0 depois do carimbo (saiu ${c.codigo})`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(falhas === 0 ? "todos os cenários passam" : `${falhas} afirmação(ões) falharam`);
process.exit(falhas === 0 ? 0 : 1);
