#!/usr/bin/env node
// `claude` falso do teste do /gm-frente (scripts/gm-frente-teste.mjs). Nunca chama o Claude nem gasta cota.
// O teste cria um shim executável chamado `claude` (pasta temporária, à frente do PATH) que roda este arquivo.
//
// Chamada que ele entende (a *Sessão filha* do frente.mjs):
//   claude -p "<prompt>" --permission-mode auto --permission-prompts none --add-dir <d> --output-format json
// A primeira linha do prompt é `/gm-<skill> <argumento>`; o cwd é a worktree. Ele emula o efeito da estação:
//   /gm-spec #n                       escreve planning/<pasta>/spec.md e sensibilidade.json (sem commit)
//   /gm-plan-tasks <pasta> --card n   escreve as tasks de cards[n].tasks (sem commit)
//   /gm-implement … --task <arq>      cria o arquivo do Toca:, vira o ✅ da task e commita (Card: #n)
//   /gm-ship … --card n               abre a PR (estado em prs/)
//   /gm-ship … --card n --merge       mergeia a PR (estado em prs/) e fecha em PARADA, como o ship real
//
// Estado: $FALSO_DIR/claude.json
//   {duracaoMs, planning, cards: {"<n>": {pasta, fase, tasks: [{nome, onda, dep, toca}]}},
//    comportamento: {"<chave>": {acao: "parada"|"semlinha"|"dormir"|"fora", motivo, caminho, duracaoMs}}}
// chave = `<estacao>:<card>:<id da task>` | `<estacao>:<card>` | `<estacao>`, a mais específica vale;
// estacao = spec | plan-tasks | implement | ship | ship-merge.
// Registro: $FALSO_DIR/sessoes.jsonl, uma linha por início e por fim, com o horário, para provar sobreposição.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const dir = process.env.FALSO_DIR;
if (!dir) {
  console.error("claude-falso: FALSO_DIR ausente");
  process.exit(2);
}
const argv = process.argv.slice(2);
const prompt = argv[argv.indexOf("-p") + 1] || "";
const primeira = prompt.split("\n")[0].trim();
const m = /^\/gm-([a-z-]+)\s*(.*)$/.exec(primeira);
const config = existsSync(join(dir, "claude.json")) ? JSON.parse(readFileSync(join(dir, "claude.json"), "utf8")) : {};
// config.planning (caminho absoluto): planning fora do repo, em <workspace>/planning/.
const planning = () => config.planning || join(process.cwd(), "planning");
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function opcao(arg, flag) {
  const i = arg.indexOf(`${flag} `);
  return i < 0 ? undefined : arg.slice(i + flag.length + 1).split(/\s+/)[0];
}
const registrar = (evento, extra = {}) => appendFileSync(join(dir, "sessoes.jsonl"), JSON.stringify({ evento, t: Date.now(), pid: process.pid, cwd: process.cwd(), ...extra }) + "\n");
const responder = (texto) => {
  process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: texto, session_id: `falso-${process.pid}` }) + "\n");
  process.exit(0);
};
const git = (...a) => spawnSync("git", ["-c", "user.name=falso", "-c", "user.email=falso@falso", "-c", "commit.gpgsign=false", ...a], { cwd: process.cwd(), encoding: "utf8" });

if (!m) {
  console.error(`claude-falso: prompt sem /gm-<skill> na primeira linha: ${primeira}`);
  process.exit(2);
}
const skill = m[1];
const arg = m[2];

let card;
let estacao;
let task;
let pasta;
if (skill === "spec") {
  estacao = "spec";
  card = /^#(\d+)/.exec(arg)?.[1];
} else {
  pasta = arg.split(/\s+/)[0];
  card = opcao(arg, "--card");
  task = opcao(arg, "--task");
  estacao = { "plan-tasks": "plan-tasks", implement: "implement", ship: arg.includes("--merge") ? "ship-merge" : "ship" }[skill];
}
if (!estacao) {
  console.error(`claude-falso: skill desconhecida: ${skill}`);
  process.exit(2);
}
const idTask = task ? task.split("/").pop().split("-")[0] : undefined;
const chaves = [`${estacao}:${card}:${idTask}`, `${estacao}:${card}`, estacao].filter((c) => !c.endsWith(":undefined"));
const comportamento = chaves.map((c) => (config.comportamento || {})[c]).find(Boolean) || {};
const cfgCard = (config.cards || {})[card] || {};

registrar("inicio", { estacao, card, task: idTask });
const fim = (texto) => {
  registrar("fim", { estacao, card, task: idTask });
  responder(texto);
};

