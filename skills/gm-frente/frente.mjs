#!/usr/bin/env node
// Condutor do /gm-frente: conduz um card ou épico em ondas e fases paralelas, abrindo cada estação
// da esteira como uma sessão headless (`claude -p "/gm-<skill> …"`). É um processo à parte, como um CI:
// a sessão do /gm-frente só o lança e o acompanha. Node >= 20, só módulos nativos, ESM.
//
//   node frente.mjs iniciar  --card <owner>/<repo>#<n> --workspace <dir> --checkout <dir> --base <dev>
//                            --entrega-arquivo <arquivo> [--paralelo <n>] [--spec <caminho>]
//                            [--limite-min <m>] [--reabrir]
//   node frente.mjs conduzir --dir <pasta de estado>
//   node frente.mjs estado   --dir <pasta de estado> [--esperar <s>]
//
// Códigos: 0 ok · 2 argumento, leitura ou versão de estado desconhecida.
// Estado: ${CLAUDE_CONFIG_DIR:-~/.claude}/gm-frente/<owner>-<repo>-<n>/estado.json (troca atômica).
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const { lerPasta, validarOndas } = await import(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "ondas.mjs")).href);

const VERSAO = 1;
const BATIMENTO_VIVO_MS = 90_000;
const BATIMENTO_RENOVA_MS = 30_000;
const ESTE_ARQUIVO = fileURLToPath(import.meta.url);
const FINAIS = new Set(["concluida", "parada", "pulada"]);

// ── utilidades ──────────────────────────────────────────────────────────────
class Parada extends Error {}
const agora = () => Date.now();
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);

function erroArg(msg) {
  console.error(`frente: ${msg}`);
  return 2;
}

function lerOpcoes(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const chave = argv[i].slice(2);
    const prox = argv[i + 1];
    if (prox === undefined || prox.startsWith("--")) o[chave] = true;
    else {
      o[chave] = prox;
      i++;
    }
  }
  return o;
}

function parseCard(texto) {
  const m = /^([^/\s#]+)\/([^/\s#]+)#(\d+)$/.exec(String(texto || ""));
  return m ? { owner: m[1], repo: m[2], n: Number(m[3]), repoCompleto: `${m[1]}/${m[2]}` } : null;
}

function pastaDeEstado(card) {
  const base = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
  return join(base, "gm-frente", `${card.owner}-${card.repo}-${card.n}`);
}

function git(cwd, ...args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}
function gitOk(cwd, ...args) {
  const r = git(cwd, ...args);
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} (${cwd}): ${(r.stderr || r.stdout).trim()}`);
  return r.stdout;
}
function gh(...args) {
  return spawnSync("gh", args, { encoding: "utf8" });
}
function ghJson(...args) {
  const r = gh(...args);
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(" ")}: ${(r.stderr || r.stdout).trim()}`);
  return JSON.parse(r.stdout || "null");
}

function escreverAtomico(arquivo, conteudo) {
  const tmp = `${arquivo}.tmp-${process.pid}`;
  writeFileSync(tmp, conteudo);
  renameSync(tmp, arquivo);
}

function carregarEstado(dir) {
  const arq = join(dir, "estado.json");
  if (!existsSync(arq)) return null;
  const est = JSON.parse(readFileSync(arq, "utf8"));
  if (est.versao !== VERSAO) throw new Error(`versão de estado desconhecida: ${est.versao} (este condutor lê a ${VERSAO})`);
  return est;
}
function salvarEstado(dir, est) {
  escreverAtomico(join(dir, "estado.json"), JSON.stringify(est, null, 2));
}
const vivo = (est) => Boolean(est) && agora() - Number(est.batimento || 0) < BATIMENTO_VIVO_MS;

// ── iniciar ─────────────────────────────────────────────────────────────────
function iniciar(o) {
  const card = parseCard(o.card);
  if (!o.card) return erroArg("falta --card <owner>/<repo>#<n>");
  if (!card) return erroArg(`--card inválido: ${o.card} (esperava <owner>/<repo>#<n>)`);
  for (const f of ["workspace", "checkout", "base", "entrega-arquivo"]) {
    if (!o[f] || o[f] === true) return erroArg(`falta --${f}`);
  }
  let entrega;
  try {
    entrega = readFileSync(o["entrega-arquivo"], "utf8");
  } catch (e) {
    return erroArg(`não consegui ler a entrega: ${o["entrega-arquivo"]} (${e.code || e.message})`);
  }
  if (!entrega.trim()) return erroArg("o arquivo da entrega está vazio: a frente precisa da entrega em palavras");
  const paralelo = o.paralelo === undefined ? 3 : Number(o.paralelo);
  if (!Number.isInteger(paralelo) || paralelo < 1) return erroArg(`--paralelo inválido: ${o.paralelo}`);
  const limiteMin = o["limite-min"] === undefined ? 120 : Number(o["limite-min"]);
  if (!(limiteMin > 0)) return erroArg(`--limite-min inválido: ${o["limite-min"]}`);

  const dir = pastaDeEstado(card);
  let est;
  try {
    est = carregarEstado(dir);
  } catch (e) {
    return erroArg(e.message);
  }
  if (vivo(est)) {
    console.log(JSON.stringify({ dir, pid: est.pid, retomada: true }));
    return 0;
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "entrega.txt"), entrega);
  const anterior = est || {};
  const unidades = (anterior.unidades || []).map((u) => {
    if (o.reabrir && u.resultado === "parada") return { ...u, resultado: null, motivo: null };
    return u;
  });
  const novo = {
    versao: VERSAO,
    card: `${card.repoCompleto}#${card.n}`,
    workspace: resolve(o.workspace),
    checkout: resolve(o.checkout),
    base: o.base,
    paralelo,
    limiteMin,
    spec: o.spec ? resolve(o.spec) : anterior.spec || null,
    pid: null,
    batimento: agora(),
    inicio: anterior.inicio || agora(),
    terminal: false,
    unidades,
  };
  const log_ = openSync(join(dir, "frente.log"), "a");
  const filho = spawn(process.execPath, [ESTE_ARQUIVO, "conduzir", "--dir", dir], {
    detached: true,
    stdio: ["ignore", log_, log_],
  });
  novo.pid = filho.pid;
  salvarEstado(dir, novo);
  filho.unref();
  closeSync(log_);
  console.log(JSON.stringify({ dir, pid: filho.pid, retomada: false }));
  return 0;
}

