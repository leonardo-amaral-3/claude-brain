#!/usr/bin/env node
// Testa skills/gm-frente/ (ondas.mjs e o condutor frente.mjs) sem rede, sem cota e sem framework
// (padrão de gm-spec-sensivel-teste.mjs). Tudo em diretório temporário.
// Uso: node scripts/gm-frente-teste.mjs
// Sai 0 se todos os cenários passam, 1 se algum falha.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..");
const ONDAS = join(raiz, "skills", "gm-frente", "ondas.mjs");
const { lerTask, validarOndas } = await import(pathToFileURL(ONDAS).href);

let falhas = 0;
function afirmar(ok, msg) {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${msg}`);
  if (!ok) falhas++;
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const temporarios = [];
function temp(prefixo) {
  const d = mkdtempSync(join(tmpdir(), `${prefixo}-`));
  temporarios.push(d);
  return d;
}
process.on("exit", () => {
  for (const d of temporarios) rmSync(d, { recursive: true, force: true });
});

function rodar(cmd, args, opcoes = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", ...opcoes });
}
function git(cwd, ...args) {
  const r = rodar("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

// Escreve um arquivo de task no formato novo (ou antigo, com campos = null).
function escreverTask(pasta, nome, { status = "❌ Status: Not Started", onda = null, dep = null, toca = null } = {}) {
  const linhas = [status];
  if (onda !== null) linhas.push(`Onda: ${onda}`);
  if (dep !== null) linhas.push(`Depende de: ${dep.length ? dep.join(", ") : "—"}`);
  if (toca !== null) linhas.push(`Toca: ${toca.map((p) => `\`${p}\``).join(", ")}`);
  const sufixo = onda === null && dep === null && toca === null ? ["", "# Task"] : ["# Task"];
  writeFileSync(join(pasta, nome), [...linhas, ...sufixo, ""].join("\n"));
}
function pastaDeTasks(tasks) {
  const d = temp("frente-tasks");
  for (const [nome, campos] of Object.entries(tasks)) escreverTask(d, nome, campos);
  return d;
}
const validar = (pasta) => {
  const r = rodar("node", [ONDAS, "--validar", pasta]);
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {}
  return { codigo: r.status, json, stderr: r.stderr };
};

// ─────────────────────────────────────────────────────────────────────────────
console.log("ondas.mjs: lerTask");
{
  const t = lerTask("✅ Status: Complete\nOnda: 2\nDepende de: 1, 3a\nToca: `a/b.mjs`, `dir/`\n\n# Task 4\n", "planning/x/tasks/4-algo-assim.md");
  afirmar(t.id === "4" && t.status === "completa" && t.onda === 2, "id é o prefixo antes do primeiro '-', status vem do ✅, Onda numérica");
  afirmar(igual(t.dependeDe, ["1", "3a"]) && igual(t.toca, ["a/b.mjs", "dir/"]), "Depende de e Toca são listas (Toca: pelos caminhos entre crases)");
  const semDep = lerTask("❌ Status: Not Started\nOnda: 1\nDepende de: —\nToca: `x`\n", "3a-parte.md");
  afirmar(semDep.id === "3a" && igual(semDep.dependeDe, []) && semDep.status === "pendente", "'—' é sem dependência; id com sufixo de letra");
  const antiga = lerTask("✅ Status: Complete\n\n# Task 1: coisa\n", "1-coisa.md");
  afirmar(antiga.onda === null && antiga.dependeDe === null && antiga.toca === null, "task antiga: os três campos são null");
}

console.log("ondas.mjs: --validar, o que é válido");
{
  const d = pastaDeTasks({
    "1-a.md": { onda: 1, dep: [], toca: ["x/a.mjs"] },
    "2-b.md": { onda: 1, dep: [], toca: ["x/b.mjs"] },
    "3-c.md": { onda: 2, dep: ["1", "2"], toca: ["x/c.mjs"] },
  });
  const r = validar(d);
  afirmar(r.codigo === 0 && r.json.ok === true && r.json.modo === "ondas", "plano com ondas: código 0, modo 'ondas'");
  afirmar(igual(r.json.ondas, [["1", "2"], ["3"]]), "as ondas saem agrupadas em ordem de número");
}
{
  const d = pastaDeTasks({ "1-a.md": {}, "2-b.md": { status: "✅ Status: Complete" }, "10-c.md": {} });
  const r = validar(d);
  afirmar(r.codigo === 0 && r.json.modo === "sequencial", "só tasks antigas: modo 'sequencial', código 0");
  afirmar(igual(r.json.ondas, [["1"], ["2"], ["10"]]), "sequencial: uma task por onda, na ordem numérica (10 depois de 2)");
}
{
  const d = pastaDeTasks({ "3-a.md": {}, "3a-b.md": {}, "4-c.md": {} });
  afirmar(igual(validar(d).json.ondas, [["3"], ["3a"], ["4"]]), "id com sufixo (3a) ordena depois do 3 e antes do 4");
}
{
  const r = rodar("node", [ONDAS, "--validar", join(raiz, "planning", "66-telemetria", "tasks", "f1")]);
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {}
  afirmar(r.status === 0 && json && json.modo === "sequencial", "a pasta real do #66 (tasks antigas) é 'sequencial', código 0");
}

console.log("ondas.mjs: --validar, o que é inválido");
{
  const d = pastaDeTasks({
    "1-a.md": { onda: 1, dep: [], toca: ["x/a.mjs"] },
    "2-b.md": { onda: 1, dep: ["1"], toca: ["x/b.mjs"] },
  });
  const r = validar(d);
  afirmar(r.codigo === 1 && r.json.ok === false && r.json.erros.some((e) => /depende de 1/.test(e)), "dependência na mesma onda → código 1");
}
{
  const d = pastaDeTasks({
    "1-a.md": { onda: 1, dep: [], toca: ["x/"] },
    "2-b.md": { onda: 1, dep: [], toca: ["x/b.mjs"] },
  });
  const r = validar(d);
  afirmar(r.codigo === 1 && r.json.erros.some((e) => /colidem/.test(e)), "colisão por diretório (x/ contém x/b.mjs) → código 1");
}
{
  const d = pastaDeTasks({
    "1-a.md": { onda: 1, dep: [], toca: ["x/a.mjs"] },
    "2-b.md": { onda: 1, dep: [], toca: ["x/a.mjs"] },
  });
  afirmar(validar(d).codigo === 1, "colisão por caminho igual → código 1");
}
{
  const d = pastaDeTasks({
    "1-a.md": { onda: 1, dep: [], toca: ["x/a.mjs"] },
    "2-b.md": { onda: 3, dep: ["1"], toca: ["x/b.mjs"] },
  });
  const r = validar(d);
  afirmar(r.codigo === 1 && r.json.erros.some((e) => /buraco/.test(e)), "onda com buraco (1 e 3) → código 1");
}
{
  const d = pastaDeTasks({
    "1-a.md": { onda: 1, dep: [], toca: ["x/a.mjs"] },
    "2-b.md": {},
  });
  const r = validar(d);
  afirmar(r.codigo === 1 && r.json.erros.some((e) => /mistura/.test(e)), "mistura de task nova com antiga → código 1");
}
{
  const d = pastaDeTasks({
    "1-a.md": { onda: 1, dep: [], toca: ["x/a.mjs"] },
    "1-b.md": { onda: 1, dep: [], toca: ["x/b.mjs"] },
  });
  const r = validar(d);
  afirmar(r.codigo === 1 && r.json.erros.some((e) => /duplicado/.test(e)), "id duplicado → código 1");
}
{
  const d = pastaDeTasks({ "1-a.md": { onda: 1, dep: ["9"], toca: ["x/a.mjs"] } });
  afirmar(validar(d).json.erros.some((e) => /não existe/.test(e)), "dependência que não existe é acusada");
}
{
  const d = temp("frente-tasks");
  writeFileSync(join(d, "1-a.md"), "❌ Status: Not Started\nOnda: 1\nDepende de: —\n\n# Task\n");
  afirmar(validar(d).json.erros.some((e) => /falta a linha Toca/.test(e)), "campo faltando numa task nova é acusado");
}

console.log("ondas.mjs: código 2");
{
  afirmar(rodar("node", [ONDAS, "--validar"]).status === 2, "--validar sem pasta → 2");
  afirmar(rodar("node", [ONDAS, "--validar", join(tmpdir(), "nao-existe-frente")]).status === 2, "--validar de pasta que não existe → 2");
  afirmar(rodar("node", [ONDAS, "--validar", temp("frente-vazia")]).status === 2, "--validar de pasta sem task → 2");
  afirmar(rodar("node", [ONDAS]).status === 2, "sem modo → 2");
  const cwd = temp("frente-repo");
  git(cwd, "init", "-q");
  afirmar(rodar("node", [ONDAS, "--conferir", "nao-existe.md"], { cwd }).status === 2, "--conferir de arquivo que não existe → 2");
}

console.log("ondas.mjs: --conferir");
{
  const cwd = temp("frente-repo");
  git(cwd, "init", "-q", "-b", "main");
  const pasta = join(cwd, "planning", "x", "tasks");
  mkdirSync(pasta, { recursive: true });
  escreverTask(pasta, "1-a.md", { status: "✅ Status: Complete", onda: 1, dep: [], toca: ["src/a.mjs"] });
  escreverTask(pasta, "2-b.md", { onda: 2, dep: ["1"], toca: ["src/b.mjs", "lib/"] });
  escreverTask(pasta, "3-c.md", { onda: 2, dep: ["1", "9"], toca: ["src/c.mjs"] });
  mkdirSync(join(cwd, "src"), { recursive: true });
  writeFileSync(join(cwd, "src", "a.mjs"), "a\n");
  git(cwd, "add", "-A");
  git(cwd, "commit", "-q", "-m", "base");
  const conf = (arq) => {
    const r = rodar("node", [ONDAS, "--conferir", arq], { cwd });
    return { codigo: r.status, json: r.stdout ? JSON.parse(r.stdout) : null };
  };
  const t2 = "planning/x/tasks/2-b.md";

  let r = conf(t2);
  afirmar(r.codigo === 0 && igual(r.json, { dependencias: [], fora: [] }), "árvore limpa e dependência ✅ → 0");

  writeFileSync(join(cwd, "src", "b.mjs"), "b\n");
  mkdirSync(join(cwd, "lib", "fundo"), { recursive: true });
  writeFileSync(join(cwd, "lib", "fundo", "z.mjs"), "z\n");
  writeFileSync(join(pasta, "2-b.md"), "✅ Status: Complete\nOnda: 2\nDepende de: 1\nToca: `src/b.mjs`, `lib/`\n\n# Task\n");
  r = conf(t2);
  afirmar(r.codigo === 0, "arquivo novo no Toca, diretório do Toca e o próprio arquivo da task → 0");

  writeFileSync(join(cwd, "src", "a.mjs"), "mudou\n");
  writeFileSync(join(cwd, "intruso.txt"), "x\n");
  r = conf(t2);
  afirmar(r.codigo === 1 && igual(r.json.fora, ["intruso.txt", "src/a.mjs"]), "rastreado alterado e não rastreado fora do Toca → 1, listados em 'fora'");

  r = conf("planning/x/tasks/3-c.md");
  afirmar(r.codigo === 1 && igual(r.json.dependencias, ["9"]), "dependência que não existe (9) fica em 'dependencias'");

  writeFileSync(join(pasta, "1-a.md"), "❌ Status: Not Started\nOnda: 1\nDepende de: —\nToca: `src/a.mjs`\n\n# Task\n");
  r = conf(t2);
  afirmar(igual(r.json.dependencias, ["1"]), "dependência ❌ na árvore → 'dependencias' = [1]");

  escreverTask(pasta, "4-antiga.md", {});
  afirmar(conf("planning/x/tasks/4-antiga.md").codigo === 0, "task antiga → 0 (nada a conferir)");
}

// ─────────────────────────────────────────────────────────────────────────────
// Seções seguintes (tasks 2 a 5 da F1): `falsos`, `iniciar`/`estado`/unidades/trava, estações,
// prompt gerado, onda paralela, conflito, retomada. Entram aqui, antes do fecho abaixo.
// ─────────────────────────────────────────────────────────────────────────────

console.log(falhas === 0 ? "\ntudo verde" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