if (comportamento.acao === "dormir") {
  await esperar(10 * 60 * 1000);
}
if (comportamento.acao === "parada") fim(`Parei.\n\nPARADA: ${comportamento.motivo || "parada pedida pelo teste"}`);
if (comportamento.acao === "semlinha") fim("Terminei, mas esqueci a linha de despacho.");

if (estacao === "spec") {
  const d = join(planning(), cfgCard.pasta || `${card}-falso`);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "spec.md"), `# Spec falsa do #${card}\n`);
  writeFileSync(join(d, "sensibilidade.json"), "{}\n");
  fim(`Spec escrita.\n\nPROXIMO: /gm-plan-tasks ${cfgCard.pasta || `${card}-falso`} --card ${card}`);
}

if (estacao === "plan-tasks") {
  const d = join(planning(), pasta, "tasks", ...(cfgCard.fase ? [cfgCard.fase] : []));
  mkdirSync(d, { recursive: true });
  for (const t of cfgCard.tasks || []) {
    const novas = t.onda !== undefined;
    const linhas = ["❌ Status: Not Started"];
    if (novas) linhas.push(`Onda: ${t.onda}`, `Depende de: ${t.dep && t.dep.length ? t.dep.join(", ") : "—"}`, `Toca: ${t.toca.map((p) => `\`${p}\``).join(", ")}`);
    writeFileSync(join(d, t.nome), [...linhas, "", `# Task ${t.nome}`, ""].join("\n"));
  }
  fim(`Tasks escritas.\n\nPROXIMO: /gm-implement ${pasta} --card ${card}`);
}

if (estacao === "implement") {
  const branch = opcao(arg, "--branch");
  const atual = git("branch", "--show-current").stdout.trim();
  if (branch && atual !== branch) fim(`Branch errada.\n\nPARADA: a worktree está em ${atual}, esperava ${branch}`);
  await esperar(comportamento.duracaoMs ?? config.duracaoMs ?? 1000);

  const arquivo = resolve(process.cwd(), task); // relativo à raiz, ou absoluto (planning no workspace)
  const texto = readFileSync(arquivo, "utf8");
  const toca = /^Toca:\s*(.*)$/m.exec(texto)?.[1];
  const caminhos = toca ? [...toca.matchAll(/`([^`]+)`/g)].map((x) => x[1]) : [`feito/t${idTask}.txt`];
  const alvo = caminhos[0].endsWith("/") ? `${caminhos[0]}t${idTask}.txt` : caminhos[0];
  const escrever = (rel, conteudo) => {
    mkdirSync(dirname(join(process.cwd(), rel)), { recursive: true });
    writeFileSync(join(process.cwd(), rel), conteudo);
  };
  escrever(alvo, `task ${idTask}\n`);
  if (comportamento.acao === "fora") escrever(comportamento.caminho, `task ${idTask} mentiu no Toca\n`);
  writeFileSync(arquivo, texto.replace(/^❌ Status: Not Started/, "✅ Status: Complete"));
  git("add", "-A");
  const c = git("commit", "-q", "-m", `feat: task ${idTask} (#${card})`, "-m", `Card: #${card}`);
  if (c.status !== 0) fim(`Commit falhou.\n\nPARADA: ${c.stderr.trim()}`);
  fim(`Task ${idTask} feita.\n\nPROXIMO: /gm-implement ${pasta} --card ${card}`);
}

if (estacao === "ship") {
  await esperar(comportamento.duracaoMs ?? 200);
  const branch = git("branch", "--show-current").stdout.trim();
  const pdir = join(dir, "prs");
  mkdirSync(pdir, { recursive: true });
  const numero = 100 + readdirSync(pdir).length + 1;
  writeFileSync(
    join(pdir, `${numero}.json`),
    JSON.stringify({ number: numero, state: "OPEN", url: `https://github.com/falso/falso/pull/${numero}`, headRefName: branch, baseRefName: "dev", mergedAt: null }),
  );
  fim(`PR #${numero} aberta.\n\nPROXIMO: /gm-ship ${pasta} --card ${card} --merge`);
}

if (estacao === "ship-merge") {
  await esperar(comportamento.duracaoMs ?? 200);
  const branch = git("branch", "--show-current").stdout.trim();
  const pdir = join(dir, "prs");
  for (const f of existsSync(pdir) ? readdirSync(pdir) : []) {
    const p = JSON.parse(readFileSync(join(pdir, f), "utf8"));
    if (p.headRefName === branch && p.state === "OPEN") {
      writeFileSync(join(pdir, f), JSON.stringify({ ...p, state: "MERGED", mergedAt: new Date().toISOString() }));
      fim(`Merge feito.\n\nPARADA: PR #${p.number} na dev; o card espera o trem do /gm-release`);
    }
  }
  fim("Sem PR aberta para esta branch.\n\nPARADA: sem PR aberta");
}
