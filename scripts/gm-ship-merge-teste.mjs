#!/usr/bin/env node
// Testa skills/gm-ship/merge-dev.mjs sem rede e sem framework (padrão de gm-spec-sensivel-teste.mjs).
// Repositório temporário com um `origin` bare, e um `gh` falso embutido neste arquivo, na frente do PATH:
// nunca o `gh` de verdade, e nada fora de diretório temporário.
// Uso: node scripts/gm-ship-merge-teste.mjs
// Sai 0 se todos os cenários passam, 1 se algum falha.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const script = join(aqui, "..", "skills", "gm-ship", "merge-dev.mjs");

let falhas = 0;
function afirmar(ok, msg) {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${msg}`);
  if (!ok) falhas++;
}

// O `gh` falso: lê o cenário de $GH_FALSO (JSON) e responde só `pr view` e `pr checks`, como o real:
// `pr checks` sai com 8 se algum pending e 1 se algum fail, e imprime o JSON do mesmo jeito.
const GH_FALSO = `#!/usr/bin/env node
const fs = require("node:fs");
const cenario = JSON.parse(fs.readFileSync(process.env.GH_FALSO, "utf8"));
fs.appendFileSync(process.env.GH_FALSO + ".chamadas", process.argv.slice(2).join(" ") + "\\n");
const [grupo, acao] = process.argv.slice(2);
if (cenario.ghQuebrado) { process.stderr.write("gh: erro de rede\\n"); process.exit(1); }
if (grupo === "pr" && acao === "view") { process.stdout.write(JSON.stringify(cenario.pr)); process.exit(0); }
if (grupo === "pr" && acao === "checks") {
  process.stdout.write(JSON.stringify(cenario.checks));
  const b = cenario.checks.map((c) => c.bucket);
  process.exit(b.includes("fail") || b.includes("cancel") ? 1 : b.includes("pending") ? 8 : 0);
}
process.stderr.write("gh falso: comando não previsto: " + process.argv.slice(2).join(" ") + "\\n");
process.exit(64);
`;

let head2; // o head da feature depois de juntar a dev
const raiz = mkdtempSync(join(tmpdir(), "gm-ship-merge-"));
try {
  const bin = join(raiz, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "gh"), GH_FALSO);
  chmodSync(join(bin, "gh"), 0o755);

  const ambienteGit = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
  const git = (cwd, ...args) => {
    const r = spawnSync("git", args, { cwd, encoding: "utf8", env: { PATH: process.env.PATH, HOME: raiz, ...ambienteGit } });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const origin = join(raiz, "origin.git");
  const clone = join(raiz, "clone");
  git(raiz, "init", "-q", "--bare", "-b", "dev", origin);
  git(raiz, "clone", "-q", origin, clone);
  const commitar = (arquivo, texto) => {
    writeFileSync(join(clone, arquivo), texto);
    git(clone, "add", "-A");
    git(clone, "commit", "-q", "-m", arquivo);
    return git(clone, "rev-parse", "HEAD");
  };
  git(clone, "checkout", "-q", "-b", "dev");
  commitar("base.txt", "base\n");
  git(clone, "push", "-q", "origin", "dev");
  git(clone, "checkout", "-q", "-b", "feat/81-x");
  const head = commitar("feature.txt", "feature\n");
  git(clone, "push", "-q", "origin", "feat/81-x");

  // A spec e o registro, ao lado, no repositório temporário.
  const pasta = join(clone, "planning", "x");
  mkdirSync(pasta, { recursive: true });
  const spec = join(pasta, "spec.md");
  const registro = join(pasta, "sensibilidade.json");
  const textoSpec = "# Spec\n\n## Execution\n- Repo: x\n- Base branch: dev\n\n## Fases\n";
  const comMotivo = "# Spec\n\n## Execution\n- Repo: x\n- Motivo da base: depende do #70, que ainda não entrou na dev\n\n## Fases\n";
  const vazia = { dado: [], faturamento: [], deploy: [], migration: [] };
  const gravarSpec = (texto, uniao = vazia) => {
    writeFileSync(spec, texto);
    writeFileSync(registro, JSON.stringify({ rodadas: [{ sha256: createHash("sha256").update(texto).digest("hex") }], uniao }));
  };
  gravarSpec(textoSpec);

  const g4Corpo = ({ headFinal = head, portao = head, tabela = [["achado 1", "a.mjs:3", `corrigido em ${head.slice(0, 7)}`], ["achado 2", "b.mjs:9", "refutado: já coberto pelo teste 4"]] } = {}) =>
    ["<!-- gm:g4 -->", `Head revisado: ${head}`, `Head final: ${headFinal}`, `Portão local: verde em ${portao} (\`node x.mjs\` → 0)`, "",
      "| achado | arquivo:linha | tratamento |", "|---|---|---|", ...tabela.map((l) => `| ${l.join(" | ")} |`)].join("\n");

  const cenarioBase = () => ({
    pr: { state: "OPEN", baseRefName: "dev", mergeable: "MERGEABLE", headRefOid: head, comments: [{ body: "um comentário qualquer" }, { body: g4Corpo() }] },
    checks: [{ bucket: "pass" }, { bucket: "skipping" }],
  });
  const arquivoCenario = join(raiz, "cenario.json");
  const rodar = (cenario, { ci = "sim", argumentos } = {}) => {
    writeFileSync(arquivoCenario, JSON.stringify(cenario));
    const args = argumentos ?? ["--repo", "o/r", "--pr", "7", "--spec", spec, "--base", "dev", "--ci", ci];
    const r = spawnSync(process.execPath, [script, ...args], { cwd: clone, encoding: "utf8", timeout: 60000, env: { PATH: `${bin}:${process.env.PATH}`, HOME: raiz, GH_FALSO: arquivoCenario, ...ambienteGit } });
    const linhas = r.stdout.split("\n").filter((l) => l !== "");
    let saida = null;
    if (linhas.length === 1) { try { saida = JSON.parse(linhas[0]); } catch { /* fica null */ } }
    return { r, saida };
  };
  const mudar = (fn, ci) => { const c = cenarioBase(); fn(c); return rodar(c, { ci }); };
  const comentarioG4 = (c, opcoes) => { c.pr.comments = [{ body: g4Corpo(opcoes) }]; };

  console.log("R3.1: as seis condições verdes → pode, acao merge");
  {
    const { r, saida } = rodar(cenarioBase());
    afirmar(r.status === 0 && saida?.pode === true && saida.acao === "merge" && saida.head === head, "CI verde, atualizada, G4 tratado, spec limpa → pode true, merge, head do gh");
    afirmar(saida && Object.values(saida.condicoes).every((v) => v === true) && Object.keys(saida.condicoes).join() === "base,mergeavel,atualizada,ci,g4,sensivel" && saida.falhas.length === 0, "as seis condições true e nenhuma falha");
    const sem = rodar(cenarioBase(), { ci: "nao" });
    afirmar(sem.saida?.pode === true && sem.saida.acao === "merge", "--ci nao com o Portão local verde no head atual → pode");
    const chamadas = readFileSync(arquivoCenario + ".chamadas", "utf8");
    afirmar(chamadas.includes("pr view 7 --repo o/r") && chamadas.includes("pr checks 7 --repo o/r"), "o gh recebe --repo explícito");
  }

  console.log("R3.2: base de outro card");
  {
    let { saida } = mudar((c) => { c.pr.baseRefName = "feat/70-outro"; });
    afirmar(saida?.pode === false && saida.condicoes.base === false && saida.acao === "parar" && saida.falhas.some((f) => f.startsWith("base:")), "base de outro card, sem Motivo da base → parar");
    gravarSpec(comMotivo);
    ({ saida } = mudar((c) => { c.pr.baseRefName = "feat/70-outro"; }));
    afirmar(saida?.condicoes.base === true, "base de outro card com `Motivo da base:` no ## Execution → base true");
    // Fora do ## Execution a linha não vale.
    gravarSpec("# Spec\n\n## Execution\n- Repo: x\n\n## Notas\n- Motivo da base: aqui não vale\n");
    ({ saida } = mudar((c) => { c.pr.baseRefName = "feat/70-outro"; }));
    afirmar(saida?.condicoes.base === false, "`Motivo da base:` fora do ## Execution não vale");
    gravarSpec("# Spec\n\n## Execution\n- Motivo da base:   \n");
    ({ saida } = mudar((c) => { c.pr.baseRefName = "feat/70-outro"; }));
    afirmar(saida?.condicoes.base === false, "`Motivo da base:` vazio não vale");
    gravarSpec(textoSpec);
    ({ saida } = mudar((c) => { c.pr.state = "MERGED"; }));
    afirmar(saida?.condicoes.base === false && saida.acao === "parar", "PR que não está aberta → base false, parar");
  }

  console.log("mergeável");
  {
    const { saida } = mudar((c) => { c.pr.mergeable = "CONFLICTING"; });
    afirmar(saida?.condicoes.mergeavel === false && saida.acao === "parar", "CONFLICTING → parar");
    const u = mudar((c) => { c.pr.mergeable = "UNKNOWN"; }).saida;
    afirmar(u?.condicoes.mergeavel === false, "UNKNOWN não é mergeável");
  }

  console.log("atualizada: origin/<base> é ancestral do head");
  {
    // A dev avança na origin (por um segundo clone), sem a feature.
    const outro = join(raiz, "outro");
    git(raiz, "clone", "-q", "-b", "dev", origin, outro);
    writeFileSync(join(outro, "novo.txt"), "novo\n");
    git(outro, "add", "-A");
    git(outro, "commit", "-q", "-m", "dev avançou");
    git(outro, "push", "-q", "origin", "dev");
    const { r, saida } = rodar(cenarioBase());
    afirmar(r.status === 0 && saida?.pode === false && saida.condicoes.atualizada === false && saida.acao === "atualizar", "dev avançou → atualizada false, acao atualizar");
    afirmar(saida?.condicoes.ci === true && saida.condicoes.g4 === true, "as outras seguem true");
    // Atualizar tem de ganhar de esperar-ci: o head vai mudar e o CI recomeça.
    const pend = mudar((c) => { c.checks = [{ bucket: "pending" }]; }).saida;
    afirmar(pend?.acao === "atualizar", "desatualizada e com CI pendente → atualizar vem antes de esperar-ci");
    // Sensível ganha de atualizar: atualizar não conserta.
    gravarSpec(textoSpec, { ...vazia, dado: ["autor"] });
    const sens = rodar(cenarioBase()).saida;
    afirmar(sens?.acao === "parar", "desatualizada e sensível → parar");
    gravarSpec(textoSpec);
    // Atualiza o clone: a feature passa a conter a dev e o head novo é o do gh.
    git(clone, "fetch", "-q", "origin");
    git(clone, "merge", "-q", "--no-edit", "origin/dev");
    git(clone, "push", "-q", "origin", "feat/81-x");
    const novoHead = git(clone, "rev-parse", "HEAD");
    const c = cenarioBase();
    c.pr.headRefOid = novoHead;
    c.pr.comments = [{ body: g4Corpo({ headFinal: novoHead, portao: novoHead, tabela: [] }) }];
    const depois = rodar(c).saida;
    afirmar(depois?.pode === true && depois.condicoes.atualizada === true && depois.head === novoHead, "depois de juntar a dev → atualizada true, pode true (G4 sem achados)");
    // Daqui para a frente, o head da feature é o novo.
    head2 = novoHead;
  }

  console.log("ci sim: pending espera, fail para");
  {
    let { saida } = mudar((c) => { c.checks = [{ bucket: "pass" }, { bucket: "pending" }]; c.pr.headRefOid = head2; comentarioG4(c, { headFinal: head2, portao: head2 }); });
    afirmar(saida?.pode === false && saida.acao === "esperar-ci" && saida.condicoes.ci === false, "algum pending → esperar-ci");
    for (const ruim of ["fail", "cancel"]) {
      ({ saida } = mudar((c) => { c.checks = [{ bucket: "pass" }, { bucket: ruim }]; c.pr.headRefOid = head2; comentarioG4(c, { headFinal: head2, portao: head2 }); }));
      afirmar(saida?.acao === "parar" && saida.falhas.some((f) => f.includes(ruim)), `um check em ${ruim} → parar`);
    }
    ({ saida } = mudar((c) => { c.checks = [{ bucket: "pending" }, { bucket: "fail" }]; c.pr.headRefOid = head2; comentarioG4(c, { headFinal: head2, portao: head2 }); }));
    afirmar(saida?.acao === "parar", "pending e fail juntos → parar (esperar não conserta)");
    ({ saida } = mudar((c) => { c.checks = []; c.pr.headRefOid = head2; comentarioG4(c, { headFinal: head2, portao: head2 }); }));
    afirmar(saida?.acao === "esperar-ci", "ainda sem nenhum check → esperar-ci");
  }

  console.log("ci nao: o Portão local do gm:g4 no head atual");
  {
    const doHead = (c, opcoes) => { c.pr.headRefOid = head2; comentarioG4(c, { headFinal: head2, portao: head2, ...opcoes }); };
    let { saida } = mudar((c) => { doHead(c); c.checks = [{ bucket: "fail" }]; }, "nao");
    afirmar(saida?.pode === true, "sem CI, o gh checks nem é lido: portão verde no head atual → pode");
    afirmar(!readFileSync(arquivoCenario + ".chamadas", "utf8").split("\n").at(-2).includes("checks"), "--ci nao não chama gh pr checks");
    ({ saida } = mudar((c) => { doHead(c, { portao: head }); }, "nao"));
    afirmar(saida?.pode === false && saida.condicoes.ci === false && saida.acao === "parar", "Portão local verde em head antigo → ci false, parar");
    ({ saida } = mudar((c) => { c.pr.headRefOid = head2; c.pr.comments = [{ body: "<!-- gm:g4 -->\nHead final: " + head2 + "\n" }]; }, "nao"));
    afirmar(saida?.condicoes.ci === false, "gm:g4 sem a linha do Portão local → ci false");
  }

  console.log("g4: existe, todo achado tratado, Head final = head");
  {
    const doHead = (c, opcoes) => { c.pr.headRefOid = head2; comentarioG4(c, { headFinal: head2, portao: head2, ...opcoes }); };
    let { saida } = mudar((c) => { c.pr.headRefOid = head2; c.pr.comments = []; });
    afirmar(saida?.condicoes.g4 === false && saida.acao === "parar" && saida.falhas.some((f) => f.includes("não tem comentário gm:g4")), "sem comentário gm:g4 → parar");
    ({ saida } = mudar((c) => doHead(c, { tabela: [["achado 1", "a.mjs:3", "corrigido em abc1234"], ["achado 2", "b.mjs:9", "pendente"]] })));
    afirmar(saida?.condicoes.g4 === false && saida.falhas.some((f) => f.includes("achado 2")), "achado com tratamento `pendente` → g4 false, nomeia o achado");
    ({ saida } = mudar((c) => doHead(c, { tabela: [["achado 1", "a.mjs:3", "refutado:"]] })));
    afirmar(saida?.condicoes.g4 === false, "`refutado:` sem o porquê não é tratamento");
    ({ saida } = mudar((c) => doHead(c, { tabela: [["achado 1", "a.mjs:3", "corrigido em abc1234: reconstruído o arquivo"]] })));
    afirmar(saida?.condicoes.g4 === true, "`corrigido em <sha>: <nota>` é tratamento (a célula começa por ele)");
    ({ saida } = mudar((c) => doHead(c, { tabela: [["achado 1", "a.mjs:3", "corrigido em abc1234xyz"]] })));
    afirmar(saida?.condicoes.g4 === false, "`corrigido em` com sha colado em lixo não é tratamento");
    ({ saida } = mudar((c) => doHead(c, { tabela: [["achado 1", "a.mjs:3", ""]] })));
    afirmar(saida?.condicoes.g4 === false, "tratamento vazio → g4 false");
    ({ saida } = mudar((c) => doHead(c, { headFinal: head })));
    afirmar(saida?.condicoes.g4 === false && saida.acao === "parar" && saida.falhas.some((f) => f.includes("Head final")), "Head final ≠ head atual → g4 false");
    ({ saida } = mudar((c) => { doHead(c); c.pr.comments.unshift({ body: g4Corpo({ tabela: [["achado velho", "a.mjs:1", "pendente"]] }) }); }));
    afirmar(saida?.condicoes.g4 === true, "com dois gm:g4, vale o último");
    ({ saida } = mudar((c) => { doHead(c); c.pr.comments.push({ body: "outro comentário depois" }); }));
    afirmar(saida?.condicoes.g4 === true, "comentário comum depois do gm:g4 não atrapalha");
    ({ saida } = mudar((c) => doHead(c, { headFinal: head2.slice(0, 7) })));
    afirmar(saida?.condicoes.g4 === true, "Head final abreviado (7+) casa com o head completo");
  }

  console.log("sensivel: sensivel.mjs --consultar");
  {
    const doHead = (c) => { c.pr.headRefOid = head2; comentarioG4(c, { headFinal: head2, portao: head2 }); };
    gravarSpec(textoSpec, { ...vazia, dado: ["autor"], deploy: ["jev-indisponivel"] });
    let { saida } = mudar(doHead);
    afirmar(saida?.pode === false && saida.condicoes.sensivel === false && saida.acao === "parar" && saida.falhas.some((f) => f.includes("união não vazia: dado, deploy")), "união não vazia → sensivel false, parar, com o motivo");
    rmSync(registro);
    ({ saida } = mudar(doHead));
    afirmar(saida?.condicoes.sensivel === false && saida.falhas.some((f) => f.includes("sem registro")), "sem sensibilidade.json → sensível (`sem registro`)");
    gravarSpec(textoSpec);
    writeFileSync(spec, textoSpec + "emenda\n");
    ({ saida } = mudar(doHead));
    afirmar(saida?.condicoes.sensivel === false && saida.falhas.some((f) => f.includes("spec mudou")), "spec editada depois da classificação → sensível");
    gravarSpec(textoSpec);
  }

  console.log("só leitura");
  {
    const status = () => git(clone, "status", "--porcelain");
    const refs = () => git(clone, "for-each-ref", "--format=%(refname) %(objectname)");
    gravarSpec(textoSpec);
    git(clone, "add", "-A");
    git(clone, "commit", "-q", "-m", "spec limpa");
    const antes = { status: status(), refs: refs(), registro: readFileSync(registro, "utf8") };
    const c = cenarioBase();
    c.pr.headRefOid = head2;
    comentarioG4(c, { headFinal: head2, portao: head2 });
    rodar(c);
    afirmar(status() === antes.status && refs().split("\n").filter((l) => !l.includes("refs/remotes/")).join() === antes.refs.split("\n").filter((l) => !l.includes("refs/remotes/")).join(), "a árvore e as refs locais ficam como estavam");
    afirmar(readFileSync(registro, "utf8") === antes.registro, "o registro da spec não é reescrito");
    const verbos = readFileSync(arquivoCenario + ".chamadas", "utf8").split("\n").filter(Boolean).map((l) => l.split(" ").slice(0, 2).join(" "));
    afirmar(verbos.every((v) => v === "pr view" || v === "pr checks"), "o gh só recebe pr view e pr checks");
  }

  console.log("código 2: argumento e leitura");
  {
    const ok = ["--repo", "o/r", "--pr", "7", "--spec", spec, "--base", "dev", "--ci", "sim"];
    const sem = (nome) => { const i = ok.indexOf(nome); return [...ok.slice(0, i), ...ok.slice(i + 2)]; };
    for (const [rotulo, argumentos] of [
      ["sem --repo", sem("--repo")],
      ["sem --ci", sem("--ci")],
      ["--ci talvez", [...sem("--ci"), "--ci", "talvez"]],
      ["--pr abc", [...sem("--pr"), "--pr", "abc"]],
      ["--repo sem barra", [...sem("--repo"), "--repo", "repo"]],
      ["argumento a mais", [...ok, "--merge"]],
      ["--base repetido", [...ok, "--base", "main"]],
      ["spec que não existe", [...sem("--spec"), "--spec", join(pasta, "nao", "spec.md")]],
      ["spec com outro nome", [...sem("--spec"), "--spec", registro]],
    ]) {
      const { r } = rodar(cenarioBase(), { argumentos });
      afirmar(r.status === 2 && r.stdout === "" && r.stderr.startsWith("merge-dev.mjs: "), `${rotulo} → código 2, stdout vazio`);
    }
    const quebrado = { ...cenarioBase(), ghQuebrado: true };
    const { r } = rodar(quebrado);
    afirmar(r.status === 2 && r.stderr.includes("gh pr view falhou"), "gh que falha → código 2 com a causa");
  }
} finally {
  rmSync(raiz, { recursive: true, force: true });
}

console.log(falhas === 0 ? "\ntudo certo" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
