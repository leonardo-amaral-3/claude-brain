#!/usr/bin/env node
// Testa skills/gm-frente/ (ondas.mjs e o condutor frente.mjs) sem rede, sem cota e sem framework
// (padrão de gm-spec-sensivel-teste.mjs). Tudo em diretório temporário.
// Uso: node scripts/gm-frente-teste.mjs
// Sai 0 se todos os cenários passam, 1 se algum falha.
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
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
// O mundo do teste: origin nua, checkout principal, `claude` e `gh` falsos à frente do PATH,
// CLAUDE_CONFIG_DIR temporário. Nada fora de diretório temporário, nada de rede, nada de cota.
const CLAUDE_FALSO = join(aqui, "claude-falso.mjs");
const GH_FALSO = join(aqui, "gh-falso.mjs");
const FRENTE = join(raiz, "skills", "gm-frente", "frente.mjs");
const OWNER = "own";
const REPO = "repo";

const escreverJson = (arq, obj) => {
  mkdirSync(dirname(arq), { recursive: true });
  writeFileSync(arq, JSON.stringify(obj, null, 2));
};
const lerJson = (arq) => JSON.parse(readFileSync(arq, "utf8"));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function ate(cond, ms = 20000, passo = 100) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    const v = await cond();
    if (v) return v;
    await dormir(passo);
  }
  return null;
}

