#!/usr/bin/env node
// Testa skills/gm-release/trem.mjs sem rede e sem framework (padrão de gm-ship-merge-teste.mjs).
// Repositório temporário com `origin` bare, `main`, `dev` e merges que carregam `**Card:** #n`, e um `gh`
// falso embutido neste arquivo (itens do board e corpos de PR), na frente do PATH. Nada fora de tmp.
// Uso: node scripts/gm-release-trem-teste.mjs
// Sai 0 se todos os cenários passam, 1 se algum falha.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const script = join(aqui, "..", "skills", "gm-release", "trem.mjs");

let falhas = 0;
function afirmar(ok, msg) {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${msg}`);
  if (!ok) falhas++;
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// O `gh` falso: responde `project item-list`, `pr list` e `pr view` a partir do cenário em $GH_FALSO.
const GH_FALSO = `#!/usr/bin/env node
const fs = require("node:fs");
const cenario = JSON.parse(fs.readFileSync(process.env.GH_FALSO, "utf8"));
const args = process.argv.slice(2);
fs.appendFileSync(process.env.GH_FALSO + ".chamadas", args.join(" ") + "\\n");
if (cenario.ghQuebrado) { process.stderr.write("gh: erro de rede\\n"); process.exit(1); }
const [grupo, acao] = args;
if (grupo === "project" && acao === "item-list") { process.stdout.write(JSON.stringify(cenario.board)); process.exit(0); }
if (grupo === "pr" && acao === "list") { process.stdout.write(JSON.stringify(cenario.prs)); process.exit(0); }
if (grupo === "pr" && acao === "view") {
  const pr = cenario.corpos[args[2]];
  if (pr === undefined) { process.stderr.write("PR não encontrada\\n"); process.exit(1); }
  process.stdout.write(JSON.stringify({ body: pr })); process.exit(0);
}
process.stderr.write("gh falso: comando não previsto: " + args.join(" ") + "\\n");
process.exit(64);
`;

const raiz = mkdtempSync(join(tmpdir(), "gm-release-trem-"));
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
  git(raiz, "init", "-q", "--bare", "-b", "main", origin);
  git(raiz, "clone", "-q", origin, clone);
  git(clone, "checkout", "-q", "-b", "main");
  writeFileSync(join(clone, "base.txt"), "base\n");
  git(clone, "add", "-A");
  git(clone, "commit", "-q", "-m", "base");
  git(clone, "push", "-q", "origin", "main");
  git(clone, "checkout", "-q", "-b", "dev");
  git(clone, "push", "-q", "origin", "dev");

  // Uma PR mergeada na dev: branch de feature + `merge --no-ff`, e o oid do merge commit.
  const prs = [];
  const mergear = (numero, corpo) => {
    git(clone, "checkout", "-q", "-b", `pr-${numero}`, "dev");
    writeFileSync(join(clone, `pr-${numero}.txt`), `${numero}\n`);
    git(clone, "add", "-A");
    git(clone, "commit", "-q", "-m", `feature ${numero}`);
    git(clone, "checkout", "-q", "dev");
    git(clone, "merge", "-q", "--no-ff", "-m", `Merge pull request #${numero}`, `pr-${numero}`);
    const oid = git(clone, "rev-parse", "HEAD");
    prs.push({ number: numero, body: corpo, mergeCommit: { oid } });
    return oid;
  };
  const doCard = (n) => `**Card:** #${n}\n\n## Resumo\nx\n`;
  mergear(100, doCard(10));
  mergear(101, doCard(11));
  mergear(102, doCard(12));
  const corte = git(clone, "rev-parse", "HEAD");
  mergear(103, doCard(11)); // segunda PR do card 11, depois do corte
  mergear(104, doCard(13)); // card inteiro depois do corte
  mergear(105, doCard(99)); // PR de card que não está no board: ignorada
  mergear(106, `Resumo.\n\n**Card:** #14\n`); // `**Card:**` fora da primeira linha: não conta
  git(clone, "push", "-q", "origin", "dev");

  const item = (n, status, repo = "o/r") => ({ id: `PVTI_${n}`, status, title: `card ${n}`, content: { type: "Issue", number: n, repository: repo, title: `Card ${n}` } });
  const board = {
    totalCount: 7,
    items: [
      item(13, "🧪 Validação em Dev"),
      item(10, "🚂 Release"),
      item(11, "🧪 Validação em Dev"),
      item(12, "🧪 Validação em Dev"),
      item(14, "🚂 Release"),
      item(15, "✅ Produção"),
      item(16, "🚂 Release", "o/outro"),
    ],
  };
  const arquivo = join(raiz, "cenario.json");
  const rodar = (sub, args, extra = {}) => {
    writeFileSync(arquivo, JSON.stringify({ board, prs, corpos: {}, ...extra }));
    const r = spawnSync(process.execPath, [script, sub, ...args], { cwd: clone, encoding: "utf8", timeout: 60000, env: { PATH: `${bin}:${process.env.PATH}`, HOME: raiz, GH_FALSO: arquivo, ...ambienteGit } });
    const linhas = r.stdout.split("\n").filter((l) => l !== "");
    let saida = null;
    if (linhas.length === 1) { try { saida = JSON.parse(linhas[0]); } catch { /* fica null */ } }
    return { r, saida };
  };
  const baseCards = ["--repo", "o/r", "--project", "2", "--owner", "dono"];
  const numeros = (lista) => lista.map((c) => c.card);

  console.log("cards --corte: no corte × fora");
  {
    const { r, saida } = rodar("cards", [...baseCards, "--corte", corte]);
    afirmar(r.status === 0 && saida !== null, "código 0 e uma linha JSON");
    afirmar(igual(numeros(saida?.no_corte ?? []), [10, 12]), "no_corte: 10 e 12 (todas as PRs são ancestrais do corte), ordenados");
    afirmar(igual(numeros(saida?.fora ?? []), [11, 13, 14]), "fora: 11 (uma PR depois do corte), 13 (inteiro depois), 14 (sem PR com Card na 1ª linha)");
    const f = Object.fromEntries((saida?.fora ?? []).map((c) => [c.card, c]));
    afirmar(f[11]?.motivo.includes("#103") && igual(f[11].prs, [101, 103]), "11: o motivo nomeia a PR #103 e prs lista as duas");
    afirmar(f[14]?.prs.length === 0 && f[14].motivo.includes("nenhuma PR"), "14: sem PR → motivo `nenhuma PR mergeada…`");
    afirmar(igual(saida?.no_corte[0].prs, [100]) && saida.no_corte[0].status === "🚂 Release" && saida.no_corte[0].titulo === "Card 10", "ficha do card: prs, status e título");
    const todos = [...numeros(saida?.no_corte ?? []), ...numeros(saida?.fora ?? [])];
    afirmar(!todos.includes(15) && !todos.includes(16) && !todos.includes(99), "✅ Produção, card de outro repo e PR de card fora do board não entram");
    const chamadas = readFileSync(arquivo + ".chamadas", "utf8");
    afirmar(chamadas.includes("pr list --repo o/r --base dev --state merged") && chamadas.includes("project item-list 2 --owner dono"), "o gh recebe repo, base dev, project e owner explícitos");
  }

  console.log("cards --main: mede contra origin/main");
  {
    let r = rodar("cards", [...baseCards, "--main"]);
    afirmar(r.saida && r.saida.no_corte.length === 0 && igual(numeros(r.saida.fora), [10, 11, 12, 13, 14]), "antes de juntar: nada está na main, tudo fora");
    // O trem entra na main: o corte é o que sobe.
    git(clone, "checkout", "-q", "main");
    git(clone, "merge", "-q", "--no-ff", "-m", "trem", corte);
    git(clone, "push", "-q", "origin", "main");
    r = rodar("cards", [...baseCards, "--main"]);
    afirmar(igual(numeros(r.saida?.no_corte ?? []), [10, 12]) && igual(numeros(r.saida?.fora ?? []), [11, 13, 14]), "depois de juntar o corte na main: 10 e 12 dentro, os outros seguem fora");
    git(clone, "checkout", "-q", "dev");
    const c = rodar("cards", [...baseCards, "--corte", corte]);
    afirmar(igual(numeros(c.saida?.no_corte ?? []), numeros(r.saida?.no_corte ?? [])) && igual(numeros(c.saida?.fora ?? []), numeros(r.saida?.fora ?? [])), "--corte e --main dão o mesmo veredito quando a main é o corte");
  }

  console.log("itens: [comando], [humano] e item sem prefixo");
  {
    const corpo = [
      "**Card:** #10", "", "## Resumo", "- [ ] [comando] `fora da seção` → 0", "",
      "## Validação em dev",
      "[checklist: cada item começa por [comando] ou [humano]]",
      "- [ ] [comando] `node scripts/x.mjs` → código 0",
      "- [x] [comando] `npm run smoke -- --rapido` → saída termina em `ok`",
      "- [ ] [humano] Abrir o painel e conferir a barra de saúde (quem valida: Leonardo)",
      "- [ ] Conferir a mensagem de ajuda no terminal",
      "- [ ] [comando] rodar o smoke sem crase → 0",
      "texto solto que não é item",
      "", "## Contexto para revisão", "- [ ] [humano] também fora da seção",
    ].join("\n");
    const { r, saida } = rodar("itens", ["--repo", "o/r", "--pr", "100"], { corpos: { 100: corpo } });
    afirmar(r.status === 0 && saida?.itens.length === 5, "cinco itens, só os da seção `## Validação em dev`");
    const [a, b, c, d, e] = saida?.itens ?? [];
    afirmar(a?.tipo === "comando" && a.comando === "node scripts/x.mjs" && a.esperado === "código 0", "[comando] com crase e seta → comando e esperado");
    afirmar(b?.tipo === "comando" && b.comando === "npm run smoke -- --rapido" && b.esperado === "saída termina em `ok`", "item já marcado [x] também vale; esperado guarda o resto");
    afirmar(c?.tipo === "humano" && c.texto.startsWith("Abrir o painel") && c.comando === null, "[humano] → tipo humano, texto sem o prefixo");
    afirmar(d?.tipo === "humano" && d.texto === "Conferir a mensagem de ajuda no terminal", "item sem prefixo → humano");
    afirmar(e?.tipo === "humano" && e.comando === null && e.texto.includes("sem crase"), "[comando] sem crase não é rodado: vai para o humano");
    const vazio = rodar("itens", ["--repo", "o/r", "--pr", "101"], { corpos: { 101: "**Card:** #10\n\n## Resumo\nx\n" } });
    afirmar(vazio.r.status === 0 && igual(vazio.saida, { itens: [] }), "PR sem a seção → itens vazio, código 0");
    const crlf = rodar("itens", ["--repo", "o/r", "--pr", "102"], { corpos: { 102: "## Validação em dev\r\n- [ ] [comando] `x` → 0\r\n" } });
    afirmar(crlf.saida?.itens[0]?.comando === "x" && crlf.saida.itens[0].esperado === "0", "corpo com CRLF lê igual");
  }

  console.log("só leitura");
  {
    const refs = () => git(clone, "for-each-ref", "--format=%(refname) %(objectname)", "refs/heads").split("\n").join();
    const antes = { refs: refs(), status: git(clone, "status", "--porcelain") };
    rodar("cards", [...baseCards, "--corte", corte]);
    afirmar(refs() === antes.refs && git(clone, "status", "--porcelain") === antes.status, "refs locais e árvore ficam como estavam");
    const verbos = readFileSync(arquivo + ".chamadas", "utf8").split("\n").filter(Boolean).map((l) => l.split(" ").slice(0, 2).join(" "));
    afirmar(verbos.every((v) => ["project item-list", "pr list", "pr view"].includes(v)), "o gh só recebe item-list, pr list e pr view");
  }

  console.log("código 2: argumento e leitura");
  {
    const casos = [
      ["subcomando desconhecido", "apagar", []],
      ["sem subcomando", undefined, []],
      ["cards sem --corte nem --main", "cards", baseCards],
      ["cards com --corte e --main", "cards", [...baseCards, "--corte", corte, "--main"]],
      ["cards sem --owner", "cards", ["--repo", "o/r", "--project", "2", "--corte", corte]],
      ["--project abc", "cards", ["--repo", "o/r", "--project", "abc", "--owner", "d", "--corte", corte]],
      ["--repo sem barra", "cards", ["--repo", "r", "--project", "2", "--owner", "d", "--corte", corte]],
      ["--corte repetido", "cards", [...baseCards, "--corte", corte, "--corte", corte]],
      ["itens sem --pr", "itens", ["--repo", "o/r"]],
      ["itens --pr abc", "itens", ["--repo", "o/r", "--pr", "abc"]],
      ["argumento a mais", "itens", ["--repo", "o/r", "--pr", "1", "--x"]],
    ];
    for (const [rotulo, sub, args] of casos) {
      const { r } = rodar(sub ?? "", args);
      afirmar(r.status === 2 && r.stdout === "" && r.stderr.startsWith("trem.mjs: "), `${rotulo} → código 2, stdout vazio`);
    }
    let r = rodar("cards", [...baseCards, "--corte", corte], { ghQuebrado: true }).r;
    afirmar(r.status === 2 && r.stderr.includes("falhou"), "gh que falha → código 2 com a causa");
    r = rodar("cards", [...baseCards, "--corte", corte], { board: { ...board, totalCount: 900 } }).r;
    afirmar(r.status === 2 && r.stderr.includes("leitura parcial"), "board com mais itens do que vieram → código 2 (leitura parcial), não um trem pela metade");
    r = rodar("cards", [...baseCards, "--corte", "0".repeat(40)]).r;
    afirmar(r.status === 2 && r.stderr.includes("git merge-base"), "corte que não existe → código 2");
    r = rodar("itens", ["--repo", "o/r", "--pr", "999"]).r;
    afirmar(r.status === 2 && r.stderr.includes("gh pr view falhou"), "PR que o gh não acha → código 2");
  }
} finally {
  rmSync(raiz, { recursive: true, force: true });
}

console.log(falhas === 0 ? "\ntudo certo" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