// ── estado ──────────────────────────────────────────────────────────────────
async function estadoCmd(o) {
  if (!o.dir || o.dir === true) return erroArg("falta --dir");
  const resumo = () => {
    const est = carregarEstado(o.dir);
    if (!est) throw new Error(`sem estado em ${o.dir}`);
    return est;
  };
  let est;
  try {
    est = resumo();
  } catch (e) {
    return erroArg(e.message);
  }
  if (o.esperar !== undefined) {
    const s = Math.min(Number(o.esperar) || 0, 540);
    const passo = Number(process.env.GM_FRENTE_ESPERA_MS) || 5000;
    const arq = join(o.dir, "estado.json");
    const assinatura = () => statSync(arq).mtimeMs + ":" + statSync(arq).size;
    const inicial = assinatura();
    const limite = agora() + s * 1000;
    while (!est.terminal && agora() < limite) {
      await dormir(Math.min(passo, Math.max(limite - agora(), 0)));
      if (assinatura() !== inicial) {
        est = resumo();
        break;
      }
    }
    est = resumo();
  }
  console.log(
    JSON.stringify({
      terminal: Boolean(est.terminal),
      condutor: vivo(est) ? "vivo" : "morto",
      unidades: est.unidades.map((u) => ({ card: u.card, estacao: u.estacao, pr: u.pr ?? null, resultado: u.resultado ?? null, motivo: u.motivo ?? null })),
    }),
  );
  return 0;
}

// ── conduzir ────────────────────────────────────────────────────────────────
// Semáforo simples: até `n` ao mesmo tempo. Usado para as sessões filhas (`--paralelo`) e para
// o /gm-ship (um por repo).
class Semaforo {
  constructor(n) {
    this.livres = n;
    this.fila = [];
  }
  async adquirir() {
    if (this.livres > 0) {
      this.livres--;
      return;
    }
    await new Promise((r) => this.fila.push(r));
  }
  liberar() {
    const prox = this.fila.shift();
    if (prox) prox();
    else this.livres++;
  }
}

class Condutor {
  constructor(dir) {
    this.dir = dir;
    this.est = carregarEstado(dir);
    if (!this.est) throw new Error(`sem estado em ${dir}`);
    this.card = parseCard(this.est.card);
    this.entrega = readFileSync(join(dir, "entrega.txt"), "utf8").trim();
    this.slots = new Semaforo(this.est.paralelo);
    this.ship = new Semaforo(1);
    this.travas = [];
    this.projeto = this.lerProjeto();
  }

  salvar() {
    this.est.batimento = agora();
    salvarEstado(this.dir, this.est);
  }

  // `## Board` do CLAUDE.md que governa o repo (o do repo, senão o do workspace): `- Project: number `N``.
  lerProjeto() {
    for (const base of [this.est.checkout, this.est.workspace]) {
      const arq = join(base, "CLAUDE.md");
      if (!existsSync(arq)) continue;
      const m = /^- Project:\s*number\s*`?(\d+)`?/m.exec(readFileSync(arq, "utf8"));
      if (m) return Number(m[1]);
    }
    return null;
  }

  // ─ spec ───────────────────────────────────────────────────────────────────
  // Ordem: --spec do estado, origin/<base> (git ls-tree), checkout, <workspace>/planning.
  localizarSpec(n) {
    const { checkout, workspace, base } = this.est;
    const dePasta = (caminho) => ({ caminho, pasta: basename(dirname(caminho)) });
    if (this.est.spec && existsSync(this.est.spec)) return { ...dePasta(this.est.spec), planejamento: this.planejamentoDe(this.est.spec) };

    const tree = git(checkout, "ls-tree", "-r", "--name-only", `origin/${base}`, "planning/");
    if (tree.status === 0) {
      const rel = tree.stdout.split("\n").find((l) => new RegExp(`^planning/${n}-[^/]+/spec\\.md$`).test(l));
      if (rel) return { caminho: null, rel, pasta: basename(dirname(rel)), planejamento: "repo" };
    }
    const emCheckout = achar(join(checkout, "planning"), n);
    if (emCheckout) return { ...dePasta(emCheckout), planejamento: "repo" };
    const emWs = achar(join(workspace, "planning"), n);
    if (emWs) return { ...dePasta(emWs), planejamento: "workspace" };
    return null;
  }
  planejamentoDe(caminho) {
    return caminho.startsWith(join(this.est.workspace, "planning") + sep) ? "workspace" : "repo";
  }

  // ─ unidades ───────────────────────────────────────────────────────────────
  comentarios(n) {
    const r = gh("api", `repos/${this.card.repoCompleto}/issues/${n}/comments`, "--paginate");
    if (r.status !== 0) throw new Error(`gh api comments #${n}: ${(r.stderr || r.stdout).trim()}`);
    return JSON.parse(r.stdout || "[]");
  }
  bloqueado(n) {
    const q = `{repository(owner:"${this.card.owner}",name:"${this.card.repo}"){issue(number:${n}){projectItems(first:20){nodes{project{number} fieldValueByName(name:"Bloqueado"){... on ProjectV2ItemFieldTextValue{text}}}}}}}`;
    const r = ghJson("api", "graphql", "-f", `query=${q}`);
    const nos = r?.data?.repository?.issue?.projectItems?.nodes || [];
    const doBoard = this.projeto === null ? nos : nos.filter((x) => x?.project?.number === this.projeto);
    return doBoard.map((x) => x?.fieldValueByName?.text || "").find((t) => t.trim()) || "";
  }

