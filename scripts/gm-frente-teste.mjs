#!/usr/bin/env node
// Testa skills/gm-frente/ (ondas.mjs e o condutor frente.mjs) sem rede, sem cota e sem framework
// (padrão de gm-spec-sensivel-teste.mjs). Tudo em diretório temporário.
// Uso: node scripts/gm-frente-teste.mjs
// Sai 0 se todos os cenários passam, 1 se algum falha.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
// Seções seguintes (tasks 2 a 5 da F1): `falsos`, `iniciar`/`estado`/unidades/trava, estações,
// prompt gerado, onda paralela, conflito, retomada. Entram aqui, antes do fecho abaixo.
// ─────────────────────────────────────────────────────────────────────────────

console.log(falhas === 0 ? "\ntudo verde" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