// issues: {"<n>": {title, state, labels, parent, subs, body}}; comentarios: {"<n>": [body]};
// claude: conteúdo de claude.json; bloqueado: {"<n>": texto}.
function mundo({ issues, comentarios = {}, claude = {}, bloqueado = {}, claudeMd } = {}) {
  const w = temp("frente-mundo");
  const origem = join(w, "origin.git");
  const ws = join(w, "ws");
  const checkout = join(ws, REPO);
  const cfg = join(w, "cfg");
  const falso = join(w, "falso");
  const bin = join(w, "bin");
  mkdirSync(ws, { recursive: true });
  mkdirSync(cfg, { recursive: true });
  mkdirSync(bin, { recursive: true });
  git(w, "init", "-q", "--bare", "-b", "dev", origem);
  git(w, "clone", "-q", origem, checkout);
  git(checkout, "checkout", "-q", "-b", "dev");
  writeFileSync(join(checkout, "README.md"), "repo de teste\n");
  writeFileSync(
    join(checkout, "CLAUDE.md"),
    claudeMd ?? "# repo\n\n## Board\n\n- Project: number `7` (\"Teste\"), owner `own`\n\n## Branches\n\n`dev` é a base de integração e `main` é produção.\n",
  );
  git(checkout, "add", "-A");
  git(checkout, "commit", "-q", "-m", "base");
  git(checkout, "push", "-q", "origin", "dev");

  for (const [nome, alvo] of [["claude", CLAUDE_FALSO], ["gh", GH_FALSO]]) {
    writeFileSync(join(bin, nome), `#!/bin/sh\nexec "${process.execPath}" "${alvo}" "$@"\n`);
    chmodSync(join(bin, nome), 0o755);
  }
  const todas = {};
  for (const [n, i] of Object.entries(issues || {})) {
    todas[n] = { number: Number(n), state: "OPEN", labels: [], parent: null, subs: [], body: "", ...i, title: i.title || `card ${n}` };
  }
  escreverJson(join(falso, "issues.json"), todas);
  escreverJson(join(falso, "config.json"), { owner: OWNER, repo: REPO, origin: origem, projeto: 7, bloqueado });
  escreverJson(join(falso, "claude.json"), claude);
  let id = 5000;
  for (const [n, corpos] of Object.entries(comentarios)) {
    escreverJson(join(falso, "comentarios", `${n}.json`), corpos.map((body) => ({ id: ++id, body })));
  }
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    CLAUDE_CONFIG_DIR: cfg,
    FALSO_DIR: falso,
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@t",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@t",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GM_FRENTE_ESPERA_MS: "200",
    GM_FRENTE_CI_POLL_MS: "200",
  };
  const m = { w, origem, ws, checkout, cfg, falso, bin, env };
  m.estadoDir = (n) => join(cfg, "gm-frente", `${OWNER}-${REPO}-${n}`);
  m.sessoes = () => (existsSync(join(falso, "sessoes.jsonl")) ? readFileSync(join(falso, "sessoes.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
  m.prs = () => (existsSync(join(falso, "prs")) ? readdirSync(join(falso, "prs")).map((f) => lerJson(join(falso, "prs", f))) : []);
  m.comentarios = (n) => (existsSync(join(falso, "comentarios", `${n}.json`)) ? lerJson(join(falso, "comentarios", `${n}.json`)) : []);
  return m;
}
const claudeFalso = (mu, prompt, cwd) => {
  const r = rodar("claude", ["-p", prompt, "--permission-mode", "auto", "--permission-prompts", "none", "--output-format", "json"], { cwd, env: mu.env });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {}
  return { status: r.status, json, linha: json ? json.result.trim().split("\n").pop() : null };
};
const ghFalso = (mu, ...a) => rodar("gh", a, { env: mu.env });

// ─────────────────────────────────────────────────────────────────────────────
console.log("falsos: claude e gh resolvem para os falsos pelo PATH do teste");
{
  const mu = mundo({
    issues: {
      "78": { labels: ["épico"], subs: [79, 80] },
      "79": { parent: 78 },
      "80": { parent: 78, state: "CLOSED" },
    },
    comentarios: { "79": ["<!-- gm:spec-ref -->\nBranch: feat/79-x", "<!-- gm:tasks -->\n- [ ] 1 — a\n- [ ] 2 — b"] },
    bloqueado: { "79": "espera o 80" },
    claude: {
      cards: { "79": { pasta: "78-epico", fase: "f1", tasks: [{ nome: "1-a.md", onda: 1, dep: [], toca: ["src/a.txt"] }, { nome: "2-b.md" }] } },
      comportamento: { "implement:79:2": { acao: "parada", motivo: "não deu" }, "ship:79": { acao: "semlinha" } },
      duracaoMs: 50,
    },
  });
  const sh = (c) => rodar("sh", ["-c", c], { env: mu.env }).stdout.trim();
  afirmar(sh("command -v claude") === join(mu.bin, "claude") && sh("command -v gh") === join(mu.bin, "gh"), "`command -v claude` e `gh` apontam para os shims do teste");

  // claude falso: spec
  const wt = join(mu.w, "wt");
  git(mu.checkout, "worktree", "add", "-q", "--detach", wt, "origin/dev");
  let r = claudeFalso(mu, "/gm-spec #78\n\nArgumento do despacho: …", wt);
  afirmar(r.status === 0 && r.json.is_error === false && r.json.subtype === "success", "claude falso devolve o JSON de resultado (is_error falso)");
  afirmar(/^PROXIMO: \/gm-plan-tasks /.test(r.linha), "a última linha do result é PROXIMO: …");
  afirmar(existsSync(join(wt, "planning", "78-falso", "spec.md")), "/gm-spec escreve planning/<pasta>/spec.md");

  // plan-tasks
  r = claudeFalso(mu, "/gm-plan-tasks 78-epico --card 79", wt);
  const tasksDir = join(wt, "planning", "78-epico", "tasks", "f1");
  afirmar(igual(readdirSync(tasksDir).sort(), ["1-a.md", "2-b.md"]), "/gm-plan-tasks escreve as tasks da fase em tasks/<fase>/");
  afirmar(lerTask(readFileSync(join(tasksDir, "1-a.md"), "utf8"), "1-a.md").onda === 1 && lerTask(readFileSync(join(tasksDir, "2-b.md"), "utf8"), "2-b.md").onda === null, "task com campos sai no formato novo; sem campos, no antigo");
  git(wt, "checkout", "-q", "-b", "feat/79-x");

  // implement
  r = claudeFalso(mu, "/gm-implement 78-epico --card 79 --branch feat/79-x --task planning/78-epico/tasks/f1/1-a.md", wt);
  afirmar(/^PROXIMO:/.test(r.linha) && existsSync(join(wt, "src", "a.txt")), "/gm-implement --task cria o arquivo do Toca:");
  afirmar(readFileSync(join(tasksDir, "1-a.md"), "utf8").startsWith("✅ Status: Complete"), "a task vira ✅ e o ✅ entra no commit");
  afirmar(git(wt, "log", "-1", "--format=%B").includes("Card: #79") && git(wt, "status", "--porcelain").trim() === "", "o commit leva Card: #79 e a árvore fica limpa");
  r = claudeFalso(mu, "/gm-implement 78-epico --card 79 --branch outra --task planning/78-epico/tasks/f1/1-a.md", wt);
  afirmar(/^PARADA: a worktree está em feat\/79-x/.test(r.linha), "branch diferente da pedida → PARADA");
  r = claudeFalso(mu, "/gm-implement 78-epico --card 79 --branch feat/79-x --task planning/78-epico/tasks/f1/2-b.md", wt);
  afirmar(r.linha === "PARADA: não deu", "comportamento por task: parada com o motivo pedido");

  // ship / ship-merge / sem linha
  r = claudeFalso(mu, "/gm-ship 78-epico --card 79", wt);
  afirmar(r.json.result.includes("esqueci") && !/^(PROXIMO|PARADA):/.test(r.linha), "comportamento semlinha: result sem linha de despacho");
  fsPrs(mu);
  r = claudeFalso(mu, "/gm-ship 78-epico --card 80", wt);
  afirmar(mu.prs().length === 1 && mu.prs()[0].state === "OPEN" && mu.prs()[0].headRefName === "feat/79-x", "/gm-ship abre a PR da branch da worktree");
  r = claudeFalso(mu, "/gm-ship 78-epico --card 80 --merge", wt);
  afirmar(mu.prs()[0].state === "MERGED" && /^PARADA: PR #101 na dev/.test(r.linha), "/gm-ship --merge mergeia e fecha em PARADA, como o ship real");
  const reg = mu.sessoes();
  afirmar(reg.length > 0 && reg.every((x) => typeof x.t === "number") && reg.some((x) => x.evento === "inicio") && reg.some((x) => x.evento === "fim"), "toda sessão registra início e fim com horário");

  // gh falso
  let g = ghFalso(mu, "issue", "view", "78", "--repo", `${OWNER}/${REPO}`, "--json", "number,labels");
  afirmar(g.status === 0 && JSON.parse(g.stdout).labels[0].name === "épico", "gh issue view devolve labels como [{name}]");
  g = ghFalso(mu, "api", `repos/${OWNER}/${REPO}/issues/78/sub_issues`);
  afirmar(igual(JSON.parse(g.stdout).map((x) => [x.number, x.state]), [[79, "OPEN"], [80, "CLOSED"]]), "gh api sub_issues lista as sub-issues com estado");
  g = ghFalso(mu, "api", `repos/${OWNER}/${REPO}/issues/79/parent`);
  afirmar(JSON.parse(g.stdout).number === 78, "gh api parent devolve o pai");
  g = ghFalso(mu, "api", `repos/${OWNER}/${REPO}/issues/78/parent`);
  afirmar(g.status !== 0 && /Not Found/.test(g.stderr), "gh api parent de card sem pai falha com 404");
  g = ghFalso(mu, "api", `repos/${OWNER}/${REPO}/issues/79/comments`);
  const coms = JSON.parse(g.stdout);
  afirmar(coms.length === 2 && coms[1].body.includes("gm:tasks"), "gh api comments lista id e corpo");
  const arq = join(mu.w, "novo.md");
  writeFileSync(arq, coms[1].body.replace("- [ ] 1 ", "- [x] 1 "));
  g = ghFalso(mu, "api", "-X", "PATCH", `repos/${OWNER}/${REPO}/issues/comments/${coms[1].id}`, "-F", `body=@${arq}`);
  afirmar(g.status === 0 && mu.comentarios(79)[1].body.includes("- [x] 1 "), "gh api PATCH comentário grava o corpo novo");
  g = ghFalso(mu, "api", "graphql", "-f", 'query={repository(owner:"own",name:"repo"){issue(number:79){projectItems(first:20){nodes{project{number} fieldValueByName(name:"Bloqueado"){... on ProjectV2ItemFieldTextValue{text}}}}}}}');
  afirmar(JSON.parse(g.stdout).data.repository.issue.projectItems.nodes[0].fieldValueByName.text === "espera o 80", "graphql projectItems devolve o Bloqueado do card");
  g = ghFalso(mu, "api", "graphql", "-f", 'query={repository(owner:"own",name:"repo"){id issue(number:79){id} ref(qualifiedName:"refs/heads/dev"){target{oid}}}}');
  const oid = JSON.parse(g.stdout).data.repository.ref.target.oid;
  afirmar(/^[0-9a-f]{40}$/.test(oid), "graphql da base devolve o oid de origin/dev");
  g = ghFalso(mu, "api", "graphql", "-f", `query=mutation{createLinkedBranch(input:{issueId:"I_79",repositoryId:"R_falso",oid:"${oid}",name:"feat/79-nova"}){linkedBranch{ref{name}}}}`);
  afirmar(g.status === 0 && git(mu.checkout, "ls-remote", "--heads", "origin", "feat/79-nova").includes("feat/79-nova"), "createLinkedBranch cria a branch na origin");
  g = ghFalso(mu, "pr", "list", "--repo", `${OWNER}/${REPO}`, "--head", "feat/79-x", "--state", "all", "--json", "number,state,url,mergedAt");
  afirmar(JSON.parse(g.stdout)[0].state === "MERGED", "gh pr list --head devolve a PR da branch");
  g = ghFalso(mu, "pr", "checks", "101", "--repo", `${OWNER}/${REPO}`, "--json", "bucket");
  afirmar(g.status !== 0 && /no checks reported/.test(g.stderr), "gh pr checks sem arquivo de checks → 'no checks reported'");
  escreverJson(join(mu.falso, "checks", "101.json"), [{ bucket: "pass" }, { bucket: "pending" }]);
  g = ghFalso(mu, "pr", "checks", "101", "--repo", `${OWNER}/${REPO}`, "--json", "bucket");
  afirmar(igual(JSON.parse(g.stdout), [{ bucket: "pass" }, { bucket: "pending" }]), "gh pr checks devolve os buckets configurados");
  g = ghFalso(mu, "repo", "delete", "x");
  afirmar(g.status === 3, "comando fora da superfície do frente.mjs é recusado (código 3)");
}
function fsPrs(mu) {
  rmSync(join(mu.falso, "prs"), { recursive: true, force: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Ferramentas do condutor
const ENTREGA = "O humano entregou a frente nesta sessão: as sessões filhas decidem pelo ## Modo despachado das skills.";
function iniciarFrente(mu, n, extras = [], { entrega = ENTREGA } = {}) {
  const arq = join(mu.w, `entrega-${n}.txt`);
  if (entrega !== null) writeFileSync(arq, entrega);
  const args = [FRENTE, "iniciar", "--card", `${OWNER}/${REPO}#${n}`, "--workspace", mu.ws, "--checkout", mu.checkout, "--base", "dev", "--entrega-arquivo", arq, ...extras];
  const r = rodar("node", args, { env: mu.env });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {}
  return { status: r.status, json, stderr: r.stderr };
}
const pidVivo = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
// Espera o condutor deste card terminar (o processo sumir) e devolve o estado.json.
async function esperarCondutor(mu, n, ms = 60000) {
  const dir = mu.estadoDir(n);
  const est = await ate(() => {
    try {
      const e = lerJson(join(dir, "estado.json"));
      return e.pid && !pidVivo(e.pid) ? e : null;
    } catch {
      return null;
    }
  }, ms, 150);
  if (!est) throw new Error(`condutor do #${n} não terminou: ${existsSync(join(dir, "frente.log")) ? readFileSync(join(dir, "frente.log"), "utf8") : "(sem log)"}`);
  return est;
}
const unidade = (est, card) => est.unidades.find((u) => u.card === card);

// Épico #78: 79 promovida (Branch declarada), 80 promovida com Bloqueado, 81 sem gm:spec-ref, 82 fechada.
function mundoEpico(extra = {}) {
  const mu = mundo({
    issues: {
      "78": { labels: ["épico"], subs: [79, 80, 81, 82] },
      "79": { parent: 78 },
      "80": { parent: 78 },
      "81": { parent: 78 },
      "82": { parent: 78, state: "CLOSED" },
    },
    comentarios: {
      "79": ["<!-- gm:spec-ref -->\n**Spec:** x\nBranch: feat/79-fase-um\n"],
      "80": ["<!-- gm:spec-ref -->\n**Spec:** x\nBranch: feat/80-fase-dois\n"],
      "82": ["<!-- gm:spec-ref -->\nBranch: feat/82-velha\n"],
    },
    bloqueado: { "80": "espera a 79" },
    claude: { comportamento: { "plan-tasks": { acao: "parada", motivo: "teste de unidades" } } },
    ...extra,
  });
  mkdirSync(join(mu.checkout, "planning", "78-epico"), { recursive: true });
  writeFileSync(join(mu.checkout, "planning", "78-epico", "spec.md"), "# spec do épico\n");
  writeFileSync(join(mu.checkout, "planning", "78-epico", "sensibilidade.json"), "{}\n");
  return mu;
}

console.log("iniciar: argumentos, condutor vivo, versão");
{
  const mu = mundoEpico();
  const semCard = rodar("node", [FRENTE, "iniciar", "--workspace", mu.ws, "--checkout", mu.checkout, "--base", "dev", "--entrega-arquivo", join(mu.w, "x")], { env: mu.env });
  afirmar(semCard.status === 2 && /--card/.test(semCard.stderr), "sem --card → código 2, dizendo qual");
  for (const f of ["workspace", "checkout", "base", "entrega-arquivo"]) {
    const todos = { workspace: mu.ws, checkout: mu.checkout, base: "dev", "entrega-arquivo": join(mu.w, "e.txt") };
    writeFileSync(join(mu.w, "e.txt"), "entrega");
    const args = [FRENTE, "iniciar", "--card", `${OWNER}/${REPO}#78`];
    for (const [k, v] of Object.entries(todos)) if (k !== f) args.push(`--${k}`, v);
    const r = rodar("node", args, { env: mu.env });
    afirmar(r.status === 2 && r.stderr.includes(`--${f}`), `sem --${f} → código 2`);
  }
  afirmar(iniciarFrente(mu, 78, [], { entrega: "  \n" }).status === 2, "arquivo de entrega vazio → código 2");
  afirmar(rodar("node", [FRENTE, "iniciar", "--card", "isso-nao-e-card", "--workspace", mu.ws, "--checkout", mu.checkout, "--base", "dev", "--entrega-arquivo", join(mu.w, "e.txt")], { env: mu.env }).status === 2, "--card fora do formato <owner>/<repo>#<n> → 2");
  afirmar(!existsSync(mu.estadoDir(78)), "nenhum dos erros deixou pasta de estado");

  // condutor vivo: batimento recente → não lança outro, retomada: true
  const dir = mu.estadoDir(78);
  escreverJson(join(dir, "estado.json"), { versao: 1, card: `${OWNER}/${REPO}#78`, pid: 4242, batimento: Date.now() - 5000, terminal: false, unidades: [] });
  const antes = readFileSync(join(dir, "estado.json"), "utf8");
  const r = iniciarFrente(mu, 78);
  afirmar(r.status === 0 && r.json.retomada === true && r.json.pid === 4242 && r.json.dir === dir, "condutor vivo (batimento de 5 s) → retomada: true, devolve o pid dele");
  afirmar(readFileSync(join(dir, "estado.json"), "utf8") === antes && !existsSync(join(dir, "frente.log")), "…e não lança outro processo nem mexe no estado");

  // versão desconhecida
  escreverJson(join(dir, "estado.json"), { versao: 99, card: `${OWNER}/${REPO}#78`, pid: 1, batimento: 0, unidades: [] });
  const v = iniciarFrente(mu, 78);
  afirmar(v.status === 2 && /versão/.test(v.stderr), "versao desconhecida no estado.json → código 2");
  const e = rodar("node", [FRENTE, "estado", "--dir", dir], { env: mu.env });
  afirmar(e.status === 2, "estado de versão desconhecida → código 2 também");
}

console.log("estado: --esperar");
{
  const mu = mundoEpico();
  const dir = mu.estadoDir(78);
  const base = { versao: 1, card: `${OWNER}/${REPO}#78`, pid: 1, batimento: Date.now(), terminal: false, unidades: [{ card: 79, estacao: "ship", pr: null, resultado: null, motivo: null }] };
  escreverJson(join(dir, "estado.json"), base);
  let r = rodar("node", [FRENTE, "estado", "--dir", dir], { env: mu.env });
  let j = JSON.parse(r.stdout);
  afirmar(r.status === 0 && j.terminal === false && j.condutor === "vivo" && j.unidades[0].estacao === "ship", "estado: terminal, condutor vivo e as unidades (card, estação, pr, resultado, motivo)");
  escreverJson(join(dir, "estado.json"), { ...base, batimento: 0 });
  j = JSON.parse(rodar("node", [FRENTE, "estado", "--dir", dir], { env: mu.env }).stdout);
  afirmar(j.condutor === "morto", "batimento velho → condutor morto");
  escreverJson(join(dir, "estado.json"), { ...base, terminal: true });
  const t0 = Date.now();
  j = JSON.parse(rodar("node", [FRENTE, "estado", "--dir", dir, "--esperar", "30"], { env: mu.env }).stdout);
  afirmar(j.terminal === true && Date.now() - t0 < 5000, "--esperar volta na hora quando já é terminal");
  escreverJson(join(dir, "estado.json"), base);
  const filho = spawn("node", [FRENTE, "estado", "--dir", dir, "--esperar", "30"], { env: mu.env });
  let saida = "";
  filho.stdout.on("data", (d) => (saida += d));
  await dormir(600);
  escreverJson(join(dir, "estado.json"), { ...base, unidades: [{ ...base.unidades[0], estacao: "concluida" }] });
  await ate(() => saida.includes("\n"), 5000, 50);
  afirmar(JSON.parse(saida).unidades[0].estacao === "concluida" && Date.now() - t0 < 25000, "--esperar acorda quando o estado.json muda, sem esperar os 30 s");
  const t1 = Date.now();
  escreverJson(join(dir, "estado.json"), base);
  j = JSON.parse(rodar("node", [FRENTE, "estado", "--dir", dir, "--esperar", "1"], { env: mu.env }).stdout);
  afirmar(j.terminal === false && Date.now() - t1 >= 900 && Date.now() - t1 < 8000, "--esperar sem mudança volta no fim do prazo");
}

console.log("unidades: épico com duas fases promovidas, uma Bloqueado, uma não promovida, uma fechada");
{
  const mu = mundoEpico();
  const r = iniciarFrente(mu, 78, ["--paralelo", "2"]);
  afirmar(r.status === 0 && r.json.retomada === false && Number.isInteger(r.json.pid) && r.json.dir === mu.estadoDir(78), "iniciar lança o condutor (retomada: false) e devolve {dir, pid}");
  const est = await esperarCondutor(mu, 78);
  afirmar(est.versao === 1 && est.card === `${OWNER}/${REPO}#78` && est.paralelo === 2 && est.base === "dev", "estado.json traz versao, card, paralelo e base");
  afirmar(readFileSync(join(mu.estadoDir(78), "entrega.txt"), "utf8") === ENTREGA, "a entrega foi gravada em entrega.txt");
  afirmar(existsSync(join(mu.estadoDir(78), "frente.log")), "o condutor escreve frente.log");
  afirmar(est.unidades.length === 4, "uma entrada por sub-issue");
  const u79 = unidade(est, 79);
  afirmar(u79.resultado === "parada" && u79.estacao === "plan-tasks" && u79.motivo === "teste de unidades", "a promovida é conduzida: chega à estação plan-tasks (o falso para ali)");
  afirmar(unidade(est, 80).resultado === "pulada" && unidade(est, 80).motivo === "Bloqueado: espera a 79", "com Bloqueado → pulada com o texto");
  afirmar(unidade(est, 81).resultado === "pulada" && unidade(est, 81).motivo === "não promovida", "sem gm:spec-ref → pulada: não promovida");
  afirmar(unidade(est, 82).resultado === "pulada" && unidade(est, 82).motivo === "fechada", "fechada → pulada: fechada");
  afirmar(est.terminal === true && typeof est.fim === "number", "todas as unidades decididas → terminal, com fim");
  afirmar(!existsSync(join(mu.checkout, ".git", "gm-frente", "79.lock")) && !existsSync(join(mu.checkout, ".git", "gm-frente", "80.lock")), "as travas são soltas no fim (e a pulada por Bloqueado nunca tomou trava)");
}

console.log("unidades: branch e worktree da unidade");
{
  const mu = mundoEpico();
  iniciarFrente(mu, 78);
  const est = await esperarCondutor(mu, 78);
  const u = unidade(est, 79);
  const wt = join(mu.ws, `${REPO}-79-fase-um`);
  afirmar(u.branch === "feat/79-fase-um" && u.worktree === wt, "branch do gm:spec-ref; worktree <workspace>/<repo>-<n>-<slug>");
  afirmar(existsSync(wt) && git(wt, "branch", "--show-current").trim() === "feat/79-fase-um", "a worktree existe, na branch da unidade");
  afirmar(git(mu.checkout, "ls-remote", "--heads", "origin", "feat/79-fase-um").includes("feat/79-fase-um"), "a branch nasceu na origin (createLinkedBranch do gh falso)");
  afirmar(git(wt, "merge-base", "--is-ancestor", "origin/dev", "HEAD") === "" , "a branch nasce de origin/dev");
  afirmar(existsSync(join(wt, "planning", "78-epico", "spec.md")) && existsSync(join(wt, "planning", "78-epico", "sensibilidade.json")), "a spec e a sensibilidade foram copiadas para a worktree");
  const msg = git(wt, "log", "-1", "--format=%B");
  afirmar(msg.startsWith("docs(planning): spec do #78") && msg.includes("Card: #79") && git(wt, "status", "--porcelain").trim() === "", "commit docs(planning): spec do #78 com Card: #79, árvore limpa");
  afirmar(!existsSync(join(mu.ws, `${REPO}-80-fase-dois`)), "unidade pulada não ganha worktree");
  const chamadas = readFileSync(join(mu.falso, "gh-chamadas.log"), "utf8");
  afirmar(chamadas.includes("createLinkedBranch"), "a branch foi criada pela mutação createLinkedBranch");

  // segunda rodada: a worktree existe, a branch existe → reaproveita sem recriar nem recommitar
  const cabeca = git(wt, "rev-parse", "HEAD");
  const dir = mu.estadoDir(78);
  escreverJson(join(dir, "estado.json"), { ...est, batimento: 0 });
  iniciarFrente(mu, 78, ["--reabrir"]);
  const est2 = await esperarCondutor(mu, 78);
  afirmar(git(wt, "rev-parse", "HEAD") === cabeca && unidade(est2, 79).worktree === wt, "segunda rodada reaproveita a worktree, sem commit novo");

  // a branch só na origin (worktree apagada): volta com `git worktree add` rastreando
  git(mu.checkout, "worktree", "remove", "--force", wt);
  git(mu.checkout, "branch", "-D", "feat/79-fase-um");
  escreverJson(join(dir, "estado.json"), { ...est2, batimento: 0 });
  iniciarFrente(mu, 78, ["--reabrir"]);
  await esperarCondutor(mu, 78);
  afirmar(git(wt, "branch", "--show-current").trim() === "feat/79-fase-um" && existsSync(join(wt, "planning", "78-epico", "spec.md")) && git(wt, "status", "--porcelain").trim() === "", "branch só na origin → worktree recriada, rastreando a origin, com a spec copiada de novo");
}

console.log("trava: um segundo condutor não conduz fase que já tem dono vivo");
{
  const mu = mundoEpico();
  const dirOutro = join(mu.w, "estado-de-outro");
  escreverJson(join(dirOutro, "estado.json"), { versao: 1, card: `${OWNER}/${REPO}#78`, pid: 1, batimento: Date.now(), terminal: false, unidades: [] });
  const trava = join(mu.checkout, ".git", "gm-frente", "79.lock");
  mkdirSync(trava, { recursive: true });
  writeFileSync(join(trava, "dono"), dirOutro);
  iniciarFrente(mu, 79);
  const est = await esperarCondutor(mu, 79);
  afirmar(unidade(est, 79).resultado === "pulada" && unidade(est, 79).motivo === `conduzida por ${dirOutro}`, "dono com batimento vivo → pulada: conduzida por <pasta>");
  afirmar(!existsSync(join(mu.ws, `${REPO}-79-fase-um`)), "…e a unidade não ganhou worktree");
  afirmar(existsSync(join(trava, "dono")) && readFileSync(join(trava, "dono"), "utf8") === dirOutro, "…e a trava do outro continua dele");

  // dono morto (batimento velho): a trava é tomada
  escreverJson(join(dirOutro, "estado.json"), { versao: 1, card: `${OWNER}/${REPO}#78`, pid: 1, batimento: Date.now() - 200000, terminal: false, unidades: [] });
  escreverJson(join(mu.estadoDir(79), "estado.json"), { ...est, batimento: 0 });
  iniciarFrente(mu, 79);
  const est2 = await esperarCondutor(mu, 79);
  afirmar(unidade(est2, 79).estacao === "plan-tasks" && unidade(est2, 79).motivo === "teste de unidades", "dono morto (batimento de 200 s) → toma a trava e conduz");
  afirmar(!existsSync(trava), "…e solta a trava no fim");
}

console.log("unidades: fase como alvo direto, e card sem épico");
{
  const mu = mundoEpico();
  iniciarFrente(mu, 79);
  const est = await esperarCondutor(mu, 79);
  afirmar(est.unidades.length === 1 && unidade(est, 79).branch === "feat/79-fase-um", "alvo = a fase: uma unidade, com a branch do gm:spec-ref");
  afirmar(existsSync(join(mu.ws, `${REPO}-79-fase-um`, "planning", "78-epico", "spec.md")), "a spec do PAI (78-*) é a que vai para a worktree");
  const mu2 = mundo({ issues: { "5": {} } });
  iniciarFrente(mu2, 5);
  const e2 = await esperarCondutor(mu2, 5);
  afirmar(e2.unidades.length === 1 && unidade(e2, 5).resultado === "parada" && unidade(e2, 5).motivo === "branch da unidade não declarada", "card sem branch declarada nem branch remota → parada: branch da unidade não declarada");
}

// ─────────────────────────────────────────────────────────────────────────────
// Estações e sessão filha (task 4)
const CARDS_EPICO = {
  "79": { pasta: "78-epico", fase: "f1", tasks: [{ nome: "1-primeira.md" }, { nome: "2-segunda.md" }] },
  "80": { pasta: "78-epico", fase: "f2", tasks: [{ nome: "1-uma.md" }, { nome: "2-outra.md" }] },
};
// Pareia início e fim das sessões do falso.
function intervalos(mu) {
  const por = new Map();
  for (const r of mu.sessoes()) {
    if (r.evento === "inicio") por.set(r.pid, { estacao: r.estacao, card: Number(r.card), task: r.task, cwd: r.cwd, ini: r.t, fim: null });
    else if (por.has(r.pid)) por.get(r.pid).fim = r.t;
  }
  return [...por.values()];
}
const sobrepoe = (a, b) => a.ini < b.fim && b.ini < a.fim;

// Epic #78 com 79 e 80 promovidas (tasks antigas), 81 com Bloqueado.
function mundoDuasFases(claude = {}) {
  const mu = mundoEpico({
    issues: {
      "78": { labels: ["épico"], subs: [79, 80, 81] },
      "79": { parent: 78 },
      "80": { parent: 78 },
      "81": { parent: 78 },
    },
    comentarios: {
      "79": ["<!-- gm:spec-ref -->\nBranch: feat/79-fase-um\n", "<!-- gm:tasks -->\n- [ ] 1 — primeira\n- [ ] 2 — segunda"],
      "80": ["<!-- gm:spec-ref -->\nBranch: feat/80-fase-dois\n", "<!-- gm:tasks -->\n- [ ] 1 — uma\n- [ ] 2 — outra"],
      "81": ["<!-- gm:spec-ref -->\nBranch: feat/81-tres\n"],
    },
    bloqueado: { "81": "espera a 80" },
    claude: { duracaoMs: 700, cards: CARDS_EPICO, ...claude },
  });
  return mu;
}

console.log("épico: duas cadeias andam ao mesmo tempo, cada uma até a sua PR (R1.2, R1.3, R1.4)");
{
  const mu = mundoDuasFases();
  const ini = iniciarFrente(mu, 78, ["--paralelo", "3"]);
  const est = await esperarCondutor(mu, 78);
  afirmar(ini.status === 0 && est.terminal === true, "a frente termina sozinha, terminal");
  afirmar(unidade(est, 79).resultado === "concluida" && unidade(est, 80).resultado === "concluida", `as duas fases chegam a concluida (${unidade(est, 79).motivo || ""} ${unidade(est, 80).motivo || ""})`);
  afirmar(unidade(est, 81).resultado === "pulada" && unidade(est, 81).motivo === "Bloqueado: espera a 80", "a terceira, com Bloqueado, fica pulada com o porquê");
  const iv = intervalos(mu);
  const de = (card) => iv.filter((x) => x.card === card);
  afirmar(de(79).some((a) => de(80).some((b) => sobrepoe(a, b))), "as sessões das duas cadeias se sobrepõem no tempo");
  const prs = mu.prs();
  afirmar(prs.length === 2 && prs.every((p) => p.state === "MERGED") && new Set(prs.map((p) => p.headRefName)).size === 2, "duas PRs no gh falso, uma por branch, cada uma levada até o merge");
  afirmar(unidade(est, 79).pr !== null && unidade(est, 79).pr !== unidade(est, 80).pr, "cada unidade guarda o número da sua PR");
  const ships = iv.filter((x) => x.estacao === "ship" || x.estacao === "ship-merge");
  afirmar(ships.length === 4 && !ships.some((a, i) => ships.some((b, j) => i < j && sobrepoe(a, b))), "nunca dois /gm-ship ao mesmo tempo no repo");
  const ordem = (card) => de(card).filter((x) => x.estacao === "implement").sort((a, b) => a.ini - b.ini).map((x) => x.task);
  afirmar(igual(ordem(79), ["1", "2"]) && igual(ordem(80), ["1", "2"]), "task antiga: uma por sessão, na ordem do número (R1.4)");
  const impl = (card) => de(card).filter((x) => x.estacao === "implement");
  afirmar(impl(79)[0].fim <= impl(79)[1].ini, "task antiga: os intervalos da mesma unidade não se sobrepõem (R1.4)");
  const wt79 = unidade(est, 79).worktree;
  afirmar(impl(79).every((x) => x.cwd === wt79) && impl(80).every((x) => x.cwd === unidade(est, 80).worktree), "task antiga roda na worktree da unidade, sem worktree -t<id> (R1.4)");
  afirmar(!git(mu.checkout, "worktree", "list").includes("-t1") && !git(mu.checkout, "branch", "-a").includes("-t1"), "nenhuma worktree nem branch -t<id> existiu");
  const log79 = git(wt79, "log", "--format=%s");
  afirmar(log79.includes("docs(planning): tasks do #79") && log79.includes("feat: task 1 (#79)") && log79.includes("feat: task 2 (#79)"), "o condutor commita a pasta de tasks; as tasks entram como commits");
  afirmar(git(wt79, "log", "--format=%B", "--grep=tasks do #79").includes("Card: #79"), "o commit das tasks leva o trailer Card: #79");
  afirmar(existsSync(join(wt79, "planning", "78-epico", "tasks", "f1", "1-primeira.md")) && !existsSync(join(wt79, "planning", "78-epico", "tasks", "f2")), "as tasks da fase 79 ficam em tasks/f1 da worktree dela (e as da 80 em f2)");

  // R1.3: o prompt gerado, no molde, só com isto
  const prompts = readdirSync(mu.estadoDir(78)).filter((f) => f.startsWith("prompt-")).sort();
  afirmar(prompts.length === 2 * (1 + 2 + 1 + 1), `um prompt por sessão aberta (${prompts.length})`);
  const todos = prompts.map((f) => readFileSync(join(mu.estadoDir(78), f), "utf8"));
  const molde = (t, esperado) => {
    const l = t.split("\n");
    return /^\/gm-[a-z-]+ /.test(l[0]) && l[1] === "" &&
      l[2] === "Argumento do despacho (gerado pelo /gm-frente; o card é o da primeira linha):" &&
      /^- Card own\/repo#\d+, fase do épico #78\. Spec: \/\S+\/planning\/78-epico\/spec\.md\.$/.test(l[3]) &&
      /^- Onde trabalhar: \/\S+, branch feat\/\d+-\S+, base dev\.( Task: \S+ — só ela\.)?$/.test(l[4]) &&
      l[5] === "- Outras sessões desta frente correm ao mesmo tempo em worktrees irmãs: não toque nelas nem no checkout principal." &&
      l[6] === `- Não há humano nesta sessão. ${ENTREGA}` && l.length === 8 && l[7] === "" && esperado(l);
  };
  afirmar(todos.every((t) => molde(t, () => true)), "cada prompt segue o molde, linha a linha");
  afirmar(todos.every((t) => !t.includes("Card: #") && !/yarn|npm run|node scripts|lint|typecheck|Co-Authored/i.test(t)), "nenhum prompt repete trailer, freio nem nome de suíte");
  afirmar(todos.filter((t) => t.includes(" Task: ")).length === 4 && todos.filter((t) => /^\/gm-implement /.test(t)).length === 4, "só as sessões de /gm-implement trazem a Task:");
  const primeiras = (re) => todos.map((t) => t.split("\n")[0]).filter((l) => re.test(l)).length;
  afirmar(primeiras(/^\/gm-plan-tasks 78-epico --card (79|80)$/) === 2, "gramática: /gm-plan-tasks <pasta> --card <n>");
  afirmar(primeiras(/^\/gm-implement 78-epico --card 79 --branch feat\/79-fase-um --task planning\/78-epico\/tasks\/f1\/[12]-[a-z]+\.md$/) === 2, "gramática: /gm-implement <pasta> --card <n> --branch <b> --task <arquivo relativo à raiz>");
  afirmar(primeiras(/^\/gm-ship 78-epico --card (79|80)$/) === 2 && primeiras(/^\/gm-ship 78-epico --card (79|80) --merge$/) === 2, "gramática: /gm-ship <pasta> --card <n> [--merge]");
  const extras = readdirSync(mu.estadoDir(78)).filter((f) => /\.sh$|^base|^cadeia|^comum/.test(f));
  afirmar(extras.length === 0, "nenhum arquivo de despacho escrito à mão: a pasta de estado só tem o que o condutor gerou (R1.3)");
}

// Card solo #5, com a branch declarada no ## Execution da spec e as tasks do falso.
function mundoSolo({ claude = {}, tasks = [{ nome: "1-a.md" }], prs = [], limite } = {}) {
  const mu = mundo({ issues: { "5": {} }, comentarios: { "5": ["<!-- gm:tasks -->\n- [ ] 1 — a"] }, claude: { duracaoMs: 300, cards: { "5": { pasta: "5-solo", tasks } }, ...claude } });
  mkdirSync(join(mu.checkout, "planning", "5-solo"), { recursive: true });
  writeFileSync(join(mu.checkout, "planning", "5-solo", "spec.md"), "# spec\n\n## Execution\n- Feature branch: `feat/5-solo`\n");
  for (const p of prs) escreverJson(join(mu.falso, "prs", `${p.number}.json`), { url: "u", mergedAt: null, baseRefName: "dev", headRefName: "feat/5-solo", ...p });
  mu.iniciar = (extras = []) => iniciarFrente(mu, 5, limite ? ["--limite-min", String(limite), ...extras] : extras);
  return mu;
}

console.log("épico: uma cadeia fecha em PARADA e a outra segue (R1.5)");
{
  const mu = mundoDuasFases({ comportamento: { "implement:79:1": { acao: "parada", motivo: "não deu para implementar" } } });
  iniciarFrente(mu, 78);
  const est = await esperarCondutor(mu, 78);
  afirmar(unidade(est, 79).resultado === "parada" && unidade(est, 79).motivo === "não deu para implementar" && unidade(est, 79).estacao === "implement", "a unidade que fechou em PARADA para, com o motivo e a estação");
  afirmar(unidade(est, 80).resultado === "concluida", "a outra unidade segue até concluir");
  afirmar(intervalos(mu).filter((x) => x.card === 79 && x.estacao.startsWith("ship")).length === 0, "a unidade parada não abre mais nenhuma sessão");
  afirmar(est.terminal === true, "terminal quando todas estão decididas, parada incluída");
}

console.log("sessão filha: saída sem linha de despacho, limite e precedência (R1.5)");
{
  const mu = mundoSolo({ claude: { comportamento: { "implement:5:1": { acao: "semlinha" } } } });
  mu.iniciar();
  const est = await esperarCondutor(mu, 5);
  const u = unidade(est, 5);
  afirmar(u.resultado === "parada" && /^saída sem linha de despacho \(última linha: «Terminei, mas esqueci a linha de despacho\.»\)$/.test(u.motivo), `saída sem linha → parada com o que veio no lugar (${u.motivo})`);
  afirmar(u.sessoes.every((x) => typeof x.fim === "number" && typeof x.pid === "number" && x.id && x.estacao), "o estado registra id, pid, estação e fim de cada sessão");
  afirmar(existsSync(join(mu.estadoDir(5), "saida-5-implement-t1-1.json")) && existsSync(join(mu.estadoDir(5), "erro-5-implement-t1-1.txt")) && existsSync(join(mu.estadoDir(5), "prompt-5-implement-t1-1.txt")), "arquivos prompt-/saida-/erro-<id>, id = <n>-<estacao>-t<task>-<k>");
}
{
  const mu = mundoSolo({ claude: { comportamento: { "implement:5:1": { acao: "dormir" } } }, limite: 0.05 });
  mu.iniciar();
  const t0 = Date.now();
  const est = await esperarCondutor(mu, 5);
  const u = unidade(est, 5);
  afirmar(u.resultado === "parada" && u.motivo === "sessão excedeu 0.05 min", `limite estourado → parada: sessão excedeu 0.05 min (${u.motivo})`);
  afirmar(Date.now() - t0 < 30000 && !pidVivo(u.sessoes[u.sessoes.length - 1].pid), "o grupo da sessão levou SIGTERM e não sobrou processo");
}
{
  // precedência: PR mergeada não reabre ship (nem plan-tasks, nem implement)
  const mu = mundoSolo({ prs: [{ number: 101, state: "MERGED" }] });
  mu.iniciar();
  const est = await esperarCondutor(mu, 5);
  const u = unidade(est, 5);
  afirmar(u.resultado === "concluida" && u.pr === 101 && u.sessoes.length === 0, "PR mergeada → concluida, sem abrir nenhuma sessão");
  afirmar(mu.sessoes().length === 0, "o claude falso nem foi chamado");
}

console.log("espera de CI: o condutor espera, depois abre o --merge");
{
  const mu = mundoSolo({ prs: [{ number: 101, state: "OPEN" }], tasks: [{ nome: "1-a.md" }] });
  escreverJson(join(mu.falso, "checks", "101.json"), [{ bucket: "pass" }, { bucket: "pending" }]);
  mu.iniciar();
  await ate(() => lerJson(join(mu.estadoDir(5), "estado.json")).unidades.some((u) => u.estacao === "espera-ci"), 15000, 100);
  await dormir(1000);
  afirmar(mu.sessoes().length === 0, "com checks pendentes nenhuma sessão é aberta (nem o --merge)");
  escreverJson(join(mu.falso, "checks", "101.json"), [{ bucket: "pass" }, { bucket: "skipping" }]);
  const est = await esperarCondutor(mu, 5);
  afirmar(unidade(est, 5).resultado === "concluida" && intervalos(mu).length === 1 && intervalos(mu)[0].estacao === "ship-merge", "sem pending → abre só o /gm-ship --merge, e a PR mergeada conclui a unidade");
}
{
  const mu = mundoSolo({ prs: [{ number: 101, state: "OPEN" }] });
  mu.iniciar();
  const est = await esperarCondutor(mu, 5);
  afirmar(unidade(est, 5).resultado === "concluida" && intervalos(mu)[0].estacao === "ship-merge", "'no checks reported' → abre o --merge mesmo assim");
}
{
  // ship sem PR: a guarda impede o laço
  const mu = mundoSolo({ claude: { comportamento: { "ship:5": { acao: "semlinha" } } } });
  mu.iniciar();
  const est = await esperarCondutor(mu, 5);
  afirmar(unidade(est, 5).resultado === "parada" && /saída sem linha/.test(unidade(est, 5).motivo), "ship sem linha de despacho → parada");
}

console.log("estação 3: spec ausente → /gm-spec numa worktree destacada, a pasta vai para a pasta de estado");
{
  const mu = mundo({ issues: { "6": {} }, claude: { duracaoMs: 200, cards: { "6": { pasta: "6-novo", tasks: [{ nome: "1-a.md" }] } } } });
  const antes = git(mu.checkout, "worktree", "list");
  iniciarFrente(mu, 6, []);
  const est = await esperarCondutor(mu, 6);
  const sessoes = intervalos(mu);
  afirmar(sessoes[0].estacao === "spec" && sessoes[0].cwd === join(mu.ws, `${REPO}-6-spec`), "a primeira sessão é o /gm-spec, na worktree <workspace>/<repo>-<n>-spec");
  afirmar(existsSync(join(mu.estadoDir(6), "spec", "6-novo", "spec.md")) && est.spec === join(mu.estadoDir(6), "spec", "6-novo", "spec.md"), "a pasta planning/<n>-*/ foi movida para <estado>/spec/ e vira a spec da frente");
  afirmar(!existsSync(join(mu.ws, `${REPO}-6-spec`)) && git(mu.checkout, "worktree", "list").split("\n").length >= antes.split("\n").length, "a worktree -spec foi removida, limpa (sem --force)");
  const prompt = readFileSync(join(mu.estadoDir(6), "prompt-6-spec-1.txt"), "utf8");
  afirmar(prompt.startsWith("/gm-spec #6\n") && /Spec: ainda não escrita/.test(prompt), "o prompt do /gm-spec avisa que a spec ainda não existe");
  const u = unidade(est, 6);
  afirmar(u.resultado === "parada" && /branch da unidade não declarada/.test(u.motivo), `sem Feature branch na spec nem branch remota, a unidade para depois da spec (${u.motivo})`);
}
{
  // Validação do #79 no #74: o /gm-spec commitou a spec numa branch do card, dentro da worktree -spec.
  // A worktree tem de sair limpa e soltar a branch, e a unidade segue nela, sem "already used by worktree".
  const mu = mundo({ issues: { "6": {} }, claude: { duracaoMs: 200, cards: { "6": { pasta: "6-novo", tasks: [{ nome: "1-a.md" }] } }, comportamento: { spec: { acao: "commitar", branch: "feat/6-novo" } } } });
  iniciarFrente(mu, 6, []);
  const est = await esperarCondutor(mu, 6);
  const u = unidade(est, 6);
  afirmar(!existsSync(join(mu.ws, `${REPO}-6-spec`)), `/gm-spec que commita numa branch: a worktree -spec sai (${u.motivo})`);
  afirmar(!/already used by worktree/.test(u.motivo || "") && u.estacao !== "spec", `a branch do card fica livre e a unidade passa da spec (${u.estacao}: ${u.motivo})`);
  afirmar(existsSync(join(mu.estadoDir(6), "spec", "6-novo", "spec.md")), "a spec commitada também é copiada para a pasta de estado");
}
{
  const mu = mundo({ issues: { "6": {} }, claude: { cards: { "6": { pasta: "6-novo" } }, comportamento: { spec: { acao: "parada", motivo: "spec precisa do humano" } } } });
  iniciarFrente(mu, 6, []);
  const est = await esperarCondutor(mu, 6);
  afirmar(unidade(est, 6).resultado === "parada" && unidade(est, 6).estacao === "spec" && unidade(est, 6).motivo === "spec precisa do humano" && est.terminal, "/gm-spec que fecha em PARADA para a frente com o motivo");
}

// ─────────────────────────────────────────────────────────────────────────────
// Onda paralela, junção, conflito e retomada (task 5)
const TASKS_ONDA = [
  { nome: "1-a.md", onda: 1, dep: [], toca: ["src/a.txt"] },
  { nome: "2-b.md", onda: 1, dep: [], toca: ["src/b.txt"] },
  { nome: "3-c.md", onda: 2, dep: ["1", "2"], toca: ["src/c.txt"] },
];
function mundoOnda({ claude = {}, duracaoMs = 1000, limite } = {}) {
  const mu = mundoSolo({ claude: { duracaoMs, ...claude }, tasks: TASKS_ONDA, limite });
  escreverJson(join(mu.falso, "comentarios", "5.json"), [{ id: 9001, body: "<!-- gm:tasks -->\n### Tasks\n- [ ] 1 — a (onda 1)\n- [ ] 2 — b (onda 1)\n- [ ] 3 — c (onda 2)" }]);
  mu.wtUnidade = join(mu.ws, `${REPO}-5-solo`);
  mu.wtTask = (id) => `${mu.wtUnidade}-t${id}`;
  return mu;
}
const listaWt = (mu) => git(mu.checkout, "worktree", "list", "--porcelain");

console.log("onda paralela: duas tasks da mesma onda, cada uma na sua worktree, juntadas depois (R1.1)");
{
  const mu = mundoOnda();
  mu.iniciar();
  const vistas = await ate(() => existsSync(mu.wtTask(1)) && existsSync(mu.wtTask(2)) && mu.sessoes().filter((x) => x.evento === "inicio" && x.estacao === "implement").length >= 2, 20000, 50);
  afirmar(Boolean(vistas), "durante a onda existem as duas worktrees -t1 e -t2");
  afirmar(git(mu.wtTask(1), "branch", "--show-current").trim() === "feat/5-solo-t1" && git(mu.wtTask(2), "branch", "--show-current").trim() === "feat/5-solo-t2", "cada uma na sua branch local <branch>-t<id>");
  const est = await esperarCondutor(mu, 5);
  const iv = intervalos(mu);
  const t = (id) => iv.find((x) => x.estacao === "implement" && x.task === id);
  afirmar(sobrepoe(t("1"), t("2")) && t("1").cwd === mu.wtTask(1) && t("2").cwd === mu.wtTask(2), "as sessões das duas abrem antes de qualquer uma terminar, cada uma na worktree própria");
  afirmar(t("3").cwd === mu.wtUnidade && t("3").ini >= Math.max(t("1").fim, t("2").fim), "a onda seguinte (uma task) roda na worktree da unidade, depois da junção");
  afirmar(unidade(est, 5).resultado === "concluida", `a unidade chega ao fim (${unidade(est, 5).motivo || "concluida"})`);
  const wt = mu.wtUnidade;
  afirmar(existsSync(join(wt, "src", "a.txt")) && existsSync(join(wt, "src", "b.txt")) && existsSync(join(wt, "src", "c.txt")), "as duas tasks estão juntadas na branch da unidade");
  const merges = git(wt, "log", "--merges", "--format=%s%n%b");
  afirmar(merges.includes("merge: task 1 da onda 1") && merges.includes("merge: task 2 da onda 1") && merges.includes("Card: #5"), "junção por --no-ff com a mensagem pedida e o trailer Card: #5");
  afirmar(!listaWt(mu).includes("-t1") && !listaWt(mu).includes("-t2") && git(mu.checkout, "branch", "--list", "*-t*").trim() === "", "worktrees e branches de task removidas");
  afirmar(git(wt, "rev-parse", "HEAD").trim() === git(mu.checkout, "ls-remote", "origin", "feat/5-solo").split("\t")[0], "push feito: a origin está no HEAD da unidade");
  const corpo = mu.comentarios(5)[0].body;
  afirmar(corpo.includes("- [x] 1 — a") && corpo.includes("- [x] 2 — b") && corpo.includes("- [x] 3 — c"), "um checkbox marcado no gh falso por task juntada");
  const patches = readFileSync(join(mu.falso, "gh-chamadas.log"), "utf8").split("\n").filter((l) => l.includes("PATCH")).length;
  afirmar(patches === 3, `uma edição do comentário por task, não por onda (${patches})`);
  afirmar(["1", "2", "3"].every((id) => readFileSync(join(wt, "planning", "5-solo", "tasks", `${id}-${{ 1: "a", 2: "b", 3: "c" }[id]}.md`), "utf8").startsWith("✅")), "as três tasks estão ✅ na branch da unidade");
}

console.log("onda paralela: conflito ao juntar (o falso mente no Toca:) para só aquela unidade (R1.5)");
{
  const mu = mundoOnda({ claude: { comportamento: { "implement:5:2": { acao: "fora", caminho: "src/a.txt" } } }, duracaoMs: 300 });
  mu.iniciar();
  const est = await esperarCondutor(mu, 5);
  const u = unidade(est, 5);
  afirmar(u.resultado === "parada" && u.motivo === "conflito ao juntar a task 2: src/a.txt", `conflito → parada com a task e os arquivos (${u.motivo})`);
  afirmar(git(mu.wtUnidade, "status", "--porcelain").trim() === "" && git(mu.wtUnidade, "log", "--merges", "--format=%s").includes("merge: task 1 da onda 1") && !existsSync(join(mu.wtUnidade, "src", "b.txt")), "o merge foi abortado: árvore limpa, a task 1 já juntada, a 2 não");
  afirmar(existsSync(mu.wtTask(2)) && git(mu.checkout, "branch", "--list", "*-t2").trim() !== "", "a worktree e a branch da task em conflito ficam para diagnóstico");
  afirmar(!existsSync(mu.wtTask(1)), "a task já juntada foi limpa");
  afirmar(mu.comentarios(5)[0].body.includes("- [x] 1 — a") && mu.comentarios(5)[0].body.includes("- [ ] 2 — b"), "só o checkbox da task juntada foi marcado");
  afirmar(!intervalos(mu).some((x) => x.task === "3"), "a onda seguinte não abriu");
}

console.log("onda paralela: uma task fecha em PARADA, as outras ainda são juntadas (R1.5)");
{
  const mu = mundoOnda({ claude: { comportamento: { "implement:5:2": { acao: "parada", motivo: "task 2 travou" } } }, duracaoMs: 300 });
  mu.iniciar();
  const est = await esperarCondutor(mu, 5);
  const u = unidade(est, 5);
  afirmar(u.resultado === "parada" && u.motivo === "task 2 travou", "a unidade para depois, com o motivo da task");
  afirmar(existsSync(join(mu.wtUnidade, "src", "a.txt")) && !existsSync(join(mu.wtUnidade, "src", "b.txt")), "a task 1, que fechou em PROXIMO, foi juntada; a 2 não");
  afirmar(mu.comentarios(5)[0].body.includes("- [x] 1 — a") && git(mu.checkout, "ls-remote", "origin", "feat/5-solo").split("\t")[0] === git(mu.wtUnidade, "rev-parse", "HEAD").trim(), "…e empurrada e marcada");
}

console.log("retomada: matar o condutor no meio da onda e iniciar de novo (R1.5)");
{
  const mu = mundoOnda({ duracaoMs: 2500 });
  const r1 = mu.iniciar();
  await ate(() => mu.sessoes().filter((x) => x.evento === "inicio" && x.estacao === "implement").length >= 2, 20000, 50);
  process.kill(r1.json.pid, "SIGKILL");
  const dir = mu.estadoDir(5);
  afirmar(await ate(() => !pidVivo(r1.json.pid), 5000, 50), "o condutor morreu no meio da onda");
  const vivas = mu.sessoes().filter((x) => x.evento === "inicio").map((x) => x.pid).filter(pidVivo).length;
  afirmar(vivas === 2, "as duas filhas (destacadas) seguem vivas");
  const antes = lerJson(join(dir, "estado.json"));
  afirmar(antes.unidades[0].sessoes.filter((x) => !x.fim).length === 2, "o estado guarda as duas sessões em voo, com pid");
  const imediato = mu.iniciar();
  afirmar(imediato.json.retomada === true, "com o batimento ainda fresco, iniciar diz retomada: true e não lança outro");
  escreverJson(join(dir, "estado.json"), { ...antes, batimento: 0 });
  const r2 = mu.iniciar();
  afirmar(r2.json.retomada === false && r2.json.pid !== r1.json.pid, "batimento velho → o condutor novo é lançado");
  const est = await esperarCondutor(mu, 5);
  const u = unidade(est, 5);
  afirmar(u.resultado === "concluida", `a unidade termina (${u.motivo || "concluida"})`);
  const impl = mu.sessoes().filter((x) => x.evento === "inicio" && x.estacao === "implement");
  afirmar(impl.length === 3 && igual(impl.map((x) => x.task).sort(), ["1", "2", "3"]), "cada task abriu uma sessão só: a viva foi esperada, não reaberta, e a ✅ não voltou");
  afirmar(!listaWt(mu).includes("-t1") && !listaWt(mu).includes("-t2"), "as worktrees de task foram juntadas e removidas pelo condutor novo");
  afirmar(mu.comentarios(5)[0].body.includes("- [x] 1 —") && mu.comentarios(5)[0].body.includes("- [x] 2 —") && mu.comentarios(5)[0].body.includes("- [x] 3 —"), "os três checkboxes marcados");
}

// ─────────────────────────────────────────────────────────────────────────────
// Achados do G4 da F1
console.log("G4: planning no workspace (fora do repo), da spec à PR");
{
  const mu = mundo({ issues: { "9": {} }, comentarios: { "9": ["<!-- gm:tasks -->\n- [ ] 1 — a"] }, claude: { duracaoMs: 200, cards: { "9": { pasta: "9-ws", tasks: [{ nome: "1-a.md" }, { nome: "2-b.md" }] } } } });
  const pl = join(mu.ws, "planning");
  escreverJson(join(mu.falso, "claude.json"), { ...lerJson(join(mu.falso, "claude.json")), planning: pl });
  mkdirSync(join(pl, "9-ws"), { recursive: true });
  writeFileSync(join(pl, "9-ws", "spec.md"), "# spec\n\n## Execution\n- Feature branch: `feat/9-ws`\n");
  iniciarFrente(mu, 9);
  const est = await esperarCondutor(mu, 9);
  const u = unidade(est, 9);
  afirmar(u.resultado === "concluida", `planning no workspace: a unidade chega a concluida (${u.motivo || "concluida"})`);
  afirmar(["1-a.md", "2-b.md"].every((f) => readFileSync(join(pl, "9-ws", "tasks", f), "utf8").startsWith("✅")), "as tasks ✅ ficam no planning do workspace, lidas do disco");
  const impl = readdirSync(mu.estadoDir(9)).filter((f) => f.startsWith("prompt-9-implement"));
  afirmar(impl.length === 2 && impl.every((f) => readFileSync(join(mu.estadoDir(9), f), "utf8").split("\n")[0].includes(`--task ${join(pl, "9-ws", "tasks")}`)), "o --task vai com o caminho absoluto do workspace");
}
{
  const mu = mundo({ issues: { "6": {} }, claude: { duracaoMs: 200, cards: { "6": { pasta: "6-novo" } } } });
  const pl = join(mu.ws, "planning");
  escreverJson(join(mu.falso, "claude.json"), { ...lerJson(join(mu.falso, "claude.json")), planning: pl });
  iniciarFrente(mu, 6);
  const est = await esperarCondutor(mu, 6);
  const u = unidade(est, 6);
  afirmar(!/ENOENT|erro do condutor/.test(u.motivo || "") && /branch da unidade não declarada/.test(u.motivo || ""), `estação 3 com o /gm-spec escrevendo no workspace: sem ENOENT, a spec é achada lá (${u.motivo})`);
  afirmar(est.spec === join(pl, "6-novo", "spec.md") && !existsSync(join(mu.ws, `${REPO}-6-spec`)), "a spec da frente é a do workspace e a worktree -spec saiu");
}

console.log("G4: fase concluída e fechada depois não vira pulada numa rodada nova");
{
  const mu = mundoDuasFases();
  iniciarFrente(mu, 78);
  const est = await esperarCondutor(mu, 78);
  afirmar(unidade(est, 79).resultado === "concluida", "a fase 79 concluiu na primeira rodada");
  const issues = lerJson(join(mu.falso, "issues.json"));
  issues["79"].state = "CLOSED";
  escreverJson(join(mu.falso, "issues.json"), issues);
  const r = iniciarFrente(mu, 78);
  afirmar(r.json.retomada === false, "estado terminal com batimento fresco não é condutor vivo: a rodada nova é lançada");
  const est2 = await esperarCondutor(mu, 78);
  afirmar(unidade(est2, 79).resultado === "concluida" && unidade(est2, 79).pr === unidade(est, 79).pr, `fechada depois de concluída continua concluida, com a PR (${unidade(est2, 79).resultado} ${unidade(est2, 79).motivo || ""})`);
}

console.log("G4: worktree registrada com a pasta apagada é recriada");
{
  const mu = mundoSolo();
  mu.iniciar();
  await ate(() => {
    try {
      return lerJson(join(mu.estadoDir(5), "estado.json")).unidades.some((u) => u.worktree && existsSync(u.worktree));
    } catch {
      return false;
    }
  }, 20000, 50);
  const est0 = await esperarCondutor(mu, 5);
  const wt = unidade(est0, 5).worktree;
  rmSync(wt, { recursive: true, force: true });
  afirmar(listaWt(mu).includes(`worktree ${wt}`), "a worktree segue registrada no git, sem a pasta");
  escreverJson(join(mu.estadoDir(5), "estado.json"), { ...est0, terminal: false, batimento: 0, unidades: est0.unidades.map((u) => ({ ...u, resultado: null, motivo: null })) });
  fsPrs(mu);
  mu.iniciar();
  const est = await esperarCondutor(mu, 5);
  afirmar(unidade(est, 5).resultado === "concluida" && existsSync(wt), `o prune deixa o worktree add recriar a pasta (${unidade(est, 5).motivo || "concluida"})`);
}

console.log("G4: trava sem dono escrito");
{
  const mu = mundoDuasFases();
  const lock = join(mu.checkout, ".git", "gm-frente", "79.lock");
  mkdirSync(lock, { recursive: true });
  iniciarFrente(mu, 78);
  const est = await esperarCondutor(mu, 78);
  afirmar(unidade(est, 79).resultado === "pulada" && unidade(est, 79).motivo === "conduzida por (trava sendo tomada)", `trava recente sem dono → é de alguém, pulada (${unidade(est, 79).motivo})`);
  afirmar(unidade(est, 80).resultado === "concluida", "a outra fase segue");
  const velho = new Date(Date.now() - 200000);
  rmSync(lock, { recursive: true, force: true });
  mkdirSync(lock, { recursive: true });
  utimesSync(lock, velho, velho);
  iniciarFrente(mu, 78);
  const est2 = await esperarCondutor(mu, 78);
  afirmar(unidade(est2, 79).resultado === "concluida", `trava velha sem dono → tomada (${unidade(est2, 79).motivo || "concluida"})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Seções seguintes (tasks 2 a 5 da F1): `falsos`, `iniciar`/`estado`/unidades/trava, estações,
// prompt gerado, onda paralela, conflito, retomada. Entram aqui, antes do fecho abaixo.
// ─────────────────────────────────────────────────────────────────────────────

console.log(falhas === 0 ? "\ntudo verde" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