  // Lê o alvo: o card, se é épico (label `épico`) e quais são as sub-issues, e o pai (fase de um épico).
  lerContexto() {
    const n = this.card.n;
    const r = this.card.repoCompleto;
    const issue = ghJson("issue", "view", String(n), "--repo", r, "--json", "number,title,state,labels,body");
    const epico = (issue.labels || []).some((l) => /^[eé]pico$/i.test(l.name));
    const subs = epico ? ghJson("api", `repos/${r}/issues/${n}/sub_issues`).sort((a, b) => a.number - b.number) : [];
    let pai = null;
    if (!epico || subs.length === 0) {
      const p = gh("api", `repos/${r}/issues/${n}/parent`);
      if (p.status === 0) pai = JSON.parse(p.stdout).number;
    }
    return { epico: epico && subs.length > 0, subs, pai };
  }

  // Card com label épico e sub-issues → uma unidade por sub-issue aberta, promovida (gm:spec-ref) e sem
  // Bloqueado; as demais entram como `pulada` com o porquê. Card sem sub-issues → ele mesmo (se é fase
  // de um épico, com o pai e a fase dele).
  descobrirUnidades(ctx) {
    const n = this.card.n;
    const r = this.card.repoCompleto;
    const comRef = (card) => this.comentarios(card).find((c) => c.body.includes("<!-- gm:spec-ref -->"))?.body || null;
    if (!ctx.epico) {
      if (!ctx.pai) return [{ card: n, pai: null, fase: null, specRef: null }];
      const irmas = ghJson("api", `repos/${r}/issues/${ctx.pai}/sub_issues`).sort((a, b) => a.number - b.number);
      const idx = irmas.findIndex((x) => x.number === n);
      return [{ card: n, pai: ctx.pai, fase: idx >= 0 ? `f${idx + 1}` : null, specRef: comRef(n) }];
    }
    return ctx.subs.map((s, i) => {
      const u = { card: s.number, pai: n, fase: `f${i + 1}`, specRef: null };
      if (s.state !== "OPEN") return { ...u, pulada: "fechada" };
      const ref = comRef(s.number);
      if (!ref) return { ...u, pulada: "não promovida" };
      const bloq = this.bloqueado(s.number);
      if (bloq) return { ...u, pulada: `Bloqueado: ${bloq}` };
      return { ...u, specRef: ref };
    });
  }

  // Junta o que foi descoberto ao que já estava no estado (uma rodada anterior): concluida e parada
  // ficam; pulada é recalculada; o que é novo entra.
  atualizarUnidades(descobertas) {
    const porCard = new Map(this.est.unidades.map((u) => [u.card, u]));
    const lista = [];
    for (const d of descobertas) {
      const antiga = porCard.get(d.card);
      const base = antiga && antiga.resultado !== "pulada" ? antiga : { card: d.card, branch: null, worktree: null, estacao: null, resultado: null, motivo: null, pr: null, sessoes: [] };
      const u = { ...base, pai: d.pai, fase: d.fase, specRef: d.specRef };
      if (d.pulada) {
        u.resultado = "pulada";
        u.motivo = d.pulada;
        u.estacao = null;
      } else if (u.resultado === "pulada") {
        u.resultado = null;
        u.motivo = null;
      }
      lista.push(u);
    }
    for (const u of this.est.unidades) if (!lista.some((x) => x.card === u.card)) lista.push(u);
    this.est.unidades = lista;
    this.salvar();
  }

