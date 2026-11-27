#!/usr/bin/env node
// Contrato da task em ondas: leitura, validação e conferência (spec do #78, F1).
//
//   node ondas.mjs --validar <pasta de tasks>     JSON; código 0 válido, 1 inválido
//   node ondas.mjs --conferir <arquivo-da-task>   no cwd da worktree; 0 ok, 1 com {dependencias, fora}
//
// Código 2: argumento ou arquivo ilegível. Só módulos nativos.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RE_NOME = /^(\d+[a-z]*)-.*\.md$/;

// "3a" → [3, "a"]; usado para ordenar ids do jeito que a esteira numera.
function chaveId(id) {
  const m = /^(\d+)([a-z]*)$/.exec(id);
  return m ? [Number(m[1]), m[2]] : [Infinity, id];
}
export function compararIds(a, b) {
  const [na, sa] = chaveId(a);
  const [nb, sb] = chaveId(b);
  return na - nb || (sa < sb ? -1 : sa > sb ? 1 : 0);
}

function valorDaLinha(linhas, rotulo) {
  for (const l of linhas.slice(1, 4)) {
    const m = new RegExp(`^${rotulo}:\\s*(.*)$`).exec(l.trim());
    if (m) return m[1].trim();
  }
  return null;
}

// Lê o texto de um arquivo de task. onda/dependeDe/toca são null quando o campo falta
// (task antiga). Campo presente mas malformado vira valor inválido que o validador acusa.
export function lerTask(texto, arquivo) {
  const linhas = String(texto).replace(/\r\n/g, "\n").split("\n");
  const primeira = (linhas[0] || "").trim();
  const id = basename(String(arquivo)).split("-")[0];
  const status = primeira.startsWith("✅") ? "completa" : "pendente";

  const brutoOnda = valorDaLinha(linhas, "Onda");
  const brutoDep = valorDaLinha(linhas, "Depende de");
  const brutoToca = valorDaLinha(linhas, "Toca");

  let onda = null;
  if (brutoOnda !== null) onda = /^\d+$/.test(brutoOnda) ? Number(brutoOnda) : NaN;

  let dependeDe = null;
  if (brutoDep !== null) {
    dependeDe = brutoDep === "" || brutoDep === "—" || brutoDep === "-" ? [] : brutoDep.split(/\s*,\s*/).filter(Boolean);
  }

  let toca = null;
  if (brutoToca !== null) {
    const entre = [...brutoToca.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
    toca = entre.length ? entre : brutoToca.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
  }
  return { id, arquivo: String(arquivo), status, onda, dependeDe, toca };
}

export function colide(a, b) {
  if (a === b) return true;
  if (a.endsWith("/") && b.startsWith(a)) return true;
  if (b.endsWith("/") && a.startsWith(b)) return true;
  return false;
}

const temCampos = (t) => t.onda !== null || t.dependeDe !== null || t.toca !== null;

// tasks: saída de lerTask. Devolve {ok: true, modo, ondas: [[ids]]} ou {ok: false, erros}.
export function validarOndas(tasks) {
  const erros = [];
  const ordenadas = [...tasks].sort((a, b) => compararIds(a.id, b.id));

  const vistos = new Set();
  for (const t of ordenadas) {
    if (vistos.has(t.id)) erros.push(`id duplicado: ${t.id}`);
    vistos.add(t.id);
  }

  const novas = ordenadas.filter(temCampos);
  if (novas.length === 0) {
    return erros.length
      ? { ok: false, erros }
      : { ok: true, modo: "sequencial", ondas: ordenadas.map((t) => [t.id]) };
  }
  if (novas.length !== ordenadas.length) {
    const antigas = ordenadas.filter((t) => !temCampos(t)).map((t) => t.id);
    erros.push(`mistura de tasks com e sem Onda/Depende de/Toca (sem os campos: ${antigas.join(", ")})`);
  }

  for (const t of novas) {
    if (t.onda === null) erros.push(`task ${t.id}: falta a linha Onda:`);
    else if (!Number.isInteger(t.onda) || t.onda < 1) erros.push(`task ${t.id}: Onda: inválida (inteiro a partir de 1)`);
    if (t.dependeDe === null) erros.push(`task ${t.id}: falta a linha Depende de:`);
    if (t.toca === null) erros.push(`task ${t.id}: falta a linha Toca:`);
    else if (t.toca.length === 0) erros.push(`task ${t.id}: Toca: sem nenhum caminho`);
  }

  const porId = new Map(ordenadas.map((t) => [t.id, t]));
  for (const t of novas) {
    for (const d of t.dependeDe || []) {
      const dep = porId.get(d);
      if (!dep) erros.push(`task ${t.id}: depende de ${d}, que não existe`);
      else if (d === t.id) erros.push(`task ${t.id}: depende de si mesma`);
      else if (Number.isInteger(dep.onda) && Number.isInteger(t.onda) && dep.onda >= t.onda) {
        erros.push(`task ${t.id} (onda ${t.onda}) depende de ${d} (onda ${dep.onda}): a dependência tem de estar em onda menor`);
      }
    }
  }

  const porOnda = new Map();
  for (const t of novas) {
    if (!Number.isInteger(t.onda) || t.onda < 1) continue;
    if (!porOnda.has(t.onda)) porOnda.set(t.onda, []);
    porOnda.get(t.onda).push(t);
  }
  for (const [k, grupo] of [...porOnda].sort((a, b) => a[0] - b[0])) {
    for (let i = 0; i < grupo.length; i++) {
      for (let j = i + 1; j < grupo.length; j++) {
        for (const pa of grupo[i].toca || []) {
          for (const pb of grupo[j].toca || []) {
            if (colide(pa, pb)) erros.push(`onda ${k}: tasks ${grupo[i].id} e ${grupo[j].id} colidem em ${pa} / ${pb}`);
          }
        }
      }
    }
  }

  const numeros = [...porOnda.keys()].sort((a, b) => a - b);
  for (let i = 0; i < numeros.length; i++) {
    if (numeros[i] !== i + 1) {
      erros.push(`ondas com buraco: esperava a onda ${i + 1}, a próxima é a ${numeros[i]}`);
      break;
    }
  }

  if (erros.length) return { ok: false, erros };
  return { ok: true, modo: "ondas", ondas: numeros.map((k) => porOnda.get(k).map((t) => t.id)) };
}

export function lerPasta(pasta) {
  const nomes = readdirSync(pasta).filter((n) => RE_NOME.test(n)).sort((a, b) => compararIds(a.split("-")[0], b.split("-")[0]));
  return nomes.map((n) => lerTask(readFileSync(join(pasta, n), "utf8"), join(pasta, n)));
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

// Confere a task no cwd da worktree. Devolve {dependencias, fora}.
export function conferir(arquivoTask, cwd = process.cwd()) {
  const caminho = isAbsolute(arquivoTask) ? arquivoTask : resolve(cwd, arquivoTask);
  const task = lerTask(readFileSync(caminho, "utf8"), caminho);
  if (!temCampos(task)) return { dependencias: [], fora: [] };

  const topo = git(cwd, "rev-parse", "--show-toplevel").trim();
  const pasta = dirname(caminho);
  const irmaos = existsSync(pasta) ? lerPasta(pasta) : [];
  const dependencias = [];
  for (const d of task.dependeDe || []) {
    const dep = irmaos.find((t) => t.id === d);
    if (!dep || dep.status !== "completa") dependencias.push(d);
  }

  const mudados = new Set(
    [...git(topo, "diff", "--name-only", "HEAD").split("\n"), ...git(topo, "ls-files", "--others", "--exclude-standard").split("\n")].filter(Boolean),
  );
  const propria = relative(topo, caminho).split("\\").join("/");
  const permitidos = [...(task.toca || []), propria];
  const fora = [...mudados].filter((f) => !permitidos.some((p) => colide(p, f))).sort();
  return { dependencias, fora };
}

function principal(argv) {
  const [modo, alvo] = argv;
  if (modo === "--validar") {
    if (!alvo) return erroArg("uso: ondas.mjs --validar <pasta de tasks>");
    let tasks;
    try {
      if (!statSync(alvo).isDirectory()) throw new Error("não é pasta");
      tasks = lerPasta(alvo);
    } catch (e) {
      return erroArg(`pasta ilegível: ${alvo} (${e.message})`);
    }
    if (tasks.length === 0) return erroArg(`nenhuma task em ${alvo}`);
    const r = validarOndas(tasks);
    console.log(JSON.stringify(r, null, 2));
    return r.ok ? 0 : 1;
  }
  if (modo === "--conferir") {
    if (!alvo) return erroArg("uso: ondas.mjs --conferir <arquivo-da-task>");
    let r;
    try {
      r = conferir(alvo);
    } catch (e) {
      return erroArg(`não consegui conferir ${alvo}: ${e.message.split("\n")[0]}`);
    }
    console.log(JSON.stringify(r));
    return r.dependencias.length || r.fora.length ? 1 : 0;
  }
  return erroArg("uso: ondas.mjs --validar <pasta> | --conferir <arquivo-da-task>");
}

function erroArg(msg) {
  console.error(msg);
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(principal(process.argv.slice(2)));
}