  // ─ trava por unidade ──────────────────────────────────────────────────────
  gitCommonDir() {
    const r = gitOk(this.est.checkout, "rev-parse", "--path-format=absolute", "--git-common-dir").trim();
    return r;
  }
  // mkdir atômico em <git-common-dir>/gm-frente/<n>.lock com o caminho da pasta de estado dentro.
  // Dono com batimento vivo → false (e o motivo); dono morto → toma.
  tomarTrava(n) {
    const pai = join(this.gitCommonDir(), "gm-frente");
    mkdirSync(pai, { recursive: true });
    const trava = join(pai, `${n}.lock`);
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        mkdirSync(trava);
        writeFileSync(join(trava, "dono"), this.dir);
        this.travas.push(trava);
        return { ok: true };
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
      }
      let dono = "";
      try {
        dono = readFileSync(join(trava, "dono"), "utf8").trim();
      } catch {}
      if (dono === this.dir) {
        this.travas.push(trava);
        return { ok: true };
      }
      let estDono = null;
      try {
        estDono = carregarEstado(dono);
      } catch {}
      if (vivo(estDono)) return { ok: false, dono };
      rmSync(trava, { recursive: true, force: true });
    }
    return { ok: false, dono: "(trava que não se solta)" };
  }
  soltarTravas() {
    for (const t of this.travas) rmSync(t, { recursive: true, force: true });
    this.travas = [];
  }

  // ─ branch e worktree da unidade ───────────────────────────────────────────
  branchDaUnidade(u, spec) {
    if (u.specRef) {
      const m = /^Branch:\s*`?(\S+?)`?\s*$/m.exec(u.specRef);
      if (m) return m[1];
    }
    const texto = spec?.caminho && existsSync(spec.caminho) ? readFileSync(spec.caminho, "utf8") : spec?.rel ? git(this.est.checkout, "show", `origin/${this.est.base}:${spec.rel}`).stdout : "";
    const m = /Feature branch:\s*`?((?:feat|fix)\/[^\s`]+)`?/.exec(texto || "");
    if (m && !u.pai) return m[1];
    const rem = git(this.est.checkout, "ls-remote", "--heads", "origin", `feat/${u.card}-*`, `fix/${u.card}-*`);
    const lista = (rem.stdout || "").split("\n").map((l) => l.split("\t")[1]).filter(Boolean).map((r) => r.replace("refs/heads/", ""));
    if (lista.length === 1) return lista[0];
    return null;
  }
  worktreeDe(u, branch) {
    const slug = branch.replace(new RegExp(`^(feat|fix)/${u.card}-`), "").replace(/\//g, "-");
    return join(this.est.workspace, `${this.card.repo}-${u.card}-${slug}`);
  }

  prepararWorktree(u, spec) {
    const { checkout, base } = this.est;
    const wt = u.worktree;
    gitOk(checkout, "fetch", "-q", "origin");
    const listada = gitOk(checkout, "worktree", "list", "--porcelain").split("\n").some((l) => l === `worktree ${wt}`);
    const remota = git(checkout, "rev-parse", "--verify", "-q", `refs/remotes/origin/${u.branch}`).status === 0;
    const local = git(checkout, "rev-parse", "--verify", "-q", `refs/heads/${u.branch}`).status === 0;
    if (listada && existsSync(wt)) {
      if (remota) {
        const adiante = git(wt, "merge-base", "--is-ancestor", "HEAD", `origin/${u.branch}`).status === 0;
        const igual = git(wt, "rev-parse", "HEAD").stdout === git(wt, "rev-parse", `origin/${u.branch}`).stdout;
        if (adiante && !igual) gitOk(wt, "merge", "-q", "--ff-only", `origin/${u.branch}`);
      }
    } else if (local) {
      gitOk(checkout, "worktree", "add", "-q", wt, u.branch);
    } else if (remota) {
      gitOk(checkout, "worktree", "add", "-q", "--track", "-b", u.branch, wt, `origin/${u.branch}`);
    } else {
      this.criarBranchRemota(u);
      gitOk(checkout, "fetch", "-q", "origin");
      if (git(checkout, "rev-parse", "--verify", "-q", `refs/remotes/origin/${u.branch}`).status === 0) {
        gitOk(checkout, "worktree", "add", "-q", "--track", "-b", u.branch, wt, `origin/${u.branch}`);
      } else {
        gitOk(checkout, "worktree", "add", "-q", "-b", u.branch, wt, `origin/${base}`);
      }
    }
    this.copiarSpec(u, spec);
  }

  // createLinkedBranch a partir de origin/<base> (a mutação do /gm-implement, `## Guarantee the branch`);
  // se falhar, quem chama cai em `git worktree add -b`.
  criarBranchRemota(u) {
    const { owner, repo } = this.card;
    const q1 = `{repository(owner:"${owner}",name:"${repo}"){id issue(number:${u.card}){id} ref(qualifiedName:"refs/heads/${this.est.base}"){target{oid}}}}`;
    const r1 = gh("api", "graphql", "-f", `query=${q1}`);
    if (r1.status !== 0) return log(`createLinkedBranch: leitura falhou (${r1.stderr.trim()}); sigo com git worktree add -b`);
    try {
      const d = JSON.parse(r1.stdout).data.repository;
      const q2 = `mutation{createLinkedBranch(input:{issueId:"${d.issue.id}",repositoryId:"${d.id}",oid:"${d.ref.target.oid}",name:"${u.branch}"}){linkedBranch{ref{name}}}}`;
      const r2 = gh("api", "graphql", "-f", `query=${q2}`);
      if (r2.status !== 0) log(`createLinkedBranch falhou (${r2.stderr.trim()}); sigo com git worktree add -b`);
    } catch (e) {
      log(`createLinkedBranch: resposta ilegível (${e.message}); sigo com git worktree add -b`);
    }
  }

  // Planning dentro do repo e a spec não está na branch → copia spec.md e sensibilidade.json e commita.
  copiarSpec(u, spec) {
    if (!spec || spec.planejamento !== "repo") return;
    const wt = u.worktree;
    const destino = join(wt, "planning", spec.pasta);
    if (existsSync(join(destino, "spec.md"))) return;
    mkdirSync(destino, { recursive: true });
    if (spec.caminho) {
      for (const f of ["spec.md", "sensibilidade.json"]) {
        const de = join(dirname(spec.caminho), f);
        if (existsSync(de)) copyFileSync(de, join(destino, f));
      }
    } else {
      gitOk(wt, "checkout", `origin/${this.est.base}`, "--", `planning/${spec.pasta}`);
    }
    gitOk(wt, "add", "--", `planning/${spec.pasta}`);
    const pai = u.pai ?? u.card;
    gitOk(wt, "commit", "-q", "-m", `docs(planning): spec do #${pai}`, "-m", `Card: #${u.card}`);
  }

  // ─ o laço ─────────────────────────────────────────────────────────────────
  async conduzir() {
    const est = this.est;
    est.pid = process.pid;
    est.terminal = false;
    this.salvar();
    const bateu = setInterval(() => this.salvar(), BATIMENTO_RENOVA_MS);
    log(`condutor ${est.card} (pid ${process.pid}, paralelo ${est.paralelo})`);
    try {
      gitOk(est.checkout, "fetch", "-q", "origin");
      let ctx = this.lerContexto();
      const specN = () => (ctx.epico ? this.card.n : ctx.pai ?? this.card.n);
      let spec = this.localizarSpec(specN());
      if (!spec) {
        // Estação 3: sem spec achada. A sessão `/gm-spec` roda numa worktree destacada à parte.
        if (!(await this.estacaoSpec())) return;
        ctx = this.lerContexto();
        spec = this.localizarSpec(specN());
        if (!spec) return this.parar(this.unidadeRaiz(), "/gm-spec fechou em PROXIMO mas não deixou planning/<n>-*/spec.md");
        if (ctx.epico) {
          const raiz = this.unidadeRaiz();
          raiz.resultado = "pulada";
          raiz.motivo = "épico fatiado em fases";
        }
      }
      if (spec.caminho) est.spec = spec.caminho;
      this.spec = spec;
      this.atualizarUnidades(this.descobrirUnidades(ctx));

      const ativas = est.unidades.filter((u) => !FINAIS.has(u.resultado));
      await Promise.all(ativas.map((u) => this.conduzirUnidade(u)));
    } catch (e) {
      log(`erro do condutor: ${e.stack || e.message}`);
      for (const u of est.unidades) if (!FINAIS.has(u.resultado)) this.parar(u, `erro do condutor: ${e.message}`);
    } finally {
      clearInterval(bateu);
      this.fim();
    }
  }

  parar(u, motivo) {
    u.resultado = "parada";
    u.motivo = motivo;
    log(`unidade #${u.card} parou em ${u.estacao || "—"}: ${motivo}`);
    this.salvar();
  }

  async conduzirUnidade(u) {
    try {
      const trava = this.tomarTrava(u.card);
      if (!trava.ok) {
        u.resultado = "pulada";
        u.motivo = `conduzida por ${trava.dono}`;
        this.salvar();
        return;
      }
      if (!u.branch) {
        u.branch = this.branchDaUnidade(u, this.spec);
        if (!u.branch) return this.parar(u, "branch da unidade não declarada");
        u.worktree = this.worktreeDe(u, u.branch);
      }
      this.prepararWorktree(u, this.spec);
      this.salvar();
      await this.avaliarUnidade(u);
    } catch (e) {
      this.parar(u, e instanceof Parada ? e.message : `erro: ${e.message}`);
    }
  }

  // ─ sessão filha ──────────────────────────────────────────────────────────
  // Molde fixo: nada de freio, trailer nem suíte — isso mora no `## Modo despachado` das skills e no CLAUDE.md.
  montarPrompt({ skill, arg, u, cwd, branchTxt, spec, task }) {
    const fase = u.pai ? `, fase do épico #${u.pai}` : "";
    const linhas = [
      `/gm-${skill} ${arg}`,
      "",
      "Argumento do despacho (gerado pelo /gm-frente; o card é o da primeira linha):",
      `- Card ${this.card.repoCompleto}#${u.card}${fase}. Spec: ${spec}.`,
      `- Onde trabalhar: ${cwd}, branch ${branchTxt}, base ${this.est.base}.${task ? ` Task: ${task} — só ela.` : ""}`,
      "- Outras sessões desta frente correm ao mesmo tempo em worktrees irmãs: não toque nelas nem no checkout principal.",
      `- Não há humano nesta sessão. ${this.entrega}`,
    ];
    return linhas.join("\n") + "\n";
  }

  caminhoSpec(u) {
    if (!this.spec) return "ainda não escrita (esta sessão a escreve)";
    return this.spec.planejamento === "repo" ? join(u.worktree, "planning", this.spec.pasta, "spec.md") : this.spec.caminho;
  }

  // Abre uma sessão filha e espera o fim. Devolve {tipo: "PROXIMO"|"PARADA"|"erro", motivo, linha}.
  // `via`: "ship" segura também o semáforo do /gm-ship (um por repo).
  async sessao(u, { estacao, skill, arg, cwd, branchTxt, task, taskId, via }) {
    const prefixo = `${u.card}-${estacao}${taskId ? `-t${taskId}` : ""}`;
    const k = u.sessoes.filter((x) => x.id.startsWith(`${prefixo}-`) && /^\d+$/.test(x.id.slice(prefixo.length + 1))).length + 1;
    const id = `${prefixo}-${k}`;
    const prompt = this.montarPrompt({ skill, arg, u, cwd, branchTxt, spec: this.caminhoSpec(u), task });
    writeFileSync(join(this.dir, `prompt-${id}.txt`), prompt);

    if (via === "ship") await this.ship.adquirir();
    await this.slots.adquirir();
    try {
      const saida = openSync(join(this.dir, `saida-${id}.json`), "w");
      const erro = openSync(join(this.dir, `erro-${id}.txt`), "w");
      const args = ["-p", prompt, "--permission-mode", "auto", "--permission-prompts", "none", "--add-dir", this.dir, "--output-format", "json"];
      const filho = spawn("claude", args, { cwd, detached: true, stdio: ["ignore", saida, erro] });
      closeSync(saida);
      closeSync(erro);
      const reg = { id, pid: filho.pid, estacao, task: taskId ?? null, inicio: agora(), fim: null };
      u.sessoes.push(reg);
      this.salvar();
      log(`#${u.card} abriu ${id} (pid ${filho.pid}): /gm-${skill} ${arg}`);

      const limiteMs = this.est.limiteMin * 60 * 1000;
      let estourou = false;
      let falhou = null;
      const terminou = new Promise((resolver) => {
        filho.on("exit", resolver);
        filho.on("error", (e) => {
          falhou = e;
          resolver();
        });
      });
      let segundo = null;
      const timer = setTimeout(() => {
        estourou = true;
        matarGrupo(filho.pid, "SIGTERM");
        segundo = setTimeout(() => matarGrupo(filho.pid, "SIGKILL"), 30_000);
      }, limiteMs);
      await terminou;
      clearTimeout(timer);
      if (segundo) clearTimeout(segundo);
      reg.fim = agora();
      this.salvar();
      if (falhou) return { tipo: "erro", motivo: `não consegui abrir o claude (${falhou.code || falhou.message})` };
      if (estourou) return { tipo: "erro", motivo: `sessão excedeu ${this.est.limiteMin} min` };
      return this.julgar(id);
    } finally {
      this.slots.liberar();
      if (via === "ship") this.ship.liberar();
    }
  }

  // Julgamento pela saída, nunca pelo código de saída (uma sessão adotada na retomada não é filha deste condutor).
  julgar(id) {
    const arq = join(this.dir, `saida-${id}.json`);
    const semLinha = (quê) => ({ tipo: "erro", motivo: `saída sem linha de despacho (${quê})` });
    if (!existsSync(arq)) return semLinha("arquivo de saída ausente");
    let j;
    try {
      j = JSON.parse(readFileSync(arq, "utf8"));
    } catch {
      return semLinha("JSON ilegível");
    }
    if (j.is_error) return semLinha(`is_error verdadeiro${j.subtype ? `: ${j.subtype}` : ""}`);
    const ultima = String(j.result ?? "").split("\n").map((l) => l.trim()).filter(Boolean).pop() || "";
    const m = /^(PROXIMO|PARADA): (.+)$/.exec(ultima);
    if (!m) return semLinha(`última linha: «${ultima.slice(0, 80)}»`);
    return { tipo: m[1], motivo: m[2], linha: ultima };
  }

  // Retomada: sessão sem `fim` no estado. Com `pid` vivo, espera (até o limite contado do `inicio`);
  // terminada, julga pela saída; sem saída nenhuma, a sessão se perdeu e a avaliação segue pelos artefatos.
  async adotar(u, filtro = () => true) {
    for (const s of u.sessoes.filter((x) => !x.fim && filtro(x))) {
      const limite = s.inicio + this.est.limiteMin * 60 * 1000;
      let estourou = false;
      while (pidVivo(s.pid)) {
        if (agora() > limite) {
          estourou = true;
          matarGrupo(s.pid, "SIGTERM");
          await dormir(1000);
          if (pidVivo(s.pid)) matarGrupo(s.pid, "SIGKILL");
          break;
        }
        await dormir(500);
      }
      s.fim = agora();
      this.salvar();
      if (estourou) return { tipo: "erro", motivo: `sessão excedeu ${this.est.limiteMin} min` };
      if (existsSync(join(this.dir, `saida-${s.id}.json`)) && readFileSync(join(this.dir, `saida-${s.id}.json`), "utf8").trim()) return this.julgar(s.id);
    }
    return null;
  }

  // PROXIMO segue; PARADA e erro param a unidade, a não ser que a PR já esteja mergeada (o /gm-ship --merge
  // fecha em PARADA depois do merge, e aí a unidade está concluída).
  tratar(u, res) {
    if (res.tipo === "PROXIMO") return false;
    const pr = this.buscarPr(u);
    if (pr?.state === "MERGED") {
      this.concluir(u, pr);
      return true;
    }
    this.parar(u, res.tipo === "PARADA" ? res.motivo : res.motivo);
    return true;
  }
  concluir(u, pr) {
    u.pr = pr.number;
    u.estacao = "concluida";
    u.resultado = "concluida";
    u.motivo = null;
    log(`unidade #${u.card} concluída (PR #${pr.number} mergeada)`);
    this.salvar();
  }

  buscarPr(u) {
    const lista = ghJson("pr", "list", "--repo", this.card.repoCompleto, "--head", u.branch, "--state", "all", "--json", "number,state,url,mergedAt") || [];
    const pr = lista.find((p) => p.state === "MERGED") || lista.find((p) => p.state === "OPEN") || null;
    if (pr) u.pr = pr.number;
    return pr;
  }

  // Espera de CI: quem espera é o condutor, nunca uma sessão filha.
  async esperarCi(u, pr) {
    const passo = Number(process.env.GM_FRENTE_CI_POLL_MS) || 60_000;
    const teto = Number(process.env.GM_FRENTE_CI_MAX_MS) || 60 * 60_000;
    const inicio = agora();
    for (;;) {
      const r = gh("pr", "checks", String(pr.number), "--repo", this.card.repoCompleto, "--json", "bucket");
      let buckets = null;
      try {
        buckets = JSON.parse(r.stdout).map((b) => b.bucket);
      } catch {}
      if (buckets === null) {
        log(`#${u.card} sem leitura dos checks da PR #${pr.number} (${(r.stderr || "").trim().slice(0, 80)}); abro o --merge mesmo assim`);
        return;
      }
      if (!buckets.includes("pending")) return;
      if (agora() - inicio > teto) {
        log(`#${u.card} CI ainda pendente depois de ${Math.round(teto / 60000)} min; abro o --merge mesmo assim`);
        return;
      }
      u.estacao = "espera-ci";
      this.salvar();
      await dormir(passo);
    }
  }

  // ─ tasks da unidade ───────────────────────────────────────────────────────
  pastaTasks(u) {
    const base = this.spec.planejamento === "repo" ? join(u.worktree, "planning", this.spec.pasta) : dirname(this.spec.caminho);
    const candidatas = u.fase ? [join(base, "tasks", u.fase), join(base, "tasks")] : [join(base, "tasks")];
    const tem = (d) => existsSync(d) && readdirSync(d).some((n) => /^\d+[a-z]*-.*\.md$/.test(n));
    return candidatas.find(tem) || candidatas[0];
  }
  argTask(u, arquivo) {
    return this.spec.planejamento === "repo" ? relative(u.worktree, arquivo).split(sep).join("/") : arquivo;
  }
  pastaDePlanning() {
    return this.spec.pasta;
  }

  // ─ a avaliação ────────────────────────────────────────────────────────────
  // Estações, de cima para baixo a cada volta; a primeira que casa vale. Retomar é avaliar de novo.
  async avaliarUnidade(u) {
    const pasta = this.pastaDePlanning();
    const guardas = { plan: 0, ship: 0, merge: 0 };
    const sessaoDe = (estacao, skill, arg, extra = {}) =>
      this.sessao(u, { estacao, skill, arg, cwd: u.worktree, branchTxt: u.branch, ...extra });
    for (;;) {
      // Sessões de task são adotadas por task, dentro da onda; as demais, aqui.
      const adotada = await this.adotar(u, (x) => x.estacao !== "implement");
      if (adotada && this.tratar(u, adotada)) return;

      // 1 e 2: a PR da branch
      const pr = this.buscarPr(u);
      if (pr?.state === "MERGED") return this.concluir(u, pr);
      if (pr?.state === "OPEN") {
        if (++guardas.merge > 3) return this.parar(u, `a PR #${pr.number} não foi mergeada depois de 3 passadas do /gm-ship --merge`);
        await this.esperarCi(u, pr);
        u.estacao = "ship-merge";
        this.salvar();
        const res = await sessaoDe("ship-merge", "ship", `${pasta} --card ${u.card} --merge`, { via: "ship" });
        if (this.tratar(u, res)) return;
        continue;
      }

      // 4: spec e nenhuma task na worktree
      const dirTasks = this.pastaTasks(u);
      let tasks = existsSync(dirTasks) ? lerPasta(dirTasks) : [];
      if (tasks.length === 0) {
        if (++guardas.plan > 1) return this.parar(u, "o /gm-plan-tasks fechou em PROXIMO mas não escreveu nenhuma task");
        u.estacao = "plan-tasks";
        this.salvar();
        const res = await sessaoDe("plan-tasks", "plan-tasks", `${pasta} --card ${u.card}`);
        if (this.tratar(u, res)) return;
        this.commitarTasks(u, dirTasks);
        continue;
      }

      // 5: tasks com ❌ → as ondas
      const plano = validarOndas(tasks);
      if (!plano.ok) return this.parar(u, `plano de tasks inválido: ${plano.erros.join("; ")}`);
      const pendente = (id) => tasks.find((t) => t.id === id)?.status === "pendente";
      const onda = plano.ondas.find((o) => o.some(pendente));
      if (onda) {
        u.estacao = "implement";
        this.salvar();
        const ids = onda.filter(pendente);
        if (await this.executarOnda(u, pasta, tasks, ids, plano.ondas.indexOf(onda) + 1)) return;
        continue;
      }

      // 6: tudo ✅, sem PR
      if (++guardas.ship > 1) return this.parar(u, "o /gm-ship fechou em PROXIMO mas não há PR aberta da branch");
      u.estacao = "ship";
      this.salvar();
      const res = await sessaoDe("ship", "ship", `${pasta} --card ${u.card}`, { via: "ship" });
      if (this.tratar(u, res)) return;
    }
  }

  // Uma task numa worktree: adota a sessão que ficou de uma rodada anterior, não reabre task que a branch já
  // traz ✅, senão abre a sessão. Devolve {tipo, motivo}.
  async rodarTask(u, pasta, t, { cwd, branch }) {
    const arquivoNaWt = join(cwd, relative(u.worktree, t.arquivo));
    const adotada = await this.adotar(u, (x) => x.task === t.id);
    if (adotada) return adotada;
    if (this.taskFechada(u, t.arquivo, branch === u.branch ? "HEAD" : branch)) {
      return { tipo: "PROXIMO", motivo: "já fechada na branch" };
    }
    const arquivo = this.argTask({ worktree: cwd }, arquivoNaWt);
    return this.sessao(u, {
      estacao: "implement", skill: "implement", arg: `${pasta} --card ${u.card} --branch ${branch} --task ${arquivo}`,
      cwd, branchTxt: branch, task: arquivo, taskId: t.id,
    });
  }

  // A onda: uma task roda na worktree da unidade; duas ou mais, cada uma na sua worktree e branch local
  // (<branch>-t<id>), todas ao mesmo tempo, e depois são juntadas na ordem do número. Devolve true quando a unidade parou.
  async executarOnda(u, pasta, tasks, ids, k) {
    const alvos = ids.map((id) => tasks.find((x) => x.id === id));
    const juntadas = [];
    let motivoParada = null;

    if (alvos.length === 1) {
      const t = alvos[0];
      const res = await this.rodarTask(u, pasta, t, { cwd: u.worktree, branch: u.branch });
      if (res.tipo !== "PROXIMO") motivoParada = res.motivo;
      else if (!this.taskFechada(u, t.arquivo)) motivoParada = `a task ${t.id} fechou em PROXIMO mas não está ✅ no último commit da branch`;
      else juntadas.push(t);
    } else {
      const pasta_t = (t) => ({ branch: `${u.branch}-t${t.id}`, cwd: `${u.worktree}-t${t.id}` });
      for (const t of alvos) {
        const { branch, cwd } = pasta_t(t);
        const listada = gitOk(this.est.checkout, "worktree", "list", "--porcelain").split("\n").includes(`worktree ${cwd}`);
        if (listada && existsSync(cwd)) continue;
        const existe = git(this.est.checkout, "rev-parse", "--verify", "-q", `refs/heads/${branch}`).status === 0;
        if (existe) gitOk(this.est.checkout, "worktree", "add", "-q", cwd, branch);
        else gitOk(this.est.checkout, "worktree", "add", "-q", "-b", branch, cwd, u.branch);
      }
      const resultados = await Promise.all(alvos.map((t) => this.rodarTask(u, pasta, t, pasta_t(t))));
      for (let i = 0; i < alvos.length; i++) {
        const t = alvos[i];
        const { branch, cwd } = pasta_t(t);
        const res = resultados[i];
        if (res.tipo !== "PROXIMO") {
          motivoParada ||= res.motivo;
          continue;
        }
        if (!this.taskFechada(u, t.arquivo, branch)) {
          motivoParada ||= `a task ${t.id} fechou em PROXIMO mas não está ✅ no último commit da branch dela`;
          continue;
        }
        const m = git(u.worktree, "merge", "--no-ff", "--no-edit", "-m", `merge: task ${t.id} da onda ${k}`, "-m", `Card: #${u.card}`, branch);
        if (m.status !== 0) {
          const arquivos = git(u.worktree, "diff", "--name-only", "--diff-filter=U").stdout.trim().split("\n").filter(Boolean).join(", ");
          git(u.worktree, "merge", "--abort");
          motivoParada = `conflito ao juntar a task ${t.id}: ${arquivos || (m.stderr || m.stdout).trim().split("\n")[0]}`;
          break;
        }
        juntadas.push(t);
        const rm = git(this.est.checkout, "worktree", "remove", cwd);
        if (rm.status !== 0) log(`worktree ${cwd} não saiu (${rm.stderr.trim()}); fica`);
        else git(u.worktree, "branch", "-d", branch);
      }
    }

    const erroPush = this.depoisDaOnda(u, juntadas);
    if (motivoParada || erroPush) {
      this.parar(u, motivoParada || erroPush);
      return true;
    }
    return false;
  }

  // Depois da onda: push da branch da unidade e o checkbox de cada task juntada, uma por vez, relendo o
  // comentário antes de cada edição. O modo task não empurra nem marca: é o condutor.
  depoisDaOnda(u, juntadas) {
    if (juntadas.length === 0) return null;
    const p = git(u.worktree, "push", "-q", "origin", u.branch);
    if (p.status !== 0) return `git push da ${u.branch} falhou: ${(p.stderr || p.stdout).trim().split("\n")[0]}`;
    for (const t of juntadas) this.marcarCheckbox(u, t.id);
    return null;
  }
  marcarCheckbox(u, id) {
    const c = this.comentarios(u.card).find((x) => x.body.includes("<!-- gm:tasks -->"));
    if (!c) return log(`#${u.card}: sem comentário gm:tasks para marcar a task ${id}`);
    const corpo = c.body.replace(new RegExp(`^- \\[ \\] ${id} `, "m"), `- [x] ${id} `);
    if (corpo === c.body) return;
    const arq = join(this.dir, `gm-tasks-${u.card}.md`);
    writeFileSync(arq, corpo);
    const r = gh("api", "-X", "PATCH", `repos/${this.card.repoCompleto}/issues/comments/${c.id}`, "-F", `body=@${arq}`);
    if (r.status !== 0) log(`#${u.card}: não consegui marcar a task ${id} (${(r.stderr || "").trim()})`);
  }

  // O ✅ tem de estar no último commit (é o que a junção e a retomada conferem).
  taskFechada(u, arquivoAbs, ref = "HEAD", cwd = u.worktree) {
    const rel = relative(cwd, arquivoAbs).split(sep).join("/");
    const r = git(cwd, "show", `${ref}:${rel}`);
    return r.status === 0 && r.stdout.startsWith("✅");
  }

  commitarTasks(u, dirTasks) {
    if (this.spec.planejamento !== "repo" || !existsSync(dirTasks)) return;
    const rel = relative(u.worktree, dirTasks);
    gitOk(u.worktree, "add", "--", rel);
    if (git(u.worktree, "diff", "--cached", "--quiet", "--", rel).status === 0) return;
    gitOk(u.worktree, "commit", "-q", "-m", `docs(planning): tasks do #${u.card}`, "-m", `Card: #${u.card}`);
  }

  // ─ estação 3: spec ─────────────────────────────────────────────────────────
  unidadeRaiz() {
    let r = this.est.unidades.find((x) => x.card === this.card.n);
    if (!r) {
      r = { card: this.card.n, pai: null, fase: null, specRef: null, branch: null, worktree: null, estacao: "spec", resultado: null, motivo: null, pr: null, sessoes: [] };
      this.est.unidades.push(r);
    }
    return r;
  }

  // `/gm-spec #<n>` numa worktree destacada em origin/<base>; depois a pasta planning/<n>-*/ sai de lá
  // para <pasta de estado>/spec/ e a worktree é removida, limpa. Devolve false quando a frente para.
  async estacaoSpec() {
    const { checkout, base, workspace } = this.est;
    const raiz = this.unidadeRaiz();
    raiz.estacao = "spec";
    this.salvar();
    const wt = join(workspace, `${this.card.repo}-${this.card.n}-spec`);
    gitOk(checkout, "fetch", "-q", "origin");
    const listada = gitOk(checkout, "worktree", "list", "--porcelain").split("\n").some((l) => l === `worktree ${wt}`);
    if (listada && existsSync(wt)) gitOk(wt, "checkout", "-q", "--detach", `origin/${base}`);
    else gitOk(checkout, "worktree", "add", "-q", "--detach", wt, `origin/${base}`);

    const adotada = await this.adotar(raiz);
    const res = adotada || (await this.sessao(raiz, { estacao: "spec", skill: "spec", arg: `#${this.card.n}`, cwd: wt, branchTxt: `origin/${base} (destacada)` }));
    if (res.tipo !== "PROXIMO") {
      this.parar(raiz, res.motivo);
      return false;
    }
    const pasta = readdirSync(join(wt, "planning")).sort().find((n) => n.startsWith(`${this.card.n}-`) && existsSync(join(wt, "planning", n, "spec.md")));
    if (pasta) {
      mkdirSync(join(this.dir, "spec"), { recursive: true });
      const destino = join(this.dir, "spec", pasta);
      rmSync(destino, { recursive: true, force: true });
      renameSync(join(wt, "planning", pasta), destino);
      this.est.spec = join(destino, "spec.md");
      this.salvar();
    }
    const r = git(checkout, "worktree", "remove", wt);
    if (r.status !== 0) log(`worktree ${wt} não saiu (${r.stderr.trim()}); fica`);
    return true;
  }

  fim() {
    const est = this.est;
    const todas = est.unidades.every((u) => FINAIS.has(u.resultado));
    this.soltarTravas();
    if (todas) {
      est.terminal = true;
      est.fim = agora();
    }
    this.salvar();
    const resumo = est.unidades.map((u) => `#${u.card} ${u.resultado || u.estacao}${u.motivo ? ` (${u.motivo})` : ""}`).join("; ");
    log(`fim${todas ? "" : " (há unidades sem decisão)"}: ${resumo}`);
  }
}

function pidVivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}
function matarGrupo(pid, sinal) {
  try {
    process.kill(-pid, sinal);
  } catch {
    try {
      process.kill(pid, sinal);
    } catch {}
  }
}

// Acha planning/<n>-*/spec.md dentro de uma pasta planning.
function achar(planning, n) {
  if (!existsSync(planning)) return null;
  for (const nome of readdirSync(planning).sort()) {
    if (new RegExp(`^${n}-`).test(nome) && existsSync(join(planning, nome, "spec.md"))) return join(planning, nome, "spec.md");
  }
  return null;
}

// ── main ────────────────────────────────────────────────────────────────────
async function principal(argv) {
  const [cmd, ...resto] = argv;
  const o = lerOpcoes(resto);
  if (cmd === "iniciar") return iniciar(o);
  if (cmd === "estado") return estadoCmd(o);
  if (cmd === "conduzir") {
    if (!o.dir || o.dir === true) return erroArg("falta --dir");
    let c;
    try {
      c = new Condutor(o.dir);
    } catch (e) {
      return erroArg(e.message);
    }
    await c.conduzir();
    return 0;
  }
  return erroArg("uso: frente.mjs iniciar|conduzir|estado …");
}

if (process.argv[1] && ESTE_ARQUIVO === resolve(process.argv[1])) {
  principal(process.argv.slice(2)).then((c) => process.exit(c));
}
